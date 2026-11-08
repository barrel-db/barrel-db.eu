---
translation_of: src/content/synced/guides/contexts.md
source_hash: "0f2f01d95308c0fd"
title: "Contextes"
description: "Un contexte est un jeu de données nommé (une base Barrel aujourd’hui) que vous interrogez avec d’autres contextes, où qu’ils se trouvent : sur ce nœud ou sur d’autres nœuds barrel_server. Vous enregistrez une fiche par contexte sur le nœud auquel votre agent parle, puis vous lancez une seule instruction BQL sur plusieurs contextes par leur nom. Chaque réponse dit quels contextes ont répondu, pourquoi les autres ne l’ont pas fait et ce que couvre chaque réponse."
source: "docs/guides/contexts.md"
---

Un contexte est un jeu de données nommé (une base Barrel aujourd’hui) que vous
interrogez avec d’autres contextes, où qu’ils se trouvent : sur ce nœud ou sur
d’autres nœuds `barrel_server`. Vous enregistrez une fiche par contexte sur le
nœud auquel votre agent parle, puis vous lancez une seule instruction BQL sur
plusieurs contextes par leur nom. Chaque réponse dit quels contextes ont
répondu, pourquoi les autres ne l’ont pas fait et ce que couvre chaque réponse,
dans des champs et dans un `summary` d’un paragraphe. Quand vous avez besoin de
réponses sans le réseau, vous gardez un ensemble de travail : une liste de
contextes, certains distants, d’autres enregistrés localement comme tranches de
résultats de requête ou comme snapshots importés. Utilisez ce guide quand un
agent (via MCP) ou un programme (via REST ou Erlang) doit chercher ou lister des
données réparties sur plusieurs serveurs Barrel, ou continuer à travailler hors
ligne.

Les contextes sont livrés dans barrel 1.10.0 (l’API Erlang, `barrel_ctx`) et
barrel_server 1.10.0 (les routes REST et les outils MCP). Chaque requête et
réponse ci-dessous provient d’une exécution de `scripts/contexts-demo.sh`,
raccourcie avec `"..."` ; les ids et les numéros de séquence changent à chaque
exécution. La conception sous-jacente est décrite dans
[contexts](/fr/docs/architecture/contexts).

## Lancer la démo

Le script démarre trois nœuds en loopback (L sur 18081, R1 sur 18082, R2 sur
18083), charge une application OTP par nœud et pilote le nœud L via MCP.

```sh
rebar3 as server compile
scripts/contexts-demo.sh /path/to/corpus.jsonl
# ... passed: 36, failed: 0
```

`WORK_DIR` et `OUT_DIR` choisissent où vont les données des nœuds et la
transcription (le script vide `WORK_DIR`) ; `PORT_L`, `PORT_R1`, `PORT_R2` et
`NODE_PREFIX` permettent à deux exécutions de partager une machine.

## Enregistrer un contexte

Enregistrez une fiche par contexte sur le nœud qui lance les requêtes
(authentification globale). Une fiche locale nomme une base de ce nœud ; une
fiche distante nomme un autre serveur et une base sur celui-ci.

```sh
curl -XPOST localhost:18081/contexts -H 'content-type: application/json' -d '
  {"name": "otp/sasl", "title": "OTP sasl", "topics": ["erlang", "release"],
   "locations": [{"kind": "remote", "endpoint": "http://127.0.0.1:18082",
                  "db": "otp_sasl"}]}'
```

```json
{"id": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl", "type": "context_card",
 "discoverable": "listed", "format": 1, "title": "OTP sasl", "topics": ["erlang", "release"],
 "locations": [{"db": "otp_sasl", "endpoint": "http://127.0.0.1:18082", "kind": "remote"}]}
```

À partir de là, vous pouvez utiliser le nom `otp/sasl` ou l’id partout. Les
fiches ne contiennent jamais de secrets ; les jetons des serveurs distants vivent
dans la configuration du nœud :

```erlang
{barrel, [{ctx_credentials, #{<<"http://127.0.0.1:18082">> => <<"token">>}}]}
```

## Savoir à quoi peut ressembler une requête

Appelez `context_capabilities` (REST : `GET /contexts/_capabilities`) avant une
première requête.

