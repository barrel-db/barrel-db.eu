// The MCP tools reference as Markdown, for "View as Markdown" and agents.
import type { APIRoute } from 'astro';
import { groups, tools, meta } from './_mcp-tools';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function mcpToolsMarkdown(): string {
  const lines = [
    '# MCP tools',
    '',
    `The ${tools.length} tools barrel_server${meta.barrelServer ? ` ${meta.barrelServer}` : ''} registers on /mcp, generated from its tools/list answer (MCP ${meta.protocolVersion}, captured ${meta.generated}). JSON: https://barrel-db.eu/docs/reference/mcp-tools.json`,
    '',
  ];
  for (const g of groups) {
    lines.push(`## ${g.title}`, '');
    for (const t of g.tools) {
      lines.push(`### ${t.name}`, '');
      if (t.marks.length) lines.push(`Annotations: ${t.marks.join(', ')}.`, '');
      lines.push(t.description, '');
      if (t.args.length) {
        lines.push('| Argument | Type | Required | Description |', '|---|---|---|---|');
        for (const a of t.args) lines.push(`| \`${a.name}\` | ${a.type} | ${a.required ? 'yes' : 'no'} | ${cell(a.description)} |`);
      } else {
        lines.push('No arguments.');
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export const GET: APIRoute = () =>
  new Response(mcpToolsMarkdown(), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
