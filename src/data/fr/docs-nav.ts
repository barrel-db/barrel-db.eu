// translation_of: src/data/docs-nav.ts source_hash: 36ec790d06731be5
// French labels for the docs sidebar. Slugs and order come from the English file.
import { docsNav as enNav, type NavItem, type NavSection } from '../docs-nav';

const titles: Record<string, string> = {
  'Get started': 'Démarrer', Concepts: 'Concepts', 'Store and query': 'Stocker et interroger',
  Search: 'Recherche', Replicate: 'Répliquer', Agents: 'Agents', Timeline: 'Timeline',
  Contexts: 'Contextes', Browser: 'Navigateur', Security: 'Sécurité', Operate: 'Exploiter',
  Reference: 'Référence', Architecture: 'Architecture', Contribute: 'Contribuer',
};

const labels: Record<string, string> = {
  'start/what-is-barrel': 'Présentation pour les développeurs',
  'start/install': 'Installer',
  'start/quickstart-embedded': 'Démarrage rapide : intégrée',
  'start/quickstart-server': 'Démarrage rapide : serveur',
  'start/quickstart-browser': 'Démarrage rapide : navigateur',
  'start/choose-deployment': 'Choisir un déploiement',
  'concepts/record': 'L’enregistrement',
  'concepts/versions': 'Versions, conflits, convergence',
  'concepts/spaces': 'Espaces et capacités',
  'concepts/contexts': 'Contextes et ensembles de travail',
  'guides/embedding': 'Intégrer barrel dans une application Erlang',
  'guides/record-mode': 'Mode enregistrement',
  'guides/query-bql': 'Interroger avec BQL',
  'store/attachments': 'Pièces jointes',
  'search/hybrid': 'Vectorielle, mots-clés et hybride',
  'search/substring-regex': 'Sous-chaîne et expression régulière',
  'search/reranking': 'Reclassement',
  'search/embedding-providers': 'Choisir un fournisseur d’embeddings',
  'guides/synchronization': 'Synchronisation',
  'replicate/conflicts': 'Conflits',
  'replicate/upgrade-from-2-0': 'Mettre à jour depuis la 2.0',
  'guides/spaces': 'Espaces, sessions, passations',
  'guides/mcp': 'Point d’accès MCP',
  'guides/audit-provenance': 'Audit et provenance',
  'guides/code-indexing': 'Indexer une base de code',
  'guides/timeline': 'Brancher, fusionner, restaurer',
  'guides/contexts': 'Interroger plusieurs jeux de données',
  'guides/barrel-lite': 'barrel-lite',
  'guides/encryption': 'Chiffrement au repos',
  'security/authentication': 'Authentification',
  'guides/rest-server': 'Lancer le serveur',
  'guides/embedding-barrel-server': 'Intégrer le serveur dans une application',
  'operate/monitoring': 'Supervision',
  'operate/troubleshooting': 'Dépannage',
  'operate/backups': 'Sauvegarde et restauration',
  'reference/barrel-api': 'API Barrel',
  'reference/bql': 'BQL',
  'reference/rest-api': 'API REST',
  'reference/mcp-tools': 'Outils MCP',
  'reference/configuration': 'Configuration',
  'reference/errors': 'Codes d’erreur',
  'reference/libraries': 'Bibliothèques',
  'architecture/overview': 'Vue d’ensemble',
  features: 'État des fonctionnalités',
  'architecture/replication-proofs': 'Preuves de la réplication',
  'architecture/contexts': 'Conception des contextes',
  'architecture/vision': 'Vision',
  'contribute/build-and-test': 'Compiler et tester',
  'contribute/end-to-end-tests': 'Tests de bout en bout',
  'contribute/write-a-provider': 'Écrire un fournisseur',
  'guides/distributing-apps': 'Distribuer les applications',
};

export const docsNav: NavSection[] = enNav.map((s) => ({
  title: titles[s.title] ?? s.title,
  items: s.items.map((i) => ({ slug: i.slug, label: labels[i.slug] ?? i.label })),
}));
export const docsOrder: NavItem[] = docsNav.flatMap((s) => s.items);
export function sectionOf(slug: string): NavSection | undefined {
  return docsNav.find((s) => s.items.some((i) => i.slug === slug));
}
