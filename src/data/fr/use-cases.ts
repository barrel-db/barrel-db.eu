// translation_of: src/data/use-cases.ts source_hash: abbfc2370154627d
// French text for src/data/use-cases.ts. Slugs and code come from the English file;
// only the words are kept here.
import * as en from '../use-cases';
import type { UseCaseDetail } from '../use-cases';

export type { FlowNode, UseCaseDetail } from '../use-cases';

type Text = Pick<UseCaseDetail, 'name' | 'short' | 'problem' | 'solution' | 'example'> & { flow: [string, string][] };

const fr: Record<string, Text> = {
  'database-per-agent': {
    name: 'Une base par agent',
    short: 'Isolée, partagée par jeton',
    problem: 'Des agents qui partagent une même base voient et écrasent le travail des autres, et vous ne pouvez pas couper l’accès d’un agent sans toucher aux autres.',
    solution: 'Chaque agent reçoit un espace : sa propre base et un jeton qui dit ce qu’il peut lire ou écrire. Révoquez le jeton, l’agent n’a plus accès.',
    flow: [['Planificateur', 'accorde un jeton'], ['Espace sp_research', 'jeton via MCP'], ['Agent de recherche', '']],
    example: 'Exemple C : deux agents et une passation',
  },
  'write-on-every-node': {
    name: 'Écrire sur chaque nœud',
    short: 'Sites et appareils en active-active',
    problem: 'Sites, appareils et régions ont chacun besoin de leurs données en local, plus d’une copie centrale, sur des liaisons qui vont et viennent.',
    solution: 'Intégrez Barrel sur chaque nœud et lancez une tâche de réplication continue vers le hub. Des filtres et des canaux décident de ce qui va où.',
    flow: [['Nœud en périphérie', 'envoi continu'], ['Hub barrel_server', 'récupéré par les autres'], ['Autres nœuds', '']],
    example: 'Guide : synchronisation',
  },
  'database-per-customer': {
    name: 'Une base par client',
    short: 'Une clé par client',
    problem: 'Des données clients mélangées dans des tables partagées imposent un filtre sur chaque requête, et supprimer un client oblige à traquer ses lignes.',
    solution: 'Un espace par client, chiffré avec sa propre clé. Au départ du client, l’espace est supprimé et chaque jeton émis pour lui est révoqué.',
    flow: [['Votre backend SaaS', 'un par client'], ['Espace sp_acme', 'sa propre clé'], ['Fournisseur de clés', '']],
    example: 'Guide du chiffrement au repos',
  },
  'agent-memory': {
    name: 'La mémoire des agents',
    short: 'Sessions, notes épinglées, rappel',
    problem: 'Un agent oublie d’un tour à l’autre, sauf si vous gardez la conversation, ses notes et ce qui compte, et pouvez les retrouver plus tard.',
    solution: 'Les sessions gardent les messages et des données de travail avec une expiration glissante, les notes épinglées restent au premier plan, et le mode enregistrement rend les documents stockés cherchables par le sens.',
    flow: [['Agent de support', 'à chaque tour'], ['Session dans un espace', 'expire après ttl'], ['Documents cherchables', '']],
    example: 'Exemple A : une mémoire persistante pour un agent',
  },
  'private-rag': {
    name: 'Recherche privée dans vos connaissances',
    short: 'Du RAG sur vos propres machines',
    problem: 'La recherche documentaire pour un modèle (RAG) suppose en général un stockage de documents, une base vectorielle et un service d’embeddings à garder en phase, et vos données quittent votre réseau.',
    solution: 'Écrivez des documents. Barrel calcule leurs embeddings avec un modèle local, cherche par le sens et par mots-clés en même temps, et peut reclasser les meilleurs résultats. Vous transmettez ces résultats à votre modèle.',
    flow: [['Documents', 'embedding à l’écriture'], ['barrel, mode enregistrement', 'recherche hybride'], ['Reclassement', 'meilleurs résultats'], ['Votre appel au LLM', '']],
    example: 'Exemple B : RAG privé',
  },
  'code-search': {
    name: 'Recherche de code pour agents de développement',
    short: 'Exacte, par motif et approximative',
    problem: 'Un agent de développement a autant besoin de correspondances exactes (un code d’erreur, un symbole, un motif) que de réponses par le sens.',
    solution: 'Un index de trigrammes répond aux requêtes par sous-chaîne et par expression régulière sur les champs que vous choisissez ; la recherche hybride répond par le sens. Les deux sont des outils MCP.',
    flow: [['Agent de développement', 'ngram_search, search'], ['barrel_server', 'MCP'], ['Morceaux de code', 'index de trigrammes']],
    example: 'Guide : indexer une base de code pour un agent',
  },
  'branch-per-run': {
    name: 'Une branche par exécution d’agent',
    short: 'Essayer, relire, fusionner',
    problem: 'Laisser un agent modifier des données en production est risqué, et copier une base pour faire des essais prend du temps.',
    solution: 'Créez une branche en temps constant, laissez l’agent travailler sur la copie, examinez ce qui a changé, puis fusionnez ou jetez la branche. Créez une branche à un instant passé pour récupérer un état.',
    flow: [['main', ''], ['Exécution de l’agent sur une branche', 'relecture'], ['fusionner ou supprimer', '']],
    example: 'Exemple D : expérimenter sur une branche',
  },
  'offline-first': {
    name: 'Applications hors ligne d’abord',
    short: 'Une copie dans le navigateur',
    problem: 'Une application de terrain doit continuer à fonctionner sans connexion et rattraper son retard ensuite sans perdre de modifications.',
    solution: 'barrel-lite garde une copie dans le navigateur, lit et écrit en local, et synchronise dans les deux sens quand la connexion revient.',
    flow: [['Application web', 'lectures et écritures locales'], ['barrel-lite (OPFS)', '/db/:db/_sync'], ['barrel_server', '']],
    example: 'Exemple E : application local-first',
  },
};

export const useCaseDetails: UseCaseDetail[] = en.useCaseDetails.map((u) => {
  const f = fr[u.slug];
  return {
    ...u,
    name: f.name, short: f.short, problem: f.problem, solution: f.solution, example: f.example,
    flow: u.flow.map((n, i) => ({ ...n, label: f.flow[i][0], edge: f.flow[i][1] })),
  };
});
