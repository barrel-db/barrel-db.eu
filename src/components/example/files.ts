// The example folders, imported at build time so the pages always
// show the files that scripts/verify-examples.sh runs.
import type { MarkdownInstance } from 'astro';

const readmes = import.meta.glob<MarkdownInstance<Record<string, never>>>(
  ['/examples/*/README.md', '/examples/*/README.fr.md'], { eager: true });

const sources = import.meta.glob<string>(
  [
    '/examples/*/**/*.{erl,src,config,sh,ts,json,eterm}',
    '!/examples/**/_build/**',
    '!/examples/**/_checkouts/**',
    '!/examples/**/node_modules/**',
    '!/examples/**/data/**',
  ],
  { query: '?raw', import: 'default', eager: true });

const outputs = import.meta.glob<string>(
  '/examples/*/expected.txt', { query: '?raw', import: 'default', eager: true });

/** The README of an example; README.fr.md for French. */
export function readme(slug: string, lang: 'en' | 'fr' = 'en') {
  const file = lang === 'fr' ? 'README.fr.md' : 'README.md';
  const r = readmes[`/examples/${slug}/${file}`];
  if (!r) throw new Error(`examples/${slug}/${file} is missing`);
  return r;
}

export function source(slug: string, path: string): string {
  const s = sources[`/examples/${slug}/${path}`];
  if (s === undefined) throw new Error(`examples/${slug}/${path} is missing`);
  return s;
}

export function expected(slug: string): string {
  const s = outputs[`/examples/${slug}/expected.txt`];
  if (s === undefined) throw new Error(`examples/${slug}/expected.txt is missing`);
  return s;
}

export function langOf(path: string): string {
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.sh')) return 'sh';
  if (path.endsWith('.json')) return 'json';
  return 'erlang';
}
