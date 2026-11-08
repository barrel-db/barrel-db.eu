// Pure model of the mesh demonstration: three barrel_server peers and a
// barrel-lite tab synced with Lyon. Same rules as barrel: a write replaces
// the versions it read, concurrent versions stay as conflicts, every copy
// picks the same winner (highest clock, then writer id). Plain TypeScript
// with type annotations only, so `node --experimental-strip-types` runs it.
// Captions, names and the code comments shown exist in English and French.

export type Site = 'paris' | 'lyon' | 'berlin' | 'tab';
export type Link = 'pl' | 'pb' | 'lb' | 'lt';
export type Lang = 'en' | 'fr';

export interface Version { id: string; body: string; by: Site; clock: number; replaces: string[] }
export interface Copy { live: Version[]; known: string[] }
export interface MeshState {
  clock: number;
  n: number;
  up: Record<Link, boolean>;
  nodes: Record<Site, Copy>;
  caption: string;
  call: string;
  lang?: Lang;
}

export const SITES: Site[] = ['paris', 'lyon', 'berlin', 'tab'];
export const LINKS: Link[] = ['pl', 'pb', 'lb', 'lt'];

const PAIRS: Record<Link, [Site, Site]> = {
  pl: ['paris', 'lyon'], lb: ['lyon', 'berlin'], pb: ['paris', 'berlin'], lt: ['lyon', 'tab'],
};
const TEXT = {
  en: {
    label: { paris: 'Paris', lyon: 'Lyon', berlin: 'Berlin', tab: 'the browser' } as Record<Site, string>,
    browser: 'Browser',
    words: { paris: 'blocked', lyon: 'review', berlin: 'done', tab: 'on site' } as Record<Site, string>,
    open: 'open', merged: 'merged',
    start: 'Every copy starts from the same document',
    startCall: ['%% servers: a continuous task on each link, both ways', '// browser: a barrel-lite copy synced with Lyon'],
    localWrite: (off: boolean) => '// in the browser: stored locally' + (off ? ', while offline' : ''),
    onSite: (site: string) => '%% on ' + site + ': replaces the version it read',
    aWrite: (l: string, off: boolean) => 'A write on ' + l + (off ? '. The browser is offline, so it waits locally.' : '. Nothing has synced yet.'),
    pushBoth: 'replaces both versions everywhere',
    resolved: (l: string) => 'Resolved on ' + l + '. Sync to spread it.',
    tabBack: 'The browser is back online. Sync to send its writes.',
    tabOff: 'The browser is offline. Reads and writes keep working locally.',
    restored: (a: string, b: string) => 'Link restored between ' + a + ' and ' + b + '.',
    cut: (a: string, b: string) => 'Link cut between ' + a + ' and ' + b + '. Both keep taking writes.',
    backCall: '// back online: push local writes, then pull',
    offCall: '// offline: nothing changes for the app',
    retryCall: '%% the task on this link retries until the peer answers',
    relay: (x: string, a: string) => x + ' got ' + a + '’s edit through another peer',
    ranTasks: '%% each open link ran its task, both ways',
    tabSync: '// the browser pushes, then pulls',
    tabWaits: '// the browser is offline: its writes wait locally',
    kept: '%% concurrent edits: kept as conflicts, same winner on every copy',
    same: 'Every copy holds the same document.',
    differ: 'Copies cut off from each other differ until a link returns.',
    online: (p: number) => (p ? 'Online, ' + p + ' local ' + (p === 1 ? 'write' : 'writes') + ' to push' : 'Online'),
    offline: (p: number) => 'Offline, ' + p + ' local ' + (p === 1 ? 'write' : 'writes') + ' waiting',
  },
  fr: {
    label: { paris: 'Paris', lyon: 'Lyon', berlin: 'Berlin', tab: 'le navigateur' } as Record<Site, string>,
    browser: 'Navigateur',
    words: { paris: 'bloqué', lyon: 'à revoir', berlin: 'terminé', tab: 'sur site' } as Record<Site, string>,
    open: 'ouvert', merged: 'fusionné',
    start: 'Chaque copie part du même document',
    startCall: ['%% serveurs : une tâche continue sur chaque lien, dans les deux sens', '// navigateur : une copie barrel-lite synchronisée avec Lyon'],
    localWrite: (off: boolean) => '// dans le navigateur : stocké localement' + (off ? ', hors ligne' : ''),
    onSite: (site: string) => '%% sur ' + site + ' : remplace la version lue',
    aWrite: (l: string, off: boolean) => 'Une écriture sur ' + l + (off ? '. Le navigateur est hors ligne, elle attend donc localement.' : '. Rien n’est encore synchronisé.'),
    pushBoth: 'remplace les deux versions partout',
    resolved: (l: string) => 'Résolu sur ' + l + '. Synchronisez pour le propager.',
    tabBack: 'Le navigateur est de nouveau en ligne. Synchronisez pour envoyer ses écritures.',
    tabOff: 'Le navigateur est hors ligne. Lectures et écritures continuent en local.',
    restored: (a: string, b: string) => 'Lien rétabli entre ' + a + ' et ' + b + '.',
    cut: (a: string, b: string) => 'Lien coupé entre ' + a + ' et ' + b + '. Les deux continuent d’accepter des écritures.',
    backCall: '// de nouveau en ligne : pousser les écritures locales, puis tirer',
    offCall: '// hors ligne : rien ne change pour l’application',
    retryCall: '%% la tâche de ce lien réessaie jusqu’à ce que le pair réponde',
    relay: (x: string, a: string) => x + ' a reçu la modification de ' + a + ' par un autre pair',
    ranTasks: '%% chaque lien ouvert a exécuté sa tâche, dans les deux sens',
    tabSync: '// le navigateur pousse, puis tire',
    tabWaits: '// le navigateur est hors ligne : ses écritures attendent localement',
    kept: '%% modifications concurrentes : gardées en conflit, même gagnant sur chaque copie',
    same: 'Chaque copie contient le même document.',
    differ: 'Les copies coupées les unes des autres diffèrent jusqu’au retour d’un lien.',
    online: (p: number) => (p ? 'En ligne, ' + p + ' ' + (p === 1 ? 'écriture locale' : 'écritures locales') + ' à pousser' : 'En ligne'),
    offline: (p: number) => 'Hors ligne, ' + p + ' ' + (p === 1 ? 'écriture locale en attente' : 'écritures locales en attente'),
  },
};
const T = (s: { lang?: Lang } | Lang = 'en') => TEXT[typeof s === 'string' ? s : (s.lang ?? 'en')];

