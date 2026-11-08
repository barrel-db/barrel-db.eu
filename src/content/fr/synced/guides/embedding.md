---
translation_of: src/content/synced/guides/embedding.md
source_hash: "b3409f4f33babba8"
title: "Embarquer barrel dans une application Erlang"
description: "barrel est la base de données edge embarquable. Elle compose la couche documents (barrel_docdb) et la couche vecteurs (barrel_vectordb) derrière une seule API, où un document, ses pièces jointes (blobs) et son vecteur partagent un même identifiant. Lisez ce guide quand vous voulez une base de données dans votre release Erlang sans faire tourner de serveur."
source: "docs/guides/embedding.md"
---

`barrel` est la base de données edge embarquable. Elle compose la couche
documents (`barrel_docdb`) et la couche vecteurs (`barrel_vectordb`) derrière
une seule API, où un document, ses pièces jointes (blobs) et son vecteur
partagent un même identifiant. Lisez ce guide quand vous voulez une base de
données dans votre release Erlang sans faire tourner de serveur.

## Quand l’utiliser

- Vous voulez des documents, des vecteurs, la recherche BM25/hybride, des
  pièces jointes et un flux de changements depuis un seul handle, dans le
  même processus.
- Vous n’avez pas besoin de point d’accès réseau. Pour un accès HTTP, lancez
  plutôt `barrel_server`.

## Ouvrir et fermer

```erlang
{ok, _} = application:ensure_all_started(barrel_docdb),
{ok, _} = application:ensure_all_started(barrel_vectordb),

{ok, Db} = barrel:open(mydb),
%% options par couche :
{ok, Db2} = barrel:open(mydb, #{
    vectordb => #{dimension => 768, bm25_backend => memory}
}),
ok = barrel:close(Db).
```

Une base lie son stockage vectoriel au processus qui l’a ouverte. Ouvrez-la
depuis un processus de longue durée (un gen_server ou un superviseur), pas
depuis un processus éphémère.

## Ouvrir sans stockage vectoriel

Une base qui ne contient que des documents n’a besoin ni du stockage
vectoriel ni de son RocksDB. Passez `vectordb => none` :

```erlang
{ok, Db} = barrel:open(notes, #{vectordb => none}),
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>, <<"lang">> => <<"en">>}),
{ok, _Rows, _Meta} = barrel:query(Db, "SELECT * FROM db WHERE lang = 'en'"),
{error, no_vector_store} = barrel:search(Db, <<"anything">>, #{}).
```

- Les documents, pièces jointes, requêtes, changements et la réplication
  fonctionnent comme d’habitude.
- Les appels vectoriels (`vector_*`, `search*`, `embed*`, `embedder_info/1`,
  `vector_stats/1`) et les fonctions de table `vector_top_k`, `bm25_top_k` et
  `hybrid_top_k` répondent `{error, no_vector_store}`.
- Le mode enregistrement demande un stockage vectoriel : `embedding` avec
  `vectordb => none` répond `{error, {invalid_option, vectordb}}`.
- Une branche d’une telle base n’a pas non plus de stockage vectoriel. Un
  export de contexte la refuse (`{error, no_vector_store}`) ; une tranche de
  cette base ne contient que des documents.
- `barrel_spaces:create_space(#{vectordb => none})` crée un espace sans
  stockage vectoriel ; l’espace se rouvre sans lui sur chaque nœud.

## Ouvrir en lecture seule

Ouvrez avec `read_only => true` pour servir une base sans écrire aucun
fichier, par exemple une copie importée que plusieurs nœuds partagent. Chaque
écriture répond `{error, read_only}`.

```erlang
{ok, Ro} = barrel:open(mydb, #{read_only => true}),
{error, read_only} = barrel:put_doc(Ro, #{<<"id">> => <<"z">>}),
{ok, _} = barrel:get_doc(Ro, <<"a">>),
ok = barrel:close(Ro).
```

- La base doit exister : une base absente échoue avec
  `read_only_store_missing`. Une base écrite par une version plus ancienne
  qui demande une mise à niveau échoue avec `read_only_upgrade_needed` ;
  ouvrez-la une fois en écriture.
- Le mode enregistrement ne persiste aucune politique et ne démarre aucun
  indexeur. Passez `embedding => stored` pour utiliser la politique que la
  base a persistée (`{error, no_stored_policy}` sur une base simple).

## Partager des handles via barrel_dbs

`barrel_dbs` met en cache les handles ouverts par nom, ferme ceux qui sont
inactifs et évince au-delà d’un plafond. Prenez un bail (lease) quand un
processus a besoin qu’une base reste ouverte pendant qu’il travaille ; prenez
une retenue (hold) quand vous avez besoin que ses fichiers soient fermés
(c’est le cas d’un export).

