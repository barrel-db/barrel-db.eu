// The data modules for a language. English files are the source; French files
// override their text only.
import type { Lang } from '../i18n';
import * as siteEn from './site';
import * as siteFr from './fr/site';
import * as navEn from './docs-nav';
import * as navFr from './fr/docs-nav';

export const siteFor = (lang: Lang) => (lang === 'fr' ? siteFr : siteEn);
export const navFor = (lang: Lang) => (lang === 'fr' ? navFr : navEn);
