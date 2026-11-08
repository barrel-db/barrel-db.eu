#!/bin/sh
# Build, then run two separate nodes on the same data directory:
# the first writes the memory, the second recalls it.
set -e
cd "$(dirname "$0")"
rebar3 compile >&2
rm -rf data
for phase in write recall; do
  erl -noshell -config config/sys \
    -pa _build/default/lib/*/ebin _build/default/checkouts/*/ebin \
    -eval "agent_memory:main($phase)"
done
