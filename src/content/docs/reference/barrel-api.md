---
title: Barrel API
description: The barrel module, the single entry point to the embedded database, grouped by area.
---

This is the `barrel` module, the one API you use to embed the database. Every
function takes the database handle returned by `barrel:open/1,2` (except the
lifecycle calls). Reach for the guides for worked examples; this page is the map.

## Lifecycle

| Function | Description |
|----------|-------------|
| `open/1`, `open/2` | Open (creating if needed) a database; `open/2` takes per-layer options. Returns a handle. |
| `close/1` | Close a database handle. |
| `info/1` | Database info (counts, floors, cursors). |
| `delete/1` | Delete a database and its files. |

Open from a long-lived process: the database links its vector store to the caller.
See [Embedding Barrel](/docs/guides/embedding).

## Documents

| Function | Description |
|----------|-------------|
| `put_doc/2,3` | Create or update a document (a map with `<<"id">>`). |
| `get_doc/2,3` | Read a document by id. |
| `delete_doc/2,3` | Delete a document (writes a tombstone). |
| `find/2,3` | Structured path query (`#{where => [...]}`). |
| `put_docs/2,3`, `get_docs/2,3`, `delete_docs/2` | Batch variants; one result per id, in order. |

## Queries (BQL)

| Function | Description |
|----------|-------------|
| `query/2,3` | Run a BQL statement; returns rows + meta. |
| `query_fold/5` | Stream a query in chunks (`chunk_size`, `has_more`/`continuation`). |
| `explain_query/2,3` | Return the plan for a BQL statement. |

See the [BQL reference](/docs/reference/bql) and the
[querying guide](/docs/guides/query-bql).

## Attachments

| Function | Description |
|----------|-------------|
| `put_attachment/4`, `get_attachment/3` | Store and read a blob by name. |
| `list_attachments/2`, `delete_attachment/3`, `attachment_info/3` | List, delete, inspect. |
| `open_attachment_writer/4` -> `write_attachment/2` -> `finish_attachment/1` | Stream a large blob in (`abort_attachment/1` to cancel). |
| `open_attachment_reader/3` -> `read_attachment/1` -> `close_attachment_reader/1` | Stream a blob out. |

## Vectors and search

| Function | Description |
|----------|-------------|
| `vector_add/4,5`, `vector_add_batch/2` | Attach a vector (or a batch) to documents. |
| `vector_get/2`, `vector_delete/2`, `vector_stats/1` | Read, delete, and count vectors. |
| `search_vector/3` | Nearest-neighbour search by vector (`#{k => N}`). |
| `search_bm25/3` | Keyword search (needs a BM25 backend enabled at open). |
| `search_hybrid/3`, `search/3` | Hybrid vector + keyword, and text search when an embedder is configured. |

Hybrid search and auto-embedding need an embedder via `barrel_embed`; without one
they return `{error, embedder_not_configured}`. See
[Record mode](/docs/guides/record-mode).

## Changes and subscriptions

| Function | Description |
|----------|-------------|
| `changes/2,3` | Read the changes feed from `first` or a cursor. |
| `hlc_encode/1`, `hlc_decode/1` | Turn a feed position into a URL-safe cursor and back. |
| `subscribe/2,3`, `subscribe_ack/2`, `subscribe_stop/1` | Subscribe to changes with backpressure. |
| `subscribe_query/2,3`, `unsubscribe_query/1` | Live queries (BQL `SUBSCRIBE`). |

## Timeline

| Function | Description |
|----------|-------------|
| `branch/2,3` | Branch a database (at now, or a past point in time). |
| `merge/1,2` | Merge a branch back. |

See [Timeline](/docs/guides/timeline).

## History

| Function | Description |
|----------|-------------|
| `history/1,2`, `history_floor/1` | Read the retained change history and its floor. |
| `doc_versions/2`, `version_body/3` | List a document's versions and read a past body. |

See [Audit & provenance](/docs/guides/audit-provenance).
