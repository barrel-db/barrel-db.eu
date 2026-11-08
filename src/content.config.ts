import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const page = z.object({
  title: z.string(),
  description: z.string().optional(),
  /** Repository path a synced page was copied from. */
  source: z.string().optional(),
  /** sha256 prefix of the upstream file, for synced pages. */
  source_hash: z.string().optional(),
  commit: z.string().optional(),
  updated: z.string().optional(),
  /** Marks a page whose subject is not implemented yet. */
  status: z.enum(['today', 'optional', 'planned']).optional(),
});

// Pages written for the site (src/content/docs). The entry id is the URL under /docs/.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: page,
});

// Guides and architecture notes copied from the barrel repository by
// scripts/sync-guides.mjs. Never edit these here: fix them upstream.
const synced = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/synced' }),
  schema: page,
});

// French translations. Each entry names the English file it translates and that file's
// hash (translation_of, source_hash); scripts/i18n.mjs checks they still match.
const fr = z.object({ translation_of: z.string(), source_hash: z.string() });
const docsFr = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/fr/docs' }),
  schema: page.merge(fr),
});
const guidesFr = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/fr/synced' }),
  schema: page.merge(fr),
});

export const collections = { docs, synced, docsFr, guidesFr };
