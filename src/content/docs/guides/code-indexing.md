---
title: Index a codebase for an agent
description: Build a search index an AI coding agent queries by meaning and by keyword. Barrel keeps one record per chunk, embeds it for you, and answers keyword, semantic and hybrid queries from one BQL call.
---

An AI coding agent works better when it can ask "where do we validate the auth token" and get the right code back, not only files that contain the word "auth". That needs semantic search next to keyword search, over a codebase that changes constantly. Read this when you want to give an agent that index: you store one record per code chunk, Barrel embeds it, and you query it with keyword, vector or hybrid search from one call. Expose it over MCP and the agent uses it as a tool.

## How it fits together

- **One record per chunk.** A chunk is a slice of a file: a function, a class, a span of lines. You store it as a document. In [record mode](/docs/guides/record-mode) Barrel keeps a vector for that document in sync, so a chunk's text and its embedding are one record under one id.
- **Metadata rides along.** Path, language and symbol are fields of the document, so a search can filter on them ("only Python", "only under `src/`").
- **One query language for three kinds of search.** BQL has `bm25_top_k` (keyword), `vector_top_k` (semantic) and `hybrid_top_k` (both, fused). You do not merge result sets yourself.
- **The agent reaches it over MCP.** [barrel_server](/docs/guides/mcp) exposes the database to an agent, so search is a tool call.

For exact identifiers and regular expressions over the same documents, add a [substring and regex index](/docs/search/substring-regex) next to this one.

## Open the index

Open a record-mode database. The `embedding` policy names the field to embed (the chunk text) and the metadata fields returned with search hits. The `barrel` application must be running; it supervises the indexer.

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel_dbs:ensure(<<"code_index">>, #{
    embedding => #{
        fields => [<<"text">>],
        mode => sync,
        embedder => {local, #{}},
        dimensions => 768,
        metadata_fields => [<<"path">>, <<"lang">>,
                            <<"symbol">>]},
    vectordb => #{db_path => "/var/lib/app/code_index_vec"}}).
```

- `{local, #{}}` runs `BAAI/bge-base-en-v1.5` (768 dimensions) through Python; any [embedding provider](/docs/search/embedding-providers) works. Set `dimensions` to the model's size.
- Record mode turns on a disk BM25 index, so `bm25_top_k` and `hybrid_top_k` work without more options.
- `barrel_dbs:ensure/2` gives you a supervised, shared handle. If barrel_server runs in the same node, the server reuses this open database instead of opening a plain one.
- `db_path` places the vector store where you want it. Without it the store goes next to the documents, in `<data_dir>/code_index.vectordb`.

## Index a file

A chunk needs a **stable id** so re-indexing overwrites the same record instead of adding one. Derive it from the file path and the line span, for example `src/auth.py#40-88`. Write the chunks with `put_docs/2`; with `mode => sync`, a chunk is searchable when the call returns.

```erlang
index_file(Db, Path, Lang, Chunks) ->
    Docs = [#{<<"id">>     => chunk_id(Path, C),
              <<"path">>   => Path,
              <<"lang">>   => Lang,
              <<"symbol">> => maps:get(symbol, C),
              <<"text">>   => maps:get(body, C)}
            || C <- Chunks],
    barrel:put_docs(Db, Docs).

chunk_id(Path, #{start_line := S, end_line := E}) ->
    <<Path/binary, "#", (integer_to_binary(S))/binary,
      "-", (integer_to_binary(E))/binary>>.
```

`put_docs/2` returns one `{ok, #{<<"id">>, <<"rev">>, ...}}` or `{error, Reason}` per chunk, in order. In sync mode, one embedding failure fails the whole batch and nothing is written.

To skip files that did not change, keep each file's content hash in a small document. An update must carry the current `_rev`, so read before you write:

```erlang
unchanged(Db, Path, Hash) ->
    case barrel:get_doc(Db, <<"file:", Path/binary>>) of
        {ok, #{<<"hash">> := Hash}} -> true;
        _ -> false
    end.

record_hash(Db, Path, Hash) ->
    Id = <<"file:", Path/binary>>,
    Doc = case barrel:get_doc(Db, Id) of
        {ok, Old} -> Old#{<<"hash">> => Hash};
        {error, not_found} -> #{<<"id">> => Id}
    end,
    barrel:put_doc(Db, Doc#{<<"hash">> => Hash}).
```

## Search

Each search function is the `FROM` source of a BQL query. It takes the query text and `k`, and exposes a `_score` column. Name document fields next to it to get them in each row; `SELECT *` returns every field of the chunk, `text` included.

Keyword search, for an exact identifier or error string:

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, symbol, m._score "
    "FROM bm25_top_k('parse_config', k => 10) AS m").
```

Semantic search, for intent:

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, symbol, v._score "
    "FROM vector_top_k('where do we validate the auth "
    "token', k => 10) AS v").
```

Hybrid search fuses both with reciprocal rank fusion. It is the one an agent should reach for first:

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, symbol, h._score "
    "FROM hybrid_top_k('retry a failed request with "
    "backoff', k => 10) AS h").
