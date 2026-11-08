// Both docs collections behind one lookup: site pages win over synced ones only if a
// slug is defined twice, which check-nav reports as an error.
import { getCollection, type CollectionEntry } from 'astro:content';

export type DocEntry = CollectionEntry<'docs'> | CollectionEntry<'synced'>;

export async function allDocs(): Promise<DocEntry[]> {
  const site = await getCollection('docs');
  const synced = await getCollection('synced');
  const seen = new Set(site.map((e) => e.id));
  const dupes = synced.filter((e) => seen.has(e.id)).map((e) => e.id);
  if (dupes.length) throw new Error(`docs defined twice (site and synced): ${dupes.join(', ')}`);
  return [...site, ...synced];
}

export function isSynced(e: DocEntry): e is CollectionEntry<'synced'> {
  return e.collection === 'synced';
}

/** File name of a site page relative to src/content/docs, for "Edit this page". */
export function siteFile(e: DocEntry): string | undefined {
  return e.collection === 'docs' ? (e as any).filePath?.replace(/^src\/content\/docs\//, '') : undefined;
}
