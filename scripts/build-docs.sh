#!/bin/bash
# Build all documentation sites for docs.barrel-db.eu

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/docs-dist"

echo "Building documentation to $OUTPUT_DIR"

# Clean output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build barrel_vectordb docs
echo "Building barrel_vectordb docs..."
cd "$PROJECT_DIR/../barrel_vectordb"
mkdocs build --site-dir "$OUTPUT_DIR/vectordb"

# Build barrel_docdb docs
echo "Building barrel_docdb docs..."
cd "$PROJECT_DIR/../barrel_docdb"
mkdocs build --site-dir "$OUTPUT_DIR/docdb"

# Build barrel_embed docs
echo "Building barrel_embed docs..."
cd "$PROJECT_DIR/../barrel_embed"
mkdocs build --site-dir "$OUTPUT_DIR/embed"

# Create root index redirect
cat > "$OUTPUT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Barrel DB Documentation</title>
    <meta http-equiv="refresh" content="0; url=/vectordb/">
</head>
<body>
    <p>Redirecting to <a href="/vectordb/">Barrel Vector documentation</a>...</p>
</body>
</html>
EOF

echo "Done! Documentation built to $OUTPUT_DIR"
echo ""
echo "Projects:"
echo "  - $OUTPUT_DIR/vectordb/"
echo "  - $OUTPUT_DIR/docdb/"
echo "  - $OUTPUT_DIR/embed/"
