import type { ComponentContent } from './types';

const code = `{ok, _} = application:ensure_all_started(barrel).
{ok, Db} = barrel:open(<<"research">>, #{vectordb => #{
    db_path => filename:join(VecDir, "research"),
    dimensions => 64,
    embedder => {kb_embed, #{}},
    bm25_backend => memory}}).
Notes = [
  {<<"paper:raft">>, <<"Raft consensus: leader election "
     "and log replication for replicated state machines">>,
   #{<<"topic">> => <<"distributed-systems">>,
     <<"year">> => 2014}},
  {<<"paper:crdt">>, <<"Conflict-free replicated data "
     "types converge without coordination">>,
   #{<<"topic">> => <<"distributed-systems">>,
     <<"year">> => 2011}},
  {<<"paper:hnsw">>, <<"HNSW: hierarchical navigable small "
     "world graphs for approximate nearest neighbor "
     "search">>,
   #{<<"topic">> => <<"vector-search">>,
     <<"year">> => 2016}},
  {<<"paper:bm25">>, <<"Okapi BM25 ranking function for "
     "keyword search over documents">>,
   #{<<"topic">> => <<"information-retrieval">>,
     <<"year">> => 1994}}].
[{ok, _} = barrel:put_doc(Db,
    M#{<<"id">> => Id, <<"abstract">> => T})
 || {Id, T, M} <- Notes].
barrel:vector_add_batch(Db, Notes).
barrel:search(Db, <<"leader election in replicated logs">>,
              #{k => 2}).
barrel:search_bm25(Db, <<"keyword search">>, #{k => 2}).
barrel:query(Db, <<"SELECT v.id, v._score, v._distance, "
    "abstract FROM vector_top_k("
    "'replicated state machines', k => 2) AS v">>).`;

const output = `{ok,#{inserted => 4}}

{ok,[#{metadata => #{<<"topic">> => <<"distributed-systems">>,
                     <<"year">> => 2014},
       text => <<"Raft consensus: ...">>,
       key => <<"paper:raft">>,score => 0.5257737534501699},
     #{metadata => #{<<"topic">> => <<"distributed-systems">>,
                     <<"year">> => 2011},
       text => <<"Conflict-free replicated data types ...">>,
       key => <<"paper:crdt">>,score => 0.14173227881546058}]}

{ok,[{<<"paper:bm25">>,1.9587592623731485},
     {<<"paper:hnsw">>,0.6586049622596158}]}

{ok,[#{<<"_distance">> => 0.5158329928408527,
       <<"_score">> => 0.4841670071591473,
       <<"abstract">> => <<"Raft consensus: ...">>,
       <<"id">> => <<"paper:raft">>},
     #{<<"_distance">> => 0.7817821172596275,
       <<"_score">> => 0.21821788274037246,
       <<"abstract">> => <<"Conflict-free replicated ...">>,
       <<"id">> => <<"paper:crdt">>}],
    #{count => 2, has_more => false, ...}}`;

