#!/bin/bash
# Build the per-library reference sites for docs.barrel-db.eu.
#
# Each site is ex_doc output for one app of the barrel umbrella: the guides
# checked into the app, plus an API reference generated from its modules.
#
# Point BARREL_DIR at the umbrella checkout (defaults to ../barrel).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/docs-dist"
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

# Root redirect: barrel is the product, the rest are its pieces.
cat > "$OUTPUT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Barrel documentation</title>
    <meta http-equiv="refresh" content="0; url=/barrel/">
</head>
<body>
    <p>Redirecting to the <a href="/barrel/">Barrel API reference</a>.</p>
</body>
</html>
EOF

echo "Done. Sites:"
for site in $SITES; do
    echo "  $OUTPUT_DIR/${site%%:*}/"
done
