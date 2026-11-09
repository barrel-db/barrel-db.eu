// Every French docs page as plain Markdown.
import type { APIRoute } from 'astro';
import { allDocsFr } from '../../../lib/docs';
import { mdxToMarkdown } from '../../../lib/mdx-to-md';

export async function getStaticPaths() {
  const entries = await allDocsFr();
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as any;
  const head = `# ${entry.data.title}\n\n`;
  return new Response(head + mdxToMarkdown(entry.body ?? '').trim() + '\n', { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
};
