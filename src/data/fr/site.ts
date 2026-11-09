// translation_of: src/data/site.ts source_hash: 42cd13f480174e76
// French text for src/data/site.ts. Slugs, versions and status come from the English
// file, so only the words are kept here.
import * as en from '../site';
import type { Status } from '../site';

export { GITHUB, SITE_REPO } from '../site';

const cap: Record<string, [string, string]> = {
  replication: ['Réplication', 'Active-active : chaque copie accepte les écritures et converge'],
  search: ['Recherche', 'Vectorielle, par mots-clés, hybride et par expression régulière, dans un seul langage de requête'],
  timeline: ['Timeline', 'Créer une branche d’une base, la fusionner, retrouver un état passé'],
  agents: ['Couche agents', 'Espaces, jetons de capacité, sessions, passations, MCP'],
  security: ['Sécurité', 'Chiffrement au repos, jetons, requêtes signées, mTLS'],
  deployments: ['Déploiements', 'Intégrée, serveur ou navigateur, et comment choisir'],
};
export const capabilities = en.capabilities.map((c) => ({ ...c, name: cap[c.slug][0], body: cap[c.slug][1] }));

const groups: Record<string, string> = {
  'The database': 'La base de données',
  Data: 'Données',
  Models: 'Modèles',
  Agents: 'Agents',
  Access: 'Accès',
  'Storage and security': 'Stockage et sécurité',
};
const comp: Record<string, string> = {
  barrel: 'Des enregistrements : document, fichiers et vecteur sous un même identifiant',
  docdb: 'Documents, versions, requêtes, réplication',
  vectordb: 'Index vectoriel, BM25, recherche hybride',
  ngram: 'Recherche par sous-chaîne et par expression régulière',
  embed: 'Fournisseurs d’embeddings, locaux ou dans le cloud',
  rerank: 'Reclasser les résultats de recherche',
  spaces: 'Espaces, jetons, sessions, passations',
  server: 'REST et MCP sur HTTP',
  lite: 'Une copie dans le navigateur, synchronisée',
  crypto: 'Clés et algorithmes de chiffrement',
  'att-s3': 'Pièces jointes dans un stockage compatible S3',
  faiss: 'Moteur d’index FAISS',
};
export const components = en.components.map((c) => ({ ...c, group: groups[c.group], body: comp[c.slug] }));
export const componentGroups = en.componentGroups.map((g) => groups[g]);

const uc: Record<string, [string, string]> = {
  'database-per-agent': ['Une base par agent', 'Isolée, partagée par jeton'],
  'write-on-every-node': ['Écrire sur chaque nœud', 'Sites et appareils en active-active'],
  'database-per-customer': ['Une base par client', 'Une clé par client'],
  'agent-memory': ['La mémoire des agents', 'Sessions, notes épinglées, rappel'],
  'private-rag': ['Recherche privée dans vos connaissances', 'Du RAG sur vos propres machines'],
  'code-search': ['Recherche de code pour agents de développement', 'Exacte, par motif et approximative'],
  'branch-per-run': ['Une branche par exécution d’agent', 'Essayer, relire, fusionner'],
  'offline-first': ['Applications hors ligne d’abord', 'Une copie dans le navigateur'],
};
export const useCases = en.useCases.map((u) => ({ ...u, name: uc[u.slug][0], short: uc[u.slug][1] }));

export const mainNav = [
  { label: 'Qu’est-ce que Barrel ?', href: '/what-is-barrel' },
  { label: 'Cas d’usage', href: '/use-cases' },
  { label: 'Réplication', href: '/product/replication' },
  { label: 'Docs', href: '/docs' },
  { label: 'Exemples', href: '/examples' },
];

export const statusLabel: Record<Status, string> = {
  today: 'Fonctionne aujourd’hui',
  optional: 'Optionnel, à installer',
  planned: 'Prévu',
};
