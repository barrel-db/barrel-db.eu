---
title: Requetes avec BQL
description: Interrogez les documents, la recherche vectorielle et la recherche par mot-cle avec une seule instruction SELECT, y compris les abonnements en direct et l'acces HTTP.
---

BQL est le langage de requete de barrel, un dialecte PartiQL (du SQL pour JSON) :
une seule instruction SELECT interroge les documents, la recherche vectorielle et
la recherche par mot-cle, avec des abonnements en direct. Lisez ceci quand vous
voulez interroger barrel avec une chaine de requete au lieu des maps de
specification structurees de `find/2`, ou quand vous voulez que les resultats
vectoriels et BM25 soient rattaches a leurs documents.

## Quand l'utiliser

- Vous voulez une seule surface de requete : filtres, projections, recuperation
  top-k vectorielle ou par mot-cle, et mises a jour en direct avec la meme
  syntaxe.
- Vous pilotez barrel via HTTP et voulez envoyer une chaine de requete.
- Pour construire des requetes par programme, l'API de specification structuree
  `barrel:find/2` reste de premier ordre ; BQL se compile sur le meme moteur.

## Lancer une requete

```erlang
{ok, Db} = barrel:open(mydb),

{ok, Rows, Meta} = barrel:query(Db,
    <<"SELECT title, author.name AS who "
      "FROM db "
      "WHERE type = 'post' AND rank >= 3 "
      "ORDER BY title LIMIT 10">>),

%% named parameters
{ok, Rows2, _} = barrel:query(Db,
    <<"SELECT * FROM db WHERE org = $org">>,
    #{params => #{<<"org">> => <<"acme">>}}).
```

Les lignes sont des maps : `<<"id">>` plus vos projections (`SELECT *` renvoie le
document entier aplati). Un attribut absent laisse sa cle absente de la ligne. Les
utilisateurs docdb embarques obtiennent les memes requetes de document a travers
`barrel_docdb:query/2,3`.

Les requetes sans ORDER BY, UNNEST ni LIMIT sont diffusees par morceaux : passez
`chunk_size` et suivez `Meta` (`has_more`, `continuation`), ou repliez sans
materialiser :

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

- Le nom du FROM est la variable de portee ; la base de donnees vient de l'appel
  d'API. `AS d` est optionnel ; sans lui le nom du FROM est l'alias.
- Chemins : `d.a.b`, index de tableau `d.tags[0]`, cles entre guillemets
  `d."a key"`. Les mots-cles sont acceptes apres un point (`d.order`). Les champs
  de premier niveau prefixes par `_` sont reserves et rejetes.
- Operateurs : `=`, `!=`, `<`, `<=`, `>`, `>=`, `IN (..)`, `LIKE`,
  `BETWEEN a AND b`, `IS [NOT] NULL`, `IS [NOT] MISSING`,
  `CONTAINS(path, value)`, `AND`, `OR`, `NOT`. Les comparaisons ne correspondent
  qu'entre valeurs de meme type (deux nombres ou deux chaines).
- Les parametres `$name` lient des scalaires depuis la map `params`.
- `WHERE id = 'x'`, les plages d'id, et `id LIKE 'prefix%'` deviennent des
  balayages de cle primaire.
- ORDER BY prend une seule cle ; les valeurs absentes se trient apres les nombres
  et les chaines.

L'egalite, les plages, `LIKE 'prefix%'`, `IS NOT MISSING`, et leurs combinaisons
AND utilisent les index de chemin. `OR`, `IN`, `NOT`, `LIKE` en forme d'expression
reguliere, `IS NULL`, `IS MISSING` et `CONTAINS` font un balayage ;
`explain_query` liste un avertissement `{full_scan, _}` pour chacun :

```erlang
{ok, #{engine := #{strategy := Strategy}, warnings := Warnings}} =
    barrel:explain_query(Db, <<"SELECT * FROM db WHERE a = 1 OR b = 2">>).
```

### MISSING contre NULL

PartiQL distingue un `null` stocke d'un attribut absent :

- `a IS MISSING` : l'attribut est absent.
- `a IS NULL` : l'attribut est `null` OU absent.
- `a = NULL` ne correspond jamais et est rejete ; utilisez les formes ci-dessus.

## UNNEST des tableaux

`UNNEST` produit une ligne par element de tableau ; l'element obtient son propre
alias, utilisable dans WHERE, SELECT et ORDER BY. Les valeurs vides, absentes ou
non-tableaux ne produisent aucune ligne.

