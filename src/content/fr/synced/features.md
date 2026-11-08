---
translation_of: src/content/synced/features.md
source_hash: "1b216049ea45d556"
title: "Fonctionnalités"
description: "Ce que Barrel fait aujourd’hui et ce qui est prévu, par capacité. Lisez cette page pour savoir quelles fonctionnalités sont utilisables maintenant, lesquelles sont optionnelles et lesquelles restent à venir. Chaque ligne renvoie à un guide quand il existe."
source: "docs/features.md"
---

Ce que Barrel fait aujourd’hui et ce qui est prévu, par capacité. Lisez cette
page pour savoir quelles fonctionnalités sont utilisables maintenant, lesquelles
sont optionnelles et lesquelles restent à venir. Chaque ligne renvoie à un guide
quand il existe.

## Légende des statuts

- **Prêt** : utilisable maintenant, avec des tests.
- **Optionnel** : utilisable maintenant, désactivé par défaut ou derrière un profil de build.
- **Prévu** : pas encore construit.

## Modèle de données

Un enregistrement barrel est un identifiant avec trois faces : un document JSON,
ses pièces jointes (blobs) et son vecteur. Les documents vivent dans
`barrel_docdb`, les vecteurs dans `barrel_vectordb`, les blobs sont des pièces
jointes de documents. L’API `barrel` les compose ; chaque application sous-jacente
reste utilisable seule.

## Capacités

