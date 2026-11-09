#!/bin/sh
# Type-check, then run main.ts against BARREL_URL
# (default http://localhost:8080). barrel-lite must be installed:
#   npm install /path/to/barrel/clients/barrel-lite
set -e
cd "$(dirname "$0")"
[ -d node_modules/barrel-lite ] || {
  echo "install barrel-lite first (see README)" >&2; exit 1; }
npx tsc --noEmit >&2
exec node --experimental-strip-types --no-warnings main.ts
