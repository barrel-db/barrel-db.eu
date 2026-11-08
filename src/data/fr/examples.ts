// translation_of: src/components/example/examples.ts source_hash: d34c5fdc0d56e122
// French text for src/components/example/examples.ts. Slugs, files and links come
// from the English file; only the words are kept here.
import * as en from '../../components/example/examples';
import type { Example, ExampleLink } from '../../components/example/examples';

export { REPO_TREE } from '../../components/example/examples';
export type { Example, ExampleLink } from '../../components/example/examples';

const text: Record<string, { title: string; summary: string; runs: string }> = {
  'embedded-erlang': {
    title: 'Intégrer barrel dans une application Erlang',
    summary: 'Ouvrir une base dans votre nœud, écrire des documents, les interroger en BQL, fermer proprement. Sans serveur.',
    runs: 'Erlang, intégré',
  },
  'agent-memory': {
    title: 'Mémoire d’agent qui survit aux redémarrages',
    summary: 'Une session avec messages, contexte épinglé et données de travail dans un espace ; des faits vectorisés à l’écriture et retrouvés par recherche sur un second nœud.',
    runs: 'Erlang, intégré',
  },
  'private-rag': {
    title: 'Recherche privée dans vos connaissances',
    summary: 'Ingérer des articles de support, les chercher par mots-clés et en recherche hybride, les reclasser au besoin, et construire le prompt de votre LLM.',
    runs: 'Erlang, intégré',
  },
  'agents-handoff': {
    title: 'Partager un espace entre agents',
    summary: 'Un espace, un jeton en lecture seule pour un agent, et une tâche passée à un autre agent, acceptée puis terminée.',
    runs: 'Erlang, intégré',
  },
  'branch-experiment': {
    title: 'Créer une branche, comparer, fusionner, restaurer',
    summary: 'Modifier une branche d’une base, la comparer à son parent, la fusionner, puis ouvrir une branche d’un état passé.',
    runs: 'Erlang, intégré',
  },
  'local-first': {
    title: 'Local-first avec barrel-lite',
    summary: 'Deux clients TypeScript avec une copie locale : modifications hors ligne, synchronisation avec un barrel_server, et un conflit résolu pour tous.',
    runs: 'TypeScript, Node, un serveur',
  },
  'contexts-bql': {
    title: 'Interroger deux bases comme des contextes',
    summary: 'Enregistrer des bases comme contextes et lancer une seule requête BQL sur elles, avec sources, couverture et réponse partielle quand l’une est indisponible.',
    runs: 'Erlang, intégré',
  },
  'mcp-session': {
    title: 'Une session MCP avec curl',
    summary: 'Le JSON-RPC brut qu’un agent envoie à barrel_server : initialize, liste des outils, écriture, lecture, requête et recherche.',
    runs: 'Shell, un serveur',
  },
};

// Labels of the links, keyed by the English label.
const labels: Record<string, string> = {
  'Quickstart: embedded': 'Démarrage rapide : intégrée',
  'Embed barrel in an Erlang app': 'Intégrer barrel dans une application Erlang',
  'Query with BQL': 'Interroger avec BQL',
  'Memory for agents': 'La mémoire des agents',
  'Spaces, sessions, handoffs': 'Espaces, sessions, passations',
  'Record mode': 'Mode enregistrement',
  'Choose an embedding provider': 'Choisir un fournisseur d’embeddings',
  'Private knowledge search': 'Recherche privée dans vos connaissances',
  'Vector, keyword and hybrid': 'Vectorielle, mots-clés et hybride',
  'Reranking': 'Reclassement',
  'A database per agent': 'Une base par agent',
  'Spaces and capabilities': 'Espaces et capacités',
  'A branch per agent run': 'Une branche par exécution d’agent',
  'Branch, merge, recover': 'Brancher, fusionner, restaurer',
  'Versions, conflicts, convergence': 'Versions, conflits, convergence',
  'Offline-first apps': 'Applications hors ligne d’abord',
  'Quickstart: browser': 'Démarrage rapide : navigateur',
  'barrel-lite': 'barrel-lite',
  'Conflicts': 'Conflits',
  'Contexts and working sets': 'Contextes et ensembles de travail',
  'Query several datasets': 'Interroger plusieurs jeux de données',
  'MCP endpoint': 'Point d’accès MCP',
  'MCP tools': 'Outils MCP',
  'Quickstart: server': 'Démarrage rapide : serveur',
};

const link = (l: ExampleLink): ExampleLink => {
  const label = labels[l.label];
  if (label === undefined) throw new Error(`No French label for "${l.label}"`);
  return { ...l, label };
};

export const examples: Example[] = en.examples.map((e) => {
  const t = text[e.slug];
  if (!t) throw new Error(`No French text for example ${e.slug}`);
  return { ...e, ...t, useCase: e.useCase && link(e.useCase), docs: e.docs.map(link) };
});
