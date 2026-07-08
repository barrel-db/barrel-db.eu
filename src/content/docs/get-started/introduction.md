---
title: Introduction
description: What Barrel is, and when you would reach for it.
---

Barrel is an embeddable edge-AI database. You store a document, its attachments,
and its vector under one id, then query, search, sync, and hand that data to
agents, without stitching together a document store and a separate vector index.
Reach for Barrel when you are building an agent or an offline-first app and you
want memory, search, and sync in one place.

## One record, three shapes

A single write stores everything about an item:

- the **document** (schemaless JSON) with version-vector MVCC and BQL queries,
- its **attachments** (content-addressed blobs, streamed and replicated),
- and its **vector** (auto-embedded, or bring your own), searchable with vector,
  BM25, and hybrid search.

Because they share one id, an agent's memory is one write and one read. There is
no glue code keeping a doc store and a vector index in sync.

## Run it where you need it

You use the same database in three places:

- **Embedded**: a library in your Erlang or Elixir app, no separate process.
- **Server**: run `barrel_server` for a REST/JSON and MCP surface over the same
  database.
- **Browser**: sync an offline-first copy into the browser with `barrel-lite`.

## What you get

- A unified record: documents, blobs, and vectors under one id.
- Local vector, BM25, and hybrid search, plus BQL (a PartiQL dialect).
- Offline-first sync with HLC version vectors, so writes converge without a
  coordinator and are never silently dropped.
- Encryption at rest with per-database keys.
- Timeline: branch a database, restore it to a point in time, and merge back.
- An agent layer: spaces, capability tokens, sessions, and handoffs over REST
  and the Model Context Protocol.

## Next steps

- [Install Barrel](/docs/get-started/installation) in your project.
- Follow the [Quickstart](/docs/get-started/quickstart) to store and search your
  first documents.
- Read [Data model](/docs/concepts/data-model) to understand the one-record idea.
