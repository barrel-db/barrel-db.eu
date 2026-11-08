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

/** Path of a site page in the site repository, for "Edit this page". */
export function siteFile(e: { collection: string; filePath?: string }): string | undefined {
  return e.collection === 'synced' ? undefined : e.filePath;
}

export type FrEntry = CollectionEntry<'docsFr'> | CollectionEntry<'guidesFr'>;

/** French docs: translated site pages and translated guides, by slug. */
export async function allDocsFr(): Promise<FrEntry[]> {
  const site = await getCollection('docsFr');
  const guides = await getCollection('guidesFr');
  return [...site, ...guides];
}
