---
translation_of: src/content/synced/architecture/contexts.md
source_hash: "e89f26fda3e26947"
title: "Contextes : conception"
description: "Un contexte est un jeu de données nommé, possédé et borné (une base Barrel aujourd’hui) qu’un agent découvre, attache et interroge avec d’autres contextes, sur ce nœud ou sur d’autres nœuds barrel_server. Cette page décrit la conception telle que livrée dans barrel 1.10.0 et barrel_server 1.10.0 : identités, fiche, manifeste d’instantané, ensembles de travail, opérations, contrat de requête, règles d’exécution et de fusion, budgets, permissions, publication et import."
source: "docs/architecture/contexts.md"
---

Un contexte est un jeu de données nommé, possédé et borné (une base Barrel
aujourd’hui) qu’un agent découvre, attache et interroge avec d’autres
contextes, sur ce nœud ou sur d’autres nœuds `barrel_server`. Cette page
décrit la conception telle que livrée dans barrel 1.10.0 et barrel_server
1.10.0 : les identités, la fiche, le manifeste d’instantané, les ensembles
de travail, les opérations, le contrat de requête, les règles d’exécution et
de fusion, les budgets, les permissions, et la façon dont une base est
publiée et importée. Lisez-la avant de modifier quoi que ce soit sous
`barrel_ctx*` ou dans les routes des contextes ; pour utiliser les contextes,
lisez le [guide des contextes](/fr/docs/guides/contexts).

## Modèle

Les contextes sont une fédération par composition, pas des shards
transparents. L’agent choisit les contextes ; l’exécuteur choisit les bases
et les emplacements, exécute une instruction BQL sur chacun, et indique pour
chaque source ce qui a répondu, depuis quel état, et ce qui manque. Rien
n’est fusionné ni classé tant que la fusion n’est pas valide pour
l’instruction.

| Élément | Module | Stocké dans ou communique avec |
|---|---|---|
| Catalogue des fiches de contexte | `barrel_ctx_catalog` | la base `_barrel_catalog` |
| Exécuteur fédéré | `barrel_ctx_query`, `barrel_ctx_shape`, `barrel_ctx_merge` | les bases locales et les membres distants |
| Client distant | `barrel_ctx_remote` | `POST /db/:db/query` et `_bulk_get` d’un autre nœud |
| Ensembles de travail, tranches, couverture | `barrel_ctx_ws`, `barrel_ctx_slice`, `barrel_ctx_coverage` | la base `_barrel_worksets` |
| Export et import | `barrel_ctx_export`, `barrel_ctx_manifest` | un répertoire par génération |
| Erreurs et résumés | `barrel_ctx_error`, `barrel_ctx_explain` | une seule forme d’erreur, un `summary` sur chaque réponse |
| Façade | `barrel_ctx` | l’API Erlang |
| REST et MCP | `barrel_server_contexts`, `barrel_server_worksets`, `barrel_server_mcp_contexts` | `/contexts`, `/worksets`, les outils `context_*` |

## Identité

- **Identifiant de contexte** : `ctx_` suivi de 24 caractères base32 en
  minuscules (15 octets aléatoires), émis une fois et jamais réutilisé. Il
  n’encode ni nœud, ni base, ni nom d’affichage.
- **Nom** : un chemin modifiable et lisible, comme `otp/sasl`. Chaque
  opération accepte un nom là où elle accepte un identifiant ; un nom inconnu
  renvoie les noms les plus proches, un nom partagé par plusieurs fiches
  répond `ambiguous_context`.
- **Emplacement** : là où le contexte peut être interrogé : `local` (une base
  sur ce nœud), `remote` (`endpoint` et `db` sur un autre serveur), ou
  `snapshot` (une publication). Un emplacement n’est pas une identité ; une
  fiche peut en lister plusieurs.
- **Versions**, jamais mélangées :
  - `live` : une base modifiable. L’affirmation la plus forte est une
    observation, `{instance_id, last_seq}`, lue après la requête. C’est une
    indication de fraîcheur, pas un instantané cohérent.
  - `generation` : un entier, monotone par contexte, qui nomme un manifeste
    exporté. Seule une génération est une version figée.