```json
{"name": "context_capabilities", "arguments": {}}
```

```json
{"shapes": [
   {"shape": "ordered_rows", "requires": ["LIMIT n", "ORDER BY a selected field"], "merge": "ordered",
    "example": "SELECT id, path, lines FROM c WHERE lines > 300 ORDER BY lines DESC LIMIT 10"},
   {"shape": "unordered_rows", "requires": ["LIMIT n"], "merge": "grouped", "...": "..."},
   {"shape": "retrieval", "functions": ["bm25_top_k", "vector_top_k", "hybrid_top_k"],
    "merge": "grouped; vector_top_k is merged by score when every context reports the same embedding",
    "example": "SELECT b.id, b.path, b._score FROM bm25_top_k('release upgrade', k => 5) AS b"}],
 "bql": "Strings use single quotes ('text'); double quotes name fields. The collection alias is free (FROM c).",
 "limits": {"max_contexts": 8, "max_limit": 1000,
            "deadline_ms": {"default": 5000, "max": 60000},
            "per_context_timeout_ms": {"default": 4000, "max": 60000},
            "max_parallel": {"default": 8, "max": 16}},
 "refused_merges": {"rrf": "rank fusion over disjoint corpora is not a relevance order",
                    "rerank": "no validated reranker yet"},
 "rejected": ["SUBSCRIBE", "OFFSET", "UNNEST", "continuation"],
 "offline": false, "...": "..."}
```

## Trouver un contexte

`context_list` renvoie toutes les fiches listées ; `context_discover` garde les
fiches où chaque mot de `q` apparaît dans le nom, le titre, la description ou les
sujets ; `context_inspect` lit une fiche par nom ou par id.

```json
{"name": "context_discover", "arguments": {"q": "release"}}
```

```json
{"contexts": [{"id": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl", "...": "..."}],
 "summary": "1 context matches 'release': otp/sasl. A filter, not a ranking: other contexts may still hold answers."}
```

Un nom mal saisi renvoie les noms les plus proches :

```json
{"name": "context_inspect", "arguments": {"context": "otp/sasll"}}
```

```json
{"error": "unknown_context",
 "message": "No context has the id or name otp/sasll.",
 "hint": "Did you mean: otp/sasl? context_list (GET /contexts) shows every context.",
 "details": {"context": "otp/sasll",
             "suggestions": [{"id": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl"}]}}
```

## Interroger plusieurs contextes

`context_query` (REST : `POST /contexts/_query`) prend une instruction et les
contextes par leur nom. Les lignes sont fusionnées dans l’ordre quand
l’instruction a un `ORDER BY` sur un champ sélectionné et un `LIMIT` :

```json
{"name": "context_query",
 "arguments": {"query": "SELECT id, path, lines FROM c WHERE lines > 300 ORDER BY lines DESC LIMIT 10",
               "contexts": ["otp/tools", "otp/sasl", "otp/eunit"]}}
```

```json
{"execution": "succeeded", "merge": "ordered",
 "summary": "All 3 contexts answered (otp/tools, otp/sasl, otp/eunit). 10 rows are merged across contexts in ORDER BY order. otp/tools filled the LIMIT or k; more matches may exist.",
 "rows": [
   {"_ctx": "ctx_uuojp36sme7ym4pjb2faocuo", "_ctx_name": "otp/tools", "id": "fprof", "lines": 3631, "path": "tools-4.2.1/src/fprof.erl"},
   {"_ctx": "ctx_uuojp36sme7ym4pjb2faocuo", "_ctx_name": "otp/tools", "id": "cover", "lines": 3120, "path": "tools-4.2.1/src/cover.erl"},
   {"_ctx": "ctx_5loieq7q3hdaxluhwkklz5px", "_ctx_name": "otp/sasl", "id": "release_handler", "lines": 3092, "path": "sasl-4.4/src/release_handler.erl"},
   "..."],
 "sources": [
   {"context": "ctx_uuojp36sme7ym4pjb2faocuo", "name": "otp/tools", "status": "ok", "rows": 10,
    "bound": "limit_reached", "retrieval": "exact", "membership": "live",
    "location": {"kind": "local", "db": "otp_tools"},
    "version": {"kind": "live", "observed": {"instance_id": "19ab40285574d671", "last_seq": "AAABoNO_U7sAAAAE"}}},
   {"context": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl", "status": "ok", "rows": 8,
    "bound": "exhausted", "bytes": 753, "...": "..."},
   "..."],
 "coverage": {"requested": 3, "answered": 3, "failed": 0, "skipped": 0, "missing": [],
              "scope_origin": "explicit"}}
```

