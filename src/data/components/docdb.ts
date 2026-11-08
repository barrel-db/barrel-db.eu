import type { ComponentContent } from './types';

const code = `{ok, _} = application:ensure_all_started(barrel_docdb).
{ok, _} = barrel_docdb:create_db(<<"kb">>).
barrel_docdb:put_docs(<<"kb">>, [
  #{<<"id">> => <<"kb:101">>, <<"type">> => <<"article">>,
    <<"title">> => <<"Reset a forgotten password">>,
    <<"views">> => 1200,
    <<"tags">> => [<<"account">>, <<"login">>]},
  #{<<"id">> => <<"kb:102">>, <<"type">> => <<"article">>,
    <<"title">> => <<"Configure SSO with Okta">>,
    <<"views">> => 430,
    <<"tags">> => [<<"sso">>, <<"login">>]},
  #{<<"id">> => <<"kb:201">>, <<"type">> => <<"article">>,
    <<"title">> => <<"Export invoices as CSV">>,
    <<"views">> => 980,
    <<"tags">> => [<<"export">>]}]).
barrel_docdb:find(<<"kb">>, #{id_prefix => <<"kb:1">>,
                              include_docs => false}).
barrel_docdb:query(<<"kb">>,
  <<"SELECT title, views FROM kb WHERE type = 'article' "
    "AND views >= 500 ORDER BY views DESC">>).`;

const output = `[{ok,#{<<"id">> => <<"kb:101">>,<<"ok">> => true,
      <<"rev">> =>
        <<"000001a1b8784bea00000000@waec6d4b23aba0dca">>}},
 ...]

{ok,[#{<<"id">> => <<"kb:101">>},#{<<"id">> => <<"kb:102">>}],
    #{has_more => false, ...}}

{ok,[#{<<"id">> => <<"kb:101">>,
       <<"title">> => <<"Reset a forgotten password">>,
       <<"views">> => 1200},
     #{<<"id">> => <<"kb:201">>,
       <<"title">> => <<"Export invoices as CSV">>,
       <<"views">> => 980}],
    #{count => 2, has_more => false, ...}}`;

const code2 = `barrel_rep:replicate(<<"edge_a">>, <<"edge_b">>),
barrel_rep:replicate(<<"edge_b">>, <<"edge_a">>).
%% both sides edited task:1 while apart
barrel_docdb:get_conflicts(<<"edge_a">>, <<"task:1">>).
{ok, #{<<"_observed">> := Seen}} =
    barrel_docdb:get_doc(<<"edge_a">>, <<"task:1">>,
                         #{conflicts => true}).
barrel_docdb:resolve_conflict(<<"edge_a">>, <<"task:1">>,
    Seen, {merge, Merged}).
%% Merged: the body to keep, here with a "note" field`;

const output2 = `{ok,[<<"000001a1b879d59100000000@w7bcb971434496877">>]}

{ok,#{id => <<"task:1">>,
      rev => <<"000001a1b879d59500000000@w7bcb971434496877">>,
      conflicts_resolved => 1}}`;

