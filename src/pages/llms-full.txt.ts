// Every docs page, in sidebar order, as one Markdown file.
import type { APIRoute } from 'astro';
import { docsOrder } from '../data/docs-nav';
import { allDocs } from '../lib/docs';

export const GET: APIRoute = async () => {
  const entries = new Map((await allDocs()).map((e) => [e.id, e]));
  const parts: string[] = ['# Barrel documentation\n'];
  for (const i of docsOrder) {
    const e = entries.get(i.slug);
    if (!e) continue;
    parts.push(`\n---\n\n# ${e.data.title}\n\nURL: https://barrel-db.eu/docs/${i.slug}\n\n${(e.body ?? '').trim()}\n`);
  }
  return new Response(parts.join(''), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
