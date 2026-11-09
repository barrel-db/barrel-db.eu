// Every docs page, in sidebar order, as one Markdown file.
import type { APIRoute } from 'astro';
import { docsOrder } from '../data/docs-nav';
import { allDocs } from '../lib/docs';
import { mdxToMarkdown } from '../lib/mdx-to-md';
import { mcpToolsMarkdown } from './docs/reference/mcp-tools.md';

export const GET: APIRoute = async () => {
  const entries = new Map((await allDocs()).map((e) => [e.id, e]));
  const parts: string[] = ['# Barrel documentation\n'];
  for (const i of docsOrder) {
    const e = entries.get(i.slug);
    if (!e && i.slug === 'reference/mcp-tools') {
      parts.push(`\n---\n\nURL: https://barrel-db.eu/docs/${i.slug}\n\n${mcpToolsMarkdown()}\n`);
      continue;
    }
    if (!e) continue;
    parts.push(`\n---\n\n# ${e.data.title}\n\nURL: https://barrel-db.eu/docs/${i.slug}\n\n${mdxToMarkdown(e.body ?? '').trim()}\n`);
  }
  return new Response(parts.join(''), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
