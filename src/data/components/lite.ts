import type { ComponentContent } from './types';

const install = `git clone https://github.com/barrel-db/barrel
cd barrel/clients/barrel-lite
npm install
npm run build
# then, in your app
npm install /path/to/barrel/clients/barrel-lite`;

const code = `import { Database } from "barrel-lite";

const db = await Database.open("notes", {
  remote: {
    url: "https://edge.example:8080",
    db: "notes",
    token: "bsp_...",
  },
  multiTab: true,
});

await db.put({ id: "n1", title: "hello" });
const doc = await db.get("n1");

// the same BQL text runs locally on the synced set
const rows = await db.query(
  "SELECT title FROM notes WHERE pinned = true");

db.onChange((c) => console.log("changed", c.id));
db.liveSync({ continuous: true });
await db.sync(); // push, then pull`;

export const lite: ComponentContent = {
  slug: 'lite',
  lead: 'A copy of a Barrel database in the browser. barrel-lite keeps an offline-first local store and syncs it with barrel_server over the replication wire.',
  problem: 'Web apps need to keep working offline and pick up changes made elsewhere. barrel-lite stores documents and attachments in the browser, runs BQL locally, and replicates with a server using the same version rules as the Erlang nodes, so conflicts are kept, not lost.',
  useWhen: [
    'A web app must work offline and sync when it reconnects.',
    'You want local queries and local vector ranking over the data a user holds.',
    'Several tabs share one store: one tab syncs, the others go through it.',
  ],
  notWhen: [
    'You need full-text or ANN search in the browser: those run on the server (`searchText`, `searchVector`).',
    'You need signed requests or mTLS from the client: it sends bearer tokens only.',
  ],
  dependsOn: [],
  external: 'TypeScript, ESM, Node 20 or later to build; syncs with [barrel_server](/product/server) over HTTP',
  standalone: { short: 'Partly', text: 'The local store and local BQL work without a server. Sync, server search and remote queries need barrel_server.' },
  install: { code: install, lang: 'bash', label: 'Shell', note: 'barrel-lite is not published on npm (the package is marked private). Build it from the repository.' },
  reachedThrough: ['TypeScript in the browser (OPFS) or Node (memory)'],
  config: [
    { title: 'Database.open(name, opts)', rows: [
      { key: 'remote', def: 'none', meaning: '`{url, db, token?, fetch?}`; `url` may include a sub-path' },
      { key: 'storage', def: 'OPFS, else memory', meaning: 'A storage adapter' },
      { key: 'multiTab', def: 'false', meaning: 'One leader tab per origin (Web Locks and BroadcastChannel)' },
      { key: 'onConflict', def: 'none', meaning: 'Callback for concurrent versions' },
      { key: 'flushDebounceMs', def: '200', meaning: 'Delay before local writes are flushed' },
    ] },
  ],
  api: [
    { title: 'Documents', rows: [
      { task: 'Open', call: 'Database.open(name, opts)', returns: '`Promise<Database>`' },
      { task: 'Write, read, delete', call: 'put(doc), get(id), remove(id)', returns: '`{id, version}`, the doc or `undefined`' },
      { task: 'List', call: 'allDocs(opts)', returns: 'records' },
      { task: 'Conflicts', call: 'conflicts(id), resolve(id, body)', returns: 'versions, `{id, version}`' },
    ] },
    { title: 'Query and search', rows: [
      { task: 'Local BQL', call: 'query(bql, {params})', returns: 'rows; table functions throw `BqlServerOnlyError`' },
      { task: 'Server BQL', call: 'queryRemote(bql, opts)', returns: '`{rows, meta}`' },
      { task: 'Local vector ranking', call: 'syncEmbeddings(), searchLocal(vector, {k, filter})', returns: '`[{id, score, doc}]`, brute-force cosine' },
      { task: 'Server search', call: 'searchVector(vector, {k}), searchText(q, {k, mode})', returns: 'server hits' },
    ] },
    { title: 'Files and sync', rows: [
      { task: 'Attachments', call: 'putAttachment, getAttachment, removeAttachment', returns: '`{digest}`, `{bytes, info}`' },
      { task: 'Sync once', call: 'push(), pull(), sync()', returns: 'push and pull stats' },
      { task: 'Keep syncing', call: 'liveSync({continuous, vectors})', returns: '`{stop}`' },
      { task: 'Events', call: 'onChange(fn), onStatus(fn)', returns: 'an unsubscribe function' },
    ] },
  ],
  examples: [
    { title: 'Open, write, query, sync', intro: 'From the package README. Not run for this page; the unit suite (31 files, 187 tests) passed against a fake server.', label: 'TypeScript', code, lang: 'typescript' },
  ],
  limits: [
    'Not on npm: build it from `clients/barrel-lite` in the repository.',
    'Bearer tokens only, global or `bsp_` capability tokens. No signed requests.',
    'Local writes are flushed on a debounce; writes not yet flushed are lost on a crash. Durability comes from sync.',
    'No full-text search and no ANN index in the browser; `searchLocal` ranks synced vectors by brute force.',
    'The `"offline"` status exists in the type but is never emitted.',
  ],
  guides: [
    { label: 'barrel-lite guide', href: '/docs/guides/barrel-lite' },
    { label: 'Quickstart: browser', href: '/docs/start/quickstart-browser' },
    { label: 'Synchronization', href: '/docs/guides/synchronization' },
  ],
};
