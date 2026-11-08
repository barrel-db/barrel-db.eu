---
title: BQL reference
description: The BQL grammar Barrel implements, the search table functions, parameters, SUBSCRIBE, and the statements the compiler refuses.
---

BQL is Barrel's query language: a small PartiQL-style SELECT over documents, plus search table functions and live queries. This page is the syntax reference, taken from the lexer, parser and compiler in barrel_docdb. Use it to check whether a statement is valid; for worked examples, read [Query with BQL](/docs/guides/query-bql).

## Where a statement runs

| Call | Runs |
|---|---|
| `barrel:query/2,3`, `barrel:query_fold/5`, `barrel:explain_query/2,3` | Everything below, table functions included |
| `barrel:subscribe_query/2,3` | `SUBSCRIBE` statements |
| `barrel_docdb:query/2,3` | Documents only: table functions return `{error, {table_fn_requires_barrel, Fn}}`, `SUBSCRIBE` returns `{error, {unsupported, subscribe}}` |
| `POST /db/:db/query`, MCP `query` | Everything; `SUBSCRIBE` needs SSE over REST and `query_subscribe` over MCP |

## Statement shape

```
SELECT select_list FROM source [ [AS] alias ]
  [ , UNNEST ( path ) AS ident ]
  [ WHERE expr ]
  [ ORDER BY path [ASC | DESC] ]
  [ LIMIT int ] [ OFFSET int ]
  [ SUBSCRIBE ]
```

- `select_list` is `*`, or paths with an optional `AS name`, separated by commas. The id is always returned.
- `source` is a collection name, or a search table function. The collection name is only an alias: the database comes from the call.
- `ORDER BY` takes one key.

```sql
SELECT k.title, t AS tag
FROM kb AS k, UNNEST(k.tags) AS t
WHERE t LIKE 'log%'
```

## Paths and literals

- A path starts with a name and continues with `.key` or `[index]`: `title`, `owner.name`, `labels[0]`, `t.owner.name`. Any keyword may follow a dot.
- `"double quotes"` name a field: `"time spent"`. Double a quote to escape it.
- `'single quotes'` are strings; double a quote to escape it.
- Numbers are integers or floats, with a unary minus. `TRUE`, `FALSE` and `NULL` are literals.
- `$name` is a parameter. `--` starts a comment to the end of the line.
- Keywords are case-insensitive.

## Predicates

Combine them with `AND`, `OR`, `NOT` and parentheses.

| Form | Matches |
|---|---|
| `a = b`, `!=`, `<>`, `<`, `<=`, `>`, `>=` | A comparison between a path and a literal or parameter. Values of different types never match. |
| `x IS [NOT] NULL` | A stored null, or an absent field |
| `x IS [NOT] MISSING` | An absent field only |
| `x [NOT] IN ('a', 'b')` | One of a set of literals |
| `'a' [NOT] IN tags` | Membership in an array; same as `CONTAINS` |
| `CONTAINS(tags, 'a')`, `tags CONTAINS 'a'` | An array holding the value |
| `x [NOT] LIKE 'pat%'` | `%` any run, `_` one character |
| `x [NOT] BETWEEN a AND b` | An inclusive range |

On `id`, only `=`, ranges and `LIKE 'prefix%'` (with no `%` or `_` in the prefix) are accepted, and not inside an `OR`.

The path index serves equality, ranges, `LIKE 'prefix%'`, `IS NOT MISSING` and their `AND`s. `OR`, `IN`, `NOT`, other `LIKE` patterns, `IS NULL`, `IS MISSING` and `CONTAINS` scan; `explain_query` then warns `{full_scan, _}`.

## Parameters

Bind `$name` with the `params` option. Keys are binaries:

```erlang
barrel:query(Db,
    <<"SELECT id, title FROM kb WHERE product = $p">>,
    #{params => #{<<"p">> => <<"portal">>}}).
```

A parameter must be a scalar. A missing one fails with `{unbound_param, Name}`. Over REST, send `"params": {"p": "portal"}` in the JSON body.

## Search table functions

A table function is the `FROM` source and needs an alias. Its first argument is the query text, as a string or a parameter; named arguments follow with `=>`.

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

| Function | Needs | `_score` |
|---|---|---|
| `vector_top_k` | An embedder; also takes `ef_search` | 1 minus the distance; `_distance` is also available |
| `bm25_top_k` | A BM25 backend | The BM25 score |
| `hybrid_top_k` | An embedder and a BM25 backend | The fused RRF value |

- `k` is an integer of at least 1, 10 by default.
- The function over-fetches (3 times `k` by default, at most 1000; the `overfetch` option of `barrel:query/3` changes it), joins each hit to its document, applies `WHERE`, and returns up to `k` rows. A selective filter can return fewer.
- `_score` and `_distance` can be selected or ordered, never filtered in `WHERE`.

## Live queries

Append `SUBSCRIBE` to get the matching rows, then a message for every row that is added, changes or leaves.

```erlang
{ok, #{ref := Ref}} = barrel:subscribe_query(Db,
    <<"SELECT title FROM kb WHERE status = 'published' "
      "SUBSCRIBE">>).
```

The owner receives `{bql_rows, Ref, Rows}`, `{bql_ready, Ref, #{count, last_seq}}`, then `{bql_change, Ref, #{action, id, rev, row}}` with `action` one of `add`, `change`, `remove`. `SUBSCRIBE` does not combine with a table function, `UNNEST`, `ORDER BY` or `OFFSET`.

## Paging

Queries without `ORDER BY`, `UNNEST` or `LIMIT` stream: pass `chunk_size`, then the `continuation` from the result meta to get the next chunk. The meta carries `has_more`, `instance_id`, `last_seq`, and `count` when the query materializes.

## Refused statements

These are not in the grammar at all, so they are syntax errors: aggregates such as `COUNT(*)`, `GROUP BY`, joins, `DISTINCT`, subqueries and functions in the select list.

The compiler refuses these with `{error, {invalid_query, {Line, Col}, Code}}`:

| Code | Statement |
|---|---|
| `{unsupported, wildcard_path, use_unnest}` | A `[*]` path; use `UNNEST` |
| `{unsupported, multi_key_order_by}` | `ORDER BY` with more than one key |
| `{unsupported, id_in_disjunction}`, `{unsupported, id_condition}` | An `id` condition inside `OR`, or other than `=`, a range or a prefix `LIKE` |
| `score_in_where` | `_score` or `_distance` in `WHERE` |
| `path_to_path_comparison`, `path_between_bound` | Comparing two fields |
| `{use_is_null, _}` | `= NULL`; use `IS NULL` |
| `constant_predicate` | A predicate without a field |
| `{reserved_field, F}` | A top-level `_` field, such as `_rev` |
| `{unbound_param, N}`, `{invalid_param, N}` | A missing or non-scalar parameter |
| `{alias_required, _}` | A table function or an indexed projection without `AS` |
| `duplicate_alias`, `duplicate_output_name` | Two names that collide |
| `unknown_table_function`, `invalid_table_fn_arg` | A bad table function or argument |
| `invalid_unnest_path`, `invalid_order_key` | A bad `UNNEST` path or `ORDER BY` key |
| `{unsupported_with_subscribe, _}` | `SUBSCRIBE` with a table function, `UNNEST`, `ORDER BY` or `OFFSET` |

`barrel_bql:format_error/1` turns an error into the text REST returns, such as `line 1 column 13: syntax error: syntax error before: '('`.
