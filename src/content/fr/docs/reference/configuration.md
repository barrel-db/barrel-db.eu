---
translation_of: src/content/docs/reference/configuration.md
source_hash: "2e2a7e72e1bead58"
title: Configuration
description: Les options que vous passez à l’ouverture d’une base, et les clés d’environnement de chaque application Barrel avec leurs valeurs par défaut.
---

Cette page liste les options que vous passez à l’ouverture d’une base, et les clés que chaque application Barrel lit dans son environnement (`sys.config`), avec leurs valeurs par défaut. Servez-vous-en comme aide-mémoire ; les guides expliquent quand modifier chacune.

## Ouvrir une base

`barrel:open/2` prend une map, avec une sous-map par couche :

```erlang
{ok, Db} = barrel:open(<<"notes">>, #{
    docdb => #{retention_period => 2592000},
    vectordb => #{db_path => "/var/lib/app/vec/notes",
                  dimensions => 768,
                  bm25_backend => disk},
    encryption => default
}).
```

| Clé | Défaut | Signification |
|---|---|---|
| `docdb` | `#{}` | Les options du magasin de documents, ci-dessous |
| `vectordb` | `#{}` | La configuration du magasin de vecteurs, ci-dessous, ou `none` pour les documents seuls |
| `embedding` | aucun | Une politique d’embedding : la base tourne en [mode enregistrement](/fr/docs/guides/record-mode). `stored` rouvre avec la politique que la base a sauvegardée. |
| `encryption` | `disabled` | `default` (clé tirée de `BARREL_ENCRYPTION_KEY`) ou `#{provider => Mod}`. Passez-la à chaque ouverture. Voir [Chiffrement](/fr/docs/guides/encryption). |
| `read_only` | `false` | Ouvre les deux magasins en lecture seule |
| `store_supervised` | `false` | Supervise le magasin de vecteurs au lieu de le lier à l’appelant |

### Magasin de documents (`docdb`)

Ce sont les options de `barrel_docdb:create_db/2`. `encryption`, `read_only`, `channels`, `conflict_resolver` et les réglages de rétention ne sont pas stockés : passez-les à nouveau à chaque ouverture.

| Clé | Défaut | Signification |
|---|---|---|
| `data_dir` | le `data_dir` de l’environnement applicatif | Dossier parent de la base |
| `att_opts` | blob dans RocksDB | Backend des pièces jointes : `#{backend => none}`, ou `#{backend => s3, s3 => #{bucket => ...}}` avec barrel_att_s3 |
| `retention_period` | `2592000` (30 jours, en secondes) | Historique conservé pour l’audit et les branches à un instant donné ; `0` garde tout et désactive la purge |
| `retention_check_interval` | `600000` ms | Fréquence de la purge de rétention |
| `ttl_sweep_interval` | `0` (désactivé) | Fréquence de suppression des documents expirés |
| `ttl_sweep_batch` | `512` | Documents supprimés par étape de purge |
| `tombstone_purge_after` | `0` (conserver) | Purge les stubs de suppression après ce nombre de secondes |
| `channels` | aucun | `#{Name => [Pattern]}`, fixé à la création |
| `conflict_resolver` | aucun | Un résolveur pour les versions concurrentes |
| `max_conflict_versions` | `8` | Versions concurrentes conservées par document |
| `max_group`, `write_chunk` | `256`, `16` | Tailles du group commit |
| `stats_interval` | `60000` ms | Fréquence de mise à jour des gauges de taille et de compaction ; `0` la désactive |
| `att_upload_timeout` | `3600` s | Durée maximale pendant laquelle un envoi de pièce jointe peut rester ouvert |
| `store_opts` | `#{}` | Options RocksDB, voir ci-dessous |

Les principales clés de `store_opts`. Chacune s’applique à toutes les familles de colonnes du stockage des documents : la mémoire des memtables d’une base peut donc atteindre `write_buffer_size` × `max_write_buffer_number` × 4.

| Clé | Défaut | Rôle |
|---|---|---|
| `compression`, `bottommost_compression` | `zstd` | rocksdb inclut toujours zstd. `snappy` et `lz4` ne marchent que si rocksdb a été compilé avec la bibliothèque du système. |
| `bloom_bits` | `10` | Bits par clé du filtre de Bloom : la lecture d’une clé absente évite les fichiers qui ne peuvent pas la contenir |
| `block_size` | `4096` | Taille d’un bloc de table, en octets |
| `write_buffer_size` | 64 Mio | Taille d’une memtable avant écriture sur disque |
| `max_write_buffer_number` | `2` | Memtables par famille de colonnes avant que les écritures attendent un flush |
| `min_tombstones_for_range_conversion` | `64` | Une suite d’au moins ce nombre de suppressions devient une seule suppression de plage au flush, et les lectures la sautent d’un coup. `0` la désactive. |
| `use_direct_io_for_compaction_reads` | `false` | Les compactions lisent en I/O directe et laissent le cache de pages à vos lectures. Acceptée aussi dans `att_opts`. Demande un système de fichiers qui gère l’I/O directe (pas tmpfs). |

