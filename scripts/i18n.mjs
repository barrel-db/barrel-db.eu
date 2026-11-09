#!/usr/bin/env node
// Keep the French site in step with the English one.
//
// Every English source that carries reader-facing text has a French file. The French
// file names its source and the hash of the source it was translated from:
//
//   Markdown / MDX frontmatter:   translation_of: src/content/docs/x.md
//                                 source_hash: 1a2b3c4d5e6f7a8b
//   .astro / .ts (a comment):     // translation_of: src/pages/x.astro source_hash: 1a2b...
//   README.fr.md (first line):    <!-- translation_of: examples/x/README.md source_hash: 1a2b... -->
//
// Synced guides are hashed on their upstream file in the barrel repository (the
// source_hash the sync script writes), so a change upstream makes the French guide stale.
//
//   node scripts/i18n.mjs            check: exit 1 if a translation is missing or stale
//   node scripts/i18n.mjs status     list every pair and its state
//   node scripts/i18n.mjs stamp <french files...>
//                                    record the current source hash after updating a translation
//   node scripts/i18n.mjs diff <french file>
//                                    show what changed in the English source since it was translated
//
// Components in src/components hold both languages side by side and are not tracked
// here; see AGENTS.md.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p);
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function walk(dir, keep) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p, keep));
    else if (keep(p)) out.push(p);
  }
  return out;
}

// English sources and where their French file lives.
function pairs() {
  const list = [];
  const add = (en, fr, kind) => list.push({ en: rel(en), fr: rel(fr), kind });

  for (const p of walk(join(root, 'src/pages'), (f) => f.endsWith('.astro'))) {
    const r = rel(p);
    if (r.startsWith('src/pages/fr/') || r === 'src/pages/404.astro' || r === 'src/pages/pricing.astro') continue;
    add(p, join(root, 'src/pages/fr', r.slice('src/pages/'.length)), 'page');
  }
  for (const p of walk(join(root, 'src/content/docs'), (f) => /\.mdx?$/.test(f))) {
    add(p, join(root, 'src/content/fr/docs', rel(p).slice('src/content/docs/'.length)), 'doc');
  }
  for (const p of walk(join(root, 'src/content/synced'), (f) => f.endsWith('.md'))) {
    add(p, join(root, 'src/content/fr/synced', rel(p).slice('src/content/synced/'.length)), 'guide');
  }
  for (const f of ['site.ts', 'use-cases.ts', 'docs-nav.ts']) {
    add(join(root, 'src/data', f), join(root, 'src/data/fr', f), 'data');
  }
  for (const p of walk(join(root, 'src/data/components'), (f) => f.endsWith('.ts') && !/\/(index|types)\.ts$/.test(f))) {
    add(p, join(root, 'src/data/fr/components', rel(p).slice('src/data/components/'.length)), 'data');
  }
  add(join(root, 'src/components/example/examples.ts'), join(root, 'src/data/fr/examples.ts'), 'data');
  for (const d of existsSync(join(root, 'examples')) ? readdirSync(join(root, 'examples')) : []) {
    const readme = join(root, 'examples', d, 'README.md');
    if (existsSync(readme)) add(readme, join(root, 'examples', d, 'README.fr.md'), 'readme');
  }
  return list;
}

function sourceHash(enPath) {
  const text = readFileSync(join(root, enPath), 'utf8');
  if (enPath.startsWith('src/content/synced/')) {
    const m = text.match(/^source_hash:\s*"?([0-9a-f]+)"?/m);
    if (m) return m[1];
  }
  return hash(text);
}

function header(frPath) {
  const text = readFileSync(join(root, frPath), 'utf8').slice(0, 2000);
  const of = text.match(/translation_of:\s*"?([^\s"]+)"?/);
  const h = text.match(/source_hash:\s*"?([0-9a-f]+)"?/);
  return { of: of?.[1], hash: h?.[1] };
}

function state(p) {
  if (!existsSync(join(root, p.fr))) return 'missing';
  const h = header(p.fr);
  if (!h.of || !h.hash) return 'no-header';
  if (h.of !== p.en) return 'wrong-source';
  return h.hash === sourceHash(p.en) ? 'ok' : 'stale';
}

function stamp(files) {
  const byFr = new Map(pairs().map((p) => [p.fr, p]));
  for (const f of files) {
    const fr = rel(resolve(f));
    const p = byFr.get(fr);
    if (!p) { console.error(`not a French counterpart of any source: ${fr}`); process.exitCode = 1; continue; }
    const file = join(root, fr);
    let text = readFileSync(file, 'utf8');
    const h = sourceHash(p.en);
    if (/source_hash:\s*"?[0-9a-f]*"?/.test(text)) {
      text = text.replace(/translation_of:\s*"?[^\s"]+"?/, (m) => m.startsWith('translation_of: "') ? `translation_of: "${p.en}"` : `translation_of: ${p.en}`)
                 .replace(/source_hash:\s*("?)[0-9a-f]*\1/, (m, q) => `source_hash: ${q}${h}${q}`);
    } else if (/\.mdx?$/.test(fr) && text.startsWith('---\n')) {
      text = text.replace(/^---\n/, `---\ntranslation_of: ${p.en}\nsource_hash: "${h}"\n`);
    } else if (fr.endsWith('.md')) {
      text = `<!-- translation_of: ${p.en} source_hash: ${h} -->\n${text}`;
    } else if (fr.endsWith('.astro') && text.startsWith('---\n')) {
      text = text.replace(/^---\n/, `---\n// translation_of: ${p.en} source_hash: ${h}\n`);
    } else {
      text = `// translation_of: ${p.en} source_hash: ${h}\n${text}`;
    }
    writeFileSync(file, text);
    console.log(`stamped ${fr} (${h})`);
  }
}

function diff(file) {
  const fr = rel(resolve(file));
  const p = pairs().find((x) => x.fr === fr);
  if (!p) { console.error(`not a French counterpart: ${fr}`); process.exit(1); }
  const h = header(fr).hash;
  if (p.kind === 'guide') {
    console.log(`${p.en} is synced from the barrel repository; compare the upstream file's history (git log -p) since the translation (hash ${h}).`);
    return;
  }
  // Find the commit where the English file had the recorded hash, and diff from there.
  const revs = execFileSync('git', ['-C', root, 'log', '--format=%H', '--', p.en]).toString().trim().split('\n').filter(Boolean);
  for (const rev of revs) {
    let old = '';
    try { old = execFileSync('git', ['-C', root, 'show', `${rev}:${p.en}`]).toString(); } catch { continue; }
    if (hash(old) === h) {
      process.stdout.write(execFileSync('git', ['-C', root, 'diff', rev, '--', p.en]).toString() || 'no change since the translation\n');
      return;
    }
  }
  console.log(`no commit of ${p.en} has hash ${h}; read the whole English file`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'stamp') stamp(args);
else if (cmd === 'diff') diff(args[0]);
else {
  const all = pairs().map((p) => ({ ...p, state: state(p) }));
  if (cmd === 'status') for (const p of all) console.log(`${p.state.padEnd(12)} ${p.fr}  <-  ${p.en}`);
  const bad = all.filter((p) => p.state !== 'ok');
  if (bad.length) {
    if (cmd !== 'status') for (const p of bad) console.error(`${p.state.padEnd(12)} ${p.fr}  <-  ${p.en}`);
    console.error(`\n${bad.length} of ${all.length} French files are missing or out of date.`);
    console.error('Translate or update them, then run: node scripts/i18n.mjs stamp <french files>');
    process.exit(1);
  }
  console.log(`translations up to date (${all.length} files)`);
}
