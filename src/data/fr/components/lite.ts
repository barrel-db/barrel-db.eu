// translation_of: src/data/components/lite.ts source_hash: 286a82e72e6d711e
// French text for the barrel-lite library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { lite as en } from '../../components/lite';

export const lite = overlay(en, {
  lead: 'Une copie d’une base Barrel dans le navigateur. barrel-lite garde un stockage local hors ligne d’abord et le synchronise avec barrel_server par le protocole de réplication.',
  problem: 'Les applications web doivent continuer à fonctionner hors ligne et récupérer les changements faits ailleurs. barrel-lite stocke documents et pièces jointes dans le navigateur, exécute BQL localement, et réplique avec un serveur selon les mêmes règles de version que les nœuds Erlang : les conflits sont conservés, pas perdus.',
  useWhen: [
    'Une application web doit fonctionner hors ligne et se synchroniser à la reconnexion.',
    'Vous voulez des requêtes locales et un classement vectoriel local sur les données d’un utilisateur.',
    'Plusieurs onglets partagent un même stockage : un onglet synchronise, les autres passent par lui.',
  ],
  notWhen: [
    'Vous avez besoin de recherche plein texte ou ANN dans le navigateur : elles tournent sur le serveur (`searchText`, `searchVector`).',
    'Vous avez besoin de requêtes signées ou de mTLS côté client : il n’envoie que des tokens bearer.',
  ],
  external: 'TypeScript, ESM, Node 20 ou plus récent pour le build ; se synchronise avec [barrel_server](/product/server) sur HTTP',
  standalone: { short: 'En partie', text: 'Le stockage local et BQL en local fonctionnent sans serveur. La synchronisation, la recherche côté serveur et les requêtes distantes demandent barrel_server.' },
  install: { note: 'barrel-lite n’est pas publié sur npm (le paquet est marqué privé). Construisez-le depuis le dépôt.' },
  reachedThrough: ['TypeScript dans le navigateur (OPFS) ou dans Node (mémoire)'],
  config: [
    { rows: [
      { def: 'aucun', meaning: '`{url, db, token?, fetch?}` ; `url` peut contenir un sous-chemin' },
      { def: 'OPFS, sinon mémoire', meaning: 'Un adaptateur de stockage' },
      { meaning: 'Un onglet leader par origine (Web Locks et BroadcastChannel)' },
      { def: 'aucun', meaning: 'Callback appelée pour les versions concurrentes' },
      { meaning: 'Délai avant l’écriture sur disque des modifications locales' },
    ] },
  ],
  api: [
    { title: 'Documents', rows: [
      { task: 'Ouvrir' },
      { task: 'Écrire, lire, supprimer', returns: '`{id, version}`, le document ou `undefined`' },
      { task: 'Lister', returns: 'enregistrements' },
      { task: 'Conflits' },
    ] },
    { title: 'Requêtes et recherche', rows: [
      { task: 'BQL local', returns: 'lignes ; les fonctions de table lèvent `BqlServerOnlyError`' },
      { task: 'BQL sur le serveur' },
      { task: 'Classement vectoriel local', returns: '`[{id, score, doc}]`, cosinus en force brute' },
      { task: 'Recherche sur le serveur', returns: 'résultats du serveur' },
    ] },
    { title: 'Fichiers et synchronisation', rows: [
      { task: 'Pièces jointes' },
      { task: 'Synchroniser une fois', returns: 'statistiques d’envoi et de réception' },
      { task: 'Synchroniser en continu' },
      { task: 'Événements', returns: 'une fonction de désabonnement' },
    ] },
  ],
  examples: [
    { title: 'Ouvrir, écrire, interroger, synchroniser', intro: 'Tiré du README du paquet. Non exécuté pour cette page ; la suite unitaire (31 fichiers, 187 tests) passe contre un faux serveur.' },
  ],
  limits: [
    'Absent de npm : construisez-le depuis `clients/barrel-lite` dans le dépôt.',
    'Tokens bearer seulement, globaux ou jetons de capacité `bsp_`. Pas de requêtes signées.',
    'Les écritures locales sont écrites avec un délai ; celles qui ne le sont pas encore sont perdues en cas de plantage. La durabilité vient de la synchronisation.',
    'Ni recherche plein texte ni index ANN dans le navigateur ; `searchLocal` classe les vecteurs synchronisés en force brute.',
    'Le statut `"offline"` existe dans le type mais n’est jamais émis.',
  ],
  guides: [
    { label: 'Guide barrel-lite' },
    { label: 'Démarrage rapide : navigateur' },
    { label: 'Synchronisation' },
  ],
});