La récupération (`bm25_top_k`, `hybrid_top_k`) revient groupée par contexte :

```json
{"name": "context_query",
 "arguments": {"query": "SELECT b.id, b.path, b._score FROM bm25_top_k('release upgrade', k => 3) AS b",
               "contexts": ["otp/tools", "otp/sasl", "otp/eunit"]}}
```

```json
{"execution": "succeeded", "merge": "grouped", "relevance": false,
 "summary": "All 3 contexts answered (otp/tools, otp/sasl, otp/eunit). Results are grouped per context because BM25 scores are not comparable across contexts. otp/tools, otp/sasl filled the LIMIT or k; more matches may exist.",
 "groups": [
   {"context": "ctx_uuojp36sme7ym4pjb2faocuo", "name": "otp/tools",
    "rows": [{"id": "xref", "_score": 2.798410656725898, "...": "..."}, "..."]},
   {"context": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl",
    "rows": [{"id": "systools_relup", "_score": 5.142367995611812, "...": "..."}, "..."]},
   {"context": "ctx_zuepupiv6vxtzjlqz2cszqsv", "name": "otp/eunit", "rows": []}],
 "...": "..."}
```

Une instruction qui ne peut pas s’exécuter sur plusieurs contextes est refusée
avant qu’aucun contexte ne soit contacté, avec la correction dans `hint` :

```json
{"name": "context_query", "arguments": {"query": "SELECT * FROM c ORDER BY path", "contexts": ["otp/tools"]}}
```

```json
{"error": "limit_required",
 "message": "A row query over contexts needs a LIMIT.",
 "hint": "Add LIMIT n (n <= 1000), and ORDER BY a selected field to merge rows in order.",
 "details": {"max_limit": 1000}}
```

## Lire une réponse

Lisez d’abord `summary` ; les champs portent les mêmes faits pour un programme.

| Champ | Signification |
|---|---|
| `summary` | Un paragraphe : qui a répondu, pourquoi les autres ne l’ont pas fait, comment les lignes ont été fusionnées, ce que couvrent les copies locales. |
| `execution` | `succeeded` (chaque contexte a répondu), `partial`, ou `failed` (aucun n’a répondu ; MCP positionne `isError`). |
| `merge` | `ordered` (lignes selon la clé d’ORDER BY), `grouped` (un groupe par contexte), `interleave` (tour à tour, pas un classement), `score` (scores vectoriels, même embedding). |
| `rows[]._ctx`, `_ctx_name` | Le contexte d’où vient une ligne, id et nom. Les réponses groupées portent `context` et `name` par groupe. |
| `relevance` | Récupération seulement : `true` quand les lignes suivent un seul ordre de pertinence entre contextes, `false` sinon. |
| `merge_fallback` | Présent quand une fusion par score `vector_top_k` n’a pas été possible ; dit pourquoi et pour quel contexte. |
| `sources[].status` | `ok`, `timeout`, `unreachable`, `unauthorized`, `error`, `skipped_budget`, `skipped_offline`. |
| `sources[].error` | Quand ce n’est pas `ok` : `reason` (un code), `message` (ce qui s’est passé), `hint` (quoi faire). |
| `sources[].bound` | `limit_reached` : le contexte a atteint LIMIT ou k, d’autres lignes peuvent exister. `exhausted` : il a renvoyé tout ce qui correspondait. |
| `sources[].membership` | Ce que couvre la réponse : `live` (la base actuelle), `retrieved_set` (seulement la tranche enregistrée), `complete_generation` (un snapshot importé complet). |
| `sources[].version` | `live` avec `observed` (id d’instance et dernière séquence après la requête, un indice de fraîcheur), `generation`, `retrieved_set`, ou `unknown`. |
| `sources[].retrieval` | `exact` (lignes, BM25) ou `approximate` (ANN : vecteur, hybride). |
| `coverage` | Des comptes, et `missing` : les contextes dont les lignes ne sont pas dans la réponse. |

