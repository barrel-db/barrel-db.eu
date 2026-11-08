// The data modules for a language. English files are the source; French files
// override their text only.
import type { Lang } from '../i18n';
import * as siteEn from './site';
import * as siteFr from './fr/site';
import * as navEn from './docs-nav';
import * as navFr from './fr/docs-nav';
import * as useCasesEn from './use-cases';
import * as useCasesFr from './fr/use-cases';
import * as examplesEn from '../components/example/examples';
import * as examplesFr from './fr/examples';
import { componentContent as contentEn } from './components';
import type { ComponentContent } from './components/types';
import { barrel } from './fr/components/barrel';
import { docdb } from './fr/components/docdb';
import { vectordb } from './fr/components/vectordb';
import { ngram } from './fr/components/ngram';
import { embed } from './fr/components/embed';
import { rerank } from './fr/components/rerank';
import { spaces } from './fr/components/spaces';
import { server } from './fr/components/server';
import { lite } from './fr/components/lite';
import { crypto } from './fr/components/crypto';
import { attS3 } from './fr/components/att-s3';
import { faiss } from './fr/components/faiss';

export const siteFor = (lang: Lang) => (lang === 'fr' ? siteFr : siteEn);
export const navFor = (lang: Lang) => (lang === 'fr' ? navFr : navEn);
export const useCasesFor = (lang: Lang) => (lang === 'fr' ? useCasesFr : useCasesEn);
export const examplesFor = (lang: Lang) => (lang === 'fr' ? examplesFr : examplesEn);

const contentFr: Record<string, ComponentContent> = Object.fromEntries(
  [barrel, docdb, vectordb, ngram, embed, rerank, spaces, server, lite, crypto, attS3, faiss]
    .map((c) => [c.slug, c]),
);

/** Text of the /product/<slug> library pages. Slugs and dependencies are the same in both. */
export const componentsFor = (lang: Lang) => (lang === 'fr' ? contentFr : contentEn);
