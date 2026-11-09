import type { ComponentContent } from './types';

const code = `%% p(L, V) -> io:format("~s: ~p~n", [L, V]).

{ok, #{id := SpaceId} = Space} =
    barrel_spaces:create_space(#{
        label => <<"joint research">>,
        owner => <<"alice">>, vectordb => none}),
{ok, _} = barrel:put_doc(maps:get(db, Space),
    #{<<"id">> => <<"notes">>, <<"text">> => <<"draft v1">>}),
{ok, Sid} = barrel_session:create(Space,
    #{agent => <<"alice">>, ttl => 1800}),
{ok, _} = barrel_session:add_message(Space, Sid,
    #{role => <<"user">>,
      content => <<"draft is half done">>}),

{ok, ReadTok, _Grant} = barrel_caps:grant(SpaceId,
    #{rights => [read], subject => <<"carol">>}),
p("carol verify write",
  barrel_caps:verify(ReadTok, SpaceId, write)),
p("carol on another scope",
  barrel_caps:verify(ReadTok, <<"sp_other">>, read)),
p("tampered token",
  barrel_caps:verify(<<ReadTok/binary, "x">>,
                     SpaceId, read)),

{ok, #{token := HTok}} = barrel_handoff:create(Space, #{
    task_name  => <<"finish the draft">>,
    from_agent => <<"alice">>, to_agent => <<"bob">>,
    from_session => Sid,
    pending    => [<<"polish conclusion">>]}),
p("handoff token verify write",
  element(1, barrel_caps:verify(HTok, SpaceId, write))),
p("handoff token verify admin",
  barrel_caps:verify(HTok, SpaceId, admin)),

{ok, #{handoff := H, space := BobSpace}} =
    barrel_handoff:accept(HTok, #{agent => <<"bob">>}),
p("accepted", {maps:get(<<"status">>, H),
               maps:get(<<"accepted_by">>, H)}),
p("second accept",
  barrel_handoff:accept(HTok, #{agent => <<"mallory">>})),
{ok, Notes} = barrel:get_doc(maps:get(db, BobSpace),
                             <<"notes">>),
p("bob reads notes", maps:get(<<"text">>, Notes)),
{ok, Msgs} = barrel_session:get_messages(BobSpace, Sid),
p("bob reads alice's messages",
  [maps:get(<<"content">>, M) || M <- Msgs]),

{ok, Done} = barrel_handoff:complete(HTok,
    #{result => <<"shipped">>}),
p("completed", maps:get(<<"status">>, Done)),
p("handoff token after complete",
  barrel_caps:verify(HTok, SpaceId, read)),
ok = barrel_caps:revoke(ReadTok),
p("carol after revoke",
  barrel_caps:verify(ReadTok, SpaceId, read)).`;

const output = `carol verify write: {error,forbidden}
carol on another scope: {error,wrong_space}
tampered token: {error,invalid_token}
handoff token verify write: ok
handoff token verify admin: {error,forbidden}
accepted: {<<"accepted">>,<<"bob">>}
second accept: {error,already_accepted}
bob reads notes: <<"draft v1">>
bob reads alice's messages: [<<"draft is half done">>]
completed: <<"completed">>
handoff token after complete: {error,revoked}
carol after revoke: {error,revoked}`;

const rest = `# open server (no auth configured)
curl -X POST $B/spaces \\
  -H 'content-type: application/json' \\
  -d '{"label":"joint research","owner":"alice"}'
# 201 {"ok":true,"space":"sp_..."}

curl -X POST $B/spaces/$SPACE/grants \\
  -H 'content-type: application/json' \\
  -d '{"rights":["read"],"subject":"carol"}'
# 201 {"token":"bsp_...","grant":{...}}

curl -X POST $B/handoffs \\
  -H 'content-type: application/json' \\
  -d '{"space":"'$SPACE'",
       "task_name":"finish the draft",
       "from_agent":"alice","to_agent":"bob"}'

curl -X POST $B/handoffs/accept \\
  -H 'content-type: application/json' \\
  -d '{"token":"'$HTOK'","agent":"bob"}'

curl -X POST $B/handoffs/complete \\
  -H 'content-type: application/json' \\
  -d '{"token":"'$HTOK'","result":"shipped"}'`;

