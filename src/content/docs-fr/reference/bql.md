---
title: Reference BQL
description: La surface de grammaire BQL, une reference rapide de la syntaxe et des fonctions de table de recherche.
---

BQL est le langage de requete de Barrel, un dialecte PartiQL sur les documents,
les vecteurs et la recherche par mot-cle. Ceci est la reference de syntaxe. Pour
des exemples concrets et la semantique, lisez le
[guide des requetes](/fr/docs/guides/query-bql).

## Forme d'une instruction

```sql
SELECT <projection>
FROM <source>
WHERE <predicate>
ORDER BY <one key> [ASC|DESC]
LIMIT <n> OFFSET <n>
[SUBSCRIBE]
```

`FROM db` balaie la base de donnees courante. Vous pouvez aussi selectionner
depuis une fonction de table de recherche (ci-dessous). `ORDER BY` prend une seule
cle.

## Chemins

Referencez les champs de document par chemin : `d.title`, `d.author.name`,
`d.tags[0]`. Mettez entre guillemets les cles qui ne sont pas des identifiants :
`d."full name"`. Un `WHERE id = '...'` devient un balayage de cle primaire.

## Operateurs

`=`, `!=`, `<`, `<=`, `>`, `>=`, `IN`, `LIKE`, `BETWEEN`, `IS NULL`,
`IS NOT NULL`, `IS MISSING`, `CONTAINS()`, combines avec `AND`, `OR`, `NOT`.

## Parametres

Liez des valeurs avec `$name` et passez-les a `query/3` :

```erlang
barrel:query(Db, <<"SELECT id FROM db WHERE kind = $k">>, #{params => #{k => <<"note">>}}).
```

## UNNEST

Etendez un tableau en lignes :

```sql
SELECT t FROM db UNNEST(d.tags) AS t
```

## Fonctions de table de recherche

Utilisez une fonction de recherche comme source `FROM`. Chacune prend une chaine de
requete et `k`, et expose une colonne `_score` :

```sql
SELECT id, _score FROM vector_top_k('edge sync', k => 5) AS v
SELECT id, _score FROM bm25_top_k('edge sync', k => 5) AS b
SELECT id, _score FROM hybrid_top_k('edge sync', k => 5) AS h
```

`vector_top_k` et `hybrid_top_k` necessitent un embedder configure ; `bm25_top_k`
necessite un backend BM25 active a l'ouverture.

## Requetes en direct

Ajoutez `SUBSCRIBE` pour diffuser les correspondances a mesure qu'elles changent
(Server-Sent Events via HTTP). Portee v1 : pas de jointures, pas de `GROUP BY`, pas
de jokers `[*]` ; les fonctions de table, `UNNEST`, `ORDER BY`, et `OFFSET` ne se
combinent pas avec `SUBSCRIBE`.