- **Jeux de données dérivés** (tranches d’ensemble récupéré) : ils
  enregistrent leur origine : le contexte source, sa version observée, la
  sélection et un hash des identifiants.

## Fiche

Une fiche est petite, descriptive et indicative. Elle ne contient jamais
d’identifiants secrets et n’accorde jamais rien ; c’est la source qui décide.

```json
{"id": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl", "type": "context_card",
 "format": 1, "discoverable": "listed", "title": "OTP sasl",
 "topics": ["erlang", "release"],
 "locations": [{"kind": "remote", "endpoint": "http://127.0.0.1:18082", "db": "otp_sasl"}],
 "embedding": {"fingerprint": "sha256:...", "distance": "cosine", "dimensions": 768}}
```

- Validation : un nom de 1 à 256 octets, au moins un emplacement, des
  endpoints `http` ou `https` sans userinfo, des noms de base en
  `[A-Za-z0-9_-]`, au plus 64 Kio. Une clé qui désigne un secret (`token`,
  `password`, `api_key`, `authorization`, ...) à n’importe quelle profondeur,
  ou une valeur de capacité `bsp_`, échoue avec `invalid_card`.
- `discoverable` : `listed` ou `unlisted`. Les fiches non listées se
  résolvent par identifiant ou par nom mais restent en dehors des listes et
  de la découverte.
- `embedding` est optionnel : ce que la source déclare pour les résultats
  vectoriels. La déclaration propre d’un membre distant, dans les métadonnées
  de sa requête, l’emporte sur la fiche.
- La découverte est un filtre, pas un classement : une fiche correspond quand
  chaque mot de la requête apparaît dans son nom, son titre, sa description
  ou ses sujets.

## Manifeste d’instantané

Un export écrit un répertoire par génération : les fichiers de la base sous
`docdb/` et `vectordb/`, des parties adressées par contenu, et un
`manifest.json` racine.

```json
{"type": "snapshot_manifest", "format": 1,
 "context": "ctx_v7i2tvh35bjlkqmjpm42dgex", "generation": 1, "parent_generation": null,
 "published_at": "2026-09-26T09:36:47Z", "publisher": "node:...",
 "engine": {"barrel": "1.10.0", "barrel_docdb": "1.7.0", "barrel_vectordb": "2.5.0"},
 "sources": [{"db": "otp_sasl", "keyspace": "otp_sasl", "instance_id": "1bd86765269c67f5",
              "last_seq": "AAABoN0S5DMAAAAP", "quiesced": true}],
 "layout": {"docdb": "docdb", "vectordb": "vectordb", "mode": "plain", "att_backend": "blob",
            "encrypted": false, "dimensions": 8, "vectors": 17, "vector_config_etf": "..."},
 "parts": [{"kind": "data", "ref": "parts/sha256-4b08....json", "sha256": "4b08...",
            "artifacts": 21, "bytes": 433203}]}
```

- Une partie liste au plus 1000 artefacts, chacun avec `path`, `sha256` et
  `bytes`, et elle est nommée par son propre sha256. Les grandes bases
  ajoutent des parties, pas une racine plus grande.
- `layout.vector_config_etf` porte la configuration vectorielle portable
  (dimension, backend d’index, backend BM25) pour que l’importateur charge le
  graphe persisté sans reconstruction. Elle ne porte jamais de clés,
  d’embedders ni de docstores.
- Les bases chiffrées s’exportent sous forme chiffrée ; la clé passe par le
  fournisseur de clés, jamais par le manifeste.

## Ensemble de travail

Un ensemble de travail est la liste des contextes avec lesquels un agent
travaille, un document par ensemble dans la base locale `_barrel_worksets`.

