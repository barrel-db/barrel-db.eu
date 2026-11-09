import type { ComponentContent } from './types';

const code = `S3 = #{bucket => <<"barrel-matrix">>,
       endpoint => <<"http://127.0.0.1:29000">>,
       region => <<"us-east-1">>,
       access_key_id => <<"s3testadmin">>,
       secret_access_key => <<"s3testsecret">>},
{ok, _} = application:ensure_all_started(barrel_att_s3),
{ok, _} = barrel_docdb:create_db(<<"s3db">>,
    #{data_dir => Dir,
      att_opts => #{backend => s3, s3 => S3}}),
{ok, _} = barrel_docdb:put_doc(<<"s3db">>,
                               #{<<"id">> => <<"doc1">>}),
{ok, Info} = barrel_docdb:put_attachment(<<"s3db">>,
    <<"doc1">>, <<"greeting.txt">>, <<"Hello, World!">>),
io:format("put: ~p~n", [Info]),
io:format("get: ~p~n", [barrel_docdb:get_attachment(
    <<"s3db">>, <<"doc1">>, <<"greeting.txt">>)]),
io:format("create_only again: ~p~n",
    [element(1, barrel_docdb:put_attachment(<<"s3db">>,
        <<"doc1">>, <<"greeting.txt">>, <<"second">>,
        #{create_only => true}))]).`;

const output = `put: #{name => <<"greeting.txt">>,length => 13,
       digest => <<"sha256-dffd6021...a362182986f">>,
       content_type => <<"text/plain">>,chunked => false}
get: {ok,<<"Hello, World!">>}
create_only again: error`;

export const attS3: ComponentContent = {
  slug: 'att-s3',
  lead: 'An attachment backend for barrel_docdb that keeps file bytes in an S3-compatible bucket instead of the local RocksDB blob store.',
  problem: 'Large files fill local disks and are hard to share between nodes. With barrel_att_s3 the document stays in barrel_docdb while its attachments go to object storage, with the attachment feed, replication, branching (server-side copy), multipart uploads and cleanup of abandoned uploads.',
  useWhen: [
    'Attachments are large or many, and local disk is the limit.',
    'You already run S3-compatible storage (RustFS and Garage are tested in CI).',
  ],
  notWhen: [
    'The database is encrypted and the files must be too: S3 attachments are stored in plaintext.',
    'You need conditional writes on Garage: it cannot enforce them.',
  ],
  dependsOn: ['docdb'],
  external: 'livery_s3, livery, rocksdb, hlc, mimerl',
  standalone: { short: 'No', text: 'No. It is a backend that barrel_docdb loads through `att_opts`.' },
  install: { code: '{barrel_att_s3, "~> 0.1"}', lang: 'erlang', label: 'rebar.config deps', note: 'Not in the default umbrella build: use `rebar3 as s3 compile`.' },
  reachedThrough: ['`att_opts` of `barrel_docdb:create_db/2`', 'REST `PUT /db/:db` with `{"att_opts": {"backend": "s3", ...}}`', 'the normal attachment calls'],
  config: [
    { title: 'att_opts', rows: [
      { key: 'backend', def: 'blob', meaning: 'Set `s3`' },
      { key: 's3.bucket', def: 'required', meaning: 'Must exist; missing gives `{att_store_open_failed, missing_bucket}`' },
      { key: 's3.endpoint, s3.region', def: 'none', meaning: 'Where the store is' },
      { key: 's3.access_key_id, s3.secret_access_key', def: 'none', meaning: 'Credentials' },
      { key: 's3.part_size', def: '8 MiB', meaning: 'Multipart part size' },
    ] },
    { title: 'App env (barrel_att_s3)', rows: [
      { key: 'multipart_gc_interval', def: '1 h', meaning: 'Cleanup of abandoned uploads; 0 disables' },
      { key: 'multipart_gc_max_age', def: '24 h', meaning: 'Age before an upload is abandoned' },
    ] },
  ],
  api: [
    { title: 'Through barrel_docdb', rows: [
      { task: 'Use S3 for a database', call: 'barrel_docdb:create_db/2 with `att_opts`', returns: '`{ok, Pid}`' },
      { task: 'Store, read, delete', call: 'put_attachment/4,5, get_attachment/3, delete_attachment/3', returns: '`{ok, Info}`, `{ok, Bytes}`, `ok`' },
      { task: 'Write only if absent', call: 'put_attachment/5 with `create_only => true`', returns: '`{error, {conflict, Info}}` if it exists' },
      { task: 'Write if unchanged', call: 'put_attachment/5 with `expected_etag`', returns: '`{error, conditional_writes_unsupported}` on Garage' },
      { task: 'Stream', call: 'open_attachment_writer/4,5, open_attachment_stream/3,4', returns: 'writer and reader handles' },
    ] },
  ],
  examples: [
    { title: 'Attachments in a local RustFS bucket', intro: 'From a verified run against RustFS 1.0.0 in a container. Objects are keyed `<db>/<hex doc id>/<name>`.', label: 'Erlang', code, output, outputLabel: 'Output, from a run on barrel_att_s3 0.1.4 (digest trimmed)' },
  ],
  limits: [
    'Branching copies each attachment in the background; until done, reads answer `{error, {att_sync_pending, _}}`.',
    'Deleting a closed database needs `att_opts` again. Re-creating an open database with new `att_opts` silently does nothing.',
    'MinIO and AWS S3 are documented as supported but not tested in CI.',
    'Feed metadata stays local in `<db>/attachments/feed.db`.',
  ],
  gaps: [
    'Attachments are not encrypted by database encryption: with `encryption => default`, the object in the bucket held the plaintext.',
  ],
  guides: [
    { label: 'Attachments', href: '/docs/store/attachments' },
    { label: 'Encryption at rest', href: '/docs/guides/encryption' },
  ],
};
