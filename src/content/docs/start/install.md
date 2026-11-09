---
title: Install
description: Add Barrel to an Erlang project from Hex, build the server from the umbrella, or build barrel-lite for the browser.
---

This page tells you what to install for each way of running Barrel: the
`barrel` library from Hex for an Erlang application, the umbrella build for
`barrel_server`, and a local build of `barrel-lite` for the browser. Read it
before a quickstart if your machine has never built Barrel.

## Requirements

What you need depends on the mode you run. Each item below says what it
is for, so you can skip what your mode does not use.

- **Erlang/OTP 26 or later, and rebar3.** Barrel is written in Erlang, so
  the library and the server need the Erlang runtime. The browser client
  does not, but it syncs with a server that does. rebar3
  is the Erlang build tool: it fetches dependencies from Hex and compiles
  them.
- **CMake and a C/C++ compiler.** Parts of Barrel are native code that is
  compiled on your machine: RocksDB (the storage engine that writes
  documents to disk), the vector store and the ngram index.
- **git**, for the server from source: you clone the Barrel repository to
  build `barrel_server`.
- **Node.js 20 or later and npm**, for the browser client: you build
  `barrel-lite` with them and add it to your web app.
- **Optional, for local embeddings:** Python 3 (the `local` provider) or
  a running [Ollama](https://ollama.com). An
  [embedding](/docs/concepts/glossary#embedding) is the list of numbers
  that lets Barrel search text by meaning; these compute it on your
  machine instead of calling a cloud API. See [Choose an embedding
  provider](/docs/search/embedding-providers).

## Add barrel to an Erlang project

Use this when your application is written in Erlang or Elixir and Barrel
runs inside it, the [embedded](/docs/concepts/glossary#embedded) mode.
Every library is on Hex, the package registry for Erlang and Elixir. Add `barrel` to `rebar.config`:

```erlang
{deps, [{barrel, "~> 1.12"}]}.
```

Add it to your application's `applications` list in `src/*.app.src`, so
it starts with your application, then fetch and build:

```shell
rebar3 compile
```

Add a library on its own when you need only that part, for example
`{barrel_docdb, "~> 2.1"}` for documents and replication without vectors,
or `{barrel_ngram, "~> 0.11"}` for substring search.

Set where data goes, in `config/sys.config`. `data_dir` is the directory
where documents are written to disk:

```erlang
[{barrel_docdb, [{data_dir, "data/docdb"}]}].
```

The default is `data/barrel_docdb`, relative to the current directory.

## Build the server from the umbrella

Use this when clients reach Barrel over HTTP or MCP.
[`barrel_server`](/docs/concepts/glossary#barrel-server) is built from
the umbrella, the Barrel repository that holds all the libraries. It is
behind the `server` profile, a named build configuration, and is not in
the default build.

```shell
git clone https://github.com/barrel-db/barrel.git
cd barrel
rebar3 as server compile
```

To build a release instead, a self-contained directory you can copy to a
machine and start:

```shell
rebar3 as server,prod release -n barrel_server
```

[Quickstart: server](/docs/start/quickstart-server) starts it.

## Optional parts

These add features most setups do not need. Install them only when you
use the feature.

| Part | How |
|------|-----|
| FAISS vector backend | `rebar3 as faiss compile`, with a system FAISS library |
| S3 attachments (`barrel_att_s3`) | `rebar3 as s3 compile`, or the Hex package |
| Reranking (`barrel_rerank`) | Python 3 with transformers and torch |

## Build barrel-lite

Use this when a web app keeps its own copy of the data.
[`barrel-lite`](/docs/concepts/glossary#barrel-lite) is not published to
npm, so you build it from the umbrella:

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
