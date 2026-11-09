// translation_of: src/data/components/docdb.ts source_hash: 0e1a871d06732f6e
// French text for the barrel_docdb library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { docdb as en } from '../../components/docdb';

export const docdb = overlay(en, {
  lead: 'Une base de documents intégrée, sur RocksDB. Les écritures sont versionnées par horloges logiques hybrides et vecteurs de version, chaque chemin est indexé pour les requêtes, et les bases se répliquent en active-active.',
  problem: 'Les copies d’une même donnée sur plusieurs nœuds, appareils ou agents reçoivent des écritures pendant qu’elles sont séparées. barrel_docdb garde chaque version concurrente comme un conflit au lieu d’en perdre une, vous laisse le résoudre, et vous donne sur le même stockage des requêtes, un flux de changements, des pièces jointes, un historique conservé avec sa provenance, un TTL et des branches.',
  useWhen: [
    'Vous avez besoin de documents synchronisés entre nœuds ou sites, avec des conflits conservés et résolubles.',
    'Vous avez besoin de requêtes sur n’importe quel champ sans déclarer d’index, avec `find/2` ou BQL.',
    'Vous avez besoin d’une piste d’audit : qui a écrit chaque version, et le contenu des versions passées.',
  ],
  notWhen: [
    'Il vous faut aussi des vecteurs ou de la recherche sémantique : utilisez [barrel](/product/barrel), qui associe cette bibliothèque à un magasin de vecteurs.',
    'Il vous faut des agrégats, GROUP BY ou des jointures : BQL n’en a pas.',
  ],
  optional: [{ text: 'stocke les octets des pièces jointes dans un stockage compatible S3' }],
  standalone: { short: 'Oui', text: 'Oui. La réplication (`barrel_rep`, `barrel_rep_tasks`) et BQL pour les documents sont ici.' },
  install: { label: 'dépendances rebar.config', note: 'La version 2.1.0 a changé la réplication. Une mise à jour depuis la 2.0 peut demander `barrel_rep:reconcile/3`.' },
  reachedThrough: ['API Erlang', 'façade barrel', 'REST `/db/:db/*` et le protocole `_sync` (barrel_server)'],
  config: [
    { title: 'Options de create_db/2', rows: [
      { def: 'data_dir de l’environnement', meaning: 'Emplacement des fichiers de la base' },
      { def: 'magasin de blobs RocksDB', meaning: '`#{backend => none}` le désactive, `s3` utilise barrel_att_s3' },
      { def: 'désactivé', meaning: '`default` ou `#{provider => Mod}`' },
      { def: 'aucun', meaning: '`#{Name => [Pattern]}`, fixé à la création' },
      { def: '2592000 s (30 jours)', meaning: 'Historique conservé ; 0 désactive le nettoyage' },
      { def: '0 (désactivé)', meaning: 'Nettoyage en arrière-plan des documents expirés' },
      { meaning: 'Conflits conservés par document' },
      { def: 'aucun', meaning: 'Résolution automatique à la réplication' },
    ] },
    { title: 'Environnement de l’application (barrel_docdb)', rows: [
      { meaning: 'Relatif au répertoire courant' },
      { meaning: 'Cache de blocs RocksDB' },
      { meaning: 'Délai maximal d’une requête' },
    ] },
  ],
  api: [
    { title: 'Bases', rows: [
      { task: 'Créer, ouvrir' },
      { task: 'Fermer, supprimer' },
      { task: 'Décrire, lister', returns: 'table d’infos, noms' },
    ] },
    { title: 'Documents', rows: [
      { task: 'Écrire', returns: '`{ok, #{id, rev, ok}}` ; `{error, conflict}` sans le `_rev` courant' },
      { task: 'Lire', returns: '`{ok, Doc}` ou `{error, not_found}`' },
      { task: 'Supprimer' },
      { task: 'Conflits' },
    ] },
    { title: 'Requêtes et changements', rows: [
      { task: 'Requête structurée' },
      { task: 'BQL (documents seuls)' },
      { task: 'Flux de changements', returns: '`{ok, Changes, Last}`, un pid de flux' },
      { task: 'Abonnement à un chemin', returns: 'des messages `{barrel_change, Db, Change}`' },
    ] },
    { title: 'Fichiers, historique, timeline, synchronisation', rows: [
      { task: 'Pièces jointes' },
      { task: 'Versions', returns: '`{ok, [Version]}` avec la provenance' },
      { task: 'Branche, fusion' },
      { task: 'Répliquer une fois' },
      { task: 'Tâche continue' },
    ] },
  ],
  examples: [
    { title: 'Écrire, chercher et interroger', intro: 'D’après une exécution vérifiée sur un répertoire de données vierge.', label: 'Shell Erlang', outputLabel: 'Sortie d’une exécution sur barrel_docdb 2.1.0 (abrégée)' },
    { title: 'Résoudre un conflit après une réplication dans les deux sens', intro: 'Deux bases locales ont modifié le même document, puis se sont répliquées dans les deux sens. La résolution nomme les versions qu’elle a observées.', label: 'Shell Erlang', outputLabel: 'Sortie de la même exécution' },
  ],
  limits: [
    'La lignée est linéaire : une branche d’une branche est refusée, et une branche à un instant antérieur au plancher de l’historique échoue avec `pitr_window_exceeded`.',
    'La réplication ne transporte ni les vecteurs ni la provenance. Les canaux ne suppriment pas des réplicas les documents qui en sont sortis.',
    'Les tâches de réplication refusent les identifiants passés en ligne. Les points de reprise des pièces jointes attendent que la cible soit durable, sauf si vous fixez `att_durability => best_effort`.',
    'Les réglages d’exécution (`encryption`, `read_only`, `channels`, `conflict_resolver`, rétention) doivent être repassés à chaque réouverture.',
    'Le `data_dir` de l’environnement est relatif au répertoire courant. La documentation de `create_db/2` indique encore `/tmp/barrel_data`.',
  ],
  gaps: [
    'Dans `find/2`, `order_by` sur un chemin est ignoré si ce chemin n’est pas sélectionné ou lié à une variable.',
    'Une requête BQL découpée en morceaux avec un prédicat d’intervalle a perdu une ligne à la continuation, une fois pendant les tests ; le cas n’est pas encore réduit.',
  ],
  guides: [
    { label: 'Synchronisation' },
    { label: 'Conflits' },
    { label: 'Mettre à jour depuis la 2.0' },
    { label: 'Interroger avec BQL' },
    { label: 'Pièces jointes' },
    { label: 'Audit et provenance' },
  ],
});
