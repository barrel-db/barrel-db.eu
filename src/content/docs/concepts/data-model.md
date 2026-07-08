---
title: Data model
description: How Barrel stores a document, its blobs, and its vector as one record under one id.
---

Barrel keeps everything about an item under a single id. Read this to understand
what a "record" is, and why that shape matters when you are building agents.

## One id, three shapes

When you write to Barrel, one id addresses three things:

- the **document**: schemaless JSON (an Erlang map), versioned and queryable;
- its **attachments**: content-addressed binary blobs, streamed and replicated;
- its **vector**: an embedding, either computed for you or supplied.

You do not keep a document store and a separate vector index in sync. There is
no second write, no id mapping, and no drift between them. An agent's memory is
one write and one read.

## The document

A document is a map with a binary `<<"id">>`. Every top-level path is indexed
automatically, so you query with [BQL](/docs/guides/query-bql) without creating
indexes. Writes are versioned with [version vectors](/docs/concepts/version-vectors),
so concurrent edits converge instead of clobbering each other.

## Attachments

Attachments are blobs attached to a document by name. They are content-addressed
and stream in chunks, so large files do not sit in memory. The storage backend is
pluggable per database. See [Embedding Barrel](/docs/guides/embedding) for the
attachment API.

## Vectors

A record can carry a vector. You add it explicitly, or open the database with an
embedding policy so Barrel embeds your text on write (see
[Record mode](/docs/guides/record-mode)). Either way the vector lives with the
document, and you search it with vector, BM25, or hybrid search.

## Where a record lives

The same record model is available three ways: embedded in your Erlang app, over
HTTP through [barrel_server](/docs/server/rest-server), and synced into the
browser with [barrel-lite](/docs/guides/barrel-lite). It is the same database and
the same record wherever you reach it.
