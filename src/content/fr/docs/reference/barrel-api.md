---
translation_of: src/content/docs/reference/barrel-api.md
source_hash: "57d79bc59ede40b4"
title: API Barrel
description: Le module barrel, point d’entrée de la base intégrée, par domaine, avec les autres modules que vous appelez à côté.
---

Voici le module `barrel`, l’API que vous utilisez pour intégrer la base dans une application Erlang. Chaque fonction prend le handle renvoyé par `barrel:open/1,2`, sauf les appels de cycle de vie. Servez-vous de cette page comme d’une carte ; les guides ont des exemples complets, et la [référence générée](/docs/lib/barrel/) détaille chaque type et chaque option.

```erlang
{ok, _} = application:ensure_all_started(barrel),
{ok, Db} = barrel:open(<<"notes">>, #{
    vectordb => #{db_path => "/var/lib/app/vec/notes"}}),
{ok, #{<<"rev">> := _}} =
    barrel:put_doc(Db, #{<<"id">> => <<"n1">>,
                         <<"title">> => <<"hello">>}).
```

Les appels renvoient `{ok, Value}` ou `{error, Reason}` ; voir [Codes d’erreur](/fr/docs/reference/errors#api-erlang).

## Cycle de vie

| Fonction | Description |
|---|---|
| `open/1`, `open/2` | Ouvre une base, en la créant si besoin. Options : `docdb`, `vectordb` (une map, ou `none` pour les documents seuls), `embedding` (une politique, ou `stored`, pour le mode enregistrement), `encryption`, `read_only`, `store_supervised`. Voir [Configuration](/fr/docs/reference/configuration#ouvrir-une-base). |
| `close/1` | Arrête l’indexeur et le magasin de vecteurs, puis ferme les documents. |
| `info/1` | Les infos docdb (configuration, espace de clés, rétention, plancher d’historique, compteurs de groupes d’écriture) plus `embedding`, `dimensions` et `embedder`. Ni nombre de documents ni taille. |
| `delete/1` | Supprime la base et les fichiers de son magasin de vecteurs. |

Ouvrez depuis un processus de longue durée : le magasin de vecteurs est lié à l’appelant, sauf si vous passez `store_supervised => true` ou ouvrez via `barrel_dbs`. Voir [Intégrer barrel dans une application Erlang](/fr/docs/guides/embedding).

## Documents

| Fonction | Description |
|---|---|
| `put_doc/2,3` | Crée ou met à jour un document (une map avec `<<"id">>`). Renvoie `{ok, #{<<"id">>, <<"rev">>, <<"ok">>}}`. Une mise à jour doit porter le `<<"_rev">>` courant. Les options comprennent `provenance`, `expires_at`, `sync` et, en mode enregistrement, `vector`. |
| `put_docs/2,3` | Un résultat par document, dans l’ordre. En mode enregistrement avec `mode => sync`, un échec d’embedding fait échouer tout le lot. |
| `get_doc/2,3` | Lit un document. Options : `include_embedding`, `conflicts`, `include_deleted`, `rev`. |
| `get_docs/2,3` | Lit plusieurs documents. |
| `delete_doc/2,3`, `delete_docs/2` | Supprime (écrit une pierre tombale). `delete_docs/2` supprime un par un, pas de façon atomique. |
| `find/2,3` | Une requête structurée (`#{where => [...]}`), la même spécification que `barrel_docdb:find/2,3`. |

## Requêtes (BQL)

| Fonction | Description |
|---|---|
| `query/2,3` | Exécute une instruction ; renvoie `{ok, Rows, Meta}`. Options : `params`, `chunk_size`, `continuation`, `overfetch`. |
| `query_fold/5` | Replie les lignes sans construire la liste complète. |
| `explain_query/2,3` | Le plan et ses avertissements. |
| `subscribe_query/2,3`, `unsubscribe_query/1` | Requêtes en direct depuis une instruction `SUBSCRIBE`. Options : `params`, `owner`. |

Les fonctions de table de recherche `vector_top_k`, `bm25_top_k` et `hybrid_top_k` ne s’exécutent que via ces appels. Voir la [référence BQL](/fr/docs/reference/bql).

## Pièces jointes

| Fonction | Description |
|---|---|
| `put_attachment/4,5`, `get_attachment/3` | Stocke et lit des octets par nom. |
| `list_attachments/2`, `delete_attachment/3`, `attachment_info/3` | Lister, supprimer, inspecter. |
| `open_attachment_writer/4`, `write_attachment/2`, `finish_attachment/1`, `abort_attachment/1` | Envoyer une grande pièce jointe en flux. |
| `open_attachment_reader/3`, `read_attachment/1`, `close_attachment_reader/1` | En lire une en flux. |

Les lectures par plage d’octets n’existent que dans barrel_docdb (`open_attachment_stream/4`, `read_attachment_range/5`).

## Vecteurs et recherche

Sur une base ouverte avec `vectordb => none`, ces appels renvoient `{error, no_vector_store}`.

| Fonction | Description |
|---|---|
| `vector_add/4,5`, `vector_add_batch/2` | Ajoute un vecteur avec son texte et ses métadonnées ; `/4` calcule l’embedding du texte, `/5` prend le vecteur. Renvoie `{error, record_mode}` en mode enregistrement, où vous écrivez des documents à la place. |
| `vector_get/2`, `vector_delete/2` | Lit ou supprime une entrée. |
| `vector_stats/1` | `count`, `dimension`, `index`, `index_origin`, `config`. |
| `search/3` | Calcule l’embedding du texte de la requête, puis fait une recherche vectorielle. Demande un embedder. |
| `search_vector/3` | Plus proches voisins d’un vecteur. |
| `search_bm25/3` | Recherche par mots-clés ; renvoie `{ok, [{Id, Score}]}`. Demande un backend BM25. |
| `search_hybrid/3` | Mots-clés et vecteurs, fusionnés (RRF par défaut). Demande les deux. |

Options : `k` (5 pour `search` et `search_vector`, 10 pour BM25 et hybride), `filter` (une fun sur les métadonnées, appliquée après la récupération), `include_text`, `include_metadata` ; pour l’hybride aussi `bm25_weight`, `vector_weight`, `fusion` (`rrf` ou `linear`) et `rrf_k`.

## Embedding

| Fonction | Description |
|---|---|
| `embed/2`, `embed_batch/2` | Calcule l’embedding d’un texte avec l’embedder de la base. |
| `embedder_info/1` | `provider`, `model`, `dimensions`, `distance`, `preprocessing`, `fingerprint`. |
| `embedding_fingerprint/3` | L’empreinte qui identifie un espace vectoriel. |

## Changements et abonnements

| Fonction | Description |
|---|---|
| `changes/2,3` | Lit le flux de changements depuis `first` ou un curseur. |
| `hlc_encode/1`, `hlc_decode/1` | Transforme une position du flux en curseur sûr pour une URL, et inversement. |
| `subscribe/2,3`, `subscribe_ack/2`, `subscribe_stop/1` | Un processus de flux de changements ; `subscribe_ack/2` acquitte un lot en mode push. |

## Timeline

| Fonction | Description |
|---|---|
| `branch/2,3` | Crée une branche maintenant, ou à un HLC passé avec `at`. Une branche simple reçoit un magasin de vecteurs vide ; une branche en mode enregistrement le remplit à partir des embeddings stockés. |
| `merge/1,2` | Fusionne une branche dans son parent. |

Voir [Brancher, fusionner, restaurer](/fr/docs/guides/timeline).

## Historique

| Fonction | Description |
|---|---|
| `history/1,2`, `history_floor/1` | Lit l’historique des changements conservé et son plancher. Options : `from`, `to`, `limit`, `id`. |
| `doc_versions/2`, `version_body/3` | Liste les versions d’un document et lit un corps passé. |

Voir [Audit et provenance](/fr/docs/guides/audit-provenance).

## Autres modules que vous appelez

| Module | Pour |
|---|---|
| `barrel_dbs` | Un handle partagé et supervisé par nom : `ensure/1,2` (avec `must_exist`), `lease/2`, `release/1`, `close/1`, `list/0`. Le serveur ouvre les bases par ce module. |
| `barrel_rep`, `barrel_rep_tasks` | La réplication ; `barrel` ne l’enveloppe pas. Passez le nom de la base. Voir [Synchronisation](/fr/docs/guides/synchronization). |
| `barrel_ctx`, `barrel_ctx_export` | Contextes, ensembles de travail, export et import. Voir [Interroger plusieurs jeux de données](/fr/docs/guides/contexts). |
| `barrel_spaces`, `barrel_caps`, `barrel_session`, `barrel_handoff` | La couche agents. Voir [Espaces, sessions, passations](/fr/docs/guides/spaces). |
| `barrel_ngram` | Recherche par sous-chaîne et expression régulière sur une base docdb. Voir [Sous-chaîne et expression régulière](/fr/docs/search/substring-regex). |
