---
translation_of: src/content/synced/guides/query-bql.md
source_hash: "3862c26fd6ba15b8"
title: "Interroger avec BQL"
description: "BQL est le langage de requête de barrel, un dialecte de PartiQL (SQL pour JSON) : une seule instruction SELECT interroge les documents, la recherche vectorielle et la recherche par mots-clés, avec des abonnements en direct. Lisez ce guide si vous voulez interroger barrel avec une chaîne de requête plutôt qu’avec les maps de spécification structurées de find/2, ou joindre les résultats vectoriels et BM25 à leurs documents."
source: "docs/guides/query-bql.md"
---

BQL est le langage de requête de barrel, un dialecte de PartiQL (SQL pour
JSON) : une seule instruction SELECT interroge les documents, la recherche
vectorielle et la recherche par mots-clés, avec des abonnements en direct.
Lisez ce guide si vous voulez interroger barrel avec une chaîne de requête
plutôt qu’avec les maps de spécification structurées de `find/2`, ou si vous
voulez que les résultats vectoriels et BM25 soient joints à leurs documents.

## Quand l’utiliser

- Vous voulez une seule surface de requête : filtres, projections,
  récupération top-k vectorielle ou par mots-clés, et mises à jour en direct
  avec la même syntaxe.
- Vous pilotez barrel sur HTTP et voulez envoyer une chaîne de requête.
- Pour construire des requêtes par programme, l’API structurée de spécification
  `barrel:find/2` reste de premier plan ; BQL se compile sur le même moteur.

## Lancer une requête

```erlang
{ok, Db} = barrel:open(mydb),

{ok, Rows, Meta} = barrel:query(Db,
    <<"SELECT title, author.name AS who "
      "FROM db "
      "WHERE type = 'post' AND rank >= 3 "
      "ORDER BY title LIMIT 10">>),

%% paramètres nommés
{ok, Rows2, _} = barrel:query(Db,
    <<"SELECT * FROM db WHERE org = $org">>,
    #{params => #{<<"org">> => <<"acme">>}}).
```

Les lignes sont des maps : `<<"id">>` plus vos projections (`SELECT *` renvoie
le document entier aplati). Un attribut manquant laisse sa clé absente de la
ligne. Si vous embarquez seulement docdb, vous obtenez les mêmes requêtes sur
les documents via `barrel_docdb:query/2,3`.

## Savoir quel état a répondu

Chaque méta de résultat, depuis `query/2,3` et `query_fold/5`, pour les requêtes
sur collection comme pour les fonctions de table, porte la version observée de
la base : `instance_id` (l’instance de la base) et `last_seq` (sa dernière
séquence validée au moment de la requête). Deux réponses avec la même paire ont
vu le même état.

```erlang
{ok, _Rows, #{instance_id := Instance, last_seq := Seq, has_more := false}} =
    barrel:query(Db, <<"SELECT title FROM db ORDER BY title LIMIT 2">>).
%% Instance = <<"03798dac60334e1e">>, Seq = <<0,0,1,160,221,21,85,206,0,0,0,0>>
```

`barrel_bql_query:row_bound/1` vous donne le nombre maximal de lignes qu’un plan
compilé peut renvoyer : son `LIMIT`, ou `k` plafonné par `LIMIT` pour une
fonction de table (`undefined` sans l’un ni l’autre).

```erlang
{ok, Plan} = barrel_bql:compile(
    <<"SELECT * FROM vector_top_k('x', k => 20) AS v LIMIT 5">>, #{}),
5 = barrel_bql_query:row_bound(Plan).
```

## Parcourir de gros résultats en flux

Les requêtes sans ORDER BY, UNNEST ni LIMIT sont envoyées en flux par morceaux :
passez `chunk_size` et suivez `Meta` (`has_more`, `continuation`), ou faites un
fold sans tout matérialiser :

```erlang
{ok, Count, _} = barrel:query_fold(Db,
    <<"SELECT * FROM db WHERE type = 'post'">>, #{chunk_size => 100},
    fun(_Row, N) -> {ok, N + 1} end, 0).
```

## Le langage