`prune_depth`, `compaction_interval` et `compaction_size_threshold` n’ont plus d’effet depuis la 2.2.0 ; une base qui les reçoit écrit un avertissement dans le journal.

### Magasin de vecteurs (`vectordb`)

| Clé | Défaut | Signification |
|---|---|---|
| `db_path` (ou `path`) | `<data_dir>/<name>.vectordb`, à côté des documents | Emplacement du magasin. Un magasin créé avant barrel 1.13.0 dans `priv/barrel_vectordb_<name>` sous le répertoire de travail continue d’y être utilisé. |
| `dimensions` (ou `dimension`) | `768` | Taille des vecteurs |
| `embedder` | aucun | Un fournisseur barrel_embed, comme `{ollama, #{model => <<"nomic-embed-text">>}}`. Sans lui, les appels texte renvoient `embedder_not_configured`. |
| `backend` | `hnsw` | `hnsw`, `diskann`, ou `faiss` (demande barrel_faiss) |
| `hnsw` | `#{m => 16, ef_construction => 200}` | Accepte aussi `distance_fn` (`cosine` ou `euclidean`) et `quantization` (`scalar` par défaut, `turboquant`, `subspace_turboquant`, `none`) |
| `diskann` | | `#{r, l, base_path}` |
| `faiss` | `#{index_type => <<"HNSW32">>}` | Accepte aussi `nprobe` |
| `bm25_backend` | `none` ; `disk` en mode enregistrement | `memory` ou `disk` active la recherche par mots-clés |
| `read_only` | `false` | Refuse les écritures |

### Politique d’embedding (`embedding`)

| Clé | Défaut | Signification |
|---|---|---|
| `fields` | le document entier | Chemins dont le texte est transformé en embedding |
| `join` | `<<"\n">>` | Séparateur entre les champs |
| `mode` | `async` | `sync` calcule l’embedding avant que l’écriture ne rende la main |
| `embedder` | | Le fournisseur barrel_embed |
| `dimensions` | `768` | Doit correspondre au modèle |
| `metadata_fields` | le document sans `id` ni les clés `_` | Champs renvoyés comme métadonnées de recherche |

Les autres clés sont refusées avec `{error, {unknown_options, Keys}}`.

## Environnement applicatif

Définissez ces clés dans `sys.config`. Les chemins sont relatifs au répertoire de travail du nœud, sauf si vous les donnez en absolu.

### barrel_server

| Clé | Défaut | Signification |
|---|---|---|
| `http_port` | `8080` | Port de l’écoute HTTP en clair, quand `listeners` n’est pas défini |
| `listeners` | une écoute HTTP/1.1 | `#{http => ..., https => ..., http3 => ...}` |
| `tls` | aucun | `#{certfile, keyfile, cacertfile, verify, ssl_opts}` |
| `data_dir` | celui de barrel_docdb | Copié dans le `data_dir` de barrel_docdb au démarrage. Les magasins de vecteurs le suivent, dans `<data_dir>/<name>.vectordb`. |
| `open_opts` | `#{}` | Options de `barrel:open/2` pour chaque base que le serveur ouvre |
| `auth` | aucun (serveur ouvert) | `#{tokens => [...]}`, ou `#{accept => [bearer, signed, mtls], signers => ..., skew_ms => 300000, require_nonce => ...}`. Voir [Authentification](/fr/docs/security/authentication). |
| `cors` | aucun | `#{origins, expose, max_age}` ; nécessaire pour [barrel-lite](/fr/docs/guides/barrel-lite) |
| `mcp` | `#{}` | `#{enabled => true, allowed_origins, allow_missing_origin, resources => full \| live_only, live}`. Voir le [guide MCP](/fr/docs/guides/mcp). |
| `max_body` | 1 Gio | Plus grand corps de requête |
| `sig_replay_sweep_ms` | `60000` | Fréquence de purge des nonces de signature déjà vus |

```erlang
[{barrel_server, [
    {http_port, 8080},
    {data_dir, "/var/lib/barrel"},
    {auth, #{tokens => [<<"change-me">>]}},
    {cors, #{origins => [<<"https://app.example">>]}}
 ]}].
```

Le serveur définit aussi le `task_db_opener` de barrel_docdb, pour que les tâches de réplication restaurées après un redémarrage ouvrent leurs bases comme le fait le serveur.

### barrel_docdb

