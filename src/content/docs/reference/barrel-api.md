---
title: Barrel API
description: The barrel module, the entry point to the embedded database, grouped by area, with the other modules you call next to it.
---

This is the `barrel` module, the API you use to embed the database in an Erlang application. Every function takes the handle returned by `barrel:open/1,2`, except the lifecycle calls. Use this page as the map; the guides have worked examples, and the [generated reference](/docs/lib/barrel/) has every type and option.

```erlang
{ok, _} = application:ensure_all_started(barrel),
{ok, Db} = barrel:open(<<"notes">>, #{
    vectordb => #{db_path => "/var/lib/app/vec/notes"}}),
{ok, #{<<"rev">> := _}} =
    barrel:put_doc(Db, #{<<"id">> => <<"n1">>,
                         <<"title">> => <<"hello">>}).
```

Calls return `{ok, Value}` or `{error, Reason}`; see [Error codes](/docs/reference/errors#erlang-api).

## Lifecycle

| Function | Description |
|---|---|
| `open/1`, `open/2` | Open a database, creating it if needed. Options: `docdb`, `vectordb` (a map, or `none` for documents only), `embedding` (a policy, or `stored`, for record mode), `encryption`, `read_only`, `store_supervised`. See [Configuration](/docs/reference/configuration#open-a-database). |
| `close/1` | Stop the indexer and the vector store, then close the documents. |
| `info/1` | The docdb info (configuration, keyspace, retention, history floor, write-group counters) plus `embedding`, `dimensions` and `embedder`. No document count or size. |
| `delete/1` | Delete the database and its vector store files. |

Open from a long-lived process: the vector store is linked to the caller unless you pass `store_supervised => true`, or open through `barrel_dbs`. See [Embed barrel in an Erlang app](/docs/guides/embedding).

## Documents

| Function | Description |
|---|---|
| `put_doc/2,3` | Create or update a document (a map with `<<"id">>`). Returns `{ok, #{<<"id">>, <<"rev">>, <<"ok">>}}`. An update must carry the current `<<"_rev">>`. Options include `provenance`, `expires_at`, `sync` and, in record mode, `vector`. |
| `put_docs/2,3` | One result per document, in order. In record mode with `mode => sync`, one embedding failure fails the whole batch. |
| `get_doc/2,3` | Read a document. Options: `include_embedding`, `conflicts`, `include_deleted`, `rev`. |
| `get_docs/2,3` | Read several documents. |
| `delete_doc/2,3`, `delete_docs/2` | Delete (writes a tombstone). `delete_docs/2` deletes one by one, not atomically. |
| `find/2,3` | A structured query (`#{where => [...]}`), the same spec as `barrel_docdb:find/2,3`. |

## Queries (BQL)

| Function | Description |
|---|---|
| `query/2,3` | Run a statement; returns `{ok, Rows, Meta}`. Options: `params`, `chunk_size`, `continuation`, `overfetch`. |
| `query_fold/5` | Fold rows without building the full list. |
| `explain_query/2,3` | The plan and its warnings. |
| `subscribe_query/2,3`, `unsubscribe_query/1` | Live queries from a `SUBSCRIBE` statement. Options: `params`, `owner`. |

The search table functions `vector_top_k`, `bm25_top_k` and `hybrid_top_k` run only through these calls. See the [BQL reference](/docs/reference/bql).

## Attachments

| Function | Description |
|---|---|
| `put_attachment/4,5`, `get_attachment/3` | Store and read bytes by name. |
| `list_attachments/2`, `delete_attachment/3`, `attachment_info/3` | List, delete, inspect. |
| `open_attachment_writer/4`, `write_attachment/2`, `finish_attachment/1`, `abort_attachment/1` | Stream a large attachment in. |
| `open_attachment_reader/3`, `read_attachment/1`, `close_attachment_reader/1` | Stream one out. |

Byte-range reads exist only in barrel_docdb (`open_attachment_stream/4`, `read_attachment_range/5`).

## Vectors and search

On a database opened with `vectordb => none`, these return `{error, no_vector_store}`.

| Function | Description |
|---|---|
| `vector_add/4,5`, `vector_add_batch/2` | Add a vector with its text and metadata; `/4` embeds the text, `/5` takes the vector. Returns `{error, record_mode}` in record mode, where you write documents instead. |
| `vector_get/2`, `vector_delete/2` | Read or delete one entry. |
| `vector_stats/1` | `count`, `dimension`, `index`, `index_origin`, `config`. |
| `search/3` | Embed the query text, then vector search. Needs an embedder. |
| `search_vector/3` | Nearest neighbours of a vector. |
| `search_bm25/3` | Keyword search; returns `{ok, [{Id, Score}]}`. Needs a BM25 backend. |
| `search_hybrid/3` | Keyword and vector, fused (RRF by default). Needs both. |

Options: `k` (5 for `search` and `search_vector`, 10 for BM25 and hybrid), `filter` (a fun on the metadata, applied after retrieval), `include_text`, `include_metadata`; for hybrid also `bm25_weight`, `vector_weight`, `fusion` (`rrf` or `linear`) and `rrf_k`.

## Embedding

| Function | Description |
|---|---|
| `embed/2`, `embed_batch/2` | Embed text with the database's embedder. |
| `embedder_info/1` | `provider`, `model`, `dimensions`, `distance`, `preprocessing`, `fingerprint`. |
| `embedding_fingerprint/3` | The fingerprint that identifies a vector space. |

## Changes and subscriptions

| Function | Description |
|---|---|
| `changes/2,3` | Read the changes feed from `first` or a cursor. |
| `hlc_encode/1`, `hlc_decode/1` | Turn a feed position into a URL-safe cursor and back. |
| `subscribe/2,3`, `subscribe_ack/2`, `subscribe_stop/1` | A changes stream process; `subscribe_ack/2` acknowledges a batch in push mode. |

## Timeline

| Function | Description |
|---|---|
| `branch/2,3` | Branch at now, or at a past HLC with `at`. A plain branch gets an empty vector store; a record-mode branch backfills from stored embeddings. |
| `merge/1,2` | Merge a branch back into its parent. |

See [Branch, merge, recover](/docs/guides/timeline).

## History

| Function | Description |
|---|---|
| `history/1,2`, `history_floor/1` | Read the retained change history and its floor. Options: `from`, `to`, `limit`, `id`. |
| `doc_versions/2`, `version_body/3` | List a document's versions and read a past body. |

See [Audit and provenance](/docs/guides/audit-provenance).

## Other modules you call

| Module | For |
|---|---|
| `barrel_dbs` | A shared, supervised handle per name: `ensure/1,2` (with `must_exist`), `lease/2`, `release/1`, `close/1`, `list/0`. The server opens databases through it. |
| `barrel_rep`, `barrel_rep_tasks` | Replication; `barrel` does not wrap it. Pass the database name. See [Synchronization](/docs/guides/synchronization). |
| `barrel_ctx`, `barrel_ctx_export` | Contexts, working sets, export and import. See [Query several datasets](/docs/guides/contexts). |
| `barrel_spaces`, `barrel_caps`, `barrel_session`, `barrel_handoff` | The agent layer. See [Spaces, sessions, handoffs](/docs/guides/spaces). |
| `barrel_ngram` | Substring and regex search over a docdb database. See [Substring and regex](/docs/search/substring-regex). |