Les lignes d’un contexte en échec ne sont jamais renvoyées, même celles reçues
avant l’échec.

## Quand un contexte ne répond pas

Avec le nœud R2 arrêté, la même requête ordonnée répond à partir des deux
autres :

```json
{"execution": "partial",
 "summary": "2 of 3 contexts answered; rows from the others are not included. otp/eunit: the server did not accept the connection (econnrefused). 10 rows are merged across contexts in ORDER BY order. otp/tools filled the LIMIT or k; more matches may exist.",
 "sources": ["...", "...",
   {"context": "ctx_zuepupiv6vxtzjlqz2cszqsv", "name": "otp/eunit", "status": "unreachable", "rows": 0,
    "error": {"reason": "econnrefused",
              "message": "the server did not accept the connection (econnrefused)",
              "hint": "Check that the remote node is up; to answer without it, attach and materialize or import a local copy.",
              "rows_received_before_failure": 0}}],
 "...": "..."}
```

## Enregistrer des résultats localement

Un ensemble de travail est la liste des contextes avec lesquels vous travaillez.
`context_attach` sans `working_set` en crée un ; gardez son id. Attacher ne
copie rien.

```json
{"name": "context_attach", "arguments": {"context": "otp/tools"}}
{"name": "context_attach", "arguments": {"working_set": "ws_gbwtzhbgsbbzl7mpwrx2dnqq", "context": "otp/sasl"}}
```

```json
{"id": "ws_gbwtzhbgsbbzl7mpwrx2dnqq",
 "summary": "Working set ws_gbwtzhbgsbbzl7mpwrx2dnqq has 2 members. otp/tools: local database otp_tools, live. otp/sasl: remote, queried over the network (not offline). Offline, 1 of 2 can answer. Local copies use 0 of 1073741824 bytes.",
 "members": [
   {"context": "ctx_uuojp36sme7ym4pjb2faocuo", "name": "otp/tools", "mode": "local",
    "local_db": "otp_tools", "membership": "live", "answers_offline": true, "version": {"kind": "live"}},
   {"context": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl", "mode": "remote",
    "location": {"endpoint": "http://127.0.0.1:18082", "db": "otp_sasl"},
    "membership": "live", "answers_offline": false, "version": {"kind": "live"}}],
 "usage": {"bytes": 0}, "...": "..."}
```

`context_materialize` enregistre ce que renvoie une requête : une tranche figée
par contexte, qui contient exactement les documents dont la requête a renvoyé
les ids. Sans `working_set`, il en crée un.

```json
{"name": "context_materialize",
 "arguments": {"working_set": "ws_gbwtzhbgsbbzl7mpwrx2dnqq",
               "from_query": {"query": "SELECT b.id FROM bm25_top_k('test', k => 5) AS b",
                              "contexts": ["otp/eunit"]},
               "include": {"embeddings": false}}}
```

```json
{"working_set": "ws_gbwtzhbgsbbzl7mpwrx2dnqq",
 "summary": "Working set ws_gbwtzhbgsbbzl7mpwrx2dnqq: saved 5 documents from otp/eunit (878 bytes) into wslice_gbwtzhbg_zuepupiv.",
 "slices": [{"context": "ctx_zuepupiv6vxtzjlqz2cszqsv", "name": "otp/eunit", "status": "complete",
             "docs": 5, "bytes": 878, "local_db": "wslice_gbwtzhbg_zuepupiv",
             "derived": {"from": "ctx_zuepupiv6vxtzjlqz2cszqsv", "selection": "ids",
                         "observed": {"instance_id": "980522d2a4ed1af5", "last_seq": "AAABoNO_WLoAAAAH"},
                         "...": "..."}}],
 "usage": {"bytes": 878, "budget_bytes": 1073741824}}
```

Un contexte déjà présent dans l’ensemble de travail doit d’abord être détaché. La
taille est vérifiée par rapport au budget avant toute écriture.

## Travailler hors ligne