```

Filter on metadata in the same query. The search over-fetches (3 times `k`) before the filter, so it still finds matches that rank below the top `k` unfiltered; a very selective filter can still return fewer than `k` rows.

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, v._score "
    "FROM vector_top_k('read a file into a buffer', "
    "k => 5) AS v "
    "WHERE v.lang = 'rust' AND v.path LIKE 'src/%'").
```

When the query text comes from the agent, pass it as a parameter instead of splicing it into the statement:

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    <<"SELECT id, path, h._score "
      "FROM hybrid_top_k($q, k => 10) AS h "
      "WHERE h.lang = $lang">>,
    #{params => #{<<"q">> => Question,
                  <<"lang">> => <<"python">>}}).
```

See the [BQL reference](/docs/reference/bql) for the rest of the grammar.

## Keep it fresh

When a file changes, its old chunks go stale: the line spans move, so the new chunk ids differ from the old ones. Chunk ids start with the file path and `#`, so list them with an id prefix. Use `find/2` here rather than `LIKE` in BQL: a prefix `LIKE` on `id` is refused when the path contains `_` or `%`.

```erlang
chunk_ids(Db, Path) ->
    {ok, Rows, _} = barrel:find(Db,
        #{id_prefix => <<Path/binary, "#">>,
          include_docs => false}),
    [Id || #{<<"id">> := Id} <- Rows].
```

Re-index the file, then delete the chunks that are not in the new set:

```erlang
reindex_file(Db, Path, Lang, Chunks) ->
    Old = chunk_ids(Db, Path),
    Results = index_file(Db, Path, Lang, Chunks),
    New = [Id || {ok, #{<<"id">> := Id}} <- Results],
    [barrel:delete_doc(Db, Id) || Id <- Old -- New],
    ok.
```

When a file is deleted, drop its chunks and its hash document:

```erlang
remove_file(Db, Path) ->
    [barrel:delete_doc(Db, Id) || Id <- chunk_ids(Db, Path)],
    barrel:delete_doc(Db, <<"file:", Path/binary>>).
```

`find/2` returns up to 1000 rows at a time; a file with more chunks than that needs `find/3` with the `continuation` from the result meta.

## Give it to an agent

Run [barrel_server](/docs/guides/rest-server) in the same node, after you opened the index as above. The agent reaches it over the Model Context Protocol and searches with the `query` tool (a `hybrid_top_k` statement) or the `search` tool with `mode` set to `hybrid`. A hit is a chunk with its path and line span in the id, which the agent opens. The tool list is in [MCP tools](/docs/reference/mcp-tools).

```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call",
 "params": {"name": "search", "arguments": {
   "db": "code_index", "mode": "hybrid", "k": 10,
   "query": "where do we validate the auth token"}}}
```

For a plain HTTP client, the same BQL runs over REST:

```shell
curl -X POST localhost:8080/db/code_index/query \
  -H 'content-type: text/plain' \
  --data-binary "SELECT id, path, h._score
    FROM hybrid_top_k('validate the auth token', k => 10)
    AS h"
```

## Notes

- Chunk on structure, not on fixed line counts: one function or class per chunk keeps a result self-contained and gives the embedding a coherent unit.
- Keep `text` to the chunk body the agent needs to read. Put path, language and symbol in their own fields so you can filter on them.
- `mode => sync` embeds on write. Use `async` for a large first indexing pass; the indexer catches up in the background.
- Every call on this page was run against the umbrella at main `c111ec4`, with a test provider in place of `{local, #{}}` so it ran offline. The scores you get depend on the model.
