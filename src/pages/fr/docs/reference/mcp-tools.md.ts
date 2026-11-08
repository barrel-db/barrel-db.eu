// translation_of: src/pages/docs/reference/mcp-tools.md.ts source_hash: 92518be7e89fa7d6
// La référence des outils MCP en Markdown, pour « Voir en Markdown » et les agents.
import type { APIRoute } from 'astro';
import { groups, tools, meta } from './_mcp-tools';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function mcpToolsMarkdownFr(): string {
  const lines = [
    '# Outils MCP',
    '',
    `Les ${tools.length} outils que barrel_server${meta.barrelServer ? ` ${meta.barrelServer}` : ''} enregistre sur /mcp, produits à partir de sa réponse tools/list (MCP ${meta.protocolVersion}, capturée le ${meta.generated}). Les descriptions sont le texte du serveur lui-même, en anglais. JSON : https://barrel-db.eu/docs/reference/mcp-tools.json`,
    '',
  ];
  for (const g of groups) {
    lines.push(`## ${g.title}`, '');
    for (const t of g.tools) {
      lines.push(`### ${t.name}`, '');
      if (t.marks.length) lines.push(`Annotations : ${t.marks.join(', ')}.`, '');
      lines.push(t.description, '');
      if (t.args.length) {
        lines.push('| Argument | Type | Obligatoire | Description |', '|---|---|---|---|');
        for (const a of t.args) lines.push(`| \`${a.name}\` | ${a.type} | ${a.required ? 'oui' : 'non'} | ${cell(a.description)} |`);
      } else {
        lines.push('Aucun argument.');
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export const GET: APIRoute = () =>
  new Response(mcpToolsMarkdownFr(), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