Passez le nœud hors ligne avec `context_offline` (REST :
`PUT /contexts/_offline`), ou passez `"offline": true` sur une seule requête.
Interrogez l’ensemble de travail par son id au lieu de lister des contextes :

```json
{"name": "context_offline", "arguments": {"offline": true}}
{"name": "context_query",
 "arguments": {"query": "SELECT id, path, lines FROM c ORDER BY lines DESC LIMIT 50",
               "working_set": "ws_gbwtzhbgsbbzl7mpwrx2dnqq"}}
```

```json
{"execution": "partial",
 "summary": "2 of 3 contexts answered; rows from the others are not included. otp/sasl: skipped: offline and no local copy. 21 rows are merged across contexts in ORDER BY order. otp/eunit answered from a saved slice: answers cover only the 5 saved documents, not the source context.",
 "sources": [
   {"name": "otp/tools", "status": "ok", "membership": "live", "rows": 16, "...": "..."},
   {"name": "otp/sasl", "status": "skipped_offline", "rows": 0,
    "error": {"reason": "no_local_copy", "message": "skipped: offline and no local copy",
              "hint": "Materialize a slice or import a snapshot while online to answer offline."}},
   {"name": "otp/eunit", "status": "ok", "membership": "retrieved_set", "rows": 5,
    "version": {"kind": "retrieved_set", "observed": {"instance_id": "980522d2a4ed1af5", "last_seq": "AAABoNO_WLoAAAAH"}},
    "location": {"kind": "local", "db": "wslice_gbwtzhbg_zuepupiv"},
    "note": "answers cover only the 5 saved documents, not the source context"}],
 "...": "..."}
```

Les contextes distants ne sont jamais contactés hors ligne, et rien n’est
téléchargé à leur place. Enregistrer depuis un contexte distant hors ligne est
refusé :

```json
{"error": "offline",
 "message": "The node is offline and this operation needs a remote source.",
 "hint": "Switch offline mode off (context_offline or PUT /contexts/_offline {\"offline\": false}) and retry.",
 "details": {"operation": "materialize", "remote_contexts": ["ctx_5loieq7q3hdaxluhwkklz5px"]}}
```

## Importer un snapshot

Un éditeur exporte une base sous forme de répertoire avec sommes de contrôle
(une étape d’opérateur en Erlang ; la base est fermée pendant la copie) :

```erlang
barrel_ctx_export:export(<<"otp_sasl">>, "/srv/export_sasl_g1",
                         #{owner => barrel_server,
                           context => <<"ctx_5loieq7q3hdaxluhwkklz5px">>,
                           generation => 1}).
```

Sur le nœud qui interroge, `context_import` (REST : `POST /worksets/:ws/_import`)
vérifie la copie, l’ouvre en lecture seule et l’ajoute à un ensemble de travail
(un nouveau quand `working_set` est omis) :

```json
{"name": "context_import", "arguments": {"dir": "$WORK/export_sasl_g1"}}
```

```json
{"id": "ws_rtjdds5plowqawmuvsanzekg",
 "summary": "Working set ws_rtjdds5plowqawmuvsanzekg has 1 member. otp/sasl: imported snapshot, generation 1. Offline, 1 of 1 can answer. Local copies use 1899476 of 1073741824 bytes.",
 "members": [{"context": "ctx_5loieq7q3hdaxluhwkklz5px", "name": "otp/sasl", "mode": "snapshot",
              "generation": 1, "local_db": "wsnap_5loieq7q_1", "membership": "complete_generation",
              "answers_offline": true, "version": {"kind": "generation", "generation": 1},
              "bytes": 1899476}],
 "...": "..."}
```

Interrogé hors ligne, il répond en tant que cette génération :

```json
{"summary": "otp/sasl answered. 17 rows in ORDER BY order. otp/sasl answered from an imported snapshot (generation 1).", "...": "..."}
```

## Nettoyer

```json
{"name": "context_detach", "arguments": {"working_set": "ws_gbwtzhbgsbbzl7mpwrx2dnqq", "context": "otp/eunit"}}
{"name": "context_working_sets", "arguments": {}}
{"name": "context_working_set_delete", "arguments": {"working_set": "ws_rtjdds5plowqawmuvsanzekg"}}
```

