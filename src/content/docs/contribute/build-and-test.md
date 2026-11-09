---
title: Build and test
description: Build the Barrel umbrella with rebar3 and its profiles, run the eunit and Common Test suites, the end-to-end scripts and the package check, as CI does.
---

This page shows how to build the barrel umbrella and run its tests the way CI does. Read it before you open a pull request, or when you need to run one suite against a change.

## Requirements

- Erlang/OTP 26 or later. CI runs OTP 28 (OTP 29 for barrel_embed alone).
- rebar3, CMake, a C and C++ compiler, and the compression libraries RocksDB links: on Debian, `cmake build-essential libssl-dev zlib1g-dev libsnappy-dev liblz4-dev libzstd-dev`.
- Python 3 with `venv`, for the embedding and reranking tests that start a model.
- Docker with the Compose plugin, for the end-to-end scripts only.

```shell
git clone https://github.com/barrel-db/barrel.git
cd barrel
rebar3 compile
```

## Build profiles

The default build has barrel_crypto, barrel_docdb, barrel_ngram, barrel_vectordb, barrel_embed, barrel_rerank, barrel and barrel_spaces. The other apps come with a profile:

| Profile | Adds | Command |
|---|---|---|
| `server` | barrel_server and its HTTP stack | `rebar3 as server compile` |
| `s3` | barrel_att_s3 | `rebar3 as s3 compile` |
| `faiss` | barrel_faiss (needs the FAISS library, OpenMP, BLAS) | `rebar3 as faiss compile` |
| `s3_server` | barrel_server and barrel_att_s3 together | `rebar3 as s3_server compile` |
| `prod` | a release that includes ERTS | `rebar3 as server,prod release -n barrel_server` |
| `test` | meck, for the suites | `rebar3 as test ...` |

Start a shell with the server running:

```shell
rebar3 as server shell
```

## Run the tests

The umbrella job in CI runs these, in this order:

```shell
rebar3 compile
rebar3 as test eunit --app barrel,barrel_crypto,barrel_docdb,barrel_ngram,barrel_vectordb,barrel_rerank
rebar3 as test eunit --module=barrel_embed_tests,barrel_embed_provider_tests,barrel_embed_request_tests,barrel_embed_pool_tests
rebar3 as test ct
```

`test/ct.sys.config` sets `{barrel_embed, [{managed_venv, false}]}`, so the suites never create a Python venv or download a model. The other barrel_embed test modules need Python or a running Ollama, and CI leaves them out.

Run one suite, or one case:

```shell
rebar3 as test ct --suite apps/barrel_docdb/test/barrel_rep_SUITE
rebar3 as test ct --suite apps/barrel_docdb/test/barrel_rep_SUITE \
  --case <case_name>
```

The server suites (REST, sync, auth, spaces, MCP, timeline, encryption) run under their profile:

```shell
rebar3 as server compile
rebar3 as server ct
```

The optional backends:

```shell
rebar3 as faiss ct --suite apps/barrel_faiss/test/barrel_faiss_SUITE

eval "$(test/e2e/attachments-s3-setup.sh)"
rebar3 as s3 ct --suite apps/barrel_att_s3/test/barrel_att_s3_SUITE
```

The S3 setup script starts RustFS and Garage in Docker and prints the variables the suite reads.

## Test one library on its own

CI also builds and tests each library alone, to catch a dependency on a sibling that its `rebar.config` does not declare. barrel_docdb needs barrel_crypto in `_checkouts` for that:

```shell
cd apps/barrel_docdb
mkdir -p _checkouts
ln -s ../../barrel_crypto _checkouts/barrel_crypto
rebar3 compile
rebar3 xref
rebar3 eunit
```

barrel_crypto, barrel_ngram, barrel_rerank and barrel_embed need no checkouts.

## Static checks

```shell
rebar3 xref
rebar3 dialyzer
```

Both are configured at the umbrella root; run them from there.

## End-to-end scripts

The scripts under `test/e2e/` build the barrel_server release in Docker and run several peers as separate processes: `replication.sh`, `active-active.sh`, `mixed-version.sh`, `crash.sh`, `power-fail.sh` (needs privileged containers for FUSE) and `attachments-s3.sh`. Each exits 0 when every assertion passed and tears its containers down.

```shell
test/e2e/replication.sh
```

The first run builds the image and takes a few minutes. See [End-to-end tests](/docs/contribute/end-to-end-tests) for what each script checks.

## Check a package before publishing

`scripts/check_package.sh` builds an app's docs against the sibling apps in the repository, then its Hex package with dependencies from Hex, the way `rebar3 hex publish` does. Run it for every app you change before you publish:

```shell
scripts/check_package.sh barrel_docdb
```

A sibling version that is not on Hex yet is reported as a warning: publish the sibling first. CI runs this for every published app except barrel_faiss.

## barrel-lite

```shell
cd clients/barrel-lite
npm ci
npm run typecheck
npm run build
npm test
```

`npm run test:integration` boots a real barrel_server on port 18080, so build the `server` profile first. `npm run test:browser` runs the Playwright specs.

## Notes

- Do not retry or allowlist a flaky test: reproduce it under stress, then fix the code or make the test deterministic.