export const barrel: ComponentContent = {
  slug: 'barrel',
  lead: 'The embeddable database. One `barrel` database is a document database and a vector store under one name and one id space, so a document, its attachments and its vector share an id.',
  problem: 'Agents and search features need documents, files and vectors that stay together. Keeping a document store and a vector index side by side means two ids, two lifecycles and writes that drift apart. barrel composes them, adds record mode (embeddings kept in sync with the documents), BQL with search table functions and live queries, timeline (branch, recover, merge), contexts and export.',
  useWhen: [
    'You build an Erlang or Elixir application and want documents, attachments and vector search in-process.',
    'You want embeddings computed from document fields and kept in sync on every write (record mode).',
    'You want to branch a database for an agent run, review it, and merge it back.',
  ],
  notWhen: [
    'You need clients over the network: run [barrel_server](/product/server) on top.',
    'You only need documents and sync, no vectors: [barrel_docdb](/product/docdb) alone is enough.',
    'You need replication through this facade: it is not exposed here yet; call `barrel_rep` on the docdb name.',
  ],
  dependsOn: ['docdb', 'vectordb', 'embed', 'crypto'],
  external: 'hackney (remote context client); OTP 26 or later',
  standalone: { short: 'Yes', text: 'Yes, as a library. It serves no network protocol on its own.' },
  install: { code: '{barrel, "~> 1.13"}', lang: 'erlang', label: 'rebar.config deps', note: 'Record mode needs the `barrel` application started; otherwise opens with a policy return `{error, barrel_app_not_started}`.' },
  reachedThrough: ['Erlang API', 'REST and MCP through barrel_server'],
  config: [
    { title: 'barrel:open/2 options', rows: [
      { key: 'docdb', def: '#{}', meaning: 'Options passed to `barrel_docdb:create_db/2`' },
      { key: 'vectordb', def: 'a vector store', meaning: 'Store config map, or `none` for documents only' },
      { key: 'vectordb.db_path', def: '<data_dir>/<name>.vectordb', meaning: 'Next to the documents. A store created before 1.13.0 in `./priv/barrel_vectordb_<name>` stays there.' },
      { key: 'embedding', def: 'none', meaning: 'Record-mode policy map, or `stored` to reuse the saved one' },
      { key: 'encryption', def: 'disabled', meaning: '`default` or `#{provider => Mod}`' },
      { key: 'read_only', def: 'false', meaning: 'Writes return `{error, read_only}`' },
      { key: 'store_supervised', def: 'false', meaning: 'By default the vector store is linked to the caller' },
    ] },
    { title: 'Record-mode policy', rows: [
      { key: 'fields', def: 'all', meaning: 'Paths whose text is embedded' },
      { key: 'mode', def: 'async', meaning: '`sync` embeds before the write returns' },
      { key: 'dimensions', def: '768', meaning: 'Vector size' },
      { key: 'embedder', def: 'none', meaning: 'A barrel_embed provider config' },
      { key: 'metadata_fields', def: 'document minus id and _ keys', meaning: 'Fields copied into vector metadata' },
    ] },
    { title: 'App env (barrel)', rows: [
      { key: 'dbs_idle_timeout', def: '300000 ms', meaning: '`barrel_dbs` closes idle databases; 0 disables' },
      { key: 'dbs_max_open', def: '0', meaning: 'Open database limit; 0 is unlimited' },
      { key: 'ctx_max_contexts', def: '8', meaning: 'Contexts per federated query' },
      { key: 'ctx_deadline_ms', def: '5000', meaning: 'Context query deadline (max 60000)' },
    ] },
  ],
  api: [
    { title: 'Open and manage', rows: [
      { task: 'Open or create', call: 'barrel:open/1,2', returns: '`{ok, Db}`' },
      { task: 'Close, delete', call: 'barrel:close/1, delete/1', returns: '`ok`' },
      { task: 'Describe', call: 'barrel:info/1', returns: 'docdb info plus embedding, dimensions, embedder' },
      { task: 'Managed lifecycle', call: 'barrel_dbs:ensure/1,2, lease/2, release/1', returns: '`{ok, Db}`, `{ok, Db, LeaseRef}`' },
    ] },
    { title: 'Documents and files', rows: [
      { task: 'Write', call: 'barrel:put_doc/2,3, put_docs/2,3', returns: '`{ok, #{<<"id">>, <<"rev">>, <<"ok">>}}`' },
      { task: 'Read', call: 'barrel:get_doc/2,3, get_docs/2,3', returns: '`{ok, Doc}`' },
      { task: 'Delete', call: 'barrel:delete_doc/2,3', returns: '`{ok, _}`' },
      { task: 'Find', call: 'barrel:find/2,3', returns: '`{ok, Rows, Meta}`' },
      { task: 'Attach a file', call: 'barrel:put_attachment/4,5, get_attachment/3', returns: '`{ok, Info}`, `{ok, Bytes}`' },
    ] },
    { title: 'Search and query', rows: [
      { task: 'Add a vector', call: 'barrel:vector_add/4,5, vector_add_batch/2', returns: '`ok`, `{ok, #{inserted}}`' },
      { task: 'Semantic search', call: 'barrel:search/3, search_vector/3', returns: '`{ok, [#{key, score, text, metadata}]}`' },
      { task: 'Keyword, hybrid', call: 'barrel:search_bm25/3, search_hybrid/3', returns: '`{ok, [{Id, Score}]}`, `{ok, [Hit]}`' },
      { task: 'BQL', call: 'barrel:query/2,3, explain_query/2,3', returns: '`{ok, Rows, Meta}`' },
      { task: 'Live query', call: 'barrel:subscribe_query/2,3, unsubscribe_query/1', returns: '`{ok, #{pid, ref}}`, then `bql_rows`, `bql_ready`, `bql_change` messages' },
    ] },
    { title: 'Timeline and history', rows: [
      { task: 'Branch', call: 'barrel:branch/2,3', returns: '`{ok, BranchDb}`' },
      { task: 'Merge back', call: 'barrel:merge/1,2', returns: '`{ok, Report}`' },
      { task: 'Changes', call: 'barrel:changes/2,3, subscribe/2,3', returns: 'changes list, or a stream pid' },
      { task: 'Versions', call: 'barrel:doc_versions/2, version_body/3', returns: '`{ok, [Version]}`, `{ok, Body}`' },
    ] },
  ],
  examples: [
    { title: 'Documents, vectors, BM25 and BQL in one database', intro: 'From a verified run. `kb_embed` is a 64-dimension demo provider written for the run (feature hashing: it matches shared words, it is not semantic). Any [barrel_embed](/product/embed) provider works in its place.', label: 'Erlang shell', code, output, outputLabel: 'Output, from a run on barrel 1.12.0 (trimmed)' },
  ],
  limits: [
    'A vector store created before barrel 1.13.0 without `db_path` stays in `./priv/barrel_vectordb_<name>` under the current directory, with a notice in the log. A backup of `data_dir` alone misses it; new stores go to `<data_dir>/<name>.vectordb`.',
    'The vector store is linked to the process that opened it. Use `barrel_dbs` or `store_supervised => true` for long-lived owners.',
    'In plain mode, `put_doc` and `vector_add` are separate writes. Record mode is the atomic path.',
    'Changing a record-mode policy on reopen logs a warning and does not reindex existing documents.',
    'Plain branches carry no vectors. A branch of a branch is refused (`cannot_branch_a_branch`).',
    'Export needs a vector store (`{error, no_vector_store}` otherwise) and closes the database during the copy.',
    'Context queries need `LIMIT`; OFFSET, UNNEST, SUBSCRIBE and continuation are refused.',
  ],
  gaps: [
    '`find/2` `order_by` on a path is ignored unless the path is selected or bound to a variable. BQL `ORDER BY` sorts correctly.',
  ],
  guides: [
    { label: 'Embed barrel in an Erlang app', href: '/docs/guides/embedding' },
    { label: 'Record mode', href: '/docs/guides/record-mode' },
    { label: 'Query with BQL', href: '/docs/guides/query-bql' },
    { label: 'Branch, merge, recover', href: '/docs/guides/timeline' },
    { label: 'Query several datasets', href: '/docs/guides/contexts' },
    { label: 'Barrel API reference', href: '/docs/reference/barrel-api' },
  ],
  apiRef: '/docs/lib/barrel/',
};