export const docdb: ComponentContent = {
  slug: 'docdb',
  lead: 'An embedded document database on RocksDB. Writes are versioned with hybrid logical clocks and version vectors, every path is indexed for queries, and databases replicate active-active.',
  problem: 'Copies of the same data on several nodes, devices or agents get written while apart. barrel_docdb keeps every concurrent version as a conflict sibling instead of losing one, lets you resolve it, and gives you queries, a changes feed, attachments, retained history with provenance, TTL and branches on the same store.',
  useWhen: [
    'You need documents that sync between nodes or sites, with conflicts kept and resolvable.',
    'You need queries on any field without declaring indexes, through `find/2` or BQL.',
    'You need an audit trail: who wrote each version, and the body of past versions.',
  ],
  notWhen: [
    'You also need vectors or semantic search: use [barrel](/product/barrel), which composes this with a vector store.',
    'You need aggregates, GROUP BY or joins: BQL has none.',
  ],
  dependsOn: ['crypto'],
  external: 'rocksdb, hackney, hlc, match_trie, mimerl, instrument',
  optional: [{ slug: 'att-s3', text: 'stores attachment bytes in S3-compatible storage' }],
  standalone: { short: 'Yes', text: 'Yes. Replication (`barrel_rep`, `barrel_rep_tasks`) and BQL for documents live here.' },
  install: { code: '{barrel_docdb, "~> 2.1"}', lang: 'erlang', label: 'rebar.config deps', note: '2.1.0 changed replication. Upgrading from 2.0 can need `barrel_rep:reconcile/3`.' },
  reachedThrough: ['Erlang API', 'barrel facade', 'REST `/db/:db/*` and the `_sync` wire (barrel_server)'],
  config: [
    { title: 'create_db/2 options', rows: [
      { key: 'data_dir', def: 'app env data_dir', meaning: 'Where the database files go' },
      { key: 'att_opts', def: 'RocksDB blob store', meaning: '`#{backend => none}` skips it, `s3` uses barrel_att_s3' },
      { key: 'encryption', def: 'disabled', meaning: '`default` or `#{provider => Mod}`' },
      { key: 'channels', def: 'none', meaning: '`#{Name => [Pattern]}`, fixed at creation' },
      { key: 'retention_period', def: '2592000 s (30 days)', meaning: 'History kept; 0 disables the sweeper' },
      { key: 'ttl_sweep_interval', def: '0 (off)', meaning: 'Background sweep of expired documents' },
      { key: 'max_conflict_versions', def: '8', meaning: 'Conflict siblings kept per document' },
      { key: 'conflict_resolver', def: 'none', meaning: 'Automatic resolution on replication' },
    ] },
    { title: 'App env (barrel_docdb)', rows: [
      { key: 'data_dir', def: '"data/barrel_docdb"', meaning: 'Relative to the current directory' },
      { key: 'block_cache_size', def: '512 MiB', meaning: 'RocksDB block cache' },
      { key: 'query_timeout_ms', def: '30000', meaning: 'Query deadline' },
    ] },
  ],
  api: [
    { title: 'Databases', rows: [
      { task: 'Create, open', call: 'barrel_docdb:create_db/1,2, open_db/1', returns: '`{ok, Pid}`' },
      { task: 'Close, delete', call: 'barrel_docdb:close_db/1, delete_db/1,2', returns: '`ok`' },
      { task: 'Describe, list', call: 'barrel_docdb:db_info/1, list_dbs/0', returns: 'info map, names' },
    ] },
    { title: 'Documents', rows: [
      { task: 'Write', call: 'barrel_docdb:put_doc/2,3, put_docs/2,3', returns: '`{ok, #{id, rev, ok}}`; `{error, conflict}` without the current `_rev`' },
      { task: 'Read', call: 'barrel_docdb:get_doc/2,3, get_docs/2,3', returns: '`{ok, Doc}` or `{error, not_found}`' },
      { task: 'Delete', call: 'barrel_docdb:delete_doc/2,3', returns: '`{ok, _}`' },
      { task: 'Conflicts', call: 'barrel_docdb:get_conflicts/2, resolve_conflict/4', returns: '`{ok, [Rev]}`, `{ok, #{conflicts_resolved}}`' },
    ] },
    { title: 'Query and changes', rows: [
      { task: 'Structured query', call: 'barrel_docdb:find/2,3, explain/2', returns: '`{ok, Rows, Meta}`' },
      { task: 'BQL (documents only)', call: 'barrel_docdb:query/2,3', returns: '`{ok, Rows, Meta}`' },
      { task: 'Changes feed', call: 'barrel_docdb:get_changes/2,3, subscribe_changes/2,3', returns: '`{ok, Changes, Last}`, a stream pid' },
      { task: 'Path subscription', call: 'barrel_docdb:subscribe/2,3, unsubscribe/1', returns: '`{barrel_change, Db, Change}` messages' },
    ] },
    { title: 'Files, history, timeline, sync', rows: [
      { task: 'Attachments', call: 'put_attachment/4,5, get_attachment/3, open_attachment_writer/4,5', returns: '`{ok, Info}`, `{ok, Bytes}`' },
      { task: 'Versions', call: 'get_doc_versions/2, get_version_body/3, fold_history/3,4', returns: '`{ok, [Version]}` with provenance' },
      { task: 'Branch, merge', call: 'branch_db/3, merge_branch/2, list_branches/1', returns: '`{ok, _}`, `{ok, Report}`' },
      { task: 'Replicate once', call: 'barrel_rep:replicate/2,3', returns: '`{ok, Report}`' },
      { task: 'Continuous task', call: 'barrel_rep_tasks:start_task/1, get_task/1, stop_task/1', returns: '`{ok, TaskId}`' },
    ] },
  ],
  examples: [
    { title: 'Write, find and query', intro: 'From a verified run on a fresh data directory.', label: 'Erlang shell', code, output, outputLabel: 'Output, from a run on barrel_docdb 2.1.0 (trimmed)' },
    { title: 'Resolve a conflict after two-way replication', intro: 'Two local databases edited the same document, then replicated both ways. The resolution names the versions it observed.', label: 'Erlang shell', code: code2, output: output2, outputLabel: 'Output, from the same run' },
  ],
  limits: [
    'Lineage is linear: a branch of a branch is refused, and a point-in-time branch older than the history floor fails with `pitr_window_exceeded`.',
    'Replication does not carry vectors or provenance. Channels do not delete departed documents on replicas.',
    'Replication tasks refuse inline credentials. Attachment checkpoints wait for the target to be durable unless you set `att_durability => best_effort`.',
    'Runtime settings (`encryption`, `read_only`, `channels`, `conflict_resolver`, retention) must be passed again on every reopen.',
    'The app env `data_dir` is relative to the current directory. The `create_db/2` doc still says `/tmp/barrel_data`.',
  ],
  gaps: [
    '`find/2` `order_by` on a path is ignored unless that path is selected or bound to a variable.',
    'A chunked BQL query with a range predicate dropped a row on continuation once in testing; not yet minimized.',
  ],
  guides: [
    { label: 'Synchronization', href: '/docs/guides/synchronization' },
    { label: 'Conflicts', href: '/docs/replicate/conflicts' },
    { label: 'Upgrade from 2.0', href: '/docs/replicate/upgrade-from-2-0' },
    { label: 'Query with BQL', href: '/docs/guides/query-bql' },
    { label: 'Attachments', href: '/docs/store/attachments' },
    { label: 'Audit and provenance', href: '/docs/guides/audit-provenance' },
  ],
  apiRef: '/docs/lib/docdb/',
};