| Mode de membre | Ce que c’est | Répond hors ligne |
|---|---|---|
| `local` | une base live sur ce nœud | oui, en `live` |
| `remote` | un emplacement sur un autre serveur | non |
| `retrieved_set` | une tranche figée : les documents qu’une requête a renvoyés, copiés dans `wslice_<ws>_<ctx>` | oui, seulement pour les documents enregistrés |
| `snapshot` | une génération importée, servie en lecture seule sous `wsnap_<ctx>_<generation>` | oui, en tant que cette génération |

- Attacher et détacher sont des opérations logiques : rien n’est ouvert,
  épinglé ni téléchargé.
- Budget par ensemble de travail, modifiable à la création : `bytes` (1 Gio
  de copies locales), `contexts` (8), `transfer_bytes` (256 Mio par
  matérialisation), `remote_parallel` (4), `deadline_ms` (5000), `open_dbs`
  (le `dbs_max_open` de `barrel_dbs`).
- Une tranche est récupérée par identifiants explicites via `_bulk_get` (avec
  `include_embedding` si demandé), écrite sous un nom temporaire, et renommée
  dans l’ensemble seulement une fois complète ; la taille est vérifiée par
  rapport au budget avant toute écriture. Elle garde un index BM25 en mémoire
  reconstruit à l’ouverture. Une tranche d’une source simple contient des
  documents, pas de vecteurs.
- Détacher une tranche la supprime ; supprimer un ensemble de travail
  supprime ses tranches. Les générations importées sont partagées par nom et
  restent.
- Un membre peut nommer un `credential_ref`, une clé des `ctx_credentials` du
  nœud ; l’ensemble de travail ne contient jamais le secret.

## Opérations

