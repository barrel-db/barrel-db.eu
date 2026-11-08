// Pure model of the mesh demonstration: three barrel_server peers and a
// barrel-lite tab synced with Lyon. Same rules as barrel: a write replaces
// the versions it read, concurrent versions stay as conflicts, every copy
// picks the same winner (highest clock, then writer id). Plain TypeScript
// with type annotations only, so `node --experimental-strip-types` runs it.

export type Site = 'paris' | 'lyon' | 'berlin' | 'tab';
export type Link = 'pl' | 'pb' | 'lb' | 'lt';

export interface Version { id: string; body: string; by: Site; clock: number; replaces: string[] }
export interface Copy { live: Version[]; known: string[] }
export interface MeshState {
  clock: number;
  n: number;
  up: Record<Link, boolean>;
  nodes: Record<Site, Copy>;
  caption: string;
  call: string;
}

export const SITES: Site[] = ['paris', 'lyon', 'berlin', 'tab'];
export const LINKS: Link[] = ['pl', 'pb', 'lb', 'lt'];

const PAIRS: Record<Link, [Site, Site]> = {
  pl: ['paris', 'lyon'], lb: ['lyon', 'berlin'], pb: ['paris', 'berlin'], lt: ['lyon', 'tab'],
};
const LABEL: Record<Site, string> = { paris: 'Paris', lyon: 'Lyon', berlin: 'Berlin', tab: 'the browser' };
const WORDS: Record<Site, string> = { paris: 'blocked', lyon: 'review', berlin: 'done', tab: 'on site' };

export const pair = (k: Link): [Site, Site] => PAIRS[k];
export const label = (x: Site): string => LABEL[x];
export const name = (x: Site): string => (x === 'tab' ? 'Browser' : LABEL[x]);

export function initial(): MeshState {
  const v0: Version = { id: 'v0', body: 'open', by: 'paris', clock: 1, replaces: [] };
  const copy = (): Copy => ({ live: [v0], known: ['v0'] });
  return {
    clock: 1, n: 0,
    up: { pl: true, lb: true, pb: true, lt: true },
    nodes: { paris: copy(), lyon: copy(), berlin: copy(), tab: copy() },
    caption: 'Every copy starts from the same document',
    call: '%% servers: a continuous task on each link, both ways\n'
      + '{ok, _} = barrel_rep_tasks:start_task(#{\n'
      + '    source => <<"tasks">>,\n'
      + '    target => <<"http://lyon.example:8080/db/tasks">>,\n'
      + '    mode => continuous, direction => both}).\n'
      + '// browser: a barrel-lite copy synced with Lyon',
  };
}

export function winner(live: Version[]): Version {
  return live.slice().sort((a, b) => (b.clock - a.clock) || (b.by < a.by ? -1 : 1))[0];
}

function merge(a: Copy, b: Copy): Copy {
  const all: Record<string, Version> = {};
  a.live.concat(b.live).forEach((v) => { all[v.id] = v; });
  const rep = new Set<string>();
  Object.values(all).forEach((v) => v.replaces.forEach((r) => rep.add(r)));
  const live = Object.values(all).filter((v) => !rep.has(v.id)).sort((x, y) => (x.id < y.id ? -1 : 1));
  const known = Array.from(new Set(a.known.concat(b.known)));
  return { live, known };
}

function same(a: Copy, b: Copy): boolean {
  return a.live.map((v) => v.id).join() === b.live.map((v) => v.id).join() && a.known.length === b.known.length;
}

function direct(a: Site, b: Site, up: Record<Link, boolean>): boolean {
  return LINKS.some((k) => up[k] && PAIRS[k].includes(a) && PAIRS[k].includes(b));
}

/** Number of distinct live sets across the copies; 1 means every copy agrees. */
export function groups(nodes: Record<Site, Copy>): number {
  return new Set(SITES.map((s) => nodes[s].live.map((v) => v.id).join())).size;
}

export function edit(s: MeshState, site: Site): MeshState {
  const clock = s.clock + 1; const n = s.n + 1; const node = s.nodes[site];
  const v: Version = { id: 'v' + n, body: WORDS[site] + (n > 4 ? ' ' + n : ''), by: site, clock, replaces: node.live.map((x) => x.id) };
  const nodes = { ...s.nodes, [site]: { live: [v], known: node.known.concat([v.id]) } };
  const offline = site === 'tab' && !s.up.lt;
  const call = site === 'tab'
    ? '// in the browser: stored locally' + (offline ? ', while offline' : '')
      + '\nawait db.put({ ...doc, state: "' + v.body + '" });'
    : '%% on ' + site + ': replaces the version it read\n'
      + '{ok, _} = barrel_docdb:put_doc(<<"tasks">>,\n'
      + '    Doc#{<<"state">> => <<"' + v.body + '">>}).';
  const caption = 'A write on ' + LABEL[site]
    + (offline ? '. The browser is offline, so it waits locally.' : '. Nothing has synced yet.');
  return { ...s, clock, n, nodes, call, caption };
}