export const pair = (k: Link): [Site, Site] => PAIRS[k];
export const label = (x: Site, lang: Lang = 'en'): string => TEXT[lang].label[x];
export const name = (x: Site, lang: Lang = 'en'): string => (x === 'tab' ? TEXT[lang].browser : TEXT[lang].label[x]);

export function initial(lang: Lang = 'en'): MeshState {
  const t = TEXT[lang];
  const v0: Version = { id: 'v0', body: t.open, by: 'paris', clock: 1, replaces: [] };
  const copy = (): Copy => ({ live: [v0], known: ['v0'] });
  return {
    clock: 1, n: 0, lang,
    up: { pl: true, lb: true, pb: true, lt: true },
    nodes: { paris: copy(), lyon: copy(), berlin: copy(), tab: copy() },
    caption: t.start,
    call: t.startCall[0] + '\n'
      + '{ok, _} = barrel_rep_tasks:start_task(#{\n'
      + '    source => <<"tasks">>,\n'
      + '    target => <<"http://lyon.example:8080/db/tasks">>,\n'
      + '    mode => continuous, direction => both}).\n'
      + t.startCall[1],
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
  const t = T(s); const clock = s.clock + 1; const n = s.n + 1; const node = s.nodes[site];
  const v: Version = { id: 'v' + n, body: t.words[site] + (n > 4 ? ' ' + n : ''), by: site, clock, replaces: node.live.map((x) => x.id) };
  const nodes = { ...s.nodes, [site]: { live: [v], known: node.known.concat([v.id]) } };
  const offline = site === 'tab' && !s.up.lt;
  const call = site === 'tab'
    ? t.localWrite(offline)
      + '\nawait db.put({ ...doc, state: "' + v.body + '" });'
    : t.onSite(site) + '\n'
      + '{ok, _} = barrel_docdb:put_doc(<<"tasks">>,\n'
      + '    Doc#{<<"state">> => <<"' + v.body + '">>}).';
  const caption = t.aWrite(t.label[site], offline);
  return { ...s, clock, n, nodes, call, caption };
}

export function resolve(s: MeshState, site: Site): MeshState {
  const t = T(s); const clock = s.clock + 1; const n = s.n + 1; const node = s.nodes[site];
  const v: Version = { id: 'v' + n, body: t.merged, by: site, clock, replaces: node.live.map((x) => x.id) };
  const nodes = { ...s.nodes, [site]: { live: [v], known: node.known.concat([v.id]) } };
  const call = site === 'tab'
    ? 'const others = await db.conflicts("task:1");\n'
      + 'await db.resolve("task:1", merge(current, others));\n'
      + 'await db.push();   // ' + t.pushBoth
    : '{ok, #{<<"_observed">> := Seen}} = barrel_docdb:get_doc(\n'
      + '    <<"tasks">>, <<"task:1">>, #{conflicts => true}),\n'
      + '{ok, _} = barrel_docdb:resolve_conflict(<<"tasks">>,\n'
      + '    <<"task:1">>, Seen, {merge, Merged}).';
  return { ...s, clock, n, nodes, call, caption: t.resolved(t.label[site]) };
}

export function toggle(s: MeshState, k: Link): MeshState {
  const t = T(s); const up = { ...s.up, [k]: !s.up[k] };
  const [a, b] = PAIRS[k];
  const isTab = k === 'lt';
  const caption = isTab
    ? (up[k] ? t.tabBack : t.tabOff)
    : (up[k] ? t.restored(t.label[a], t.label[b]) : t.cut(t.label[a], t.label[b]));
  const call = isTab
    ? (up[k] ? t.backCall + '\nawait db.sync();'
      : t.offCall + '\nconst doc = await db.get("task:1");')
    : t.retryCall + '\n{ok, Task} = barrel_rep_tasks:get_task(TaskId).';
  return { ...s, up, caption, call };
}

export function sync(s: MeshState): MeshState {
  const t = T(s); const before = s.nodes;
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
        relays.push(t.relay(t.label[x], t.label[author]));
      }
    });
  });
  const conflicts = SITES.some((x) => nodes[x].live.length > 1);
  const lines = [t.ranTasks];
  lines.push(s.up.lt ? 'await db.sync();   ' + t.tabSync : t.tabWaits);
  if (conflicts) lines.push(t.kept);
  const uniq = Array.from(new Set(relays));
  const caption = (uniq.length ? uniq.join('. ') + '. ' : '')
    + (groups(nodes) === 1 ? t.same : t.differ);
  return { ...s, nodes, call: lines.join('\n'), caption };
}

/** Writes the browser holds that Lyon, its sync peer, has not seen yet. */
export function pending(s: MeshState): number {
  return s.nodes.tab.known.filter((id) => !s.nodes.lyon.known.includes(id)).length;
}

export function tabStatus(s: MeshState): string {
  const p = pending(s);
  return s.up.lt ? T(s).online(p) : T(s).offline(p);
}

/** Versions of one copy, winner first, as the demo shows them. */
export function versions(s: MeshState, site: Site): { kind: 'winner' | 'conflict'; body: string; by: string }[] {
  const live = s.nodes[site].live; const w = winner(live);
  return [w, ...live.filter((v) => v.id !== w.id)].map((v) => ({
    kind: v.id === w.id ? 'winner' : 'conflict', body: v.body, by: name(v.by, s.lang),
  }));
}
