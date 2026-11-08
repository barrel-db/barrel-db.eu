// French chrome for the MCP tools reference. Tool names, descriptions and
// schemas come from the server (src/data/mcp-tools.json) and stay in English.
import { groups as enGroups, tools, meta, type Group } from '../../../docs/reference/_mcp-tools';

const GROUP_TITLES: Record<string, string> = {
  'databases-and-documents': 'Bases et documents',
  'query-and-search': 'Requêtes et recherche',
  branches: 'Branches',
  'spaces-sessions-and-handoffs': 'Espaces, sessions et passations',
  'contexts-and-working-sets': 'Contextes et ensembles de travail',
  other: 'Autres',
};

const MARKS: Record<string, string> = {
  'read only': 'lecture seule',
  destructive: 'destructif',
  idempotent: 'idempotent',
  'open world': 'monde ouvert',
};

// Same parts as the English describe(), with French connectors.
function describe(s: any): string {
  const parts: string[] = [];
  if (s.description) parts.push(s.description);
  if (s.enum) parts.push(`Une valeur parmi ${s.enum.map((v: any) => `\`${v}\``).join(', ')}.`);
  if (s.default !== undefined) parts.push(`Défaut \`${JSON.stringify(s.default)}\`.`);
  if (s.minimum !== undefined) parts.push(`Au moins ${s.minimum}.`);
  if (s.minItems !== undefined || s.maxItems !== undefined) {
    parts.push(s.maxItems === undefined
      ? `Au moins ${s.minItems} éléments.`
      : `De ${s.minItems ?? 0} à ${s.maxItems} éléments.`);
  }
  return parts.join(' ');
}

const typeFr = (t: string) => t.replace(/array of /g, 'tableau de ');

export const groups: Group[] = enGroups.map((g) => ({
  title: GROUP_TITLES[g.slug] ?? g.title,
  slug: g.slug,
  tools: g.tools.map((t) => {
    const props = t.raw?.inputSchema?.properties || {};
    return {
      ...t,
      marks: t.marks.map((m) => MARKS[m] ?? m),
      args: t.args.map((a) => ({ ...a, type: typeFr(a.type), description: describe(props[a.name] || {}) })),
    };
  }),
}));

export { tools, meta };
