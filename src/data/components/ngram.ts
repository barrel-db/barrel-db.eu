import type { ComponentContent } from './types';

const code = `{ok, _} = application:ensure_all_started(barrel_ngram).
{ok, _} = barrel_docdb:create_db(<<"runbooks">>).
barrel_docdb:put_docs(<<"runbooks">>, [
  #{<<"id">> => <<"rb:db">>,
    <<"title">> => <<"Postgres failover">>,
    <<"body">> => <<"If you see ERR_CONN_TIMEOUT=30s on "
                    "pg-primary-01, promote pg-replica-02.">>},
  #{<<"id">> => <<"rb:api">>, <<"title">> => <<"API 502s">>,
    <<"body">> => <<"Check upstream connect_timeout and "
                    "read_timeout in nginx.conf">>}]).
ok = barrel_ngram:open(<<"rb_idx">>,
    #{db => <<"runbooks">>,
      fields => [<<"title">>, <<"body">>]}).
barrel_ngram:index(<<"rb_idx">>).
barrel_ngram:search(<<"rb_idx">>, <<"ERR_CONN_TIMEOUT">>).
barrel_ngram:regex(<<"rb_idx">>,
                   <<"pg-(primary|replica)-\\\\d+">>).
barrel_ngram:regex(<<"rb_idx">>, <<"\\\\w+_timeout">>).
barrel_ngram:regex(<<"rb_idx">>, <<"(unclosed">>).`;

const output = `{ok,#{segments => 1,watermark => <<...>>}}

{ok,[#{id => <<"rb:db">>,spans => [{11,16}]}]}

{ok,[#{id => <<"rb:db">>,spans => [{35,13},{58,13}]}]}

{ok,[#{id => <<"rb:api">>,spans => [{15,15},{35,12}]}]}

{error,{bad_regex,{"missing closing parenthesis",9}}}`;

export const ngram: ComponentContent = {
  slug: 'ngram',
  lead: 'An exact substring and regex index over a barrel_docdb database. Every candidate is confirmed against the real text, so a hit is a real match.',
  problem: 'Semantic search misses identifiers, error strings, config keys and code symbols. barrel_ngram keeps a byte-level trigram index, built from immutable checksummed segments and kept live by the changes feed, and answers literal and PCRE regex queries with match spans.',
  useWhen: [
    'Agents search code, logs or runbooks for exact names such as `ERR_CONN_TIMEOUT` or `pg-replica-02`.',
    'You need regex search over documents with byte offsets of each match.',
  ],
  notWhen: [
    'You search by meaning: use vector or hybrid search in [barrel_vectordb](/product/vectordb).',
    'Disk is tight: the index is about 34 times the text size.',
  ],
  dependsOn: ['docdb'],
  external: 'a C NIF (vendored CRoaring) built with CMake on Linux, macOS and Windows',
  standalone: { short: 'Yes, with docdb', text: 'Yes, next to a barrel_docdb database. The barrel facade and BQL do not expose it.' },
  install: { code: '{barrel_ngram, "~> 0.11"}', lang: 'erlang', label: 'rebar.config deps' },
  reachedThrough: ['Erlang API', 'MCP tool `ngram_search` (barrel_server)'],
  config: [
    { title: 'open/2 options', rows: [
      { key: 'db', def: 'required', meaning: 'The barrel_docdb database to index' },
      { key: 'fields', def: 'all', meaning: 'Fields to index; fixed for the corpus' },
      { key: 'shards', def: '1', meaning: 'Up to 4096; fixed for the corpus' },
      { key: 'postings', def: 'varint', meaning: '`roaring` is the other encoding; fixed' },
      { key: 'freeze_threshold', def: '1000', meaning: 'Documents buffered before a segment is written' },
      { key: 'compact_threshold', def: '16', meaning: 'Segments before compaction, or `infinity`' },
      { key: 'verify_segments', def: 'checksum', meaning: '`layout` checks structure only' },
      { key: 'on_legacy', def: 'fail', meaning: '`reindex` rebuilds a 0.10 or older index' },
    ] },
    { title: 'App env (barrel_ngram)', rows: [
      { key: 'data_dir', def: '"data/barrel_ngram"', meaning: 'Relative to the current directory' },
    ] },
  ],
  api: [
    { title: 'Corpus', rows: [
      { task: 'Create or attach', call: 'barrel_ngram:open/2', returns: '`ok`, or `{error, {config_mismatch, Field, Old, New}}`' },
      { task: 'Catch up with the feed', call: 'barrel_ngram:index/1 (alias refresh/1)', returns: '`{ok, #{segments, watermark}}`' },
      { task: 'Compact', call: 'barrel_ngram:compact/1', returns: '`{ok, #{segments, doc_count}}` or `{error, busy}`' },
      { task: 'Close, delete', call: 'barrel_ngram:close/1, delete_corpus/1,2', returns: '`ok`' },
    ] },
    { title: 'Search', rows: [
      { task: 'Literal substring', call: 'barrel_ngram:search/2,3', returns: '`{ok, [#{id, spans => [{Offset, Length}]}]}`' },
      { task: 'Regex', call: 'barrel_ngram:regex/2,3', returns: 'same shape, or `{error, {bad_regex, _}}`' },
      { task: 'Ignore case', call: 'option `case_sensitive => false`', returns: 'default is case sensitive' },
    ] },
  ],
  examples: [
    { title: 'Find identifiers in runbooks', intro: 'From a verified run. Spans are byte offsets into the indexed fields, concatenated in sorted field order (`body` before `title`).', label: 'Erlang shell', code, output, outputLabel: 'Output, from a run on barrel_ngram 0.11.4' },
  ],
  limits: [
    'The index is about 34 times the text size.',
    '`db`, `fields`, `shards` and `postings` are fixed for the corpus. Changing them means `delete_corpus` and a rebuild.',
    '`index/1` is the synchronous catch-up point. Between calls, new writes reach the index through the background feed.',
    'Sharding and roaring postings exist and have tests, but were not part of the verified run.',
  ],
  guides: [
    { label: 'Substring and regex', href: '/docs/search/substring-regex' },
    { label: 'Index a codebase', href: '/docs/guides/code-indexing' },
  ],
};
