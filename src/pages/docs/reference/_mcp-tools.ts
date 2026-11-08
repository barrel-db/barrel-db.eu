// Shapes the server's tools/list answer (src/data/mcp-tools.json) for the
// MCP tools reference page and its Markdown copy.
import data from '../../../data/mcp-tools.json';

export interface Arg { name: string; type: string; required: boolean; description: string; }
export interface Tool { name: string; description: string; marks: string[]; args: Arg[]; raw: any; }
export interface Group { title: string; slug: string; tools: Tool[]; }

export const meta = {
  barrelServer: (data as any).barrelServer as string | null,
  serverInfo: (data as any).serverInfo as { name: string; version: string },
  protocolVersion: (data as any).protocolVersion as string,
  generated: (data as any).generated as string,
};

function typeOf(s: any): string {
  if (!s || !s.type) return 'any';
  if (s.type === 'array') return `array of ${typeOf(s.items)}`;
  return Array.isArray(s.type) ? s.type.join(' | ') : s.type;
}

function describe(s: any): string {
  const parts: string[] = [];
  if (s.description) parts.push(s.description);
  if (s.enum) parts.push(`One of ${s.enum.map((v: any) => `\`${v}\``).join(', ')}.`);
  if (s.default !== undefined) parts.push(`Default \`${JSON.stringify(s.default)}\`.`);
  if (s.minimum !== undefined) parts.push(`At least ${s.minimum}.`);
  if (s.minItems !== undefined || s.maxItems !== undefined) {
    parts.push(`${s.minItems ?? 0} to ${s.maxItems ?? 'any number of'} items.`);
  }
  return parts.join(' ');
}

const MARKS: [string, string][] = [
  ['readOnlyHint', 'read only'],
  ['destructiveHint', 'destructive'],
  ['idempotentHint', 'idempotent'],
  ['openWorldHint', 'open world'],
];

export const tools: Tool[] = (data as any).tools.map((t: any) => {
  const schema = t.inputSchema || {};
  const req = new Set<string>(schema.required || []);
  const props = schema.properties || {};
  const args = Object.keys(props)
    .sort((a, b) => Number(req.has(b)) - Number(req.has(a)) || a.localeCompare(b))
    .map((name) => ({ name, type: typeOf(props[name]), required: req.has(name), description: describe(props[name]) }));
  const marks = MARKS.filter(([k]) => t.annotations?.[k]).map(([, label]) => label);
  return { name: t.name, description: t.description || '', marks, args, raw: t };
});

const GROUPS: [string, string, (n: string) => boolean][] = [
  ['Databases and documents', 'databases-and-documents', (n) => /^(db_|doc_|changes$)/.test(n)],
  ['Query and search', 'query-and-search', (n) => /^(query|search$|ngram_search$)/.test(n)],
  ['Branches', 'branches', (n) => /^(branch_|merge$)/.test(n)],
  ['Spaces, sessions and handoffs', 'spaces-sessions-and-handoffs', (n) => /^(space_|session_|handoff_)/.test(n)],
  ['Contexts and working sets', 'contexts-and-working-sets', (n) => n.startsWith('context_')],
];

export const groups: Group[] = (() => {
  const left = new Set(tools.map((t) => t.name));
  const out = GROUPS.map(([title, slug, match]) => {
    const ts = tools.filter((t) => left.has(t.name) && match(t.name));
    ts.forEach((t) => left.delete(t.name));
    return { title, slug, tools: ts };
  });
  // A tool added to the server later still shows up, under "Other".
  if (left.size) out.push({ title: 'Other', slug: 'other', tools: tools.filter((t) => left.has(t.name)) });
  return out.filter((g) => g.tools.length);
})();
