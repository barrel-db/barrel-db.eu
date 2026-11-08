---
translation_of: src/content/docs/reference/bql.md
source_hash: "a53be665d667f49b"
title: Référence BQL
description: La grammaire BQL que Barrel implémente, les fonctions de table de recherche, les paramètres, SUBSCRIBE, et les instructions que le compilateur refuse.
---

BQL est le langage de requête de Barrel : un petit SELECT dans le style de PartiQL sur les documents, plus des fonctions de table de recherche et des requêtes en direct. Cette page est la référence de syntaxe, tirée du lexer, du parser et du compilateur de barrel_docdb. Utilisez-la pour vérifier qu’une instruction est valide ; pour des exemples complets, lisez [Interroger avec BQL](/fr/docs/guides/query-bql).

## Où une instruction s’exécute

| Appel | Exécute |
|---|---|
| `barrel:query/2,3`, `barrel:query_fold/5`, `barrel:explain_query/2,3` | Tout ce qui suit, fonctions de table comprises |
| `barrel:subscribe_query/2,3` | Les instructions `SUBSCRIBE` |
| `barrel_docdb:query/2,3` | Les documents seulement : les fonctions de table renvoient `{error, {table_fn_requires_barrel, Fn}}`, `SUBSCRIBE` renvoie `{error, {unsupported, subscribe}}` |
| `POST /db/:db/query`, MCP `query` | Tout ; `SUBSCRIBE` demande SSE en REST et `query_subscribe` en MCP |

## Forme d’une instruction

```
SELECT select_list FROM source [ [AS] alias ]
  [ , UNNEST ( path ) AS ident ]
  [ WHERE expr ]
  [ ORDER BY path [ASC | DESC] ]
  [ LIMIT int ] [ OFFSET int ]
  [ SUBSCRIBE ]
```

- `select_list` vaut `*`, ou des chemins avec un `AS name` facultatif, séparés par des virgules. L’id est toujours renvoyé.
- `source` est un nom de collection, ou une fonction de table de recherche. Le nom de collection n’est qu’un alias : la base vient de l’appel.
- `ORDER BY` prend une seule clé.

```sql
SELECT k.title, t AS tag
FROM kb AS k, UNNEST(k.tags) AS t
WHERE t LIKE 'log%'
```

## Chemins et littéraux

- Un chemin commence par un nom et continue avec `.key` ou `[index]` : `title`, `owner.name`, `labels[0]`, `t.owner.name`. N’importe quel mot-clé peut suivre un point.
- Les `"guillemets doubles"` nomment un champ : `"time spent"`. Doublez un guillemet pour l’échapper.
- Les `'apostrophes'` délimitent des chaînes ; doublez une apostrophe pour l’échapper.
- Les nombres sont des entiers ou des flottants, avec un moins unaire. `TRUE`, `FALSE` et `NULL` sont des littéraux.
- `$name` est un paramètre. `--` commence un commentaire jusqu’à la fin de la ligne.
- Les mots-clés ne tiennent pas compte de la casse.

## Prédicats

Combinez-les avec `AND`, `OR`, `NOT` et des parenthèses.

| Forme | Correspond à |
|---|---|
| `a = b`, `!=`, `<>`, `<`, `<=`, `>`, `>=` | Une comparaison entre un chemin et un littéral ou un paramètre. Des valeurs de types différents ne correspondent jamais. |
| `x IS [NOT] NULL` | Un null stocké, ou un champ absent |
| `x IS [NOT] MISSING` | Un champ absent seulement |
| `x [NOT] IN ('a', 'b')` | Un élément d’un ensemble de littéraux |
| `'a' [NOT] IN tags` | L’appartenance à un tableau ; identique à `CONTAINS` |
| `CONTAINS(tags, 'a')`, `tags CONTAINS 'a'` | Un tableau qui contient la valeur |
| `x [NOT] LIKE 'pat%'` | `%` une suite quelconque, `_` un caractère |
| `x [NOT] BETWEEN a AND b` | Un intervalle inclusif |

Sur `id`, seuls `=`, les intervalles et `LIKE 'prefix%'` (sans `%` ni `_` dans le préfixe) sont acceptés, et pas à l’intérieur d’un `OR`.

L’index de chemins sert l’égalité, les intervalles, `LIKE 'prefix%'`, `IS NOT MISSING` et leurs `AND`. `OR`, `IN`, `NOT`, les autres motifs `LIKE`, `IS NULL`, `IS MISSING` et `CONTAINS` font un parcours complet ; `explain_query` avertit alors `{full_scan, _}`.

## Paramètres

Liez `$name` avec l’option `params`. Les clés sont des binaires :

```erlang
barrel:query(Db,
    <<"SELECT id, title FROM kb WHERE product = $p">>,
    #{params => #{<<"p">> => <<"portal">>}}).
```

