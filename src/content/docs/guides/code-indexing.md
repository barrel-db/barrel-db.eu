---
title: Index a codebase for an agent
description: Build a search index an AI coding agent queries by meaning, not just keywords. Barrel keeps one record per chunk (text and vector together), embeds it for you, and answers full-text, semantic, and hybrid queries in one call.
---

An AI coding agent works better when it can ask "where is the auth logic" and
get the right code back, not just files that contain the word "auth". That needs
semantic search next to keyword search, over a codebase that changes constantly.
Read this when you want to give an agent that index. You store one record per
code chunk, Barrel embeds it, and you query it with full-text, vector, or hybrid
search from a single call. Expose it over MCP and the agent uses it as a tool.

## How it fits together

- **One record per chunk.** A chunk is a slice of a file (a function, a class, a
  span of lines). You store it as a document. In [record mode](/docs/guides/record-mode)
  Barrel keeps a vector for that document in sync, so a chunk's text and its
  embedding are one record under one id. No separate embeddings table, no manual
  embedding calls.
- **Metadata rides along.** Path, language, and symbol name are fields on the
  document, so you can filter a search ("only Python", "only under `src/`")
  without a join.
- **One query for three kinds of search.** BQL exposes `bm25_top_k` (keyword),
  `vector_top_k` (semantic), and `hybrid_top_k` (both, fused). The hybrid case is
  built in; you do not merge result sets yourself.
- **The agent reaches it over MCP.** [barrel_server](/docs/server/mcp) exposes the
  same database to an agent, so search is a tool call.

## Open the index

Open a record-mode database. The `embedding` policy names the field to embed (the
chunk text) and the metadata fields to project into search results. The `barrel`
application must be running; it supervises the indexer.

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel:open(code_index, #{
    embedding => #{
        fields => [<<"text">>],                 %% embed the chunk body
        mode => sync,                           %% read-your-write while indexing
        embedder => {local, #{}},               %% a barrel_embed provider
        dimensions => 768,
        metadata_fields => [<<"path">>, <<"lang">>, <<"symbol">>]
    },
    vectordb => #{dimension => 768}
}).
```

## Index a file

A chunk needs a **stable id** so re-indexing overwrites the same record instead
of duplicating it. Derive it from the file path and the line span, for example
`src/auth.py#40-88`. Write chunks with `put_docs/2`; a write with an existing id
replaces that document, and record mode re-embeds it.

```erlang
index_file(Db, Path, Lang, Chunks) ->
    Docs = [#{<<"id">>    => chunk_id(Path, Chunk),
             <<"path">>   => Path,
             <<"lang">>   => Lang,
             <<"symbol">> => maps:get(symbol, Chunk),
             <<"text">>   => maps:get(body, Chunk)}
            || Chunk <- Chunks],
    barrel:put_docs(Db, Docs).

chunk_id(Path, #{start_line := S, end_line := E}) ->
    iolist_to_binary([Path, "#", integer_to_binary(S), "-", integer_to_binary(E)]).
```

Skip files that have not changed. Store each file's content hash in a small
metadata document and compare before re-indexing:

```erlang
unchanged(Db, Path, Hash) ->
    case barrel:get_doc(Db, <<"file:", Path/binary>>) of
        {ok, #{<<"hash">> := Hash}} -> true;   %% same hash, skip
        _ -> false
    end.

record_hash(Db, Path, Hash) ->
    barrel:put_doc(Db, #{<<"id">> => <<"file:", Path/binary>>,
                         <<"hash">> => Hash}).
```

## Search

Each search function is the `FROM` source of a BQL query. It takes the query text
and `k`, and exposes a `_score` column. `SELECT *` flattens the matched document's
fields (path, symbol, text) into each row.

Keyword search, for an exact identifier or error string:

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, symbol, m._score "
    "FROM bm25_top_k('parse_config', k => 10) AS m").
```

Semantic search, for intent:

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, symbol, v._score "
    "FROM vector_top_k('where do we validate the auth token', k => 10) AS v").
```

Hybrid search fuses both and is the default an agent should reach for. You do not
merge or re-rank anything yourself:

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, symbol, h._score "
    "FROM hybrid_top_k('retry a failed request with backoff', k => 10) AS h").
```

Filter by metadata in the same query. The search over-fetches, so a filter still
finds matches that rank below the top `k` unfiltered:

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, v._score "
    "FROM vector_top_k('read a file into a buffer', k => 5) AS v "
    "WHERE v.lang = 'rust' AND v.path LIKE 'src/%'").
```

`vector_top_k` and `hybrid_top_k` embed the query, so they need an embedder
configured; `bm25_top_k` needs a BM25 backend. See the [BQL reference](/docs/reference/bql).

## Keep it fresh

When a file changes, its old chunks are stale: the line spans move, so the new
chunk ids differ from the old ones. Re-index the file, then delete the chunks that
belong to the file but are not in the new set. Chunk ids share the file path as a
prefix, so you can list them:

```erlang
reindex_file(Db, Path, Lang, Chunks) ->
    {ok, Old, _} = barrel:query(Db,
        "SELECT id FROM db WHERE id LIKE '" ++ binary_to_list(Path) ++ "#%'"),
    OldIds = [maps:get(<<"id">>, R) || R <- Old],
    Results = index_file(Db, Path, Lang, Chunks),
    NewIds = [Id || #{<<"id">> := Id} <- [D || {ok, D} <- Results]],
    Stale = OldIds -- NewIds,
    [barrel:delete_doc(Db, Id) || Id <- Stale],
    ok.
```

When a file is deleted, drop all of its chunks:

```erlang
remove_file(Db, Path) ->
    {ok, Rows, _} = barrel:query(Db,
        "SELECT id FROM db WHERE id LIKE '" ++ binary_to_list(Path) ++ "#%'"),
    [barrel:delete_doc(Db, maps:get(<<"id">>, R)) || R <- Rows],
    barrel:delete_doc(Db, <<"file:", Path/binary>>).
```

## Give it to an agent

Run [barrel_server](/docs/server/mcp) in front of the index and the agent reaches
it over the Model Context Protocol: it lists databases, runs BQL, and reads
documents as tool calls. A search is a `POST` of a `hybrid_top_k` query; a result
is a chunk with its path and line span, which the agent opens.

For a plain HTTP client instead of MCP, the same query runs over REST:

```bash
curl -X POST localhost:8080/db/code_index/query \
    -H 'content-type: application/json' \
    -d '{"query":"SELECT id, path, h._score FROM hybrid_top_k('"'"'where do we validate the auth token'"'"', k => 10) AS h"}'
```

## Notes

- Chunk on structure, not fixed line counts: one function or class per chunk
  keeps a result self-contained and gives the embedding a coherent unit.
- Keep `text` to the chunk body an agent needs to read. Put path, language, and
  symbol in metadata fields so you can filter on them.
- `mode => sync` embeds on write, so a chunk is searchable as soon as
  `put_docs` returns. Use `async` for a large initial indexing pass, then the
  indexer catches up in the background.
- The query forms here are exercised by `barrel_bql_facade_SUITE` in the umbrella,
  which runs the three `top_k` functions and metadata filters against a
  record-mode database.
