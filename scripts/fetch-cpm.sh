#!/usr/bin/env bash
# Put CPM.cmake where CMake looks first, so building rocksdb (its CRoaring
# dependency fetches CPM.cmake at configure time) does not depend on GitHub's
# release download, which answers 504 at times.
#
#   CPM_SOURCE_CACHE=$HOME/.cache/cpm scripts/fetch-cpm.sh [version]
#
# Tries the release file, then the same file from the tagged source with its
# version line set, as the release does.

set -euo pipefail
VERSION="${1:-0.42.0}"
CACHE="${CPM_SOURCE_CACHE:?set CPM_SOURCE_CACHE}"
DEST="$CACHE/cpm/CPM_${VERSION}.cmake"
mkdir -p "$(dirname "$DEST")"
[ -s "$DEST" ] && { echo "CPM.cmake $VERSION already in $DEST"; exit 0; }

if curl -fsSL --retry 3 --retry-delay 5 -o "$DEST.tmp" \
     "https://github.com/cpm-cmake/CPM.cmake/releases/download/v${VERSION}/CPM.cmake"; then
  mv "$DEST.tmp" "$DEST"
else
  curl -fsSL --retry 3 --retry-delay 5 -o "$DEST.tmp" \
    "https://raw.githubusercontent.com/cpm-cmake/CPM.cmake/v${VERSION}/cmake/CPM.cmake"
  sed "s/1\.0\.0-development-version/${VERSION}/" "$DEST.tmp" > "$DEST"
  rm -f "$DEST.tmp"
fi
grep -q "CURRENT_CPM_VERSION ${VERSION}" "$DEST" || { echo "unexpected CPM.cmake content"; exit 1; }
echo "CPM.cmake $VERSION in $DEST"
