// Languages, URL helpers and the strings of the page chrome (header, footer, docs
// shell, search, code blocks). Page content lives in the pages and data files of
// each language; scripts/i18n.mjs keeps the French files in step with the English.

export type Lang = 'en' | 'fr';
export const LANGS: Lang[] = ['en', 'fr'];

export function langOf(url: URL | string): Lang {
  const p = typeof url === 'string' ? url : url.pathname;
  return p === '/fr' || p.startsWith('/fr/') ? 'fr' : 'en';
}

/** '/docs/x' -> '/fr/docs/x' for French; leaves absolute URLs and anchors alone. */
export function localize(path: string, lang: Lang): string {
  if (lang === 'en' || !path.startsWith('/') || path.startsWith('/fr/') || path === '/fr') return path;
  if (/^\/(docs\/lib|pagefind|_astro|llms)/.test(path) || /\.(svg|png|ico|json|txt|md|xml|yaml)$/.test(path)) return path;
  return path === '/' ? '/fr' : `/fr${path}`;
}

/** The same page in the other language. */
export function counterpart(path: string): string {
  if (langOf(path) === 'fr') return path.replace(/^\/fr(?=\/|$)/, '') || '/';
  return path === '/' ? '/fr' : `/fr${path.replace(/\/$/, '')}`;
}

const en = {
  skip: 'Skip to content',
  product: 'Product',
  search: 'Search',
  searchLabel: 'Search the site',
  menu: 'Menu',
  github: 'GitHub',
  home: 'Barrel home',
  switchTheme: 'Switch between light and dark theme',
  otherLang: 'Français',
  otherLangShort: 'FR',
  whatItDoes: 'What it does',
  librariesBehind: 'The libraries behind it',
  worksToday: 'works today',
  optionalSetup: 'optional, needs setup',
  seeUseCases: 'See all use cases',
  howPiecesFit: 'How the pieces fit',
  statusAll: 'Status of every feature',
  allLibraries: 'All libraries',
  site: 'Site',
  footerAbout: 'Open source under the Apache 2.0 license. Built by Enki Bridge in Europe.',
  footerBuild: 'Build',
  footerProject: 'Project',
  documentation: 'Documentation',
  examples: 'Examples',
  useCases: 'Use cases',
  changelog: 'Changelog',
  openSource: 'Open source',
  commercial: 'Commercial support',
  contact: 'Contact',
  copy: 'Copy',
  copied: 'Copied',
  selectCopy: 'Select and copy',
  language: 'Language',
  docs: 'Docs',
  previous: 'Previous',
  next: 'Next',
  onThisPage: 'On this page',
  browseDocs: 'Browse the docs',
  fromRepo: (src: string, link: string) => `From ${link} in the barrel repository`,
  atCommit: 'at',
  updated: 'updated',
  writtenForSite: 'Written for the site',
  translatedFrom: 'Translated from the English page',
  editPage: 'Edit this page',
  viewMarkdown: 'View as Markdown',
  status: { today: 'Works today', optional: 'Optional, needs setup', planned: 'Planned' },
  cmdPlaceholder: 'Search docs, API, MCP tools, examples',
  cmdMove: 'Up and down to move',
  cmdOpen: 'Enter to open',
  cmdNoIndex: 'The search index is created by npm run build. Run a build, then npm run preview.',
  cmdNothing: (q: string) => `Nothing matches "${q}". Try a function name like branch, or a tool name like handoff_create.`,
  cmdGroups: { reference: 'Reference', lib: 'Library API', guides: 'Guides', product: 'Product', useCases: 'Use cases', examples: 'Examples', site: 'Site' },
  defaultDescription: 'Barrel is a database for agents: documents, files and vectors under one id, with search, versions, branches, active-active replication and capability-scoped access. Embedded in Erlang, served over REST and MCP, or in the browser.',
  titleHome: 'Barrel: a database for agents',
};

export type UI = typeof en;

const fr: UI = {
  skip: 'Aller au contenu',
  product: 'Produit',
  search: 'Rechercher',
  searchLabel: 'Rechercher sur le site',
  menu: 'Menu',
  github: 'GitHub',
  home: 'Accueil Barrel',
  switchTheme: 'Basculer entre thème clair et sombre',
  otherLang: 'English',
  otherLangShort: 'EN',
  whatItDoes: 'Ce que fait Barrel',
  librariesBehind: 'Les bibliothèques derrière',
  worksToday: 'fonctionne aujourd’hui',
  optionalSetup: 'optionnel, à installer',
  seeUseCases: 'Voir tous les cas d’usage',
  howPiecesFit: 'Comment les pièces s’assemblent',
  statusAll: 'État de chaque fonctionnalité',
  allLibraries: 'Toutes les bibliothèques',
  site: 'Site',
  footerAbout: 'Open source sous licence Apache 2.0. Conçu par Enki Bridge, en Europe.',
  footerBuild: 'Construire',
  footerProject: 'Projet',
  documentation: 'Documentation',
  examples: 'Exemples',
  useCases: 'Cas d’usage',
  changelog: 'Journal des versions',
  openSource: 'Open source',
  commercial: 'Offre commerciale',
  contact: 'Contact',
  copy: 'Copier',
  copied: 'Copié',
  selectCopy: 'Sélectionnez et copiez',
  language: 'Langage',
  docs: 'Docs',
  previous: 'Précédent',
  next: 'Suivant',
  onThisPage: 'Sur cette page',
  browseDocs: 'Parcourir la documentation',
  fromRepo: (src: string, link: string) => `D’après ${link} dans le dépôt barrel`,
  atCommit: 'au commit',
  updated: 'mis à jour le',
  writtenForSite: 'Écrit pour le site',
  translatedFrom: 'Traduit de la page anglaise',
  editPage: 'Modifier cette page',
  viewMarkdown: 'Voir en Markdown',
  status: { today: 'Fonctionne aujourd’hui', optional: 'Optionnel, à installer', planned: 'Prévu' },
  cmdPlaceholder: 'Rechercher dans la doc, l’API, les outils MCP, les exemples',
  cmdMove: 'Haut et bas pour se déplacer',
  cmdOpen: 'Entrée pour ouvrir',
  cmdNoIndex: 'L’index de recherche est créé par npm run build. Lancez un build, puis npm run preview.',
  cmdNothing: (q: string) => `Aucun résultat pour « ${q} ». Essayez un nom de fonction comme branch, ou un outil comme handoff_create.`,
  cmdGroups: { reference: 'Référence', lib: 'API des bibliothèques', guides: 'Guides', product: 'Produit', useCases: 'Cas d’usage', examples: 'Exemples', site: 'Site' },
  defaultDescription: 'Barrel est une base de données pour les agents : documents, fichiers et vecteurs sous un même identifiant, avec recherche, versions, branches, réplication active-active et accès par capacités. Intégrée en Erlang, servie en REST et MCP, ou dans le navigateur.',
  titleHome: 'Barrel : une base de données pour les agents',
};

export const ui: Record<Lang, UI> = { en, fr };
export const t = (lang: Lang): UI => ui[lang];
