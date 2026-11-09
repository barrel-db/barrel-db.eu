import type { ComponentContent } from './types';

const code = `{ok, _} = application:ensure_all_started(barrel_vectordb).
Cfg = #{name => <<"agent_mem">>, path => Path,
        dimensions => 4, bm25_backend => disk,
        hnsw => #{m => 8, ef_construction => 100}}.
{ok, _} = barrel_vectordb:start_link(Cfg).
ok = barrel_vectordb:add_vector(<<"agent_mem">>, <<"m1">>,
    <<"User prefers metric units in reports">>,
    #{kind => preference}, [0.9, 0.1, 0.0, 0.0]).
barrel_vectordb:add_vector_batch(<<"agent_mem">>, [
  {<<"m2">>, <<"Quarterly report is due on the 15th">>,
   #{kind => fact}, [0.7, 0.3, 0.1, 0.0]},
  {<<"m3">>, <<"Customer Acme renewed for two years">>,
   #{kind => fact}, [0.0, 0.1, 0.9, 0.2]}]).
barrel_vectordb:search_vector(<<"agent_mem">>,
    [0.8, 0.2, 0.0, 0.0],
    #{k => 2,
      filter => fun(M) -> maps:get(kind, M) =:= fact end}).
barrel_vectordb:search_bm25(<<"agent_mem">>, <<"report">>,
                            #{k => 5}).
barrel_vectordb:search(<<"agent_mem">>, <<"report">>, #{}).`;

const output = `{ok,#{inserted => 2}}

{ok,[#{metadata => #{kind => fact},
       text => <<"Quarterly report is due on the 15th">>,
       key => <<"m2">>,score => 0.9788330406946226}]}

{ok,[{<<"m2">>,0.9403363021993156}]}

{error,embedder_not_configured}`;

