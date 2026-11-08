import type { ComponentContent } from './types';
import { barrel } from './barrel';
import { docdb } from './docdb';
import { vectordb } from './vectordb';
import { ngram } from './ngram';
import { embed } from './embed';
import { rerank } from './rerank';
import { spaces } from './spaces';
import { server } from './server';
import { lite } from './lite';
import { crypto } from './crypto';
import { attS3 } from './att-s3';
import { faiss } from './faiss';

export const componentContent: Record<string, ComponentContent> = Object.fromEntries(
  [barrel, docdb, vectordb, ngram, embed, rerank, spaces, server, lite, crypto, attS3, faiss]
    .map((c) => [c.slug, c]),
);

/** Libraries whose rebar.config deps include `slug`. */
export function usedBy(slug: string): string[] {
  return Object.values(componentContent)
    .filter((c) => c.dependsOn.includes(slug))
    .map((c) => c.slug);
}

/** Libraries that can load `slug` as an optional companion. */
export function optionalIn(slug: string): string[] {
  return Object.values(componentContent)
    .filter((c) => c.optional?.some((o) => o.slug === slug))
    .map((c) => c.slug);
}
