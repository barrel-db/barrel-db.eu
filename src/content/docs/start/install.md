---
title: Install
description: Add Barrel to an Erlang project from Hex, build the server from the umbrella, or build barrel-lite for the browser.
---

This page tells you what to install for each way of running Barrel: the
`barrel` library from Hex for an Erlang application, the umbrella build for
`barrel_server`, and a local build of `barrel-lite` for the browser. Read it
before a quickstart if your machine has never built Barrel.

## Requirements

- Erlang/OTP 26 or later, and rebar3.
- CMake and a C/C++ compiler. RocksDB, the vector store and the ngram
  index build native code.
- For the server from source: git.
- For the browser client: Node.js 20 or later and npm.
- Optional, for local embeddings: Python 3 (the `local` provider) or a
  running [Ollama](https://ollama.com). See [Choose an embedding
  provider](/docs/search/embedding-providers).

## Add barrel to an Erlang project

Every library is on Hex. Add `barrel` to `rebar.config`:

```erlang
{deps, [{barrel, "~> 1.12"}]}.
```

Add it to your application's `applications` list in `src/*.app.src`, then
fetch and build:

```shell
rebar3 compile
```

Add a library on its own when you need only that part, for example
`{barrel_docdb, "~> 2.1"}` for documents and replication without vectors,
or `{barrel_ngram, "~> 0.11"}` for substring search.

Set where data goes, in `config/sys.config`:

```erlang
[{barrel_docdb, [{data_dir, "data/docdb"}]}].
```

The default is `data/barrel_docdb`, relative to the current directory.

## Build the server from the umbrella

`barrel_server` is behind the `server` profile of the umbrella. It is not
in the default build.

```shell
git clone https://github.com/barrel-db/barrel.git
cd barrel
rebar3 as server compile
```

To build a release instead:

```shell
rebar3 as server,prod release -n barrel_server
```

[Quickstart: server](/docs/start/quickstart-server) starts it.

## Optional parts

| Part | How |
|------|-----|
| FAISS vector backend | `rebar3 as faiss compile`, with a system FAISS library |
| S3 attachments (`barrel_att_s3`) | `rebar3 as s3 compile`, or the Hex package |
| Reranking (`barrel_rerank`) | Python 3 with transformers and torch |

## Build barrel-lite

`barrel-lite` is not published to npm. Build it from the umbrella:

```shell
cd barrel/clients/barrel-lite
npm ci
npm run build
```

Then add it to your web app from that directory:

```shell
npm install /path/to/barrel/clients/barrel-lite
```

[Quickstart: browser](/docs/start/quickstart-browser) uses it.

## Notes

- Without `vectordb => #{db_path => ...}`, a database puts its vector
  store in `./priv/barrel_vectordb_<name>` under the current directory,
  not under `data_dir`. Set `db_path` for every database that has
  vectors.