```sql
SELECT d.title, t AS tag
FROM db AS d, UNNEST(d.tags) AS t
WHERE d.type = 'post' AND t = 'erlang'
```

Les predicats sur l'element sont evalues par ligne ; les predicats sur le document
lui-meme utilisent toujours les index.

## Fonctions de table de recherche

La recherche vectorielle et par mot-cle entrent dans le langage comme sources
FROM. L'alias est requis ; chaque fonction prend une chaine de requete (ou un
`$param`) et des options nommees.

```sql
SELECT v._score, title FROM vector_top_k('rust orm', k => 10) AS v
SELECT m._score, title FROM bm25_top_k('rust', k => 10) AS m
SELECT h._score, title FROM hybrid_top_k('rust orm', k => 10) AS h
WHERE h.lang = 'en'
```

- `k` vaut 10 par defaut ; `vector_top_k` prend aussi `ef_search`.
- `hybrid_top_k` fusionne les branches vectorielle et BM25 avec RRF.
- Les resultats sont rattaches a leurs documents par id ; les resultats dont le
  document a disparu sont ecartes. Sur les bases de donnees en mode enregistrement,
  l'embedding du texte de requete est calcule par l'embedder de la base de
  donnees.
- `_score` est specifique a la fonction (1 - distance, BM25 brut, fusion RRF) et
  n'est pas comparable entre fonctions. Les lignes de `vector_top_k` portent aussi
  `_distance`. Les deux sont uniquement des colonnes SELECT et ORDER BY.
- Un WHERE filtre les resultats apres recuperation : barrel sur-recupere une fois
  (3x `k`, plafonne a 1000) et renvoie JUSQU'A `k` lignes ; un filtrage lourd peut
  en renvoyer moins. L'ordre par defaut est le rang de recherche.

## Requetes en direct

Ajoutez `SUBSCRIBE` et abonnez-vous au lieu de lancer : vous obtenez
l'instantane, puis des deltas d'ajout/modification/retrait a mesure que des
documents commencent ou cessent de correspondre.

```erlang
{ok, Sub} = barrel:subscribe_query(Db,
    <<"SELECT name FROM db WHERE status = 'active' SUBSCRIBE">>),
#{ref := Ref} = Sub,
receive {bql_rows, Ref, Rows} -> Rows end,
receive {bql_ready, Ref, #{count := N}} -> N end,
%% then, per matching write:
%% {bql_change, Ref, #{action := add | change, id, rev, row}}
%% {bql_change, Ref, #{action := remove, id}}
ok = barrel:unsubscribe_query(Sub).
```

- LIMIT ne plafonne que l'instantane initial ; les deltas sont non bornes.
- Les fonctions de table, UNNEST, ORDER BY et OFFSET ne se combinent pas avec
  SUBSCRIBE.
- La requete s'arrete quand vous vous desabonnez ou quand le processus
  proprietaire meurt. La detection des retraits suit le flux de changements,
  attendez-la donc dans son intervalle de polling (environ 100 ms).

## Via HTTP

`POST /db/:db/query` prend le texte BQL comme corps (ou du JSON
`{"query", "params", "continuation"}`) et diffuse du ndjson : une ligne
`{"row": ...}` par ligne, puis une ligne `{"meta": ...}` avec `has_more` et un
jeton `continuation` a renvoyer par POST. Les erreurs de requete sont un 400 avec
`message`, `line` et `column`.

```sh
curl -s http://localhost:8080/db/mydb/query \
  -d "SELECT title FROM db WHERE type = 'post' LIMIT 3"
{"row":{"id":"post:1","title":"..."}}
{"row":{"id":"post:2","title":"..."}}
{"row":{"id":"post:3","title":"..."}}
{"meta":{"has_more":false}}
```

Les instructions SUBSCRIBE necessitent `Accept: text/event-stream` (ou un
EventSource de navigateur sur `GET /db/:db/query?q=...`) et diffusent des
evenements `row`, `ready`, `change` et `error` avec un `ping` periodique.

## Notes

- Portee v1 : SELECT, WHERE, ORDER BY (une cle), LIMIT/OFFSET, UNNEST (un), les
  trois fonctions de table, SUBSCRIBE. Pas de jointures, pas de GROUP BY, pas de
  chemins joker `[*]` (utilisez UNNEST).
- ORDER BY, UNNEST et LIMIT/OFFSET materialisent leur resultat (borne) avant de
  repondre ; les filtres simples sont diffuses en flux.
- Un `SELECT` de projections etroites lit quand meme les documents entiers ; la
  projection a lieu apres la recuperation.