export const vectordb: ComponentContent = {
  slug: 'vectordb',
  lead: 'An embedded vector store. Vectors, their text and metadata live in RocksDB, with an approximate nearest neighbour index, optional BM25 and hybrid fusion.',
  problem: 'Retrieval for agents needs nearest-neighbour search, keyword search for exact terms, and a way to combine both, without running a separate search service. barrel_vectordb gives you HNSW (pure Erlang, default), DiskANN or FAISS, BM25 in memory or on disk, RRF or linear fusion, quantization, encryption and a persisted index.',
  useWhen: [
    'You need vector or keyword retrieval without documents around it, for example an agent memory.',
    'You bring your own vectors, or want text embedded through a [barrel_embed](/product/embed) provider.',
    'You want hybrid search with tunable weights.',
  ],
  notWhen: [
    'Your vectors belong to documents: use [barrel](/product/barrel), which keeps the two under one id.',
    'You need exact substring or regex matches: use [barrel_ngram](/product/ngram).',
  ],
  dependsOn: ['crypto', 'embed'],
  external: 'rocksdb, hackney, iommap; a C NIF built with CMake; OTP 26 or later',
  optional: [
    { slug: 'faiss', text: '`backend => faiss`' },
    { slug: 'rerank', text: 'reranks results' },
  ],
  standalone: { short: 'Yes', text: 'Yes. barrel_embed is always pulled in, even when you supply every vector.' },
  install: { code: '{barrel_vectordb, "~> 2.5"}', lang: 'erlang', label: 'rebar.config deps' },
  reachedThrough: ['Erlang API', 'barrel facade (`vector_*`, `search*`, BQL table functions)', 'REST `/db/:db/search/*`, MCP `search`'],
  config: [
    { title: 'Store config', rows: [
      { key: 'name', def: 'required', meaning: 'Store name used by every call' },
      { key: 'path / db_path', def: '"priv/barrel_vectordb_<name>"', meaning: 'Relative to the current directory. Set it.' },
      { key: 'dimensions', def: '768', meaning: 'Vector size; mismatches return `{dimension_mismatch, _, _}`' },
      { key: 'embedder', def: 'none', meaning: 'Without one, text calls return `embedder_not_configured`' },
      { key: 'backend', def: 'hnsw', meaning: '`hnsw`, `diskann` or `faiss`' },
      { key: 'hnsw.m, hnsw.ef_construction', def: '16, 200', meaning: 'Graph degree and build effort' },
      { key: 'hnsw.quantization', def: 'scalar', meaning: '`turboquant`, `subspace_turboquant` or `none`' },
      { key: 'bm25_backend', def: 'none', meaning: '`memory` or `disk` to enable keyword search' },
      { key: 'read_only', def: 'false', meaning: 'Writes return `{error, read_only}`' },
    ] },
    { title: 'Search options', rows: [
      { key: 'k', def: '5 vector, 10 BM25 and hybrid', meaning: 'Number of results' },
      { key: 'filter', def: 'none', meaning: '`fun(Metadata) -> boolean()`, applied after retrieval' },
      { key: 'fusion', def: 'rrf', meaning: '`linear` uses `bm25_weight` and `vector_weight` (0.5 each)' },
      { key: 'ef_search', def: 'max(k, 50)', meaning: 'Search effort' },
    ] },
  ],
  api: [
    { title: 'Lifecycle', rows: [
      { task: 'Start a store', call: 'barrel_vectordb:start_link/1, start_supervised/1', returns: '`{ok, Pid}`' },
      { task: 'Stop, remove', call: 'barrel_vectordb:stop/1, destroy/1', returns: '`ok`' },
      { task: 'Persist the index', call: 'barrel_vectordb:persist_index/1, checkpoint/1', returns: '`ok`' },
    ] },
    { title: 'Write and read', rows: [
      { task: 'Add text (embedded)', call: 'barrel_vectordb:add/4,5, add_batch/2', returns: '`ok`' },
      { task: 'Add with a vector', call: 'barrel_vectordb:add_vector/5, add_vector_batch/2', returns: '`ok`, `{ok, #{inserted}}`' },
      { task: 'Replace text', call: 'barrel_vectordb:update/4, upsert/4', returns: '`ok`; re-embeds the text' },
      { task: 'Delete', call: 'barrel_vectordb:delete/2', returns: '`ok`' },
      { task: 'Read', call: 'barrel_vectordb:get/2, peek/2, count/1, stats/1', returns: '`{ok, #{key, text, metadata, vector}}` or `not_found`' },
    ] },
    { title: 'Search', rows: [
      { task: 'By text', call: 'barrel_vectordb:search/3', returns: '`{ok, [#{key, score, text, metadata}]}`' },
      { task: 'By vector', call: 'barrel_vectordb:search_vector/3', returns: 'same shape' },
      { task: 'Keyword', call: 'barrel_vectordb:search_bm25/3', returns: '`{ok, [{Id, Score}]}`' },
      { task: 'Hybrid', call: 'barrel_vectordb:search_hybrid/3', returns: '`{ok, [Hit]}`' },
    ] },
  ],
  examples: [
    { title: 'A small agent memory with your own vectors', intro: 'From a verified run. No embedder is configured, so text search reports it.', label: 'Erlang shell', code, output, outputLabel: 'Output, from a run on barrel_vectordb 2.5.1' },
  ],
  limits: [
    'The metadata filter runs after retrieval, so heavy filtering can return fewer than `k` results (a `k => 2` search returned 1).',
    'BM25 is off unless `bm25_backend` is set. A memory BM25 index rebuilds from the stored text at every open.',
    'There is no update with an explicit vector: `update/4` and `upsert/4` re-embed the text. If embedding fails, the old entry stays and the call returns the error (before 2.5.3 the entry was lost).',
    'A read-only open of a store that needs an upgrade fails with `read_only_upgrade_needed`.',
    'The app env keys in `barrel_vectordb.app.src` (`default_dimensions`, `hnsw_m`...) are never read; defaults come from code.',
  ],
  gaps: [
    'A store started with `barrel_vectordb:start_link/1` and no path lands in `./priv/barrel_vectordb_<name>` under the current directory. Through barrel, it goes next to the documents instead.',
  ],
  guides: [
    { label: 'Vector, keyword and hybrid', href: '/docs/search/hybrid' },
    { label: 'Choose an embedding provider', href: '/docs/search/embedding-providers' },
    { label: 'Reranking', href: '/docs/search/reranking' },
  ],
  apiRef: '/docs/lib/vectordb/',
};
