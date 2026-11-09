// llms.txt (https://llmstxt.org): what Barrel is and where every page lives as Markdown.
import type { APIRoute } from 'astro';
import { docsNav } from '../data/docs-nav';
import { components } from '../data/site';
import { allDocs } from '../lib/docs';

export const GET: APIRoute = async () => {
  const entries = new Map((await allDocs()).map((e) => [e.id, e]));
  const lines = [
    '# Barrel',
    '',
    '> Barrel is an open source database for agents, written in Erlang/OTP. A record keeps a JSON document, its attachments and its vector under one id. It offers vector, BM25, hybrid and regex search, BQL queries, versions and branches, active-active replication, encryption at rest, and spaces with capability tokens for agents. It runs embedded in an Erlang application, as a server with REST and MCP (barrel_server), or in the browser (barrel-lite).',
    '',
    'Use the exact function names, routes and MCP tool names from these pages; generated reference pages are built from the source.',
    '',
  ];
  for (const s of docsNav) {
    lines.push(`## ${s.title}`, '');
    for (const i of s.items) {
      const e = entries.get(i.slug);
      if (!e && i.slug === 'reference/mcp-tools') {
        lines.push(`- [${i.label}](https://barrel-db.eu/docs/${i.slug}.md): every tool barrel_server registers on /mcp, with its arguments, generated from tools/list`);
        continue;
      }
      if (!e) continue;
      lines.push(`- [${i.label}](https://barrel-db.eu/docs/${i.slug}.md)${e.data.description ? `: ${e.data.description}` : ''}`);
    }
    lines.push('');
  }
  lines.push('## Libraries', '');
  for (const c of components) lines.push(`- ${c.name} ${c.version}: ${c.body}. https://barrel-db.eu/product/${c.slug}`);
  lines.push('', '## Optional', '', '- [Everything in one file](https://barrel-db.eu/llms-full.txt)', '- [MCP tools as JSON](https://barrel-db.eu/docs/reference/mcp-tools.json)', '');
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
