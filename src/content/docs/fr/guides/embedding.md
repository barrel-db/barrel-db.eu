---
title: Integrer barrel dans une application Erlang
description: Comment executer barrel comme base de donnees document et vecteur en processus, dans votre release Erlang, sans serveur.
---

`barrel` est la base de donnees edge embarquable. Elle compose la couche document
(`barrel_docdb`) et la couche vecteur (`barrel_vectordb`) derriere une seule API,
ou un document, ses pieces jointes (blobs) et son vecteur partagent un seul id.
Lisez ceci quand vous voulez une base de donnees dans votre release Erlang sans
lancer de serveur.

## Quand l'utiliser

- Vous voulez des documents, des vecteurs, une recherche BM25/hybride, des pieces
  jointes et un flux de changements depuis un seul handle, en processus.
- Vous n'avez pas besoin d'un point d'acces reseau. Pour un acces HTTP, lancez
  plutot `barrel_server`.

## Ouvrir et fermer

```erlang
{ok, _} = application:ensure_all_started(barrel_docdb),
{ok, _} = application:ensure_all_started(barrel_vectordb),

{ok, Db} = barrel:open(mydb),
%% pass options per layer:
{ok, Db2} = barrel:open(mydb, #{
    vectordb => #{dimension => 768, bm25_backend => memory}
}),
ok = barrel:close(Db).
```

Une base de donnees lie son stockage vectoriel au processus qui l'a ouverte.
Ouvrez-la depuis un processus a longue duree de vie (un gen_server ou un
superviseur), pas depuis un processus transitoire.

## Documents

```erlang
{ok, _}   = barrel:put_doc(Db, #{<<"id">> => <<"a">>, <<"title">> => <<"hello">>}),
{ok, Doc} = barrel:get_doc(Db, <<"a">>),
{ok, _}   = barrel:delete_doc(Db, <<"a">>),
{ok, Rows, _Meta} = barrel:find(Db, #{where => [{path, [<<"title">>], <<"hello">>}]}).
```

## Lots

```erlang
[{ok, _}, {ok, _}] = barrel:put_docs(Db, [#{<<"id">> => <<"a">>}, #{<<"id">> => <<"b">>}]),
Results = barrel:get_docs(Db, [<<"a">>, <<"b">>]),     %% one result per id, in order
_       = barrel:delete_docs(Db, [<<"a">>, <<"b">>]).
```

## Pieces jointes (blobs)

Les blobs sont des pieces jointes de document ; le backend de stockage est
enfichable par base de donnees via le point d'extension docdb
`barrel_att_backend` (RocksDB BlobDB par defaut).

```erlang
{ok, _}          = barrel:put_attachment(Db, <<"a">>, <<"f.txt">>, <<"bytes">>),
{ok, <<"bytes">>} = barrel:get_attachment(Db, <<"a">>, <<"f.txt">>),
[<<"f.txt">>]    = barrel:list_attachments(Db, <<"a">>),
ok               = barrel:delete_attachment(Db, <<"a">>, <<"f.txt">>).
```

Diffusez les gros blobs en flux :

```erlang
{ok, W0} = barrel:open_attachment_writer(Db, <<"a">>, <<"big">>, <<"application/octet-stream">>),
{ok, W1} = barrel:write_attachment(W0, <<"chunk">>),
{ok, _}  = barrel:finish_attachment(W1),

{ok, R0} = barrel:open_attachment_reader(Db, <<"a">>, <<"big">>),
{ok, _Chunk, R1} = barrel:read_attachment(R0),    %% eof at the end
ok = barrel:close_attachment_reader(R1).
```

## Vecteurs et recherche

Pour garder les vecteurs synchronises avec les documents automatiquement, ouvrez
la base de donnees avec une politique d'embedding au lieu de les gerer a la main :
voir [mode enregistrement](/fr/docs/guides/record-mode). L'API vectorielle directe
ci-dessous s'applique aux bases de donnees ordinaires.

```erlang
ok = barrel:vector_add(Db, <<"a">>, <<"hello world">>, #{}, Vector),
{ok, #{inserted := 2}} = barrel:vector_add_batch(Db, [
    {<<"a">>, <<"t1">>, #{}, V1},
    {<<"b">>, <<"t2">>, #{}, V2}
]),
{ok, Hits}  = barrel:search_vector(Db, Vector, #{k => 5}),
{ok, BHits} = barrel:search_bm25(Db, <<"hello">>, #{k => 5}).
```

Notes :

- `vector_add_batch/2` prend des tuples `{Id, Text, Metadata}` (texte dont
  l'embedding est calcule par le store) ou `{Id, Text, Metadata, Vector}`
  (explicite) ; un lot doit etre d'une seule forme.
- BM25 est optionnel : ouvrez avec `vectordb => #{bm25_backend => memory}` (ou
  `disk`).
- `search_hybrid/3` et les ajouts avec embedding automatique necessitent un
  embedder configure via `barrel_embed` ; sans lui ils renvoient
  `{error, embedder_not_configured}`.

## Changements

```erlang
{ok, Changes, Last} = barrel:changes(Db, first),
Cursor  = barrel:hlc_encode(Last),         %% JSON/URL-safe cursor
Last2   = barrel:hlc_decode(Cursor),
{ok, More, _} = barrel:changes(Db, Last2),  %% changes since the cursor
{ok, Pid} = barrel:subscribe(Db, Last).
```