```json
{"working_sets": [
   {"id": "ws_gbwtzhbgsbbzl7mpwrx2dnqq", "members": [{"name": "otp/tools", "mode": "local", "...": "..."},
                                                   {"name": "otp/sasl", "mode": "remote", "...": "..."}], "...": "..."},
   {"id": "ws_rtjdds5plowqawmuvsanzekg", "members": [{"name": "otp/sasl", "mode": "snapshot", "...": "..."}], "...": "..."}]}
{"ok": true, "deleted": "ws_rtjdds5plowqawmuvsanzekg"}
```

Détacher une tranche la supprime ; supprimer un ensemble de travail supprime ses
tranches. Les snapshots importés restent sur le disque.

## Les mêmes opérations via REST et Erlang

Les noms de champs sont les mêmes sur les trois surfaces. Les outils MCP qui
prennent `working_set` en créent un si vous l’omettez ; REST le nomme dans le
chemin, et Erlang prend `new`.

| Outil MCP | REST | Erlang (`barrel_ctx`) |
|---|---|---|
| `context_capabilities` | `GET /contexts/_capabilities` | `capabilities/0` |
| `context_list` | `GET /contexts` (`?prefix=`, `?unlisted=true`) | `list/1` |
| `context_discover` | `GET /contexts?q=` | `discover/2` |
| `context_inspect` | `GET /contexts/:id` (un nom encodé en URL : `otp%2Fsasl`) | `inspect/1` |
| (enregistrement) | `POST /contexts`, `DELETE /contexts/:id` | `register/1`, `update/2`, `unregister/1` |
| `context_query` | `POST /contexts/_query` | `query/1` |
| `context_attach` | `POST /worksets`, `POST /worksets/:ws/members` | `create_ws/1`, `attach/3` |
| `context_detach` | `DELETE /worksets/:ws/members/:ctx` | `detach/2` |
| `context_materialize` | `POST /worksets/:ws/_materialize` | `materialize/2` |
| `context_import` | `POST /worksets/:ws/_import` | `import/3` |
| `context_working_sets` | `GET /worksets`, `GET /worksets/:ws` | `list_ws/0`, `get_ws/1` |
| `context_working_set_delete` | `DELETE /worksets/:ws` | `delete_ws/1` |
| `context_offline` | `GET` et `PUT /contexts/_offline` | `offline/0`, `set_offline/1` |

Erlang renvoie `{error, {Code, Details}}` avec les codes ci-dessous ;
`barrel_ctx_error:to_map/1` donne le corps JSON.

## Erreurs

Chaque erreur a une seule forme sur REST et MCP :
`{"error": code, "message": one sentence, "hint": what to do next, "details": {...}}`.

