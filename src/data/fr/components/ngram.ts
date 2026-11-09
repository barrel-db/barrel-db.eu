// translation_of: src/data/components/ngram.ts source_hash: 5a84ba918f8ae7e2
// French text for the barrel_ngram library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { ngram as en } from '../../components/ngram';

export const ngram = overlay(en, {
  lead: 'Un index exact de sous-chaînes et d’expressions régulières sur une base barrel_docdb. Chaque candidat est vérifié sur le texte réel : un résultat est une vraie correspondance.',
  problem: 'La recherche sémantique rate les identifiants, les messages d’erreur, les clés de configuration et les symboles de code. barrel_ngram tient un index de trigrammes au niveau de l’octet, fait de segments immuables avec somme de contrôle et tenu à jour par le flux de changements, et répond aux requêtes littérales et aux expressions régulières PCRE avec la position de chaque correspondance.',
  useWhen: [
    'Des agents cherchent dans du code, des logs ou des runbooks des noms exacts comme `ERR_CONN_TIMEOUT` ou `pg-replica-02`.',
    'Vous avez besoin de recherche par expression régulière dans des documents, avec la position en octets de chaque correspondance.',
  ],
  notWhen: [
    'Vous cherchez par le sens : utilisez la recherche vectorielle ou hybride de [barrel_vectordb](/product/vectordb).',
    'L’espace disque est compté : l’index pèse environ 34 fois la taille du texte.',
  ],
  external: 'un NIF en C (CRoaring embarqué) compilé avec CMake sous Linux, macOS et Windows',
  standalone: { short: 'Oui, avec docdb', text: 'Oui, à côté d’une base barrel_docdb. La façade barrel et BQL ne l’exposent pas.' },
  install: { label: 'dépendances rebar.config' },
  reachedThrough: ['API Erlang', 'outil MCP `ngram_search` (barrel_server)'],
  config: [
    { title: 'Options de open/2', rows: [
      { def: 'obligatoire', meaning: 'La base barrel_docdb à indexer' },
      { def: 'tous', meaning: 'Champs à indexer ; fixés pour le corpus' },
      { meaning: 'Jusqu’à 4096 ; fixé pour le corpus' },
      { meaning: '`roaring` est l’autre encodage ; fixé' },
      { meaning: 'Documents mis en tampon avant l’écriture d’un segment' },
      { meaning: 'Segments avant compaction, ou `infinity`' },
      { meaning: '`layout` ne vérifie que la structure' },
      { meaning: '`reindex` reconstruit un index 0.10 ou plus ancien' },
    ] },
    { title: 'Environnement de l’application (barrel_ngram)', rows: [
      { meaning: 'Relatif au répertoire courant' },
    ] },
  ],
  api: [
    { title: 'Corpus', rows: [
      { task: 'Créer ou rattacher', returns: '`ok`, ou `{error, {config_mismatch, Field, Old, New}}`' },
      { task: 'Rattraper le flux' },
      { task: 'Compacter', returns: '`{ok, #{segments, doc_count}}` ou `{error, busy}`' },
      { task: 'Fermer, supprimer' },
    ] },
    { title: 'Recherche', rows: [
      { task: 'Sous-chaîne littérale' },
      { task: 'Expression régulière', returns: 'même forme, ou `{error, {bad_regex, _}}`' },
      { task: 'Ignorer la casse', returns: 'sensible à la casse par défaut' },
    ] },
  ],
  examples: [
    { title: 'Trouver des identifiants dans des runbooks', intro: 'D’après une exécution vérifiée. Les positions sont des décalages en octets dans les champs indexés, concaténés dans l’ordre trié des champs (`body` avant `title`).', label: 'Shell Erlang', outputLabel: 'Sortie d’une exécution sur barrel_ngram 0.11.4' },
  ],
  limits: [
    'L’index pèse environ 34 fois la taille du texte.',
    '`db`, `fields`, `shards` et `postings` sont fixés pour le corpus. Les changer demande `delete_corpus` et une reconstruction.',
    '`index/1` est le point de rattrapage synchrone. Entre deux appels, les nouvelles écritures arrivent dans l’index par le flux en arrière-plan.',
    'Le sharding et les postings roaring existent et sont testés, mais ne faisaient pas partie de l’exécution vérifiée.',
  ],
  guides: [
    { label: 'Sous-chaîne et expression régulière' },
    { label: 'Indexer une base de code' },
  ],
});