| Clé | Défaut | Signification |
|---|---|---|
| `data_dir` | `"data/barrel_docdb"` | Emplacement des bases |
| `default_store` | `barrel_store_rocksdb` | Module de stockage |
| `block_cache_size` | 512 Mio | Cache de blocs RocksDB partagé par toutes les bases |
| `block_cache_type` | `clock` | Type de cache |
| `query_timeout_ms` | `30000` | Échéance des requêtes |
| `hlc_max_offset` | `0` (désactivé) | Plus grand décalage d’horloge accepté d’un pair, en ms |
| `body_async_io` | `false` | Expérimental |
| `metrics` | `[]` | `[{exporter, none \| console \| otlp \| {Mod, Map}}, {otlp_endpoint, Url}, {otlp_headers, #{}}, {otlp_compression, none \| gzip}]` |
| `tracing` | `[]` | `[{enabled, true}, {exporter, ...}, {otlp_endpoint, Url}]` |
| `logging` | `[]` | `[{exporter, none \| console \| file \| otlp \| {Mod, Map}}, {file_path, ...}, {file_format, text \| json}, ...]` |
| `sync_auth`, `sync_signing`, `sync_ssl` | `#{}` | Identifiants pour la réplication HTTP, par origine ou par URL de base |
| `task_db_opener` | aucun | `{Mod, Fun}` qui ouvre une base pour une tâche restaurée |

Voir [Supervision](/fr/docs/operate/monitoring) pour les exporters.

### barrel

| Clé | Défaut | Signification |
|---|---|---|
| `dbs_idle_timeout` | `300000` ms | `barrel_dbs` ferme une base inutilisée après ce délai ; `0` jamais |
| `dbs_max_open` | `0` (sans limite) | Nombre maximal de bases que `barrel_dbs` garde ouvertes |
| `dbs_evict_guard` | `5000` ms | À la limite `dbs_max_open`, seule une base inactive depuis ce délai est évincée ; sinon l’ouverture échoue avec `too_many_open_dbs` |
| `ctx_max_contexts` | `8` | Contextes par requête |
| `ctx_deadline_ms` | `5000` (60000 au plus) | Échéance des requêtes de contexte |
| `ctx_member_timeout_ms` | `4000` | Temps accordé à chaque membre |
| `ctx_max_parallel` | `8` (16 au plus) | Membres interrogés en même temps |
| `ctx_offline` | `false` | Démarre en mode hors ligne |
| `ctx_catalog_db` | `_barrel_catalog` | Base qui contient les fiches de contexte |
| `ctx_dir` | `<docdb data_dir>/_ctx` | Tranches et imports |
| `ctx_credentials` | `#{}` | Identifiants pour les contextes distants |

### barrel_embed

| Clé | Défaut | Signification |
|---|---|---|
| `managed_venv` | `true` | Crée un venv Python et installe les paquets des fournisseurs à la première utilisation ; `false` utilise votre propre `python` |
| `venv_dir` | `<priv>/.venv` | Emplacement du venv géré |

### barrel_crypto

| Clé | Défaut | Signification |
|---|---|---|
| `encryption_key` | aucun | Secret maître quand `BARREL_ENCRYPTION_KEY` n’est pas défini : 32 octets, 64 caractères hexadécimaux ou une phrase de passe |
| `encryption_salt` | `barrel_default_salt_v1` | Sel quand `BARREL_ENCRYPTION_SALT` n’est pas défini |

### barrel_spaces

| Clé | Défaut | Signification |
|---|---|---|
| `registry_db` | `_barrel_spaces` | La base de registre |
| `embedder` | aucun | Embedder utilisé pour rouvrir les espaces en mode enregistrement |
| `janitor_interval` | `300000` ms | Fréquence de suppression des restes des sessions expirées |

### barrel_ngram

| Clé | Défaut | Signification |
|---|---|---|
| `data_dir` | `"data/barrel_ngram"` | Emplacement des index ; tout le reste se règle par corpus |

### barrel_att_s3

| Clé | Défaut | Signification |
|---|---|---|
| `multipart_gc_interval` | 1 heure, en ms ; `0` désactivé | Purge des envois multipart abandonnés |
| `multipart_gc_max_age` | 24 heures, en secondes | Âge au-delà duquel un envoi est considéré abandonné |

### barrel_rerank

| Clé | Défaut | Signification |
|---|---|---|
| `venv_path` | `undefined`, c’est-à-dire `priv/.venv` de l’application | Emplacement du virtualenv. Réglez-le après `application:load/1` et avant le démarrage de l’application. |

### barrel_vectordb

Son `.app.src` déclare `default_dimensions`, `default_embedder`, `hnsw_m`, `hnsw_ef_construction`, `hnsw_ef_search` et `embed_cache_size`, mais aucune n’est lue. Réglez-les par magasin dans `vectordb`.
