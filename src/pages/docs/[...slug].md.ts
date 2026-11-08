// Every docs page as plain Markdown, for agents and for "View as Markdown".
import type { APIRoute } from 'astro';
import { allDocs } from '../../lib/docs';

export async function getStaticPaths() {
  const entries = await allDocs();
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as any;
  const d = entry.data;
  const head = `# ${d.title}\n\n${d.source ? `Source: https://github.com/barrel-db/barrel/blob/main/${d.source}\n\n` : ''}`;
  return new Response(head + (entry.body ?? '').trim() + '\n', { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
};