```sql
SELECT d.title, d.author.name AS who
FROM db AS d
WHERE d.type = 'post' AND (d.rank > 3 OR d.pinned = true)
ORDER BY d.title DESC
LIMIT 10 OFFSET 20
```

- Le nom dans FROM est la variable de parcours ; la base vient de l’appel
  d’API. `AS d` est optionnel ; sans lui, le nom dans FROM sert d’alias.
- Chemins : `d.a.b`, index de tableau `d.tags[0]`, clés entre guillemets
  `d."a key"`. Les mots-clés sont acceptés après un point (`d.order`). Les
  champs de premier niveau préfixés par `_` sont réservés et rejetés.
- Opérateurs : `=`, `!=`, `<`, `<=`, `>`, `>=`, `IN (..)`, `LIKE`,
  `BETWEEN a AND b`, `IS [NOT] NULL`, `IS [NOT] MISSING`,
  `CONTAINS(path, value)`, `AND`, `OR`, `NOT`. Les comparaisons ne
  correspondent qu’entre valeurs du même type (deux nombres ou deux chaînes).
- Appartenance à un tableau : `d.tags CONTAINS 'erlang'` (infixe) et
  `'erlang' IN d.tags` testent tous deux si la liste à `d.tags` contient la
  valeur ; ils équivalent à `CONTAINS(d.tags, 'erlang')`. `IN` avec une liste
  entre parenthèses, `d.status IN ('a', 'b')`, reste une appartenance à un
  ensemble de scalaires.
- Les paramètres `$name` lient des scalaires depuis la map `params`.
- `WHERE id = 'x'`, les plages d’id et `id LIKE 'prefix%'` deviennent des
  parcours de clé primaire.
- ORDER BY prend une seule clé ; les valeurs manquantes sont triées après les
  nombres et les chaînes.

L’égalité, les plages, `LIKE 'prefix%'`, `IS NOT MISSING` et leurs combinaisons
par AND utilisent les index de chemins. `OR`, `IN`, `NOT`, les `LIKE` en forme
d’expression régulière, `IS NULL`, `IS MISSING` et `CONTAINS` font un parcours
complet ; `explain_query` liste un avertissement `{full_scan, _}` pour chacun :

```erlang
{ok, #{engine := #{strategy := Strategy}, warnings := Warnings}} =
    barrel:explain_query(Db, <<"SELECT * FROM db WHERE a = 1 OR b = 2">>).
```

### MISSING ou NULL

PartiQL distingue un `null` stocké d’un attribut absent :

- `a IS MISSING` : l’attribut est absent.
- `a IS NULL` : l’attribut vaut `null` OU est absent.
- `a = NULL` ne correspond jamais et est rejeté ; utilisez les formes
  ci-dessus.

## Dérouler des tableaux avec UNNEST

`UNNEST` produit une ligne par élément du tableau ; l’élément reçoit son propre
alias, utilisable dans WHERE, SELECT et ORDER BY. Les valeurs vides, manquantes
ou qui ne sont pas des tableaux ne produisent aucune ligne.

```sql
SELECT d.title, t AS tag
FROM db AS d, UNNEST(d.tags) AS t
WHERE d.type = 'post' AND t = 'erlang'
```

Les prédicats sur l’élément sont évalués ligne par ligne ; les prédicats sur le
document lui-même utilisent toujours les index.

## Fonctions de table de recherche

La recherche vectorielle et la recherche par mots-clés entrent dans le langage
comme sources de FROM. L’alias est obligatoire ; chaque fonction prend une
chaîne de requête (ou `$param`) et des options nommées.

```sql
SELECT v._score, title FROM vector_top_k('rust orm', k => 10) AS v
SELECT m._score, title FROM bm25_top_k('rust', k => 10) AS m
SELECT h._score, title FROM hybrid_top_k('rust orm', k => 10) AS h
WHERE h.lang = 'en'
```

- `k` vaut 10 par défaut ; `vector_top_k` accepte aussi `ef_search`.
- `hybrid_top_k` fusionne les branches vectorielle et BM25 avec RRF.
- Les résultats sont joints à leurs documents par id ; ceux dont le document a
  disparu sont écartés. Sur les bases en mode enregistrement, le texte de la
  requête est vectorisé par l’embedder de la base.
