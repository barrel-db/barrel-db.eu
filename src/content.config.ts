import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Barrel documentation pages (Markdown under src/content/docs/).
// The entry id is the path relative to base, without extension
// (e.g. get-started/introduction), which is also the /docs/<id> route.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { docs };