```erlang
{error, not_found} = barrel_dbs:ensure(<<"nope">>, #{must_exist => true}),
{ok, Db, Lease} = barrel_dbs:lease(<<"mydb">>, #{}),
%% ... Db reste ouverte malgré la fermeture sur inactivité et l'éviction ...
ok = barrel_dbs:release(Lease),

{ok, #{was_open := _}} = barrel_dbs:hold(<<"mydb">>, #{}),
%% ... chaque ensure de mydb est refusé jusqu'à unhold ...
ok = barrel_dbs:unhold(<<"mydb">>).
```

- Les baux sont comptés et prennent fin quand leur détenteur s’arrête ;
  `barrel_dbs:leases/0` les liste. `lookup/1` renvoie l’indicateur
  d’épinglage, le propriétaire et les options d’ouverture.
- Une retenue est refusée sur une base épinglée ou sous bail, ou sur une base
  ouverte en dehors du gestionnaire.

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
Results = barrel:get_docs(Db, [<<"a">>, <<"b">>]),     %% un résultat par id, dans l'ordre
_       = barrel:delete_docs(Db, [<<"a">>, <<"b">>]).
```

## Pièces jointes (blobs)

Les blobs sont des pièces jointes de documents ; le backend de stockage est
enfichable par base via la jonction docdb `barrel_att_backend` (RocksDB
BlobDB par défaut ; `barrel_att_s3` les stocke dans un bucket compatible S3).

```erlang
{ok, _}          = barrel:put_attachment(Db, <<"a">>, <<"f.txt">>, <<"bytes">>),
{ok, <<"bytes">>} = barrel:get_attachment(Db, <<"a">>, <<"f.txt">>),
[<<"f.txt">>]    = barrel:list_attachments(Db, <<"a">>),
ok               = barrel:delete_attachment(Db, <<"a">>, <<"f.txt">>).
```

Transférer de gros blobs en streaming :

```erlang
{ok, W0} = barrel:open_attachment_writer(Db, <<"a">>, <<"big">>, <<"application/octet-stream">>),
{ok, W1} = barrel:write_attachment(W0, <<"chunk">>),
{ok, _}  = barrel:finish_attachment(W1),

{ok, R0} = barrel:open_attachment_reader(Db, <<"a">>, <<"big">>),
{ok, _Chunk, R1} = barrel:read_attachment(R0),    %% eof à la fin
ok = barrel:close_attachment_reader(R1).
```

## Vecteurs et recherche

Pour garder automatiquement les vecteurs synchronisés avec les documents,
ouvrez la base avec une politique d’embedding au lieu de les gérer à la main :
voir le [mode enregistrement](/fr/docs/guides/record-mode). L’API vectorielle
directe ci-dessous s’applique aux bases simples.

```erlang
ok = barrel:vector_add(Db, <<"a">>, <<"hello world">>, #{}, Vector),
{ok, #{inserted := 2}} = barrel:vector_add_batch(Db, [
    {<<"a">>, <<"t1">>, #{}, V1},
    {<<"b">>, <<"t2">>, #{}, V2}
]),
{ok, Hits}  = barrel:search_vector(Db, Vector, #{k => 5}),
{ok, BHits} = barrel:search_bm25(Db, <<"hello">>, #{k => 5}).
```

Notes :

- `vector_add_batch/2` prend des tuples `{Id, Text, Metadata}` (texte embeddé
  par le stockage) ou `{Id, Text, Metadata, Vector}` (explicite) ; un lot doit
  être entièrement d’une seule forme.
- BM25 est à activer : ouvrez avec `vectordb => #{bm25_backend => memory}`
  (ou `disk`). Un index disque survit à une réouverture ; un index mémoire
  est reconstruit à l’ouverture à partir du texte stocké.
- `search_hybrid/3` et les ajouts avec embedding automatique demandent un
  embedder configuré via `barrel_embed` ; sans lui, ils renvoient
  `{error, embedder_not_configured}`.
- Pour embedder vous-même du texte avec l’embedder de la base (même modèle et
  même dimension que les vecteurs indexés), utilisez `barrel:embed/2`,
  `barrel:embed_batch/2` et `barrel:embedder_info/1` sur le handle ; traitez
  le handle comme opaque plutôt que de lire ses champs.

## Changements

```erlang
{ok, Changes, Last} = barrel:changes(Db, first),
Cursor  = barrel:hlc_encode(Last),         %% curseur sûr pour JSON/URL
Last2   = barrel:hlc_decode(Cursor),
{ok, More, _} = barrel:changes(Db, Last2),  %% changements depuis le curseur
{ok, Pid} = barrel:subscribe(Db, Last).
```
