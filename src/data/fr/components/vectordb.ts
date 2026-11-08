// translation_of: src/data/components/vectordb.ts source_hash: 215b20c9c2e41aee
// French text for the barrel_vectordb library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { vectordb as en } from '../../components/vectordb';

export const vectordb = overlay(en, {
  lead: 'Un magasin de vecteurs intégré. Les vecteurs, leur texte et leurs métadonnées sont dans RocksDB, avec un index de plus proches voisins approché, BM25 en option et une fusion hybride.',
  problem: 'La recherche pour les agents demande des plus proches voisins, une recherche par mots-clés pour les termes exacts et un moyen de combiner les deux, sans faire tourner un service de recherche à part. barrel_vectordb vous donne HNSW (en Erlang pur, par défaut), DiskANN ou FAISS, BM25 en mémoire ou sur disque, une fusion RRF ou linéaire, la quantification, le chiffrement et un index persistant.',
  useWhen: [
    'Vous avez besoin de recherche vectorielle ou par mots-clés sans documents autour, par exemple pour la mémoire d’un agent.',
    'Vous fournissez vos propres vecteurs, ou voulez que le texte soit transformé en embedding par un fournisseur [barrel_embed](/product/embed).',
    'Vous voulez une recherche hybride aux poids réglables.',
  ],
  notWhen: [
    'Vos vecteurs appartiennent à des documents : utilisez [barrel](/product/barrel), qui garde les deux sous un même identifiant.',
    'Il vous faut des correspondances exactes par sous-chaîne ou expression régulière : utilisez [barrel_ngram](/product/ngram).',
  ],
  external: 'rocksdb, hackney, iommap ; un NIF en C compilé avec CMake ; OTP 26 ou plus récent',
  optional: [
    {},
    { text: 'reclasse les résultats' },
  ],
  standalone: { short: 'Oui', text: 'Oui. barrel_embed est toujours inclus, même si vous fournissez tous les vecteurs.' },
  install: { label: 'dépendances rebar.config' },
  reachedThrough: ['API Erlang', 'façade barrel (`vector_*`, `search*`, fonctions de table BQL)', 'REST `/db/:db/search/*`, MCP `search`'],
  config: [
    { title: 'Configuration du magasin', rows: [
      { def: 'obligatoire', meaning: 'Nom du magasin, utilisé par chaque appel' },
      { meaning: 'Relatif au répertoire courant. Fixez-le.' },
      { meaning: 'Taille des vecteurs ; une différence renvoie `{dimension_mismatch, _, _}`' },
      { def: 'aucun', meaning: 'Sans embedder, les appels sur du texte renvoient `embedder_not_configured`' },
      { meaning: '`hnsw`, `diskann` ou `faiss`' },
      { meaning: 'Degré du graphe et effort de construction' },
      { meaning: '`turboquant`, `subspace_turboquant` ou `none`' },
      { def: 'aucun', meaning: '`memory` ou `disk` pour activer la recherche par mots-clés' },
      { meaning: 'Les écritures renvoient `{error, read_only}`' },
    ] },
    { title: 'Options de recherche', rows: [
      { def: '5 en vectoriel, 10 en BM25 et hybride', meaning: 'Nombre de résultats' },
      { def: 'aucun', meaning: '`fun(Metadata) -> boolean()`, appliqué après la recherche' },
      { meaning: '`linear` utilise `bm25_weight` et `vector_weight` (0,5 chacun)' },
      { meaning: 'Effort de recherche' },
    ] },
  ],
  api: [
    { title: 'Cycle de vie', rows: [
      { task: 'Démarrer un magasin' },
      { task: 'Arrêter, supprimer' },
      { task: 'Persister l’index' },
    ] },
    { title: 'Écrire et lire', rows: [
      { task: 'Ajouter du texte (embedding calculé)' },
      { task: 'Ajouter avec un vecteur' },
      { task: 'Remplacer le texte', returns: '`ok` ; recalcule l’embedding du texte' },
      { task: 'Supprimer' },
      { task: 'Lire', returns: '`{ok, #{key, text, metadata, vector}}` ou `not_found`' },
    ] },
    { title: 'Recherche', rows: [
      { task: 'Par texte' },
      { task: 'Par vecteur', returns: 'même forme' },
      { task: 'Par mots-clés' },
      { task: 'Hybride' },
    ] },
  ],
  examples: [
    { title: 'Une petite mémoire d’agent avec vos propres vecteurs', intro: 'D’après une exécution vérifiée. Aucun embedder n’est configuré, donc la recherche par texte le signale.', label: 'Shell Erlang', outputLabel: 'Sortie d’une exécution sur barrel_vectordb 2.5.1' },
  ],
  limits: [
    'Le filtre sur les métadonnées s’applique après la recherche : un filtre très sélectif peut renvoyer moins de `k` résultats (une recherche avec `k => 2` en a renvoyé 1).',
    'BM25 est désactivé tant que `bm25_backend` n’est pas fixé. Un index BM25 en mémoire se reconstruit à partir du texte stocké à chaque ouverture.',
    'Il n’y a pas de mise à jour avec un vecteur explicite : `update/4` et `upsert/4` recalculent l’embedding du texte.',
    'Ouvrir en lecture seule un magasin qui demande une mise à niveau échoue avec `read_only_upgrade_needed`.',
    'Les clés d’environnement de `barrel_vectordb.app.src` (`default_dimensions`, `hnsw_m`...) ne sont jamais lues ; les valeurs par défaut viennent du code.',
  ],
  gaps: [
    '`update/4` supprime l’entrée avant de calculer l’embedding. Si le calcul échoue (pas d’embedder, fournisseur indisponible), l’appel renvoie une erreur et l’entrée a disparu. `upsert/4` a le même comportement.',
    'Sans chemin fixé, le magasin se retrouve dans `./priv/` sous le répertoire courant.',
  ],
  guides: [
    { label: 'Vectorielle, par mots-clés et hybride' },
    { label: 'Choisir un fournisseur d’embeddings' },
    { label: 'Reclassement' },
  ],
});
