---
title: Quickstart
description: Open a database, store a document, query it, and run a vector search, in a few minutes.
---

This walks you from an empty project to storing, querying, and searching
documents with the embedded `barrel` API. You should have Barrel
[installed](/docs/get-started/installation) first.

## Open a database

Start the application and open a database. Open it from a long-lived process (a
gen_server or supervisor), because the database links its vector store to the
process that opened it.

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel:open(mydb).
```

To turn on keyword search, or set the vector dimension, pass options per layer:

```erlang
{ok, Db} = barrel:open(mydb, #{
    vectordb => #{dimension => 768, bm25_backend => memory}
}).
```

## Store and read a document

A document is a map. It shares its id with its attachments and its vector.

```erlang
{ok, _}   = barrel:put_doc(Db, #{<<"id">> => <<"a">>, <<"title">> => <<"hello">>}),
{ok, Doc} = barrel:get_doc(Db, <<"a">>).
```

## Query with BQL

Query the database with BQL, a PartiQL dialect. The document paths are indexed
for you, so there are no indexes to create.

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    <<"SELECT id, title FROM db WHERE title = 'hello'">>).
```

## Add a vector and search

Attach a vector to a document, then search by vector or keyword:

```erlang
ok = barrel:vector_add(Db, <<"a">>, <<"hello world">>, #{}, Vector),

{ok, Hits}  = barrel:search_vector(Db, Vector, #{k => 5}),
{ok, BHits} = barrel:search_bm25(Db, <<"hello">>, #{k => 5}).
```

To keep vectors in step with your documents automatically, open the database with
an embedding policy instead of adding vectors by hand. See
[Record mode](/docs/guides/record-mode).

## Next steps

- Understand the [data model](/docs/concepts/data-model): one id, three shapes.
- Learn [querying with BQL](/docs/guides/query-bql) in depth.
- [Sync](/docs/guides/synchronization) between databases, or to the
  [browser](/docs/guides/barrel-lite).