| Capacité | Statut | Notes |
|---|---|---|
| Documents (CRUD, MVCC, requêtes) | Prêt | `barrel_docdb` ; `find/2` sur l’index de chemins. Voir [embedding](/fr/docs/guides/embedding). |
| Lots (`put_docs`/`get_docs`/`delete_docs`, `vector_add_batch`) | Prêt | Résultats par élément, dans l’ordre. Une entrée de `put_docs` peut être `{Doc, DocOpts}` avec ses propres tags `outbox` et son propre indicateur `sync`. |
| Débit d’écriture | Prêt | Les écritures concurrentes sur une même base partagent un lot et une synchronisation disque (group commit, `max_group`) ; les documents sont préparés dans l’appelant et un processus committer écrit chaque groupe (`write_chunk`). Voir `apps/barrel_docdb/docs/benchmarks.md`. |
| Ouvertures en lecture seule | Prêt | `read_only => true` sur `barrel:open/2`, `barrel_docdb` et `barrel_vectordb` : RocksDB `OpenForReadOnly`, aucun fichier créé ni réécrit, plusieurs nœuds peuvent servir un même répertoire. Les écritures répondent `{error, read_only}`. |
| Pièces jointes (blobs) | Prêt | Pièces jointes de documents ; backend interchangeable par base via `barrel_att_backend` (RocksDB BlobDB par défaut, `none` pour les bases sans pièces jointes). Lecture et écriture en streaming. |
| Backend de pièces jointes S3 | Optionnel | `barrel_att_s3` (`rebar3 as s3`) : pièces jointes dans un stockage compatible S3, avec réplication et GC des envois multipart. |
| Recherche vectorielle | Prêt | `barrel_vectordb` ; HNSW par défaut. |
| Mode enregistrement (indexation vectorielle pilotée par une politique) | Prêt | Les documents sont vectorisés automatiquement selon la politique ; en asynchrone (rattrapé) ou en synchrone (lecture de sa propre écriture) ; vecteurs explicites via une option de put. Voir [record-mode](/fr/docs/guides/record-mode). |
| Recherche par mots-clés BM25 | Optionnel | À activer avec `bm25_backend => memory` (ou `disk`) à l’ouverture ; `disk` par défaut en mode enregistrement. L’index disque survit à la fermeture et à l’arrêt brutal ; l’index mémoire est reconstruit à l’ouverture à partir du texte stocké. |
| Recherche de sous-chaînes et d’expressions régulières par trigrammes | Optionnel | `barrel_ngram` : un index sur les documents `barrel_docdb` avec des segments vérifiés par somme de contrôle (`verify_segments`) ; exposé comme outil MCP `ngram_search`. |
| Recherche hybride (vecteur + BM25) | Optionnel | Nécessite BM25 activé ; les résultats portent texte et métadonnées. Les requêtes textuelles nécessitent un embedder (ou `query_vector`). |
| Embeddings | Optionnel | `barrel_embed` (Python local, Ollama, OpenAI, ...). La vectorisation automatique et l’hybride textuel en ont besoin. `barrel:embedder_info/1` donne l’identité du modèle et une `fingerprint` : deux bases avec la même empreinte produisent des scores vectoriels comparables. Voir [record-mode](/fr/docs/guides/record-mode). |
| Reranking | Optionnel | `barrel_rerank` (cross-encoder). |
| Backend d’index FAISS | Optionnel | `barrel_faiss` ; nécessite la bibliothèque C++ FAISS, exclu du build par défaut (`rebar3 as faiss`). |
| Flux de changements | Prêt | `changes/2`, `subscribe/2` ; curseur HLC via `hlc_encode/1`. |
| Requêtes BQL | Prêt | Dialecte PartiQL sur les documents, les vecteurs et BM25 ; requêtes SUBSCRIBE en direct. Les résultats portent la version observée (`instance_id`, `last_seq`) ; la route REST de requête accepte `max_rows` et `deadline_ms` et renvoie `bound`. Voir [query-bql](/fr/docs/guides/query-bql). |
| Contextes | Prêt | Jeux de données nommés sur ce nœud ou sur d’autres nœuds `barrel_server`, interrogés ensemble par une seule instruction BQL ; statut, version et couverture par source ; ensembles de travail avec tranches enregistrées et snapshots importés qui répondent hors ligne. Erlang (`barrel_ctx`), REST (`/contexts`, `/worksets`) et MCP (outils `context_*`). Voir [contexts](/fr/docs/guides/contexts). |
| Export et import en lecture seule | Prêt | `barrel_ctx_export` : une copie d’une base avec somme de contrôle, importée et vérifiée ailleurs et servie en lecture seule. Voir [contexts](/fr/docs/guides/contexts#importer-un-snapshot). |
| Cycle de vie des bases | Prêt | `barrel_dbs` : fermeture après inactivité, éviction LRU, épinglage, baux comptés, détentions exclusives, ouvertures `must_exist`. |
| Synchronisation / réplication | Prêt | Dans la même VM et sur HTTP (`/db/:db/_sync/*`) ; documents, pièces jointes, canaux, tâches continues. Authentification bearer, requêtes signées Ed25519 et mTLS (optionnelles ; bearer par défaut). Les vecteurs sont reconstruits localement. Voir [synchronization](/fr/docs/guides/synchronization). |
| Timeline (branche, PITR, fusion) | Prêt | Forks en O(1), retour à un instant donné, fusion en retour sous forme de synchronisation. Voir [timeline](/fr/docs/guides/timeline). |
| Audit et provenance | Prêt | Journal d’historique conservé ; acteur/session/source sur les écritures ; corps passés par version. Voir [audit-provenance](/fr/docs/guides/audit-provenance). |
| TTL des documents | Prêt | Option d’écriture `expires_at`, expiration paresseuse, balayage optionnel (`ttl_sweep_interval`). |
| Chiffrement au repos | Optionnel | Clés par base via `barrel_keyprovider` ; EncryptedEnv plus un chiffrement par secteur pour les fichiers plats. Voir [encryption](/fr/docs/guides/encryption). |
| Serveur REST/JSON | Optionnel | `barrel_server` sur `livery`, `rebar3 as server` ; sert HTTP/1.1 (par défaut) plus HTTP/2 et HTTP/3 sur TLS en option. Voir [rest-server](/fr/docs/guides/rest-server). |
| Couche agents (espaces, capacités, sessions, passations) | Prêt | `barrel_spaces` ; porteurs de capacités sur REST et MCP. Voir [spaces](/fr/docs/guides/spaces). |
| Point d’accès MCP (outils, ressources, requêtes en direct) | Optionnel | `/mcp` dans `barrel_server`, activé par défaut dans celui-ci. Voir [mcp](/fr/docs/guides/mcp). |
| Client navigateur (barrel-lite) | Prêt | Client TypeScript offline-first (`clients/barrel-lite`) : stockage OPFS, écritures horodatées HLC, synchronisation sur le réseau (polling ou SSE continu), multi-onglets, synchronisation des pièces jointes, un sous-ensemble BQL local identique au serveur, et recherche vectorielle (récupération des embeddings + top-k cosinus en force brute sur l’ensemble synchronisé, avec délégation au `/search` du serveur ; pas d’ANN dans le navigateur). Voir [barrel-lite](/fr/docs/guides/barrel-lite). |
| CORS + jetons de capacité sur `/db` | Prêt | Middleware CORS et porteurs `bsp_` limités aux routes `/db` de leur espace, pour que les navigateurs puissent synchroniser. Voir [rest-server](/fr/docs/guides/rest-server). |
| gRPC, WebTransport, socket unix, OpenAPI | Prévu | Transports à venir sur `barrel_server`. |
| API SQL, agentfs | Prévu | Plus tard. |

## Où les choses s’exécutent

- **Embarqué** : dépendez de `barrel` (aucun transport n’est tiré). Voir [embedding](/fr/docs/guides/embedding).
- **Serveur** : lancez `barrel_server` pour HTTP. Voir [rest-server](/fr/docs/guides/rest-server).
