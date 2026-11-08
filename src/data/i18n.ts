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

export const siteFor = (lang: Lang) => (lang === 'fr' ? siteFr : siteEn);
export const navFor = (lang: Lang) => (lang === 'fr' ? navFr : navEn);
export const useCasesFor = (lang: Lang) => (lang === 'fr' ? useCasesFr : useCasesEn);
export const examplesFor = (lang: Lang) => (lang === 'fr' ? examplesFr : examplesEn);
