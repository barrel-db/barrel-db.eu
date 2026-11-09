#!/bin/sh
# Build, then run main/0 once on a fresh data directory.
#   EMBEDDER=hash (default) | ollama   RERANK=1 RERANK_VENV=<dir>
set -e
cd "$(dirname "$0")"
rebar3 compile >&2
rm -rf data
exec erl -noshell -config config/sys \
  -pa _build/default/lib/*/ebin _build/default/checkouts/*/ebin \
  -eval 'private_rag:main()'
