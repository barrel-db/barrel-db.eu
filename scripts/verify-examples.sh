#!/usr/bin/env bash
#
# Run every example under examples/ and diff its output against the
# expected.txt next to it. Exits non-zero on any difference.
#
#   scripts/verify-examples.sh               # all examples
#   scripts/verify-examples.sh mcp-session   # some of them
#
# Each example is copied to a temporary directory and run there, so the
# site tree stays clean. Erlang examples build against the barrel
# checkout: the umbrella apps they use are copied into _checkouts (the
# way scripts/check_package.sh does in the barrel repository), and the
# other dependencies come from Hex.
#
# Examples that talk to a server (mcp-session, local-first) get one
# barrel_server, built from the checkout with `rebar3 as server
# compile`, started on VERIFY_PORT and stopped at the end.
#
# Both outputs pass through the same normalization (revisions, ids,
# tokens, timestamps, plus the example's own normalize.sed if any)
# before they are compared.
#
# Env: BARREL_DIR (default ../barrel), VERIFY_PORT (default 18480),
#      KEEP_WORK=1 to keep the temporary directory.
#
# The first build of rocksdb downloads CPM.cmake from GitHub; set
# CPM_SOURCE_CACHE to a directory holding cpm/CPM_<version>.cmake to
# build without that download.

set -uo pipefail

SITE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BARREL_DIR="$(cd "${BARREL_DIR:-$SITE/../barrel}" 2>/dev/null && pwd)" \
    || { echo "no barrel checkout: set BARREL_DIR"; exit 2; }
PORT="${VERIFY_PORT:-18480}"
EXAMPLES="$SITE/examples"
SERVER_EXAMPLES="mcp-session local-first"

WORK="$(mktemp -d)"
SERVER_PID=""
cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null
        wait "$SERVER_PID" 2>/dev/null
    fi
    if [ "${KEEP_WORK:-0}" = 1 ]; then
        echo "work dir kept: $WORK"
    else
        rm -rf "$WORK"
    fi
}
trap cleanup EXIT

normalize() {  # normalize <file> [extra sed file]
    local extra=()
    [ -n "${2:-}" ] && [ -f "$2" ] && extra=(-f "$2")
    sed -E \
        -e 's/[0-9a-f]{24}@w[0-9a-f]{16}/<rev>/g' \
        -e 's/bsp_[a-z2-7]{16}_[a-z2-7]{40}/<token>/g' \
        -e 's/(sp|ses|ho|pin)_[a-z2-7]{16}/\1_<id>/g' \
        -e 's/grant:[a-z2-7]{16}/grant:<id>/g' \
        -e 's/(ctx|ws)_[a-z2-7]{24}/\1_<id>/g' \
        -e 's/wslice_[a-z2-7]{8}_[a-z2-7]{8}/wslice_<id>/g' \
        -e 's/mcp_[0-9a-f]{32}/mcp_<id>/g' \
        -e 's/\{timestamp,[0-9]+,[0-9]+\}/{timestamp,<hlc>}/g' \
        -e 's/(^|[^0-9])1[0-9]{12}([^0-9]|$)/\1<ms>\2/g' \
        -e 's/<[0-9]+\.[0-9]+\.[0-9]+>/<pid>/g' \
        -e 's/#Ref<[0-9.]+>/#Ref<>/g' \
        "${extra[@]}" "$1"
}

# In-repo apps an Erlang example depends on, directly or through
# another in-repo app.
siblings() {
    python3 -I - "$BARREL_DIR" "$1" <<'EOF'
import os, re, sys
root, config = sys.argv[1], sys.argv[2]
def deps(path):
    t = re.sub(r"^\s*%.*$", "", open(path).read(), flags=re.M)
    m = re.search(r"^\{deps,\s*\[(.*?)\]\}\s*\.", t, re.S | re.M)
    names = re.findall(r"\{\s*([a-z_][a-z_0-9]*)\s*,", m.group(1)) if m else []
    return [n for n in names
            if os.path.isfile(os.path.join(root, "apps", n, "rebar.config"))]
seen, todo = set(), deps(config)
while todo:
    n = todo.pop()
    if n not in seen:
        seen.add(n)
        todo += deps(os.path.join(root, "apps", n, "rebar.config"))
print(" ".join(sorted(seen)))
EOF
}

copy_tree() {  # copy_tree <src> <dest>: sources only, no build output
    mkdir -p "$2"
    tar -C "$1" --exclude=_build --exclude=_checkouts --exclude=data \
        --exclude=node_modules --exclude=rebar.lock --exclude=doc \
        -cf - . | tar -C "$2" -xf -
}

# Built Hex dependencies are shared between examples so rocksdb and
# the other NIFs compile once per run (see run_one).
DEPS_CACHE="$WORK/deps-cache"
mkdir -p "$DEPS_CACHE"

