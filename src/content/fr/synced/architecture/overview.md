---
translation_of: src/content/synced/architecture/overview.md
source_hash: "afdc565b1207a403"
title: "Vue d’ensemble de l’architecture"
description: "Cette note décrit le découpage actuel de l’umbrella Barrel et la direction qu’il prend. Lisez-la quand vous devez savoir quelle application porte une responsabilité, ou avant d’ajouter une nouvelle application à l’umbrella."
source: "docs/architecture/overview.md"
---

Cette note décrit le découpage actuel de l’umbrella Barrel et la direction
qu’il prend. Lisez-la quand vous devez savoir quelle application porte une
responsabilité, ou avant d’ajouter une nouvelle application à l’umbrella.

## Applications actuelles

Barrel est une umbrella rebar3. Chaque application est une application OTP
distincte, avec une responsabilité claire et sa propre API publique.

- **barrel_docdb** : la couche documents. Métadonnées des documents, MVCC, le
  flux de changements, les primitives de réplication, les pièces jointes, la
  timeline (branche, PITR, fusion) et la fondation catalogue/indexation.
  Utilisable seule comme base de documents embarquée.
- **barrel_vectordb** : la couche vecteurs. La base vectorielle embarquée, les
  index ANN locaux (HNSW, FAISS, DiskANN), BM25, et la recherche hybride
  locale qui les combine. Utilisable seule comme base vectorielle embarquée.
- **barrel_embed** : génération d’embeddings auprès de plusieurs fournisseurs
  (Python local, Ollama, OpenAI et d’autres). `barrel_vectordb` l’utilise pour
  la recherche textuelle et hybride.
- **barrel_rerank** : reranking par cross-encoder. Optionnel, utilisé par
  `barrel_vectordb`.
- **barrel_faiss** : bindings NIF Erlang pour FAISS. Backend optionnel de
  `barrel_vectordb`. Il demande la bibliothèque C++ FAISS, il est donc exclu
  du build par défaut.
- **barrel_ngram** : index de sous-chaînes et d’expressions régulières par
  trigrammes sur les documents `barrel_docdb`, avec des segments immuables
  dotés de sommes de contrôle. `barrel_server` le sert sous la forme de
  l’outil MCP `ngram_search`.
- **barrel_crypto** : primitives de chiffrement au repos. Enveloppe
  AES-256-GCM, CTR adressable par offset, dérivation de clés HKDF et
  fournisseurs de clés enfichables. Utilisé par docdb et vectordb pour les
  bases chiffrées.
- **barrel** : la base de données embarquable. Compose `barrel_docdb`,
  `barrel_vectordb` et `barrel_crypto` pour qu’un document, ses pièces jointes
  (blobs) et son vecteur partagent un même identifiant. Ajoute le mode
  enregistrement, BQL, le gestionnaire de cycle de vie des bases
  (`barrel_dbs`) et les contextes (`barrel_ctx*` : le catalogue de contextes,
  les requêtes fédérées, les ensembles de travail, l’export et l’import en
  lecture seule). La timeline elle-même vit dans `barrel_docdb` ; `barrel`
  l’expose sur la base composée. Ne sert aucun protocole réseau ; son client
  de contextes distants appelle d’autres nœuds en HTTP. C’est le paquet hex
  « edge ».
- **barrel_spaces** : la couche agents. Les espaces (bases de contexte
  partagées), les jetons de capacité, les sessions avec TTL et les
  passations, construits sur `barrel`.
- **barrel_server** : le serveur réseau. Expose `barrel` et `barrel_spaces`
  en HTTP (REST/JSON) et en MCP avec `livery`, y compris les routes
  `/contexts` et `/worksets` et les outils MCP `context_*`. Activé sur
  demande via le profil `server` ; absent du build embarquable par défaut.
- **barrel_att_s3** : un backend de pièces jointes compatible S3 pour
  `barrel_docdb`. Activé sur demande via le profil `s3`.

## Découpage visé

À plus long terme, la pile sépare ces responsabilités :

- **docdb** (existe) : la source de vérité des métadonnées de documents et du
  catalogue. MVCC, changements, primitives de réplication et stockage des
  pièces jointes (blobs).
- **vectordb** (existe) : segments vectoriels et recherche locale
  vectorielle, textuelle et hybride.
- **barrel** (existe) : compose docdb et vectordb dans un même espace
  d’identifiants.
- **server** (existe, `barrel_server`) : les transports au-dessus de l’API
  `barrel`.
- **stockage objet** : les blobs sont des pièces jointes docdb avec un
  backend enfichable par base (`barrel_att_backend` : RocksDB BlobDB par
  défaut, `none` pour les bases sans pièces jointes, et un stockage
  compatible S3 via `barrel_att_s3`). Il n’y a pas d’application de stockage
  objet séparée ; un document possède son blob, comme les vecteurs et les
  métadonnées se rattachent au même identifiant.
- **couche agents** (existe, `barrel_spaces` + MCP) : espaces, jetons de
  capacité, sessions et passations au-dessus de l’API `barrel` ; exposée par
  `barrel_server`.
