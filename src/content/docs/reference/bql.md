---
title: BQL reference
description: The BQL grammar surface, a quick reference for the syntax and the search table functions.
---

BQL is Barrel's query language, a PartiQL dialect over documents, vectors, and
keyword search. This is the syntax reference. For worked examples and semantics,
read the [querying guide](/docs/guides/query-bql).

## Statement shape

```sql
SELECT <projection>
FROM <source>
WHERE <predicate>
ORDER BY <one key> [ASC|DESC]
LIMIT <n> OFFSET <n>
[SUBSCRIBE]
```

`FROM db` scans the current database. You can also select from a search table
function (below). `ORDER BY` takes a single key.

## Paths

Reference document fields by path: `d.title`, `d.author.name`, `d.tags[0]`. Quote
keys that are not identifiers: `d."full name"`. A `WHERE id = '...'` becomes a
primary-key scan.

## Operators

`=`, `!=`, `<`, `<=`, `>`, `>=`, `IN`, `LIKE`, `BETWEEN`, `IS NULL`,
`IS NOT NULL`, `IS MISSING`, `CONTAINS()`, combined with `AND`, `OR`, `NOT`.

## Parameters

Bind values with `$name` and pass them to `query/3`:

```erlang
barrel:query(Db, <<"SELECT id FROM db WHERE kind = $k">>, #{params => #{k => <<"note">>}}).
```

## UNNEST

Expand one array into rows:

```sql
SELECT t FROM db UNNEST(d.tags) AS t
```

## Search table functions

Use a search function as the `FROM` source. Each takes a query string and `k`,
and exposes a `_score` column:

```sql
SELECT id, _score FROM vector_top_k('edge sync', k => 5) AS v
SELECT id, _score FROM bm25_top_k('edge sync', k => 5) AS b
SELECT id, _score FROM hybrid_top_k('edge sync', k => 5) AS h
```

`vector_top_k` and `hybrid_top_k` need an embedder configured; `bm25_top_k` needs
a BM25 backend enabled at open.

## Live queries

Append `SUBSCRIBE` to stream matches as they change (Server-Sent Events over
HTTP). v1 scope: no joins, no `GROUP BY`, no `[*]` wildcards; the table functions,
`UNNEST`, `ORDER BY`, and `OFFSET` do not combine with `SUBSCRIBE`.
