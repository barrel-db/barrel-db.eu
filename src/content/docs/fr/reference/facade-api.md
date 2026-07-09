---
title: API de facade
description: Le module barrel, le point d'entree unique de la base de donnees embarquee, groupe par domaine.
---

Ceci est le module `barrel`, la seule API que vous utilisez pour embarquer la base
de donnees. Chaque fonction prend le handle de base de donnees renvoye par
`barrel:open/1,2` (sauf les appels de cycle de vie). Reportez-vous aux guides pour
des exemples concrets ; cette page est la carte.

## Cycle de vie

| Fonction | Description |
|----------|-------------|
| `open/1`, `open/2` | Ouvrir (en creant si besoin) une base de donnees ; `open/2` prend des options par couche. Renvoie un handle. |
| `close/1` | Fermer un handle de base de donnees. |
| `info/1` | Infos de base de donnees (compteurs, planchers, curseurs). |
| `delete/1` | Supprimer une base de donnees et ses fichiers. |

Ouvrez depuis un processus a longue duree de vie : la base de donnees lie son
store vectoriel a l'appelant. Voir
[Integrer Barrel](/fr/docs/guides/embedding).

## Documents

| Fonction | Description |
|----------|-------------|
| `put_doc/2,3` | Creer ou mettre a jour un document (une map avec `<<"id">>`). |
| `get_doc/2,3` | Lire un document par id. |
| `delete_doc/2,3` | Supprimer un document (ecrit un tombstone). |
| `find/2,3` | Requete structuree par chemin (`#{where => [...]}`). |
| `put_docs/2,3`, `get_docs/2,3`, `delete_docs/2` | Variantes par lot ; un resultat par id, dans l'ordre. |

## Requetes (BQL)

| Fonction | Description |
|----------|-------------|
| `query/2,3` | Lancer une instruction BQL ; renvoie lignes + meta. |
| `query_fold/5` | Diffuser une requete par morceaux (`chunk_size`, `has_more`/`continuation`). |
| `explain_query/2,3` | Renvoyer le plan d'une instruction BQL. |

Voir la [reference BQL](/fr/docs/reference/bql) et le
[guide des requetes](/fr/docs/guides/query-bql).

## Pieces jointes

| Fonction | Description |
|----------|-------------|
| `put_attachment/4`, `get_attachment/3` | Stocker et lire un blob par nom. |
| `list_attachments/2`, `delete_attachment/3`, `attachment_info/3` | Lister, supprimer, inspecter. |
| `open_attachment_writer/4` -> `write_attachment/2` -> `finish_attachment/1` | Diffuser un gros blob en entree (`abort_attachment/1` pour annuler). |
| `open_attachment_reader/3` -> `read_attachment/1` -> `close_attachment_reader/1` | Diffuser un blob en sortie. |

## Vecteurs et recherche

| Fonction | Description |
|----------|-------------|
| `vector_add/4,5`, `vector_add_batch/2` | Attacher un vecteur (ou un lot) a des documents. |
| `vector_get/2`, `vector_delete/2`, `vector_stats/1` | Lire, supprimer, et compter les vecteurs. |
| `search_vector/3` | Recherche du plus proche voisin par vecteur (`#{k => N}`). |
| `search_bm25/3` | Recherche par mot-cle (necessite un backend BM25 active a l'ouverture). |
| `search_hybrid/3`, `search/3` | Hybride vecteur + mot-cle, et recherche texte quand un embedder est configure. |

La recherche hybride et l'embedding automatique necessitent un embedder via
`barrel_embed` ; sans lui ils renvoient `{error, embedder_not_configured}`. Voir
[Mode enregistrement](/fr/docs/guides/record-mode).

## Changements et abonnements

| Fonction | Description |
|----------|-------------|
| `changes/2,3` | Lire le flux de changements depuis `first` ou un curseur. |
| `hlc_encode/1`, `hlc_decode/1` | Transformer une position de flux en curseur URL-safe et inversement. |
| `subscribe/2,3`, `subscribe_ack/2`, `subscribe_stop/1` | S'abonner aux changements avec contre-pression. |
| `subscribe_query/2,3`, `unsubscribe_query/1` | Requetes en direct (BQL `SUBSCRIBE`). |

## Timeline

| Fonction | Description |
|----------|-------------|
| `branch/2,3` | Creer une branche d'une base de donnees (a maintenant, ou a un instant passe). |
| `merge/1,2` | Fusionner une branche a nouveau. |

Voir [Timeline](/fr/docs/guides/timeline).

## Historique

| Fonction | Description |
|----------|-------------|
| `history/1,2`, `history_floor/1` | Lire l'historique de changements retenu et son plancher. |
| `doc_versions/2`, `version_body/3` | Lister les versions d'un document et lire un corps passe. |

Voir [Audit et provenance](/fr/docs/guides/audit-provenance).
