---
title: What Barrel is
description: Barrel is an open source database for agents and edge apps. It keeps a document, its files and its vector under one id, searches them, and replicates them between copies that all take writes.
---

Barrel is an open source database, written in Erlang/OTP, for agents and
applications that run close to their data. One record holds a JSON
document, its attachments and its vector under the same id. You search it
by field, by keyword, by meaning or by regex, and you replicate it between
copies that all accept writes. Read this page first to know what Barrel
does today, what it does not do, and which part you need.

## What you get

- **One record per id.** A document, its attachments and its embedding
  live together. In [record mode](/docs/guides/record-mode) Barrel embeds
  the fields you name and keeps the vector index in step with every write
  and delete.
- **Queries.** Every path is indexed. You query with
  [BQL](/docs/guides/query-bql), a small SQL-like language, or with
  `find/2` from Erlang.
- **Search.** Vector, BM25 keyword and hybrid search, plus exact
  substring and regex search. See [Vector, keyword and
  hybrid](/docs/search/hybrid).
- **Replication.** Every copy takes writes. Concurrent edits are kept as
  siblings and every copy shows the same winner. See [Versions, conflicts,
  convergence](/docs/concepts/versions).
- **Timeline.** Branch a database, merge the branch back, or branch at a
  past instant. See [Branch, merge, recover](/docs/guides/timeline).
- **Agent layer.** Spaces shared by capability tokens, sessions with a
  TTL, handoffs, and an MCP endpoint. See [Spaces and
  capabilities](/docs/concepts/spaces).
- **Security.** Encryption at rest per database, bearer and capability
  tokens, signed requests and mTLS. See
  [Authentication](/docs/security/authentication).

## How you run it

| Mode | What it is | Start here |
|------|------------|------------|
| Embedded | The `barrel` library inside your OTP release | [Quickstart: embedded](/docs/start/quickstart-embedded) |
| Server | `barrel_server`: REST/JSON and MCP over HTTP | [Quickstart: server](/docs/start/quickstart-server) |
| Browser | `barrel-lite`: a local copy in a web app, synced to a server | [Quickstart: browser](/docs/start/quickstart-browser) |

[Choose a deployment](/docs/start/choose-deployment) compares them.

## The parts

Barrel is one database made of separate Apache 2.0 libraries. You can
depend on `barrel` for everything, or on a single library.

| Library | Role |
|---------|------|
| `barrel` | The API in these docs: documents, files and vectors under one id |
| `barrel_docdb` | Documents, versions, BQL, attachments, replication |
| `barrel_vectordb` | Vector index (HNSW, DiskANN, FAISS), BM25, hybrid |
| `barrel_ngram` | Exact substring and regex index |
| `barrel_embed` | Embedding providers, local or cloud |
| `barrel_rerank` | Cross-encoder reranking (optional) |
| `barrel_spaces` | Spaces, capability tokens, sessions, handoffs |
| `barrel_server` | REST/JSON and MCP server |
| `barrel-lite` | TypeScript browser client |

See [Libraries](/docs/reference/libraries) for the per-library references.

## What it does not do

- **Vectors are not replicated.** Documents and attachments replicate. In
  record mode each copy rebuilds its vector index from the documents.
- **BQL has no aggregates, joins or GROUP BY.** `COUNT(*)` is a syntax
  error.
- **No backup command.** You copy data with a branch, an export, or
  replication. See [Backups and recovery](/docs/operate/backups).
- **No metrics route on the server.** Metrics are exported from Erlang.
  See [Monitoring](/docs/operate/monitoring).

The [feature status](/docs/features) page lists what is planned.
