// translation_of: src/data/components/server.ts source_hash: ce343b725bde171f
// French text for the barrel_server library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { server as en } from '../../components/server';

export const server = overlay(en, {
  lead: 'Barrel sur HTTP : une API REST, un point d’accès MCP pour les agents, et le protocole de réplication par lequel les autres nœuds et les navigateurs se synchronisent.',
  problem: 'Les agents, les services et les navigateurs qui ne sont pas des processus Erlang doivent atteindre la base, avec un contrôle d’accès. barrel_server expose les bases, la recherche, la timeline, les espaces et les contextes en REST, sert 39 outils MCP sur `/mcp`, et vérifie les tokens bearer, les jetons de capacité, les requêtes signées ou le mTLS.',
  useWhen: [
    'Des clients dans d’autres langages, ou des agents via MCP, doivent lire et écrire.',
    'Des nœuds ou des navigateurs barrel-lite répliquent sur HTTP.',
    'Vous voulez que les jetons de capacité soient appliqués : c’est le serveur qui les vérifie.',
  ],
  notWhen: [
    'Tout tourne dans un seul nœud Erlang : appelez directement [barrel](/product/barrel).',
  ],
  external: 'livery (HTTP/1.1, HTTP/2, HTTP/3) et barrel_mcp 4.4.1',
  standalone: { short: 'Oui, comme service', text: 'Oui, comme service. Il apporte avec lui barrel, barrel_docdb, barrel_spaces et barrel_ngram. Vous pouvez aussi monter ses routes dans votre propre application livery.' },
  install: { label: 'dépendances rebar.config', note: 'Dans l’umbrella : `rebar3 as server compile`, ou `rebar3 as server,prod release -n barrel_server`.' },
  reachedThrough: ['REST sur HTTP/1.1, HTTP/2 ou HTTP/3', 'MCP (Streamable HTTP) sur `/mcp`', 'le protocole `_sync`'],
  config: [
    { title: 'Environnement de l’application (barrel_server)', rows: [
      { meaning: 'Un seul écouteur HTTP/1.1 en clair quand `listeners` n’est pas défini' },
      { def: 'le data_dir de docdb', meaning: 'Copié dans le `data_dir` de barrel_docdb au démarrage' },
      { def: 'aucun', meaning: '`#{http, https, http3}`' },
      { def: 'aucun', meaning: '`certfile`, `keyfile`, `cacertfile`, `verify`' },
      { def: 'aucune (ouvert)', meaning: '`#{tokens => [Bin]}`, ou `accept => [bearer, signed, mtls]` avec `signers`' },
      { meaning: 'Taille maximale du corps de requête' },
      { def: 'aucun', meaning: '`#{origins, expose, max_age}`' },
      { def: 'activé', meaning: '`enabled`, `allowed_origins`, `resources`' },
      { def: 'aucune', meaning: 'Options d’ouverture par défaut de chaque base (BM25, embedder)' },
    ] },
  ],
  api: [
    { title: 'Bases et documents (REST)', rows: [
      { task: 'Créer, supprimer une base' },
      { task: 'Écrire, lire, supprimer', returns: '201 `{"id","ok","rev"}` ; 409 sur un `_rev` périmé' },
      { task: 'En masse' },
      { task: 'Chercher' },
      { task: 'BQL', returns: 'lignes NDJSON puis meta ; SSE pour SUBSCRIBE' },
      { task: 'Changements', returns: 'JSON, SSE, ou `feed=continuous`' },
      { task: 'Pièces jointes', returns: '201 avec les infos, octets bruts' },
      { task: 'Historique', returns: 'versions avec leur provenance' },
    ] },
    { title: 'Recherche, timeline, agents (REST)', rows: [
      { task: 'Recherche' },
      { task: 'Branche, fusion', returns: '201, 200 avec un rapport' },
      { task: 'Espaces, autorisations' },
      { task: 'Passations', returns: 'documents de passation' },
      { task: 'Contextes', returns: 'lignes, sources, résumé' },
    ] },
    { title: 'MCP et intégration', rows: [
      { task: 'Outils pour agents', returns: '39 outils : db, doc, query, search, branch, space, session, handoff, context' },
      { task: 'Monter dans votre application', returns: 'routes, avec `groups` et `prefix`' },
    ] },
  ],
  examples: [
    { title: 'Le démarrer', intro: 'Un `sys.config` minimal. Démarrez avec `application:ensure_all_started(barrel_server)`.' },
    { title: 'Écrire et interroger en REST', intro: 'D’après une exécution en direct sur un serveur ouvert (sans authentification). Deux autres notes ont été écrites entre les appels montrés, et l’exécution a envoyé la requête en JSON (`{"query": ...}`) ; la route accepte aussi du BQL brut en texte.', outputLabel: 'Réponses d’une exécution sur barrel_server 1.13.0 (abrégées)' },
  ],
  limits: [
    'Les erreurs de configuration de la recherche (`bm25_not_enabled`, `embedder_not_configured`, `dimension_mismatch`) répondent 500, pas 4xx.',
    'Une base par défaut s’ouvre avec un magasin de vecteurs en 768 dimensions et BM25 désactivé ; définissez `open_opts` pour BM25 et la recherche hybride.',
    '`POST /find` renvoie une continuation mais la refuse en retour ; paginez avec `offset`.',
    'Un curseur `?since` invalide sur `/changes` repart sans bruit du premier changement.',
    'MCP n’accepte que les tokens bearer, ni requêtes signées ni mTLS. HTTP/3 ne vérifie pas encore les certificats client.',
    'Le mTLS authentifie l’autorité de certification, pas chaque pair, et ne s’applique qu’aux requêtes sans en-tête `Authorization`.',
    'Aucun réglage ne permet de désactiver l’écouteur HTTP.',
  ],
  gaps: [
    'Les magasins de vecteurs sont créés sous `./priv/` du répertoire de travail du serveur, même avec `data_dir` défini. Sauvegardez les deux.',
  ],
  guides: [
    { label: 'Lancer le serveur' },
    { label: 'Point d’accès MCP' },
    { label: 'Authentification' },
    { label: 'Intégrer le serveur dans une application' },
    { label: 'Référence de l’API REST' },
    { label: 'Référence des outils MCP' },
  ],
});
