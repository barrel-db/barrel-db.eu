import type { ComponentContent } from './types';

const sysConfig = `[
 {barrel_server, [{http_port, 8080},
                  {data_dir, "/var/lib/barrel"}]}
].`;

const code = `curl -X PUT $B/db/demo
curl -X PUT $B/db/demo/doc/a \\
  -H 'content-type: application/json' \\
  -d '{"title":"hello world","kind":"note","n":1}'
curl -X PUT $B/db/demo/doc/a \\
  -H 'content-type: application/json' \\
  -d '{"title":"stale","_rev":"bogus"}'
curl -X POST $B/db/demo/query \\
  -H 'content-type: text/plain' \\
  --data-binary "SELECT id, title FROM c
    WHERE kind = 'note' ORDER BY id LIMIT 2"`;

const output = `201 {"ok":true,"db":"demo"}

201 {"id":"a","ok":true,
     "rev":"000001a1b876972d00000000@w78160d59891ba7d7"}

409 {"error":"conflict"}

200 application/x-ndjson
{"row":{"id":"a","title":"hello world"}}
{"row":{"id":"c","title":"third"}}
{"meta":{"count":2,"bound":"limit_reached",
         "has_more":false, ...}}`;

export const server: ComponentContent = {
  slug: 'server',
  lead: 'Barrel over HTTP: a REST API, an MCP endpoint for agents, and the replication wire that other nodes and browsers sync through.',
  problem: 'Agents, services and browsers that are not Erlang processes need to reach the database, with access control. barrel_server exposes databases, search, timeline, spaces and contexts over REST, serves 39 MCP tools at `/mcp`, and checks bearer tokens, capability tokens, signed requests or mTLS.',
  useWhen: [
    'Clients in other languages, or agents through MCP, need to read and write.',
    'Nodes or barrel-lite browsers replicate over HTTP.',
    'You want capability tokens enforced: the server is where they are checked.',
  ],
  notWhen: [
    'Everything runs in one Erlang node: call [barrel](/product/barrel) directly.',
  ],
  dependsOn: ['barrel', 'docdb', 'spaces', 'ngram'],
  external: 'livery (HTTP/1.1, HTTP/2, HTTP/3) and barrel_mcp 4.4.1',
  standalone: { short: 'Yes, as a service', text: 'Yes, as a service. It brings barrel, barrel_docdb, barrel_spaces and barrel_ngram with it. You can also mount its routes inside your own livery app.' },
  install: { code: '{barrel_server, "~> 1.13"}', lang: 'erlang', label: 'rebar.config deps', note: 'In the umbrella: `rebar3 as server compile`, or `rebar3 as server,prod release -n barrel_server`.' },
  reachedThrough: ['REST over HTTP/1.1, HTTP/2 or HTTP/3', 'MCP (Streamable HTTP) at `/mcp`', 'the `_sync` wire'],
  config: [
    { title: 'App env (barrel_server)', rows: [
      { key: 'http_port', def: '8080', meaning: 'One cleartext HTTP/1.1 listener when `listeners` is not set' },
      { key: 'data_dir', def: 'docdb data_dir', meaning: 'Copied into barrel_docdb `data_dir` at start; vector stores go there too, as `<name>.vectordb`' },
      { key: 'listeners', def: 'none', meaning: '`#{http, https, http3}`' },
      { key: 'tls', def: 'none', meaning: '`certfile`, `keyfile`, `cacertfile`, `verify`' },
      { key: 'auth', def: 'none (open)', meaning: '`#{tokens => [Bin]}`, or `accept => [bearer, signed, mtls]` with `signers`' },
      { key: 'max_body', def: '1 GiB', meaning: 'Request body limit' },
      { key: 'cors', def: 'none', meaning: '`#{origins, expose, max_age}`' },
      { key: 'mcp', def: 'enabled', meaning: '`enabled`, `allowed_origins`, `resources`' },
      { key: 'open_opts', def: 'none', meaning: 'Default open options for every database (BM25, embedder)' },
    ] },
  ],
  api: [
    { title: 'Databases and documents (REST)', rows: [
      { task: 'Create, delete a database', call: 'PUT, DELETE /db/:db', returns: '201 `{"ok":true,"db"}`; other routes answer 404 `db_not_found` until it exists' },
      { task: 'Write, read, delete', call: 'PUT, GET, DELETE /db/:db/doc/:id', returns: '201 `{"id","ok","rev"}`; 409 on a stale `_rev`' },
      { task: 'Bulk', call: 'POST /db/:db/_bulk_docs, _bulk_get', returns: '`{"results":[...]}`' },
      { task: 'Find', call: 'POST /db/:db/find', returns: '`{"rows","meta"}`' },
      { task: 'BQL', call: 'POST, GET /db/:db/query', returns: 'NDJSON rows then meta; SSE for SUBSCRIBE' },
      { task: 'Changes', call: 'GET /db/:db/changes', returns: 'JSON, SSE, or `feed=continuous`' },
      { task: 'Attachments', call: 'PUT, GET, DELETE /db/:db/doc/:id/att/:name', returns: '201 info, raw bytes' },
      { task: 'History', call: 'GET /db/:db/_history, /doc/:id/_versions', returns: 'versions with provenance' },
    ] },
    { title: 'Search, timeline, agents (REST)', rows: [
      { task: 'Search', call: 'POST /db/:db/search/vector, bm25, hybrid', returns: '`{"hits":[...]}`' },
      { task: 'Branch, merge', call: 'POST /db/:db/_timeline/branch, merge', returns: '201, 200 report' },
      { task: 'Spaces, grants', call: 'POST /spaces, /spaces/:space/grants', returns: '`{"space"}`, `{"token","grant"}`' },
      { task: 'Handoffs', call: 'POST /handoffs, /handoffs/accept, /handoffs/complete', returns: 'handoff documents' },
      { task: 'Contexts', call: 'POST /contexts/_query', returns: 'rows, sources, summary' },
    ] },
    { title: 'MCP and embedding', rows: [
      { task: 'Agent tools', call: 'POST /mcp (tools/list, tools/call)', returns: '39 tools: db, doc, query, search, branch, space, session, handoff, context' },
      { task: 'Mount in your app', call: 'barrel_server_api:routes/0,1, router/0,1', returns: 'routes, with `groups` and `prefix`' },
    ] },
  ],
  examples: [
    { title: 'Start it', intro: 'A minimal `sys.config`. Start with `application:ensure_all_started(barrel_server)`.', label: 'sys.config', code: sysConfig },
    { title: 'Write and query over REST', intro: 'From a live run on an open server (no auth configured). Two more notes were written between the calls shown, and the run sent the query as JSON (`{"query": ...}`); the route also takes raw BQL as text.', label: 'Shell', code, lang: 'bash', output, outputLabel: 'Responses, from a run on barrel_server 1.13.0 (trimmed)' },
  ],
  limits: [
    'Search configuration errors (`bm25_not_enabled`, `embedder_not_configured`, `dimension_mismatch`) answer 500, not 4xx.',
    'A default database opens with a 768-dimension vector store and BM25 off; set `open_opts` for BM25 and hybrid.',
    'There are no HTTP request metrics and no `/metrics` route. `/health` checks nothing; use `/ready` for readiness.',
    'A bad `?since` cursor on `/changes` silently restarts from the first change.',
    'MCP accepts bearer tokens only, not signed requests or mTLS. HTTP/3 has no client-certificate check yet.',
    'mTLS authenticates the CA, not the individual peer, and applies only to requests without an `Authorization` header.',
    'There is no setting to turn off the HTTP listener.',
  ],
  guides: [
    { label: 'Run the server', href: '/docs/guides/rest-server' },
    { label: 'MCP endpoint', href: '/docs/guides/mcp' },
    { label: 'Authentication', href: '/docs/security/authentication' },
    { label: 'Embed the server in an app', href: '/docs/guides/embedding-barrel-server' },
    { label: 'REST API reference', href: '/docs/reference/rest-api' },
    { label: 'MCP tools reference', href: '/docs/reference/mcp-tools' },
  ],
  apiRef: '/docs/lib/server/',
};
