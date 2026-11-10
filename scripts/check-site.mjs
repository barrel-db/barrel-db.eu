#!/usr/bin/env node
// Checks run after `astro build`, so the published site cannot quietly break:
//   - every docs sidebar entry, product page, use case and example has a built page,
//     in English and in French;
//   - library versions in src/data/site.ts match the barrel checkout (BARREL_DIR);
//   - no em dash and no banned word in the new pages (house style);
//   - every internal link in the built HTML points at a page that exists.
// Usage: node scripts/check-site.mjs   (after npm run build)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const barrel = resolve(process.env.BARREL_DIR || join(root, '..', 'barrel'));
const problems = [];

const read = (p) => readFileSync(join(root, p), 'utf8');
const built = (url) => {
  const p = url.replace(/^\//, '').replace(/\/$/, '');
  return [join(dist, p, 'index.html'), join(dist, p), join(dist, `${p}.html`)].some((f) => existsSync(f) && statSync(f).isFile());
};

// 1. Pages that the navigation promises, in both languages.
const PREFIXES = ['', '/fr'];
const need = (url, what) => { for (const p of PREFIXES) if (!built(`${p}${url}`)) problems.push(`${what} missing: ${p}${url}`); };
const nav = read('src/data/docs-nav.ts');
for (const [, slug] of nav.matchAll(/slug: '([^']+)'/g)) need(`/docs/${slug}`, 'docs page');
const site = read('src/data/site.ts');
const block = (name) => site.split(`export const ${name}`)[1]?.split('];')[0] ?? '';
for (const [, slug] of block('capabilities').matchAll(/slug: '([^']+)'/g)) need(`/product/${slug}`, 'capability page');
for (const [, slug] of block('components').matchAll(/slug: '([^']+)'/g)) need(`/product/${slug}`, 'component page');
for (const [, slug] of block('useCases').matchAll(/slug: '([^']+)'/g)) need(`/use-cases/${slug}`, 'use case page');
if (existsSync(join(root, 'examples'))) {
  for (const d of readdirSync(join(root, 'examples'))) {
    if (statSync(join(root, 'examples', d)).isDirectory()) need(`/examples/${d}`, 'example page');
  }
}

// 2. Versions against the checkout.
if (existsSync(join(barrel, 'apps'))) {
  for (const m of block('components').matchAll(/name: '([^']+)'[^}]*version: '([^']+)'[^}]*app: '([^']+)'/g)) {
    const [, name, version, app] = m;
    let actual = null;
    if (app.startsWith('apps/')) {
      const srcDir = join(barrel, app, 'src');
      const f = existsSync(srcDir) && readdirSync(srcDir).find((x) => x.endsWith('.app.src'));
      if (f) actual = readFileSync(join(srcDir, f), 'utf8').match(/\{vsn,\s*"([^"]+)"/)?.[1] ?? null;
    } else {
      const pkg = join(barrel, app, 'package.json');
      if (existsSync(pkg)) actual = JSON.parse(readFileSync(pkg, 'utf8')).version;
    }
    if (actual && actual !== version) problems.push(`version of ${name} is ${actual} in the checkout, ${version} in src/data/site.ts`);
  }
} else {
  console.warn(`no barrel checkout at ${barrel}: versions not checked`);
}

// 2b. Every `{app, "~> X.Y"}` in the sources asks for the current minor version.
const current = new Map([...block('components').matchAll(/name: '([^']+)'[^}]*version: '([^']+)'/g)]
  .map(([, n, v]) => [n, v.split('.').slice(0, 2).join('.')]));
(function scan(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'synced') scan(p); continue; }
    if (!/\.(astro|ts|md|mdx)$/.test(f)) continue;
    for (const [, n, v] of readFileSync(p, 'utf8').matchAll(/\{(barrel[a-z_]*), "~> ([0-9.]+)"\}/g)) {
      if (current.has(n) && current.get(n) !== v) problems.push(`${p.slice(root.length + 1)} asks for ${n} ~> ${v}, current is ${current.get(n)}`);
    }
  }
})(join(root, 'src'));

// 3 and 4. Walk the built HTML, skipping the French legacy pages and the ex_doc reference.
const pages = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      const rel = p.slice(dist.length);
      if (rel === '/docs/lib' || rel === '/pagefind') continue;
      walk(p);
    } else if (f.endsWith('.html')) pages.push(p);
  }
})(dist);

const skipText = (html) => html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
for (const p of pages) {
  const html = readFileSync(p, 'utf8');
  const rel = p.slice(dist.length);
  const text = skipText(html);
  if (text.includes('—')) problems.push(`em dash in ${rel}`);
  if (rel.startsWith('/fr/') && !/http-equiv="refresh"/.test(html) && !/<html lang="fr"/.test(html)) problems.push(`French page without lang="fr": ${rel}`);
  if (/comprehensive/i.test(text)) problems.push(`banned word "comprehensive" in ${rel}`);
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
    if (href.startsWith('/docs/lib/') || href.startsWith('/_astro') || href.startsWith('/pagefind')) continue;
    if (/\.(svg|png|ico|xml|txt|md|json|yaml)$/.test(href) && existsSync(join(dist, href))) continue;
    if (!built(href)) problems.push(`broken link in ${rel}: ${href}`);
  }
}

const uniq = [...new Set(problems)];
if (uniq.length) {
  console.error(uniq.map((p) => `  ${p}`).join('\n'));
  console.error(`\n${uniq.length} problem(s)`);
  process.exit(1);
}
console.log(`site checks passed (${pages.length} pages)`);