| Code | HTTP | Quand | Que faire |
|---|---|---|---|
| `invalid_argument` | 400 | Un champ manque, est inconnu, ou a un mauvais type ou une mauvaise valeur ; `details.field`, `expected`, `allowed` ou `accepted`. | Corrigez ce champ. |
| `invalid_query` | 400 | L’instruction ne s’analyse pas ; `details.bql_error`. | Les chaînes utilisent des guillemets simples. |
| `limit_required` | 400 | Une requête de lignes n’a pas de LIMIT. | Ajoutez `LIMIT n` (n <= `details.max_limit`). |
| `limit_too_large` | 400 | LIMIT ou k au-dessus de 1000. | Baissez-le ; restreignez la clause WHERE. |
| `too_many_contexts` | 400 | Plus de `details.max_contexts` contextes. | Découpez la requête. |
| `duplicate_context` | 400 | Un contexte listé deux fois (un nom et son id comptent pour un). | Listez-le une seule fois. |
| `unsupported_federated_query` | 400 | OFFSET, SUBSCRIBE, UNNEST, une continuation, ORDER BY sur un champ non sélectionné, fusion ordonnée sans ORDER BY ; `details.reason`, `accepted_shapes`. | Réécrivez sous une forme acceptée. |
| `merge_not_allowed` | 400 | Une fusion qui ne convient pas à l’instruction (`score` sur des lignes ou BM25, `ordered` sur une récupération). | Ne précisez pas `merge`. |
| `merge_not_supported` | 400 | `rrf` ou `rerank`. | Ne précisez pas `merge` ou utilisez `interleave`. |
| `scores_not_comparable` | 400 | `merge: score` sur des contextes aux embeddings différents ; `details.context`. | Ne précisez pas `merge` (groupé). |
| `unknown_context` | 404 | Aucun contexte n’a cet id ou ce nom ; `details.suggestions`. | Utilisez un nom suggéré, ou `context_list`. |
| `ambiguous_context` | 409 | Plusieurs fiches partagent ce nom ; `details.candidates`. | Passez l’un des ids. |
| `unknown_working_set` | 404 | Cet ensemble de travail n’existe pas ; `details.known`. | `context_working_sets`, ou omettez `working_set`. |
| `not_attached` | 404 | Détachement d’un contexte qui n’est pas membre. | Lisez l’ensemble de travail. |
| `already_attached` | 409 | Attachement ou matérialisation d’un contexte déjà dans l’ensemble de travail. | Détachez-le d’abord. |
| `already_exists` | 409 | Un id de fiche, ou un nom d’import, est déjà pris. | Omettez l’id, ou passez un autre `name`. |
| `invalid_card` | 400 | Une fiche sans nom ni emplacements, avec un secret, ou avec un emplacement invalide ; `details.reason`. | Corrigez la fiche. |
| `no_location` | 400 | `mode` demande un emplacement que la fiche n’a pas. | Omettez `mode`. |
| `over_budget` | 413 | Un budget d’ensemble de travail (`bytes`, `contexts`, `transfer_bytes`) ou `max_bytes` est dépassé ; `details.needed`, `available` ou `limit`. | Détachez, sélectionnez moins, ou augmentez le budget. |
| `offline` | 409 | Matérialisation depuis un contexte distant hors ligne. | Repassez d’abord en ligne. |
| `invalid_snapshot` | 400 | Le répertoire d’import n’a pas de manifeste lisible ou une somme de contrôle échoue. | Passez le répertoire écrit par un export. |
| `source_unavailable` | 502 | Une source n’a pas livré les documents à enregistrer (signalé par tranche). | Réessayez quand la source est joignable. |
| `forbidden` | 403 | Un jeton de capacité sur les ensembles de travail, les imports ou le mode hors ligne. | Utilisez un jeton global. |
| `internal` | 500 | Tout le reste ; `details.detail`. | Consultez le journal du serveur. |

Un contexte qui ne répond pas n’est pas une erreur de requête : la requête
répond, et l'`error` de la source a un `reason`, un `message` et un `hint`
(`econnrefused`, `deadline`, `no_local_copy`, `db_not_found`,
`embedder_not_configured`, `node_remote_limit`, ...).

## Notes

- **Pas de pagination.** Un contexte renvoie au plus LIMIT ou k (plafond 1000).
  `bound: limit_reached` signifie qu’il faut restreindre le prédicat ou augmenter
  la limite.
- **Discover est un filtre.** Il ne classe rien ; un contexte qu’il ne renvoie
  pas peut tout de même contenir des réponses.
- **Scores.** Les scores BM25, hybrides et RRF ne sont jamais fusionnés entre
  contextes. `vector_top_k` fusionne par score quand chaque contexte annonce la
  même empreinte d’embedding et la distance cosinus ; sinon il revient au mode
  groupé et dit pourquoi dans `merge_fallback`.
- **Permissions.** L’enregistrement, les ensembles de travail, les imports et le
  mode hors ligne nécessitent l’authentification globale. Un jeton de capacité
  peut lister les fiches et interroger les contextes ; chaque contexte local est
  vérifié comme un `POST /db/:db/query` sur cette base. Un droit `read` sur une
  source permet aussi de copier (materialize utilise `_bulk_get`).
- **Les tranches sont figées** et ne couvrent que les documents enregistrés. Une
  tranche d’une source ordinaire (hors mode enregistrement) contient des
  documents, pas des vecteurs : les requêtes de lignes fonctionnent dessus, la
  recherche BM25 et vectorielle ne trouve rien.
- **Les exports** refusent une base en mode enregistrement dont la politique
  persistée contient une clé d’API ou un autre secret.