export function resolve(s: MeshState, site: Site): MeshState {
  const clock = s.clock + 1; const n = s.n + 1; const node = s.nodes[site];
  const v: Version = { id: 'v' + n, body: 'merged', by: site, clock, replaces: node.live.map((x) => x.id) };
  const nodes = { ...s.nodes, [site]: { live: [v], known: node.known.concat([v.id]) } };
  const call = site === 'tab'
    ? 'const others = await db.conflicts("task:1");\n'
      + 'await db.resolve("task:1", merge(current, others));\n'
      + 'await db.push();   // replaces both versions everywhere'
    : '{ok, #{<<"_observed">> := Seen}} = barrel_docdb:get_doc(\n'
      + '    <<"tasks">>, <<"task:1">>, #{conflicts => true}),\n'
      + '{ok, _} = barrel_docdb:resolve_conflict(<<"tasks">>,\n'
      + '    <<"task:1">>, Seen, {merge, Merged}).';
  return { ...s, clock, n, nodes, call, caption: 'Resolved on ' + LABEL[site] + '. Sync to spread it.' };
}

export function toggle(s: MeshState, k: Link): MeshState {
  const up = { ...s.up, [k]: !s.up[k] };
  const [a, b] = PAIRS[k];
  const isTab = k === 'lt';
  const caption = isTab
    ? (up[k] ? 'The browser is back online. Sync to send its writes.' : 'The browser is offline. Reads and writes keep working locally.')
    : (up[k] ? 'Link restored between ' + LABEL[a] + ' and ' + LABEL[b] + '.'
      : 'Link cut between ' + LABEL[a] + ' and ' + LABEL[b] + '. Both keep taking writes.');
  const call = isTab
    ? (up[k] ? '// back online: push local writes, then pull\nawait db.sync();'
      : '// offline: nothing changes for the app\nconst doc = await db.get("task:1");')
    : '%% the task on this link retries until the peer answers\n{ok, Task} = barrel_rep_tasks:get_task(TaskId).';
  return { ...s, up, caption, call };
}

export function sync(s: MeshState): MeshState {
  const before = s.nodes;
  const nodes: Record<Site, Copy> = { ...s.nodes };
  let changed = true; let rounds = 0;
  while (changed && rounds < 6) {
    changed = false; rounds++;
    LINKS.filter((k) => s.up[k]).forEach((k) => {
      const [a, b] = PAIRS[k]; const m = merge(nodes[a], nodes[b]);
      if (!same(m, nodes[a]) || !same(m, nodes[b])) changed = true;
      nodes[a] = { live: m.live.slice(), known: m.known.slice() };
      nodes[b] = { live: m.live.slice(), known: m.known.slice() };
    });
  }
  const relays: string[] = [];
  SITES.forEach((x) => {
    nodes[x].known.filter((id) => !before[x].known.includes(id)).forEach((id) => {
      const author = SITES.find((y) => before[y].known.includes(id));
      if (author && author !== x && x !== 'tab' && author !== 'tab' && !direct(x, author, s.up)) {
        relays.push(LABEL[x] + ' got ' + LABEL[author] + '’s edit through another peer');
      }
    });
  });
  const conflicts = SITES.some((x) => nodes[x].live.length > 1);
  const lines = ['%% each open link ran its task, both ways'];
  lines.push(s.up.lt ? 'await db.sync();   // the browser pushes, then pulls' : '// the browser is offline: its writes wait locally');
  if (conflicts) lines.push('%% concurrent edits: kept as conflicts, same winner on every copy');
  const uniq = Array.from(new Set(relays));
  const caption = (uniq.length ? uniq.join('. ') + '. ' : '')
    + (groups(nodes) === 1 ? 'Every copy holds the same document.' : 'Copies cut off from each other differ until a link returns.');
  return { ...s, nodes, call: lines.join('\n'), caption };
}

/** Writes the browser holds that Lyon, its sync peer, has not seen yet. */
export function pending(s: MeshState): number {
  return s.nodes.tab.known.filter((id) => !s.nodes.lyon.known.includes(id)).length;
}

export function tabStatus(s: MeshState): string {
  const p = pending(s);
  const w = p === 1 ? 'write' : 'writes';
  if (s.up.lt) return p ? 'Online, ' + p + ' local ' + w + ' to push' : 'Online';
  return 'Offline, ' + p + ' local ' + w + ' waiting';
}

/** Versions of one copy, winner first, as the demo shows them. */
export function versions(s: MeshState, site: Site): { kind: 'winner' | 'conflict'; body: string; by: string }[] {
  const live = s.nodes[site].live; const w = winner(live);
  return [w, ...live.filter((v) => v.id !== w.id)].map((v) => ({
    kind: v.id === w.id ? 'winner' : 'conflict', body: v.body, by: name(v.by),
  }));
}
