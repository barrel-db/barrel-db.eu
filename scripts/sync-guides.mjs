#!/usr/bin/env node
// Copy the guides and architecture notes from the barrel repository into
// src/content/synced/, so the site never keeps its own drifting copy.
//
// Each file gets frontmatter (title from its first heading, description from
// its first paragraph, the source path) and its links rewritten: a link to a
// sibling guide becomes a site URL, any other repository path becomes a GitHub link.
//
//   BARREL_DIR=../barrel node scripts/sync-guides.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, posix } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const barrel = resolve(process.env.BARREL_DIR || join(root, '..', 'barrel'));
const out = join(root, 'src', 'content', 'synced');
const GITHUB = 'https://github.com/barrel-db/barrel/blob/main';

if (!existsSync(join(barrel, 'docs', 'guides'))) {
  console.error(`no barrel checkout at ${barrel} (set BARREL_DIR)`);
  process.exit(1);
}

// Repository path -> site URL. Everything synced is listed here.
const SOURCES = [
  ...readdirSync(join(barrel, 'docs', 'guides')).filter((f) => f.endsWith('.md'))
    .map((f) => [`docs/guides/${f}`, `guides/${f.replace(/\.md$/, '')}`]),
  ...['overview', 'vision', 'contexts', 'replication-proofs']
    .filter((n) => existsSync(join(barrel, 'docs', 'architecture', `${n}.md`)))
    .map((n) => [`docs/architecture/${n}.md`, `architecture/${n}`]),
  ['docs/features.md', 'features'],
  ['test/e2e/README.md', 'contribute/end-to-end-tests'],
];
const urlOf = new Map(SOURCES.map(([src, slug]) => [src, `/docs/${slug}`]));

let commit = 'main';
try { commit = execFileSync('git', ['-C', barrel, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* not a git checkout */ }

function rewriteLinks(md, srcPath) {
  const dir = posix.dirname(srcPath);
  return md.replace(/(\]\()([^)\s]+)(\))/g, (m, a, target, b) => {
    if (/^(https?:|mailto:|#|\/)/.test(target)) return m;
    const [path, hash = ''] = target.split('#');
    const repoPath = posix.normalize(posix.join(dir, path));
    const site = urlOf.get(repoPath);
    if (site) return `${a}${site}${hash ? '#' + hash : ''}${b}`;
    return `${a}${GITHUB}/${repoPath}${hash ? '#' + hash : ''}${b}`;
  });
}

function frontmatter(md) {
  const lines = md.split('\n');
  const h = lines.findIndex((l) => /^#\s+/.test(l));
  const title = h >= 0 ? lines[h].replace(/^#\s+/, '').trim() : 'Untitled';
  const body = h >= 0 ? [...lines.slice(0, h), ...lines.slice(h + 1)].join('\n') : md;
  const para = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|```|\||>|- |\* )/.test(p)) || '';
  const description = para.replace(/\s+/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').slice(0, 300);
  return { title, description, body };
}

const q = (s) => JSON.stringify(s);

rmSync(out, { recursive: true, force: true });
for (const [src, slug] of SOURCES) {
  const file = join(barrel, src);
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, 'utf8');
  const { title, description, body } = frontmatter(rewriteLinks(raw, src));
  const dest = join(out, `${slug}.md`);
  mkdirSync(dirname(dest), { recursive: true });
  const updated = statSync(file).mtime.toISOString().slice(0, 10);
  // Hash of the upstream file: French translations record it and CI compares.
  const sourceHash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  writeFileSync(dest, `---\ntitle: ${q(title)}\ndescription: ${q(description)}\nsource: ${q(src)}\nsource_hash: ${q(sourceHash)}\ncommit: ${q(commit)}\nupdated: ${q(updated)}\n---\n${body.replace(/^\n+/, '\n')}`);
}
console.log(`synced ${SOURCES.length} files from ${relative(root, barrel) || barrel} at ${commit}`);