L’API Erlang de `barrel_ctx` est le contrat ; REST et MCP s’y rattachent un
pour un. Le [guide](/fr/docs/guides/contexts#les-mêmes-opérations-via-rest-et-erlang) donne la table complète avec
les routes REST et les outils MCP.

| Verbe | Erlang | Ce qu’il fait |
|---|---|---|
| capabilities | `capabilities/0` | formes acceptées avec exemples, fusions, limites, budgets, état hors ligne |
| discover, list, inspect | `discover/2`, `list/1`, `inspect/1` | lire les fiches |
| register | `register/1`, `update/2`, `unregister/1` | gérer les fiches |
| query | `query/1` | une instruction sur des contextes ou un ensemble de travail |
| attach, detach | `attach/3`, `detach/2` | changer les membres d’un ensemble de travail |
| materialize | `materialize/2` | enregistrer ce qu’une requête a renvoyé sous forme de tranches |
| import | `import/3` | importer une génération exportée dans un ensemble de travail |
| offline | `offline/0`, `set_offline/1` | passer le nœud hors ligne |

Les erreurs sont `{error, {Code, Details}}` en Erlang et
`{"error": Code, "message": ..., "hint": ..., "details": {...}}` en REST et
en MCP, avec un statut HTTP par code (`barrel_ctx_error`).

## Contrat de requête

Une requête nomme l’instruction et soit `contexts` (identifiants ou noms),
soit un `working_set`, plus en option `merge`, `offline`, `params`,
`deadline_ms`, `per_context_timeout_ms` et `max_parallel`. La réponse
porte :

- `execution` : `succeeded` (chaque membre a répondu), `partial`, ou
  `failed` (aucun n’a répondu ; MCP marque le résultat comme une erreur).
- `rows` (fusionnées) ou `groups` (un par contexte), chaque ligne étiquetée
  avec `_ctx` et `_ctx_name`.
- `sources[]`, une par membre : `status` (`ok`, `timeout`, `unreachable`,
  `unauthorized`, `error`, `skipped_budget`, `skipped_offline`), `rows`,
  `bound` (`limit_reached` ou `exhausted`), `retrieval` (`exact` pour les
  lignes et BM25, `approximate` pour le vectoriel et l’hybride),
  `membership`, `version`, `location`, `elapsed_ms`, et en cas d’échec une
  `error` avec `reason`, `message`, `hint` et
  `rows_received_before_failure`.
- `coverage` : `requested`, `answered`, `failed`, `skipped`, `missing`, et
  `scope_origin` (`explicit` : l’appelant a nommé les contextes ou
  l’ensemble de travail).
- `summary` : un paragraphe qui donne les mêmes faits à un lecteur.

Les lignes d’un membre qui a échoué ne sont jamais renvoyées, même celles
reçues avant l’échec.

| Appartenance | Promesse | Version déclarée |
|---|---|---|
| `live` | la base à l’instant présent | `live` avec `observed` |
| `complete_generation` | tout ce que contient une génération exportée, exactement | `generation` |
| `retrieved_set` | seulement les documents enregistrés, jamais le contexte source | `retrieved_set` avec l’`observed` de la source au moment de l’enregistrement |

Un membre qui ne peut pas répondre hors ligne est `skipped_offline` avec
`no_local_copy`. L’exécuteur ne télécharge jamais un contexte parce qu’il est
injoignable.

## Exécution

1. Classer l’instruction (`barrel_ctx_shape`) :

   | Forme | Syntaxe | Fusion |
   |---|---|---|
   | Lignes ordonnées | `... ORDER BY <selected field> LIMIT n` | `ordered` |
   | Lignes non ordonnées | `... LIMIT n` | `grouped` |
   | Récupération | `vector_top_k`, `bm25_top_k`, `hybrid_top_k` | `grouped`, ou `score` (voir plus bas) |

   Refusé avant tout contact avec un membre : une requête de lignes sans
   `LIMIT`, un `LIMIT` ou un `k` supérieur à 1000, `SUBSCRIBE`, `OFFSET`,
   `UNNEST`, une continuation, un champ `ORDER BY` non sélectionné, plus de
   8 contextes, un contexte listé deux fois.
2. Statuer sur chaque membre avant tout travail (`barrel_ctx_coverage`) : les
   membres hors ligne qui ont besoin du réseau sont sautés, les membres dont
   la copie locale manque échouent.
3. Exécuter. Chaque membre exécute l’instruction telle quelle : il renvoie
   donc au plus `n` lignes ou `k` résultats. Un membre local s’ouvre avec
   `must_exist` (une fiche mal saisie déclare `db_not_found` au lieu de créer
   une base) et s’exécute sous un bail `barrel_dbs`, que la fermeture sur
   inactivité et l’éviction épargnent. Un membre distant envoie un POST à la
   route de requête de la source avec `max_rows` et `deadline_ms`, reçoit du
   NDJSON en streaming, et ne compte les lignes qu’à l’arrivée de la ligne de
   métadonnées finale. Les membres distants s’exécutent sous l’échéance de la
   requête, le timeout par membre, `max_parallel` et un pool de créneaux à
   l’échelle du nœud ; un membre qui trouve le pool plein est
   `skipped_budget`.
4. Fusionner et expliquer.

| Fusion | Autorisée quand | Signification |
|---|---|---|
| `ordered` | lignes ordonnées | Lignes triées par la valeur `ORDER BY`, puis par identifiant de contexte, puis par identifiant de ligne, coupées à `LIMIT`. |
| `grouped` | toujours | Un groupe par contexte, chacun dans son propre ordre. Aucun classement entre contextes n’est revendiqué. Défaut pour les lignes non ordonnées et la récupération. |
| `score` | `vector_top_k`, et chaque membre déclare la même empreinte d’embedding et la distance cosinus | Ordre global par `_score`. Choisie automatiquement quand la condition est remplie ; sinon la réponse se replie sur `grouped`, avec `merge_fallback` qui indique pourquoi et à quel contexte. Demandée explicitement sans que la condition soit remplie, elle est refusée avec `scores_not_comparable`. |
| `interleave` | récupération | Tourniquet selon le rang dans chaque membre, avec la réponse `relevance: false`. |
| `rrf`, `rerank` | jamais | Refusées avec `merge_not_supported`. |

Les scores bruts BM25, hybrides et RRF ne fusionnent jamais entre contextes :
l’IDF et la normalisation par longueur dépendent du corpus, et avec des
corpus disjoints, le premier résultat de chaque membre reçoit la même
contribution RRF. Il n’y a pas de déduplication (des lignes de contextes
différents sont distinctes même avec des identifiants égaux) ni de
pagination : `bound: limit_reached` indique à l’appelant de resserrer le
prédicat ou d’augmenter la limite.

## Budgets

| Budget | Défaut (env applicatif) | Plafond | En cas de dépassement |
|---|---|---|---|
| Contextes par requête | 8 (`ctx_max_contexts`) | | `too_many_contexts` |
| Lignes par membre | le `LIMIT` ou le `k` de l’instruction | 1000 | `limit_too_large` |
| Échéance de la requête | 5000 ms (`ctx_deadline_ms`) | 60000 ms | les membres restants sont en `timeout` |
| Timeout par membre | 4000 ms (`ctx_member_timeout_ms`) | l’échéance | `timeout` |
| Membres en parallèle par requête | 8 (`ctx_max_parallel`) | 16 | mis en file dans l’échéance |
| Requêtes distantes par nœud | 32 (`ctx_node_remote_max`) | | `skipped_budget` |
| Octets par réponse distante | 16 Mio | | `error` du membre, `response_too_large` |
| Octets locaux de l’ensemble de travail | 1 Gio | | `over_budget` avant écriture |
| Transfert par matérialisation | 256 Mio | | `over_budget` avant écriture |

Le budget d’un ensemble de travail fournit des valeurs par défaut qu’une
requête peut remplacer. La source borne aussi son propre travail : sa route
de requête plafonne `max_rows` à 1000 et `deadline_ms` à 300000, et arrête
une requête qui dépasse son échéance.

## Permissions

- La source applique le contrôle d’accès ; une fiche ne fait que le décrire.
- Dans `barrel_server`, l’enregistrement des fiches, les ensembles de
  travail, les imports et le mode hors ligne demandent un principal global.
  Un jeton de capacité peut lire les fiches et lancer des requêtes de
  contexte ; chaque membre local est autorisé comme son propre
  `POST /db/:db/query` sur cette base avant que l’exécuteur ne le voie. Les
  appelants Erlang de `barrel_ctx:query/1` sont de confiance, comme avec
  `barrel:query/2`.
- Les membres distants utilisent un jeton bearer tiré de l’env applicatif
  `barrel` `ctx_credentials`, une map indexée par endpoint ou par
  `credential_ref`.
- Un droit `read` sur une source autorise aussi la copie : la
  matérialisation utilise `_bulk_get`, qui est classé comme une lecture.

## Publication et import

Une génération passe d’un nœud à l’autre sous forme de répertoire.

1. **Exporter** (`barrel_ctx_export:export/3`) : prendre une retenue
   exclusive sur la base (`barrel_dbs:hold/2` ; la base est fermée pendant
   la copie), copier les fichiers docdb et du stockage vectoriel, puis écrire
   les parties et la racine. Une source écrite par une version plus ancienne
   est ouverte une fois en écriture sous la retenue, pour que la copie
   s’ouvre en lecture seule. Une politique de mode enregistrement qui
   contient une valeur de type `api_key` est refusée avec
   `policy_holds_secret` et rien n’est copié.
2. **Transférer** le répertoire par n’importe quel moyen.
3. **Importer** (`barrel_ctx_export:import/2`, ou `barrel_ctx:import/3` dans
   un ensemble de travail) : copier et vérifier chaque fichier par rapport à
   son sha256 dans un répertoire partiel, reprendre à partir des fichiers
   déjà vérifiés, écrire un fichier annexe d’import (keyspace source, un
   nouvel identifiant de source), et renommer à sa place seulement une fois
   complet.
4. **Servir** en lecture seule : ouvrir, interroger et fermer un import ne
   crée ni ne réécrit aucun fichier (RocksDB `OpenForReadOnly`) : chaque
   fichier garde donc sa somme de contrôle et plusieurs nœuds peuvent servir
   un même répertoire. Un index BM25 disque est utilisé tel qu’écrit ; un
   index en mémoire est reconstruit à l’ouverture.
   `barrel_ctx_export:remove_import/1` supprime une génération locale.

## Décisions

Mesuré sur le code source d’OTP lui-même : 1078 modules dans 33
applications, une application par contexte, 217 requêtes à élément connu,
`nomic-embed-text` (768 dimensions, cosinus). Les harnais sont
`bench/ctx_remote` (fanout), `bench/ctx_ranking` (classement),
`bench/rocksdb_readonly` (ouvertures en lecture seule) et
`scripts/bench_ctx_snapshot.escript` (export et import) ;
`scripts/contexts-demo.sh` exécute toute la fonctionnalité sur trois nœuds.

**Classement : groupé par défaut, fusion par score seulement avec des
empreintes égales.**

| Méthode sur les 33 contextes | recall@10 |
|---|---|
| Un index vectoriel exact sur l’union (référence) | 0.802 |
| Fusion `score` de `vector_top_k` (même empreinte) | 0.802 |
| `grouped`, le groupe propre de la cible | 0.908 |
| Tri par score BM25 brut | 0.558 |
| RRF entre contextes, ou `interleave` dans l’ordre des contextes | 0.078 |
| Rerank par cross-encoder (MiniLM) d’un pool de 100 candidats | 0.733 |

Une fusion par score sur des empreintes égales équivaut à un index unique en
force brute : elle est donc choisie automatiquement. La fusion de rangs et
l’entrelacement sur des corpus disjoints ne sont pas des ordres de
pertinence, et le reranker généraliste a dégradé les résultats sur du code :
`rerank` reste donc refusé tant qu’un reranker adapté au code n’est pas
validé.

**Les instantanés de base complète sont le format de paquet.** Exporter ou
importer tout le corpus prend environ 50 à 70 ms, et les graphes ANN se
chargent sans reconstruction : des paquets limités aux documents avec
reconstruction locale de l’index n’étaient donc pas nécessaires.

**Lecture seule signifie aucun fichier écrit.** Servir une copie avec les
stockages ouverts en lecture-écriture réécrivait des fichiers à chaque
ouverture (714 Ko, ou 33 Mo avec un WAL à rejouer), cassait les sommes de
contrôle du manifeste, et empêchait un second nœud d’utiliser le répertoire.
Avec `OpenForReadOnly`, rien n’est écrit, un second lecteur ouvre le même
répertoire, et les ouvertures sont 20 à 25 % plus rapides.

**Le fanout distant est peu coûteux.** La latence de requête est
l’aller-retour réseau plus quelques millisecondes, stable de 1 à 8 membres.

## Pas encore pris en charge

- **Paquets d’index** : publier les segments `barrel_ngram` vers un stockage
  objet et les mettre en cache localement attend un format de segment
  compact ; l’actuel donne un index d’environ 34 fois la taille du texte.
- **Publication vers un stockage objet** : les générations se déplacent sous
  forme de répertoires ; il n’y a ni téléversement, ni rétention, ni GC des
  générations publiées.
- **L’hybride entre contextes** demande des statistiques BM25 partagées ;
  d’ici là, les réponses hybrides et BM25 restent groupées.
- **Propriété des ensembles de travail** : un ensemble de travail enregistre
  une étiquette `owner` que rien n’applique ; tout principal global peut lire
  ou supprimer n’importe quel ensemble.
- **Permission de requête seule** : une autorisation qui permet d’interroger
  une source sans copier depuis elle.
- **Catalogue partagé** : les fiches vivent dans un catalogue par nœud,
  enregistrées explicitement ; il n’y a ni catalogue répliqué, ni règle sur
  qui peut écrire quelle fiche.
- **Client distant** : chaque appel ouvre et ferme sa propre connexion ; pas
  de réutilisation de connexion, ni d’options TLS au-delà des valeurs par
  défaut.
- Les sous-ensembles continus (réplication filtrée qui retire les documents
  sortis du périmètre), les instantanés par prédicat, la pagination, la
  déduplication entre répliques et la fédération live.