- **contextes** (existe, `barrel_ctx*` dans `barrel`, REST et MCP dans
  `barrel_server`) : des jeux de données nommés interrogés ensemble à travers
  les nœuds, avec des ensembles de travail et des copies portables en lecture
  seule. Voir le [guide des contextes](/fr/docs/guides/contexts).
- **fabric** (futur, `barrel_fabric`) : agents de jeux de données, durabilité,
  placement et orchestration de la réplication entre nœuds.

## Règles de frontière

Ces règles gardent l’umbrella maintenable à mesure qu’elle grandit :

- Des frontières d’applications OTP claires. Chaque application possède ses
  modules et son API publique.
- Pas de dépendances circulaires entre applications. Le sens est
  `barrel_server` -> `barrel_spaces` -> `barrel` ->
  {`barrel_docdb`, `barrel_vectordb`}, `barrel_server` -> `barrel_ngram` ->
  `barrel_docdb`, et
  `barrel_vectordb` -> `barrel_embed` (et en option `barrel_faiss`,
  `barrel_rerank`). `barrel_docdb` et `barrel_vectordb` sont des feuilles ;
  `barrel_docdb` -> `barrel_vectordb` est interdit.
- Préférer des modules propres à chaque application à des modules globaux
  partagés. Éviter une application « fourre-tout » commune.
- L’usage local ne demande aucun service externe. S3, la réplication distante
  et les agents fabric ne sont jamais nécessaires pour faire tourner une
  application en local.
- Les backends lourds optionnels (par exemple FAISS) restent activés sur
  demande et hors du build par défaut.

## Périmètre et justification

Cette umbrella contient les bibliothèques de la pile de données Barrel
(`barrel_docdb`, `barrel_vectordb`, `barrel_embed`, `barrel_rerank`,
`barrel_faiss`, `barrel_ngram`, `barrel_crypto`, `barrel_att_s3`), la base
embarquable (`barrel`), la couche agents (`barrel_spaces`) et le serveur
réseau (`barrel_server`). Les produits et les clients construits sur la pile
restent dans leurs propres dépôts.

### Ce que l’umbrella vous apporte

- La coordination des versions : un seul ensemble de dépendances résolu pour
  toutes les applications. Elle a déjà imposé un seul `hackney` (4.4.0) et un
  seul `meck` (1.2.0) là où les dépôts séparés avaient divergé, et fait
  apparaître en une passe le correctif du `catch` préfixe d’OTP 29.
- Des changements atomiques entre applications : `barrel_vectordb` et ses
  backends (`barrel_embed`, `barrel_rerank`, `barrel_faiss`) évoluent
  ensemble. Un changement de l’API vectordb et de ses adaptateurs tient en un
  commit et une exécution de CI, sans courir après les tags d’un dépôt à
  l’autre.
- Une seule surface de build, de test et de release : des profils partagés
  (l’activation de FAISS), une seule PLT, un seul `rel/`.
- Un foyer pour les couches qui traversent la pile : `barrel` (la base
  complète) unifie déjà docdb et vectordb sous un même identifiant, et
  `barrel_fabric` (futur) les étendra à plusieurs nœuds. Une couche qui
  unifie deux applications demande un dépôt qui contient les deux.
  `barrel_docdb` ne partage aucun code avec `barrel_vectordb` : sa place ici
  se justifie par `barrel` et par le travail à venir sur fabric.

### Hors périmètre (séparé volontairement)

- `barrellm` : une couche application/service qui consomme la pile
  (`barrellm` -> `barrel_docdb` + `barrel_embed`). Elle a sa propre surface
  HTTP/MCP, son propre rythme de release et des dépendances épinglées bien
  plus anciennes (par exemple rocksdb 2.5.0, hackney 1.20.1/2.0.1).
  L’intégrer inverserait les couches et ramènerait la pile vers des
  dépendances plus anciennes.
- `barrel_llm` : un répertoire vide, simple emplacement réservé. Rien à importer.

### Si des produits doivent être co-développés plus tard

Gardez-les dans des dépôts séparés qui dépendent de la pile, via des
dépendances par chemin pour le travail local
(`{path, "../barrel/apps/barrel_vectordb"}`) ou via les paquets publiés.
S’ils grandissent, regroupez-les dans leur propre umbrella d’applications
(par exemple `barrel_apps`) qui dépend de celle-ci, plutôt que de mélanger
bibliothèques et produits à plat.

## Organisation du build

- `apps/` contient les applications.
- Le `rebar.config` de premier niveau coordonne le build et agrège les
  dépendances déclarées par chaque application. Il restreint l’ensemble
  d’applications par défaut pour que l’application FAISS soit activée sur
  demande (`rebar3 as faiss compile`), comme le serveur (`rebar3 as server
  compile`) et le backend S3 (`rebar3 as s3 compile`).
- `rel/` contient le squelette de release de l’umbrella.
- `docs/` contient la documentation au niveau de l’umbrella ; la
  documentation propre à chaque application reste dans l’application.