- `_score` dépend de la fonction (1 - distance, BM25 brut, fusion RRF) et n’est
  pas comparable d’une fonction à l’autre. Les lignes de `vector_top_k` portent
  aussi `_distance`. Ce sont des colonnes de SELECT et d’ORDER BY uniquement.
- Un WHERE filtre les résultats après la récupération : barrel récupère une
  fois plus large (3x `k`, plafonné à 1000) et renvoie JUSQU’À `k` lignes ; un
  filtrage fort peut en renvoyer moins. L’ordre par défaut est le rang de
  recherche.

## Requêtes en direct

Ajoutez `SUBSCRIBE` et abonnez-vous au lieu d’exécuter : vous recevez le
snapshot, puis des deltas d’ajout, de modification et de suppression quand des
documents commencent ou cessent de correspondre.

```erlang
{ok, Sub} = barrel:subscribe_query(Db,
    <<"SELECT name FROM db WHERE status = 'active' SUBSCRIBE">>),
#{ref := Ref} = Sub,
receive {bql_rows, Ref, Rows} -> Rows end,
receive {bql_ready, Ref, #{count := N}} -> N end,
%% puis, pour chaque écriture correspondante :
%% {bql_change, Ref, #{action := add | change, id, rev, row}}
%% {bql_change, Ref, #{action := remove, id}}
ok = barrel:unsubscribe_query(Sub).
```

- LIMIT plafonne seulement le snapshot initial ; les deltas ne sont pas bornés.
- Les fonctions de table, UNNEST, ORDER BY et OFFSET ne se combinent pas avec
  SUBSCRIBE.
- La requête s’arrête quand vous vous désabonnez ou quand le processus
  propriétaire meurt. La détection des suppressions passe par le flux de
  changements : attendez-la dans son intervalle de polling (environ 100 ms).

## Sur HTTP

`POST /db/:db/query` prend le texte BQL comme corps (ou du JSON
`{"query", "params", "continuation", "max_rows", "deadline_ms"}`) et renvoie un
flux ndjson : une ligne `{"row": ...}` par ligne, puis une ligne `{"meta": ...}`
avec `has_more`, `bound` (`limit_reached` ou `exhausted`), la version observée
(`instance_id`, `last_seq` en base64url) et, quand l’instruction est paginée, un
jeton `continuation` à renvoyer par POST. `max_rows` (au plus 1000) et
`deadline_ms` (au plus 300000) bornent la requête ; voir
[Borner une requête](/fr/docs/guides/rest-server#borner-une-requête-et-lire-ce-qui-a-répondu).
Les erreurs de requête sont une 400 avec `error: invalid_query`, `message`,
`line` et `column`.

```sh
curl -s http://localhost:8080/db/mydb/query \
  -d "SELECT title FROM db WHERE type = 'post' LIMIT 3"
{"row":{"id":"post:1","title":"..."}}
{"row":{"id":"post:2","title":"..."}}
{"row":{"id":"post:3","title":"..."}}
{"meta":{"bound":"limit_reached","has_more":false,"instance_id":"03798dac60334e1e","last_seq":"AAABoN0VVc4AAAAA"}}
```

Les instructions SUBSCRIBE nécessitent `Accept: text/event-stream` (ou une
EventSource de navigateur sur `GET /db/:db/query?q=...`) et envoient en flux des
événements `row`, `ready`, `change` et `error` avec un `ping` périodique.

## Notes

- Périmètre de la v1 : SELECT, WHERE, ORDER BY (une clé), LIMIT/OFFSET, UNNEST
  (un seul), les trois fonctions de table, SUBSCRIBE. Pas de jointures, pas de
  GROUP BY, pas de chemins avec joker `[*]` (utilisez UNNEST).
- ORDER BY, UNNEST et LIMIT/OFFSET matérialisent leur résultat (borné) avant de
  répondre ; les filtres simples sont envoyés en flux.
- Un `SELECT` de projections étroites lit tout de même les documents complets ;
  la projection a lieu après la lecture.