Un paramètre doit être un scalaire. Un paramètre manquant échoue avec `{unbound_param, Name}`. En REST, envoyez `"params": {"p": "portal"}` dans le corps JSON.

## Fonctions de table de recherche

Une fonction de table est la source du `FROM` et demande un alias. Son premier argument est le texte de la requête, sous forme de chaîne ou de paramètre ; les arguments nommés suivent avec `=>`.

```sql
SELECT v.id, v._score, title
FROM vector_top_k('replicated state machines', k => 5) AS v

SELECT b.id, b._score
FROM bm25_top_k('keyword search', k => 3) AS b
WHERE b.year > 2000

SELECT h.id, h._score
FROM hybrid_top_k($q, k => 10) AS h
ORDER BY h._score DESC
```

| Fonction | Demande | `_score` |
|---|---|---|
| `vector_top_k` | Un embedder ; accepte aussi `ef_search` | 1 moins la distance ; `_distance` est aussi disponible |
| `bm25_top_k` | Un backend BM25 | Le score BM25 |
| `hybrid_top_k` | Un embedder et un backend BM25 | La valeur RRF fusionnée |

- `k` est un entier d’au moins 1, 10 par défaut.
- La fonction récupère plus de résultats que demandé (3 fois `k` par défaut, 1000 au plus ; l’option `overfetch` de `barrel:query/3` le change), joint chaque résultat à son document, applique `WHERE`, et renvoie jusqu’à `k` lignes. Un filtre sélectif peut en renvoyer moins.
- `_score` et `_distance` peuvent être sélectionnés ou triés, jamais filtrés dans `WHERE`.

## Requêtes en direct

Ajoutez `SUBSCRIBE` pour recevoir les lignes qui correspondent, puis un message pour chaque ligne ajoutée, modifiée ou sortante.

```erlang
{ok, #{ref := Ref}} = barrel:subscribe_query(Db,
    <<"SELECT title FROM kb WHERE status = 'published' "
      "SUBSCRIBE">>).
```

Le propriétaire reçoit `{bql_rows, Ref, Rows}`, `{bql_ready, Ref, #{count, last_seq}}`, puis `{bql_change, Ref, #{action, id, rev, row}}` où `action` vaut `add`, `change` ou `remove`. `SUBSCRIBE` ne se combine pas avec une fonction de table, `UNNEST`, `ORDER BY` ou `OFFSET`.

## Pagination

Les requêtes sans `ORDER BY`, `UNNEST` ni `LIMIT` sont diffusées en flux : passez `chunk_size`, puis la `continuation` des métadonnées du résultat pour obtenir le bloc suivant. Les métadonnées portent `has_more`, `instance_id`, `last_seq`, et `count` quand la requête est matérialisée.

## Instructions refusées

Celles-ci ne figurent pas du tout dans la grammaire, ce sont donc des erreurs de syntaxe : les agrégats comme `COUNT(*)`, `GROUP BY`, les jointures, `DISTINCT`, les sous-requêtes et les fonctions dans la liste de sélection.

Le compilateur refuse celles-ci avec `{error, {invalid_query, {Line, Col}, Code}}` :

| Code | Instruction |
|---|---|
| `{unsupported, wildcard_path, use_unnest}` | Un chemin `[*]` ; utilisez `UNNEST` |
| `{unsupported, multi_key_order_by}` | `ORDER BY` avec plus d’une clé |
| `{unsupported, id_in_disjunction}`, `{unsupported, id_condition}` | Une condition sur `id` à l’intérieur d’un `OR`, ou autre que `=`, un intervalle ou un `LIKE` par préfixe |
| `score_in_where` | `_score` ou `_distance` dans `WHERE` |
| `path_to_path_comparison`, `path_between_bound` | La comparaison de deux champs |
| `{use_is_null, _}` | `= NULL` ; utilisez `IS NULL` |
| `constant_predicate` | Un prédicat sans champ |
| `{reserved_field, F}` | Un champ `_` de premier niveau, comme `_rev` |
| `{unbound_param, N}`, `{invalid_param, N}` | Un paramètre manquant ou non scalaire |
| `{alias_required, _}` | Une fonction de table ou une projection indexée sans `AS` |
| `duplicate_alias`, `duplicate_output_name` | Deux noms qui entrent en collision |
| `unknown_table_function`, `invalid_table_fn_arg` | Une fonction de table ou un argument invalide |
| `invalid_unnest_path`, `invalid_order_key` | Un chemin `UNNEST` ou une clé `ORDER BY` invalide |
| `{unsupported_with_subscribe, _}` | `SUBSCRIBE` avec une fonction de table, `UNNEST`, `ORDER BY` ou `OFFSET` |

`barrel_bql:format_error/1` transforme une erreur en texte renvoyé par REST, comme `line 1 column 13: syntax error: syntax error before: '('`.