prepare_erlang() {  # prepare_erlang <dir>
    local dir=$1 s
    for s in $(siblings "$dir/rebar.config"); do
        copy_tree "$BARREL_DIR/apps/$s" "$dir/_checkouts/$s"
    done
    mkdir -p "$dir/_build/default/lib"
    for s in "$DEPS_CACHE"/*; do
        [ -d "$s" ] && cp -R "$s" "$dir/_build/default/lib/"
    done
}

save_deps() {  # save_deps <dir>: keep built Hex deps for the next one
    local dir=$1 d name app
    app="$(basename "$(ls "$dir"/src/*.app.src)" .app.src)"
    for d in "$dir"/_build/default/lib/*; do
        name="$(basename "$d")"
        [ "$name" = "$app" ] && continue
        [ -d "$dir/_checkouts/$name" ] && continue
        [ -d "$DEPS_CACHE/$name" ] || cp -R "$d" "$DEPS_CACHE/"
    done
}

start_server() {
    echo "--- building barrel_server in $BARREL_DIR"
    (cd "$BARREL_DIR" && rebar3 as server compile) >"$WORK/server-build.log" 2>&1 \
        || { cat "$WORK/server-build.log"; return 1; }
    mkdir -p "$WORK/server/data"
    cat > "$WORK/server/sys.config" <<EOF
[{barrel_server, [{http_port, $PORT},
                  {data_dir, "$WORK/server/data"},
                  {cors, #{origins => '*'}}]},
 {barrel_ngram, [{data_dir, "$WORK/server/ngram"}]},
 {kernel, [{logger_level, warning}]}].
EOF
    (cd "$WORK/server" && exec erl -noshell -noinput -config "$WORK/server/sys" \
        -pa "$BARREL_DIR"/_build/server/lib/*/ebin \
        -eval 'application:ensure_all_started(barrel_server).') \
        >"$WORK/server.log" 2>&1 &
    SERVER_PID=$!
    local i
    for i in $(seq 1 120); do
        curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && return 0
        kill -0 "$SERVER_PID" 2>/dev/null || break
        sleep 0.5
    done
    echo "barrel_server did not start; log:"
    cat "$WORK/server.log"
    return 1
}

# barrel-lite is not on npm: build it from the checkout into the work
# directory and install it as a local package.
LITE_PKG=""
build_lite() {
    local src="$BARREL_DIR/clients/barrel-lite"
    LITE_PKG="$WORK/barrel-lite"
    copy_tree "$src" "$LITE_PKG"
    rm -rf "$LITE_PKG/dist" "$LITE_PKG/test-results"
    (cd "$LITE_PKG" && npm ci --ignore-scripts --no-audit --no-fund \
        && npm run build) >"$WORK/lite-build.log" 2>&1 \
        || { cat "$WORK/lite-build.log"; return 1; }
}

run_one() {  # run_one <slug>; prints the result line
    # Every example runs at the same path: CMake caches in the shared
    # Hex dependency builds hold absolute paths. The run is moved to
    # run/<slug> afterwards, for inspection with KEEP_WORK=1.
    local slug=$1 src="$EXAMPLES/$1" dir="$WORK/ex"
    rm -rf "$dir"
    copy_tree "$src" "$dir"
    run_in "$slug" "$src" "$dir"
    local code=$?
    mkdir -p "$WORK/run"
    mv "$dir" "$WORK/run/$slug"
    return $code
}

run_in() {
    local slug=$1 src=$2 dir=$3
    if [ -f "$dir/rebar.config" ]; then
        prepare_erlang "$dir"
    fi
    if [ -f "$dir/package.json" ]; then
        (cd "$dir" && npm install --no-audit --no-fund --no-save \
            "$LITE_PKG") >"$dir/npm.log" 2>&1 \
            || { cat "$dir/npm.log"; return 1; }
    fi
    local start=$SECONDS
    (cd "$dir" && BARREL_URL="http://127.0.0.1:$PORT" ./run.sh) \
        >"$dir/actual.txt" 2>"$dir/stderr.log"
    local code=$?
    # A failed build must not seed the next examples.
    [ $code -eq 0 ] && [ -f "$dir/rebar.config" ] && save_deps "$dir"
    if [ $code -ne 0 ]; then
        echo "FAIL $slug: run.sh exited $code ($((SECONDS - start)) s)"
        tail -n 40 "$dir/stderr.log"
        return 1
    fi
    normalize "$src/expected.txt" "$src/normalize.sed" >"$dir/expected.norm"
    normalize "$dir/actual.txt" "$src/normalize.sed" >"$dir/actual.norm"
    if diff -u "$dir/expected.norm" "$dir/actual.norm" >"$dir/diff.txt"; then
        echo "ok   $slug ($((SECONDS - start)) s)"
    else
        echo "FAIL $slug: output differs from expected.txt"
        cat "$dir/diff.txt"
        return 1
    fi
}

if [ $# -gt 0 ]; then
    SLUGS="$*"
else
    SLUGS="$(cd "$EXAMPLES" && ls -d */ | tr -d / | sort)"
fi

needs_server=0
needs_lite=0
for s in $SLUGS; do
    [ -d "$EXAMPLES/$s" ] || { echo "no example $s"; exit 2; }
    case " $SERVER_EXAMPLES " in *" $s "*) needs_server=1 ;; esac
    [ -f "$EXAMPLES/$s/package.json" ] && needs_lite=1
done

if [ $needs_server = 1 ]; then start_server || exit 1; fi
if [ $needs_lite = 1 ]; then build_lite || exit 1; fi

failed=0
passed=0
results=()
for s in $SLUGS; do
    if run_one "$s"; then
        passed=$((passed + 1)); results+=("ok   $s")
    else
        failed=$((failed + 1)); results+=("FAIL $s")
    fi
done

echo
echo "--- summary (barrel at $BARREL_DIR, $(git -C "$BARREL_DIR" rev-parse --short HEAD 2>/dev/null))"
printf '%s\n' "${results[@]}"
echo "passed: $passed, failed: $failed"
[ $failed -eq 0 ]
