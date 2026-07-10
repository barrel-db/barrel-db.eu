#!/bin/bash
# Build the per-library reference sites into the Astro site, at /docs/lib/<name>/.
#
# Each site is ex_doc output for one app of the barrel umbrella: the guides
# checked into the app, plus an API reference generated from its modules. The
# output lands in public/, so `astro build` copies it into dist/ and one deploy
# serves the guides and the reference from the same origin.
#
# Run this before `astro build`; `npm run build` does it for you.
#
# Point BARREL_DIR at the umbrella checkout (defaults to ../barrel).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR/public/docs/lib}"
BARREL_DIR="${BARREL_DIR:-$PROJECT_DIR/../barrel}"

if [ ! -d "$BARREL_DIR/apps" ]; then
    echo "error: no barrel umbrella at $BARREL_DIR (set BARREL_DIR)" >&2
    exit 1
fi

# <url path>:<umbrella app>
#
# barrel_faiss is not built here: it links against a system FAISS build.
# Its reference ships on HexDocs.
SITES="
barrel:barrel
docdb:barrel_docdb
vectordb:barrel_vectordb
embed:barrel_embed
server:barrel_server
spaces:barrel_spaces
rerank:barrel_rerank
crypto:barrel_crypto
"

echo "Building documentation to $OUTPUT_DIR"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# The umbrella apps depend on each other and none are on Hex yet, so an app
# built on its own must resolve its siblings through _checkouts. rebar reads
# _checkouts only from the app being built (not from a checkout's own
# _checkouts), so each app needs its FULL transitive sibling closure, listed
# explicitly. The closures must be acyclic in build order: an app never lists a
# sibling that (transitively) depends back on it, or rebar cannot order the
# compile and a behaviour module can compile before the behaviour it implements.
# Only the apps whose default profile has a compile-time sibling dependency need
# checkouts: barrel implements a barrel_vectordb behaviour and pulls the whole
# library layer; docdb and vectordb call barrel_crypto. barrel_spaces and
# barrel_server keep their siblings in a `hex' profile, so their default (ex_doc)
# build documents their own modules without pulling anything.
checkouts_for() {  # checkouts_for <app> -> its transitive umbrella siblings
    case "$1" in
        barrel_docdb|barrel_vectordb) echo "barrel_crypto" ;;
        barrel) echo "barrel_crypto barrel_docdb barrel_vectordb barrel_embed" ;;
        *)      echo "" ;;
    esac
}

for app in barrel barrel_docdb barrel_vectordb; do
    co="$BARREL_DIR/apps/$app/_checkouts"
    rm -rf "$co"; mkdir -p "$co"
    for dep in $(checkouts_for "$app"); do
        ln -sfn "../../$dep" "$co/$dep"
    done
done

# ex_doc resolves extras and the logo relative to the working directory, so
# each app is built from its own directory.
for site in $SITES; do
    path="${site%%:*}"
    app="${site##*:}"
    echo "Building $app -> $path/"
    (cd "$BARREL_DIR/apps/$app" && rebar3 ex_doc --output "$OUTPUT_DIR/$path")
done

# /docs/lib/ itself is not a site; send it to the page that lists them.
# data-pagefind-ignore keeps this stub out of the search index.
cat > "$OUTPUT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Barrel library reference</title>
    <meta http-equiv="refresh" content="0; url=/docs/reference/libraries">
</head>
<body data-pagefind-ignore>
    <p>Redirecting to the <a href="/docs/reference/libraries">library reference</a>.</p>
</body>
</html>
EOF

echo "Done. Sites:"
for site in $SITES; do
    echo "  /docs/lib/${site%%:*}/"
done
