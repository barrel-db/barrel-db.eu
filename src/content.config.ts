import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const page = z.object({
  title: z.string(),
  description: z.string().optional(),
  /** Repository path a synced page was copied from. */
  source: z.string().optional(),
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

// The French pages from the previous site, served unchanged until translated.
const docsFr = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs-fr' }),
  schema: z.object({ title: z.string(), description: z.string().optional() }),
});

export const collections = { docs, synced, docsFr };