const mcp = `{"name": "space_create",
 "arguments": {"label": "joint research",
               "owner": "alice"}}

{"name": "space_grant",
 "arguments": {"space": "sp_...", "rights": ["read"],
               "subject": "carol"}}

{"name": "handoff_create",
 "arguments": {"space": "sp_...",
               "task_name": "finish the draft",
               "from_agent": "alice", "to_agent": "bob"}}

{"name": "handoff_accept",
 "arguments": {"token": "bsp_...", "agent": "bob"}}

{"name": "handoff_complete",
 "arguments": {"token": "bsp_...", "result": "shipped"}}`;

export const spaces: ComponentContent = {
  slug: 'spaces',
  lead: 'Give each agent, team or task its own database, and share it by handing out a token. Sessions hold an agent\'s working memory for a while; a handoff passes a task, and the rights to finish it, to another agent.',
  problem: 'Several agents working on shared data need separate databases, a way to give one agent read access and another write access, short-lived working memory, and a clean way to pass unfinished work along. barrel_spaces adds those pieces on top of barrel databases.',
  useWhen: [
    'Several agents work on the same data and each should only read or write what it was given.',
    'An agent needs a conversation log, scratch data and pinned notes that expire on their own.',
    'One agent starts a task and another finishes it, with what was done and what is left.',
  ],
  notWhen: [
    'You only need one database for one application: use [barrel](/product/barrel) directly. Spaces add the sharing and session layer on top of it.',
    'You need isolation between Erlang processes on the same node: tokens do not give you that (see limits); use per-space encryption.',
  ],
  dependsOn: ['barrel', 'docdb', 'crypto'],
  external: 'none beyond the Barrel libraries',
  standalone: { short: 'No', text: 'No. A space is a barrel database, so barrel and barrel_docdb come with it.' },
  install: { code: '{barrel_spaces, "~> 1.3"}', lang: 'erlang', label: 'rebar.config deps' },
  reachedThrough: ['Erlang API', 'REST `/spaces` and `/handoffs` (barrel_server)', 'MCP tools `space_*`, `session_*`, `handoff_*`'],
  config: [
    { title: 'create_space/1 options', rows: [
      { key: 'label, purpose, owner', def: 'none', meaning: 'Stored in the registry document' },
      { key: 'session_ttl', def: '3600 s', meaning: 'Default TTL of sessions in this space' },
      { key: 'ttl_sweep_interval', def: '60000 ms', meaning: 'How often expired sessions are swept' },
      { key: 'vectordb', def: 'a vector store', meaning: '`none` for documents only, or a store config map' },
      { key: 'encryption', def: 'disabled', meaning: '`default` or `#{provider => Mod}`; the in-process isolation boundary' },
      { key: 'embedding', def: 'none', meaning: 'Record-mode policy for the space database' },
    ] },
    { title: 'App env (barrel_spaces)', rows: [
      { key: 'registry_db', def: '_barrel_spaces', meaning: 'Database holding spaces, grants and handoffs' },
      { key: 'janitor_interval', def: '300000 ms', meaning: 'Registry cleanup interval' },
      { key: 'embedder', def: 'none', meaning: 'Embedder used to reopen record-mode spaces' },
    ] },
  ],
  api: [
    { title: 'Spaces', rows: [
      { task: 'Create a space', call: 'barrel_spaces:create_space/1', returns: '`{ok, #{id, db}}`' },
      { task: 'Open, close', call: 'barrel_spaces:open_space/1,2, close_space/1', returns: '`{ok, Space}`, or `space_dropped`, `not_found`, `db_is_encrypted`' },
      { task: 'Drop (revokes every grant)', call: 'barrel_spaces:drop_space/1,2', returns: '`ok`' },
      { task: 'List, describe', call: 'barrel_spaces:list_spaces/0, space_info/1', returns: 'registry documents' },
    ] },
    { title: 'Capability tokens', rows: [
      { task: 'Issue a token', call: 'barrel_caps:grant/2', returns: '`{ok, Token, Grant}`; the token is shown once' },
      { task: 'Check a right', call: 'barrel_caps:verify/3', returns: '`{ok, Grant}` or `invalid_token`, `revoked`, `expired`, `wrong_space`, `forbidden`' },
      { task: 'Revoke', call: 'barrel_caps:revoke/1, revoke_all/1', returns: '`ok`' },
      { task: 'Who holds it', call: 'barrel_caps:auth_context/1, list/1', returns: '`{ok, #{space, subject, rights, scopes}}`' },
    ] },
    { title: 'Sessions', rows: [
      { task: 'Start a session', call: 'barrel_session:create/1,2', returns: '`{ok, Sid}`' },
      { task: 'Keep it alive', call: 'barrel_session:touch/2', returns: '`{ok, _}`' },
      { task: 'Log a message', call: 'barrel_session:add_message/3', returns: '`{ok, _}`' },
      { task: 'Read messages', call: 'barrel_session:get_messages/2,3', returns: '`{ok, [Msg]}`; options `limit`, `order`, `since`, `before`' },
      { task: 'Scratch data, pins', call: 'set_data/4, get_data/3, pin_context/3, list_pinned/2', returns: '`{ok, _}`' },
    ] },
    { title: 'Handoffs', rows: [
      { task: 'Hand off a task', call: 'barrel_handoff:create/2', returns: '`{ok, #{handoff_id, token}}`' },
      { task: 'Accept it', call: 'barrel_handoff:accept/2', returns: '`{ok, #{handoff, space, session}}`' },
      { task: 'Finish it', call: 'barrel_handoff:complete/2', returns: '`{ok, Handoff}`; revokes the token by default' },
      { task: 'Pass it on', call: 'barrel_handoff:chain/2', returns: 'a new handoff, instead of completing' },
      { task: 'Find handoffs', call: 'barrel_handoff:list/1, get/1', returns: 'handoff documents' },
    ] },
  ],
  flow: {
    title: 'How a handoff moves through a space',
    intro: 'Alice works in a space, hands the task to Bob, and Bob finishes it. Carol only holds a read token. This is the verified run below, step by step.',
    steps: [
      { title: 'Create a space', body: 'A new barrel database, registered under an id.', call: 'barrel_spaces:create_space/1' },
      { title: 'Grant a token', body: 'Carol gets read rights on this space only.', call: 'barrel_caps:grant/2' },
      { title: 'Hand off', body: 'Alice passes the task, her session and what is pending.', call: 'barrel_handoff:create/2', accent: true },
      { title: 'Accept, then complete', body: 'Bob reads Alice\'s notes and messages, finishes, and the token is revoked.', call: 'barrel_handoff:accept/2', accent: true },
    ],
  },
  table: {
    caption: 'Results of `barrel_caps:verify/3`. Cells marked with an asterisk were not called in the run; they follow from the rights ladder read < write < admin in `barrel_caps.erl`. The handoff token is revoked once Bob completes the task.',
    head: ['Who', 'read', 'write', 'admin'],
    rows: [
      ['Carol', 'ok', 'forbidden', 'forbidden*'],
      ['Handoff token', 'ok*', 'ok', 'forbidden'],
      ['Any token, other space', 'wrong_space', 'wrong_space*', 'wrong_space*'],
    ],
  },
  examples: [
    { title: 'The flow, in code', intro: 'Run with the `barrel_spaces` application started and `barrel_docdb` `data_dir` set.', label: 'spaces_demo.erl (abridged)', code, output, outputLabel: 'Output, from a run on barrel_spaces 1.3.1 (lines for the calls shown)' },
  ],
  tabs: {
    title: 'The same steps over REST and MCP',
    intro: 'Calls only, against an open server. The create and grant calls were run live with these answers; the handoff calls are written from the route handlers and the registered tool schemas.',
    tabs: [
      { label: 'REST', code: rest, lang: 'bash' },
      { label: 'MCP', code: mcp, lang: 'json' },
    ],
  },
  limits: [
    'Tokens are checked by the server, over REST and MCP. Inside your own Erlang node, `open_space/1` and every `barrel_session` call take no token, so any code can open any space (verified). Use per-space encryption if processes must not read each other\'s data.',
    'Accepting, completing or chaining a handoff only checks the read right on its token.',
    'A space\'s vector store lives on one node, at `<data_dir>/<id>_vec`, and is not replicated.',
    'Encrypted spaces can be opened through the Erlang API only, not over REST or MCP.',
    '`chain/2` and `complete/2` are alternatives: after `complete`, the token is revoked and `chain` fails.',
  ],
  guides: [
    { label: 'Guide: spaces, sessions, handoffs', href: '/docs/guides/spaces' },
    { label: 'Concepts: spaces and capabilities', href: '/docs/concepts/spaces' },
    { label: 'MCP endpoint', href: '/docs/guides/mcp' },
  ],
  apiRef: '/docs/lib/spaces/',
};
