#!/usr/bin/env bash
#
# Put the built site online at barrel-db.eu.
#
#   scripts/deploy.sh               # build from main, upload, swap in
#   scripts/deploy.sh --no-build    # upload the dist/ you already have
#   scripts/deploy.sh --rollback    # put the previous version back
#
# The site is unpacked next to the live one on the server and then swapped
# in, so visitors never see a half-copied site. The previous version stays
# in <root>.prev for --rollback. .well-known/ is carried over: the web root
# is also where Let's Encrypt writes its challenge files.
#
# Settings, from the environment:
#   DEPLOY_HOST   ssh destination        (default freebsd@barrel-db.eu)
#   DEPLOY_ROOT   web root on the host   (default /var/www/barrel-db.eu)
#   DEPLOY_SUDO   how to become root     (default sudo; doas, or empty when
#                                         DEPLOY_HOST logs in as root)
#   BARREL_DIR    barrel checkout used by the build (default ../barrel)

set -euo pipefail

HOST=${DEPLOY_HOST:-freebsd@barrel-db.eu}
ROOT=${DEPLOY_ROOT:-/var/www/barrel-db.eu}
SUDO=${DEPLOY_SUDO-sudo}
SITE=$(cd "$(dirname "$0")/.." && pwd)
BUILD=1
ROLLBACK=0

for arg in "$@"; do
  case $arg in
    --no-build) BUILD=0 ;;
    --rollback) ROLLBACK=1 ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (see --help)" >&2; exit 2 ;;
  esac
done

# The steps that run on the server, as root. POSIX sh: the host is FreeBSD.
# shellcheck disable=SC2016  # expanded by the remote sh, not here
remote_install='
set -eu
root=$1; tarball=$PWD/$2
new=$root.new; prev=$root.prev
rm -rf "$new"; mkdir "$new"
tar xzf "$tarball" -C "$new" --no-xattrs --no-acls --no-fflags
test -f "$new/index.html" || { echo "no index.html in $tarball" >&2; exit 1; }
[ -d "$root/.well-known" ] && cp -Rp "$root/.well-known" "$new/"
chmod -R a+rX "$new"
rm -rf "$prev"
[ -d "$root" ] && mv "$root" "$prev"
mv "$new" "$root"
rm -f "$tarball"
echo "live: $root (previous version in $prev)"
'

# shellcheck disable=SC2016
remote_rollback='
set -eu
root=$1; prev=$root.prev
test -d "$prev" || { echo "no previous version in $prev" >&2; exit 1; }
mv "$root" "$root.rollback"
mv "$prev" "$root"
mv "$root.rollback" "$prev"
echo "live: the previous version (the one replaced is now in $prev)"
'

# Run one of the steps above on the host as root. The step goes up as a
# file and runs under sh, whatever the account's login shell.
run_remote() {
  local step=$1; shift
  local file
  file=$(mktemp -t barrel-deploy)
  printf '%s\n' "$step" > "$file"
  scp -q "$file" "$HOST:barrel-deploy-step.sh"
  rm -f "$file"
  ssh -t "$HOST" "$SUDO sh barrel-deploy-step.sh $*; rm -f barrel-deploy-step.sh"
}

if [ "$ROLLBACK" = 1 ]; then
  run_remote "$remote_rollback" "$ROOT"
  exit 0
fi

cd "$SITE"

if [ "$BUILD" = 1 ]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  [ "$branch" = main ] || { echo "on $branch: deploy from main (or pass --no-build)" >&2; exit 1; }
  [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "uncommitted changes; commit or stash them first" >&2; exit 1; }
  git fetch -q origin main
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main differs from origin/main; pull or push first" >&2; exit 1; }
  export BARREL_DIR=${BARREL_DIR:-$SITE/../barrel}
  npm ci
  npm run build
  npm run check:site
fi

[ -f dist/index.html ] || { echo "dist/index.html missing: build first" >&2; exit 1; }

sha=$(git rev-parse --short HEAD)
tarball=barrel-db.eu-$sha.tar.gz
# no macOS ._ files and no extended attributes (com.apple.provenance),
# which the server's tar cannot restore
case "$(tar --version 2>/dev/null)" in
    *bsdtar*) TAR_FLAGS="--no-xattrs --no-acls --no-mac-metadata" ;;
    *)        TAR_FLAGS="--no-xattrs --no-acls" ;;
esac
# shellcheck disable=SC2086  # flags are words
COPYFILE_DISABLE=1 tar $TAR_FLAGS -czf "$tarball" -C dist .
echo "uploading $tarball ($(du -h "$tarball" | cut -f1)) to $HOST"
scp -q "$tarball" "$HOST:"
run_remote "$remote_install" "$ROOT" "$tarball"
rm -f "$tarball"
