// translation_of: src/data/components/spaces.ts source_hash: 4cef2870966f59bd
// French text for the barrel_spaces library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { spaces as en } from '../../components/spaces';

export const spaces = overlay(en, {
  lead: 'Donnez à chaque agent, équipe ou tâche sa propre base de données, et partagez-la en remettant un jeton. Les sessions gardent pour un temps la mémoire de travail d’un agent ; une passation transmet une tâche, et les droits pour la terminer, à un autre agent.',
  problem: 'Plusieurs agents qui travaillent sur des données communes ont besoin de bases séparées, d’un moyen de donner à un agent l’accès en lecture et à un autre l’accès en écriture, d’une mémoire de travail de courte durée, et d’une façon propre de transmettre un travail inachevé. barrel_spaces ajoute ces pièces au-dessus des bases barrel.',
  useWhen: [
    'Plusieurs agents travaillent sur les mêmes données et chacun ne doit lire ou écrire que ce qu’on lui a donné.',
    'Un agent a besoin d’un journal de conversation, de données de travail et de notes épinglées qui expirent d’elles-mêmes.',
    'Un agent commence une tâche et un autre la termine, avec ce qui a été fait et ce qui reste à faire.',
  ],
  notWhen: [
    'Vous n’avez besoin que d’une base pour une application : utilisez directement [barrel](/product/barrel). Les espaces ajoutent par-dessus la couche de partage et de sessions.',
    'Vous avez besoin d’isoler des processus Erlang sur le même nœud : les jetons ne le permettent pas (voir les limites) ; utilisez le chiffrement par espace.',
  ],
  external: 'aucune en dehors des bibliothèques Barrel',
  standalone: { short: 'Non', text: 'Non. Un espace est une base barrel, donc barrel et barrel_docdb viennent avec.' },
  install: { label: 'dépendances rebar.config' },
  reachedThrough: ['API Erlang', 'REST `/spaces` et `/handoffs` (barrel_server)', 'Outils MCP `space_*`, `session_*`, `handoff_*`'],
  config: [
    { title: 'Options de create_space/1', rows: [
      { def: 'aucun', meaning: 'Enregistrés dans le document du registre' },
      { meaning: 'TTL par défaut des sessions de cet espace' },
      { meaning: 'Fréquence de purge des sessions expirées' },
      { def: 'un magasin de vecteurs', meaning: '`none` pour des documents seuls, ou une table de configuration du magasin' },
      { def: 'désactivé', meaning: '`default` ou `#{provider => Mod}` ; la frontière d’isolation dans le processus' },
      { def: 'aucune', meaning: 'Politique du mode enregistrement pour la base de l’espace' },
    ] },
    { title: 'Environnement de l’application (barrel_spaces)', rows: [
      { meaning: 'Base qui contient les espaces, les autorisations et les passations' },
      { meaning: 'Intervalle de nettoyage du registre' },
      { def: 'aucun', meaning: 'Embedder utilisé pour rouvrir les espaces en mode enregistrement' },
    ] },
  ],
  api: [
    { title: 'Espaces', rows: [
      { task: 'Créer un espace' },
      { task: 'Ouvrir, fermer', returns: '`{ok, Space}`, ou `space_dropped`, `not_found`, `db_is_encrypted`' },
      { task: 'Supprimer (révoque toutes les autorisations)' },
      { task: 'Lister, décrire', returns: 'documents du registre' },
    ] },
    { title: 'Jetons de capacité', rows: [
      { task: 'Émettre un jeton', returns: '`{ok, Token, Grant}` ; le jeton n’est montré qu’une fois' },
      { task: 'Vérifier un droit', returns: '`{ok, Grant}` ou `invalid_token`, `revoked`, `expired`, `wrong_space`, `forbidden`' },
      { task: 'Révoquer' },
      { task: 'Qui le détient' },
    ] },
    { title: 'Sessions', rows: [
      { task: 'Démarrer une session' },
      { task: 'La garder active' },
      { task: 'Enregistrer un message' },
      { task: 'Lire les messages', returns: '`{ok, [Msg]}` ; options `limit`, `order`, `since`, `before`' },
      { task: 'Données de travail, épingles' },
    ] },
    { title: 'Passations', rows: [
      { task: 'Transmettre une tâche' },
      { task: 'L’accepter' },
      { task: 'La terminer', returns: '`{ok, Handoff}` ; révoque le jeton par défaut' },
      { task: 'La transmettre à nouveau', returns: 'une nouvelle passation, au lieu de terminer' },
      { task: 'Trouver des passations', returns: 'documents de passation' },
    ] },
  ],
  flow: {
    title: 'Comment une passation traverse un espace',
    intro: 'Alice travaille dans un espace, transmet la tâche à Bob, et Bob la termine. Carol ne détient qu’un jeton de lecture. C’est l’exécution vérifiée ci-dessous, étape par étape.',
    steps: [
      { title: 'Créer un espace', body: 'Une nouvelle base barrel, enregistrée sous un identifiant.' },
      { title: 'Accorder un jeton', body: 'Carol reçoit des droits de lecture sur cet espace seulement.' },
      { title: 'Transmettre', body: 'Alice transmet la tâche, sa session et ce qui reste à faire.' },
      { title: 'Accepter, puis terminer', body: 'Bob lit les notes et les messages d’Alice, termine, et le jeton est révoqué.' },
    ],
  },
  table: {
    caption: 'Résultats de `barrel_caps:verify/3`. Les cases marquées d’un astérisque n’ont pas été appelées pendant l’exécution ; elles découlent de l’échelle des droits read < write < admin dans `barrel_caps.erl`. Le jeton de passation est révoqué dès que Bob termine la tâche.',
    head: ['Qui', 'read', 'write', 'admin'],
    rows: [
      ['Carol', 'ok', 'forbidden', 'forbidden*'],
      ['Jeton de passation', 'ok*', 'ok', 'forbidden'],
      ['Tout jeton, autre espace', 'wrong_space', 'wrong_space*', 'wrong_space*'],
    ],
  },
  examples: [
    { title: 'Le déroulé, en code', intro: 'À lancer avec l’application `barrel_spaces` démarrée et le `data_dir` de `barrel_docdb` défini.', label: 'spaces_demo.erl (abrégé)', outputLabel: 'Sortie d’une exécution sur barrel_spaces 1.3.1 (lignes des appels montrés)' },
  ],
  tabs: {
    title: 'Les mêmes étapes en REST et en MCP',
    intro: 'Appels seulement, sur un serveur ouvert. Les appels de création et d’autorisation ont été exécutés en direct avec ces réponses ; les appels de passation sont écrits d’après les gestionnaires de routes et les schémas d’outils enregistrés.',
  },
  limits: [
    'Les jetons sont vérifiés par le serveur, en REST et en MCP. Dans votre propre nœud Erlang, `open_space/1` et tous les appels `barrel_session` ne prennent aucun jeton : n’importe quel code peut ouvrir n’importe quel espace (vérifié). Utilisez le chiffrement par espace si des processus ne doivent pas lire les données les uns des autres.',
    'Accepter, terminer ou retransmettre une passation ne vérifie que le droit de lecture de son jeton.',
    'Le magasin de vecteurs d’un espace vit sur un seul nœud, dans `<data_dir>/<id>_vec`, et n’est pas répliqué.',
    'Les espaces chiffrés ne s’ouvrent que par l’API Erlang, pas en REST ni en MCP.',
    '`chain/2` et `complete/2` s’excluent : après `complete`, le jeton est révoqué et `chain` échoue.',
  ],
  guides: [
    { label: 'Guide : espaces, sessions, passations' },
    { label: 'Concepts : espaces et capacités' },
    { label: 'Point d’accès MCP' },
  ],
});
