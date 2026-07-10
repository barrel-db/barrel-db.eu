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

# The barrel facade's siblings are not on Hex yet, so resolve them locally.
mkdir -p "$BARREL_DIR/apps/barrel/_checkouts"
for dep in barrel_crypto barrel_docdb barrel_vectordb barrel_embed; do
    ln -sfn "../../$dep" "$BARREL_DIR/apps/barrel/_checkouts/$dep"
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
