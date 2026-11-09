// translation_of: src/data/components/barrel.ts source_hash: 7fb456c04536f8ea
// French text for the barrel library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { barrel as en } from '../../components/barrel';

export const barrel = overlay(en, {
  lead: 'La base de données intégrable. Une base `barrel` est à la fois une base de documents et un magasin de vecteurs, sous un même nom et un même espace d’identifiants : un document, ses pièces jointes et son vecteur partagent un identifiant.',
  problem: 'Les agents et les fonctions de recherche ont besoin de documents, de fichiers et de vecteurs qui restent ensemble. Faire cohabiter une base de documents et un index vectoriel, c’est deux identifiants, deux cycles de vie et des écritures qui divergent. barrel les assemble, et ajoute le mode enregistrement (des embeddings tenus à jour avec les documents), BQL avec des fonctions de table de recherche et des requêtes en direct, la timeline (branche, récupération, fusion), les contextes et l’export.',
  useWhen: [
    'Vous écrivez une application Erlang ou Elixir et voulez documents, pièces jointes et recherche vectorielle dans le même processus.',
    'Vous voulez des embeddings calculés à partir des champs des documents et tenus à jour à chaque écriture (mode enregistrement).',
    'Vous voulez créer une branche d’une base pour une exécution d’agent, relire le résultat, puis la fusionner.',
  ],
  notWhen: [
    'Vous avez besoin de clients sur le réseau : lancez [barrel_server](/product/server) par-dessus.',
    'Vous n’avez besoin que de documents et de synchronisation, sans vecteurs : [barrel_docdb](/product/docdb) suffit.',
    'Vous avez besoin de la réplication par cette façade : elle n’y est pas encore exposée ; appelez `barrel_rep` avec le nom de la base docdb.',
  ],
  external: 'hackney (client des contextes distants) ; OTP 26 ou plus récent',
  standalone: { short: 'Oui', text: 'Oui, comme bibliothèque. Elle ne sert aucun protocole réseau par elle-même.' },
  install: { label: 'dépendances rebar.config', note: 'Le mode enregistrement demande que l’application `barrel` soit démarrée ; sinon l’ouverture avec une politique renvoie `{error, barrel_app_not_started}`.' },
  reachedThrough: ['API Erlang', 'REST et MCP via barrel_server'],
  config: [
    { title: 'Options de barrel:open/2', rows: [
      { meaning: 'Options transmises à `barrel_docdb:create_db/2`' },
      { def: 'un magasin de vecteurs', meaning: 'Table de configuration du magasin, ou `none` pour des documents seuls' },
      { meaning: 'À côté des documents. Un magasin créé avant la 1.13.0 dans `./priv/barrel_vectordb_<name>` y reste.' },
      { meaning: 'Table de politique du mode enregistrement, ou `stored` pour réutiliser celle enregistrée' },
      { def: 'désactivé', meaning: '`default` ou `#{provider => Mod}`' },
      { meaning: 'Les écritures renvoient `{error, read_only}`' },
      { meaning: 'Par défaut, le magasin de vecteurs est lié à l’appelant' },
    ] },
    { title: 'Politique du mode enregistrement', rows: [
      { def: 'tous', meaning: 'Chemins dont le texte est transformé en embedding' },
      { meaning: '`sync` calcule l’embedding avant que l’écriture ne rende la main' },
      { meaning: 'Taille du vecteur' },
      { meaning: 'Une configuration de fournisseur barrel_embed' },
      { def: 'le document sans l’id ni les clés _', meaning: 'Champs copiés dans les métadonnées du vecteur' },
    ] },
    { title: 'Environnement de l’application (barrel)', rows: [
      { meaning: '`barrel_dbs` ferme les bases inactives ; 0 désactive' },
      { meaning: 'Nombre maximal de bases ouvertes ; 0 pour illimité' },
      { meaning: 'Contextes par requête fédérée' },
      { meaning: 'Délai d’une requête de contexte (60000 au plus)' },
    ] },
  ],
  api: [
    { title: 'Ouvrir et gérer', rows: [
      { task: 'Ouvrir ou créer' },
      { task: 'Fermer, supprimer' },
      { task: 'Décrire', returns: 'les infos docdb, plus embedding, dimensions, embedder' },
      { task: 'Cycle de vie géré' },
    ] },
    { title: 'Documents et fichiers', rows: [
      { task: 'Écrire' },
      { task: 'Lire' },
      { task: 'Supprimer' },
      { task: 'Chercher' },
      { task: 'Joindre un fichier' },
    ] },
    { title: 'Recherche et requêtes', rows: [
      { task: 'Ajouter un vecteur' },
      { task: 'Recherche sémantique' },
      { task: 'Mots-clés, hybride' },
      { task: 'BQL' },
      { task: 'Requête en direct', returns: '`{ok, #{pid, ref}}`, puis des messages `bql_rows`, `bql_ready`, `bql_change`' },
    ] },
    { title: 'Timeline et historique', rows: [
      { task: 'Créer une branche' },
      { task: 'Fusionner' },
      { task: 'Changements', returns: 'liste des changements, ou un pid de flux' },
      { task: 'Versions' },
    ] },
  ],
  examples: [
    { title: 'Documents, vecteurs, BM25 et BQL dans une même base', intro: 'D’après une exécution vérifiée. `kb_embed` est un fournisseur de démonstration en 64 dimensions écrit pour l’exécution (hachage de caractéristiques : il rapproche les mots communs, il n’est pas sémantique). N’importe quel fournisseur [barrel_embed](/product/embed) peut le remplacer.', label: 'Shell Erlang', outputLabel: 'Sortie d’une exécution sur barrel 1.12.0 (abrégée)' },
  ],
  limits: [
    'Un magasin de vecteurs créé avant barrel 1.13.0 sans `db_path` reste dans `./priv/barrel_vectordb_<name>` sous le répertoire courant, avec une notice dans le journal. Une sauvegarde du seul `data_dir` le manque ; les nouveaux magasins vont dans `<data_dir>/<name>.vectordb`.',
    'Le magasin de vecteurs est lié au processus qui l’a ouvert. Utilisez `barrel_dbs` ou `store_supervised => true` pour des propriétaires de longue durée.',
    'En mode simple, `put_doc` et `vector_add` sont deux écritures séparées. Le mode enregistrement est la voie atomique.',
    'Changer la politique du mode enregistrement à la réouverture écrit un avertissement dans les logs et ne réindexe pas les documents existants.',
    'Les branches simples n’emportent pas de vecteurs. Une branche d’une branche est refusée (`cannot_branch_a_branch`).',
    'L’export demande un magasin de vecteurs (sinon `{error, no_vector_store}`) et ferme la base pendant la copie.',
    'Les requêtes de contexte demandent `LIMIT` ; OFFSET, UNNEST, SUBSCRIBE et la continuation sont refusés.',
  ],
  gaps: [
    'Dans `find/2`, `order_by` sur un chemin est ignoré si le chemin n’est pas sélectionné ou lié à une variable. `ORDER BY` en BQL trie correctement.',
  ],
  guides: [
    { label: 'Intégrer barrel dans une application Erlang' },
    { label: 'Le mode enregistrement' },
    { label: 'Interroger avec BQL' },
    { label: 'Branche, fusion, récupération' },
    { label: 'Interroger plusieurs jeux de données' },
    { label: 'Référence de l’API Barrel' },
  ],
});
