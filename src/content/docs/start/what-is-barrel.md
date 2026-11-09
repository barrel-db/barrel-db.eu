---
title: Overview for developers
description: Barrel is an open source database for agents and edge apps. It keeps a document, its files and its vector under one id, searches them, and replicates them between copies that all take writes.
---

Barrel is an open source database, written in Erlang/OTP, for agents and
applications that run close to their data. One record holds a JSON
document, its attachments and its vector under the same id. You search it
by field, by keyword, by meaning or by regex, and you replicate it between
copies that all accept writes. Read this page first to know what Barrel
does today, what it does not do, and which part you need.

## The core ideas

A few ideas come back on every page of these docs. Each one is explained
here in plain words, with a link to its [glossary](/docs/concepts/glossary)
entry.

**A record keeps everything about one thing under one id.** A
[record](/docs/concepts/glossary#record) is a JSON
[document](/docs/concepts/glossary#document), the files attached to it
([attachments](/docs/concepts/glossary#attachment)) and its
[vector](/docs/concepts/glossary#vector). For a support article such as
kb-142, that is its fields, an attached screenshot, and the numbers that
describe what its text means. You never keep two stores in step by hand.

**Every write gets a revision.** When you write a document, Barrel adds a
[revision](/docs/concepts/glossary#revision) token, `_rev`. To update the
document you send that token back, so Barrel knows which version you
edited. A write based on a stale version is refused instead of silently
replacing a newer one.

**Search by meaning comes from embeddings.** An
[embedding](/docs/concepts/glossary#embedding) is a vector computed from
text by a model, so that texts with a similar meaning get close vectors.
That is how "I cannot log in" finds "Reset a locked account". In [record
mode](/docs/concepts/glossary#record-mode) you name the fields to embed,
and Barrel computes the vectors and keeps them in step with every write
and delete. [Hybrid search](/docs/concepts/glossary#hybrid-search) adds
[BM25](/docs/concepts/glossary#bm25) keyword ranking for exact terms.

**Every copy takes writes.** [Replication](/docs/concepts/glossary#replication)
copies changes between databases, in one direction or both, and every copy
accepts writes ([active-active](/docs/concepts/glossary#active-active)).
When two copies change the same document at the same time, both versions
are kept: one is the winner and the other is a
[conflict](/docs/concepts/glossary#conflict) you can resolve. Every copy
picks the same winner, so they end up identical; this is
[convergence](/docs/concepts/glossary#convergence).

**Agents share data through spaces.** A
[space](/docs/concepts/glossary#space) is a database created through
Barrel's agent layer so that several agents can work on it. Access is
given with a [capability token](/docs/concepts/glossary#capability-token),
which grants named rights (read, write) on one space and can be revoked.
A [handoff](/docs/concepts/glossary#handoff) passes a task and its space
from one agent to another.

**A database has a timeline.** You can create a
[branch](/docs/concepts/glossary#branch), a separate copy of the
database to try changes on, and merge it back later. A branch taken at a
past instant gives you [point-in-time
recovery](/docs/concepts/glossary#point-in-time-recovery).

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

You use the same database in three ways, depending on where your code
runs. They replicate with each other, so you can start with one and add
another later.

| Mode | What it is | Start here |
|------|------------|------------|
| Embedded | The `barrel` library inside your OTP release | [Quickstart: embedded](/docs/start/quickstart-embedded) |
| Server | `barrel_server`: REST/JSON and MCP over HTTP | [Quickstart: server](/docs/start/quickstart-server) |
| Browser | `barrel-lite`: a local copy in a web app, synced to a server | [Quickstart: browser](/docs/start/quickstart-browser) |

[Choose a deployment](/docs/start/choose-deployment) compares them.

## The parts

Barrel is one database made of separate Apache 2.0 libraries. You can
depend on `barrel` for everything, or on a single library when you need
only that part, for example `barrel_docdb` for documents and sync without
vectors.

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

These limits are true today. Check them before you design around
Barrel.

- **Vectors are not replicated.** Documents and attachments replicate. In
  record mode each copy rebuilds its vector index from the documents.
- **BQL has no aggregates, joins or GROUP BY.** `COUNT(*)` is a syntax
  error.
- **No backup command.** You copy data with a branch, an export, or
  replication. See [Backups and recovery](/docs/operate/backups).
- **No metrics route on the server.** Metrics are exported from Erlang.
  See [Monitoring](/docs/operate/monitoring).

The [feature status](/docs/features) page lists what is planned.
