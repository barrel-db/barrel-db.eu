---
translation_of: src/content/docs/guides/code-indexing.md
source_hash: "802f89935471def4"
title: Indexer une base de code pour un agent
description: Construire un index de recherche qu’un agent de code interroge par le sens et par mots-clés. Barrel garde un enregistrement par fragment, calcule son embedding pour vous, et répond aux requêtes par mots-clés, sémantiques et hybrides en un seul appel BQL.
---

Un agent de code IA travaille mieux quand il peut demander « où valide-t-on le token d’authentification ? » et recevoir le bon code, pas seulement les fichiers qui contiennent le mot « auth ». Cela demande une recherche sémantique à côté de la recherche par mots-clés, sur une base de code qui change sans cesse. Lisez cette page quand vous voulez donner cet index à un agent : vous stockez un enregistrement par fragment de code, Barrel en calcule l’embedding, et vous l’interrogez par mots-clés, par vecteurs ou en hybride en un seul appel. Exposez-le en MCP et l’agent l’utilise comme un outil.

## Comment les pièces s’assemblent

- **Un enregistrement par fragment.** Un fragment est une tranche de fichier : une fonction, une classe, une plage de lignes. Vous le stockez comme un document. En [mode enregistrement](/fr/docs/guides/record-mode), Barrel tient à jour un vecteur pour ce document : le texte d’un fragment et son embedding forment un seul enregistrement sous un seul id.
- **Les métadonnées suivent.** Le chemin, le langage et le symbole sont des champs du document, si bien qu’une recherche peut filtrer dessus (« seulement Python », « seulement sous `src/` »).
- **Un seul langage de requête pour trois types de recherche.** BQL a `bm25_top_k` (mots-clés), `vector_top_k` (sémantique) et `hybrid_top_k` (les deux, fusionnés). Vous ne fusionnez pas vous-même les résultats.
- **L’agent y accède en MCP.** [barrel_server](/fr/docs/guides/mcp) expose la base à un agent : la recherche devient un appel d’outil.

Pour les identifiants exacts et les expressions régulières sur les mêmes documents, ajoutez un [index de sous-chaînes et d’expressions régulières](/fr/docs/search/substring-regex) à côté de celui-ci.

## Ouvrir l’index

Ouvrez une base en mode enregistrement. La politique `embedding` nomme le champ dont calculer l’embedding (le texte du fragment) et les champs de métadonnées renvoyés avec les résultats. L’application `barrel` doit tourner ; elle supervise l’indexeur.

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel_dbs:ensure(<<"code_index">>, #{
    embedding => #{
        fields => [<<"text">>],
        mode => sync,
        embedder => {local, #{}},
        dimensions => 768,
        metadata_fields => [<<"path">>, <<"lang">>,
                            <<"symbol">>]},
    vectordb => #{db_path => "/var/lib/app/code_index_vec"}}).
```

- `{local, #{}}` exécute `BAAI/bge-base-en-v1.5` (768 dimensions) via Python ; n’importe quel [fournisseur d’embeddings](/fr/docs/search/embedding-providers) convient. Réglez `dimensions` sur la taille du modèle.
- Le mode enregistrement active un index BM25 sur disque : `bm25_top_k` et `hybrid_top_k` fonctionnent sans autre option.
- `barrel_dbs:ensure/2` vous donne un handle supervisé et partagé. Si barrel_server tourne dans le même nœud, le serveur réutilise cette base ouverte au lieu d’en ouvrir une simple.
- `db_path` place le magasin de vecteurs où vous le voulez. Sans lui, le magasin va à côté des documents, dans `<data_dir>/code_index.vectordb`.

## Indexer un fichier

Un fragment a besoin d’un **id stable** pour qu’une réindexation écrase le même enregistrement au lieu d’en ajouter un. Dérivez-le du chemin du fichier et de la plage de lignes, par exemple `src/auth.py#40-88`. Écrivez les fragments avec `put_docs/2` ; avec `mode => sync`, un fragment est cherchable dès que l’appel rend la main.

```erlang
index_file(Db, Path, Lang, Chunks) ->
    Docs = [#{<<"id">>     => chunk_id(Path, C),
              <<"path">>   => Path,
              <<"lang">>   => Lang,
              <<"symbol">> => maps:get(symbol, C),
              <<"text">>   => maps:get(body, C)}
            || C <- Chunks],
    barrel:put_docs(Db, Docs).

chunk_id(Path, #{start_line := S, end_line := E}) ->
    <<Path/binary, "#", (integer_to_binary(S))/binary,
      "-", (integer_to_binary(E))/binary>>.
```

`put_docs/2` renvoie un `{ok, #{<<"id">>, <<"rev">>, ...}}` ou un `{error, Reason}` par fragment, dans l’ordre. En mode sync, un échec d’embedding fait échouer tout le lot et rien n’est écrit.

Pour sauter les fichiers qui n’ont pas changé, gardez le hash du contenu de chaque fichier dans un petit document. Une mise à jour doit porter le `_rev` courant : lisez donc avant d’écrire.

```erlang
unchanged(Db, Path, Hash) ->
    case barrel:get_doc(Db, <<"file:", Path/binary>>) of
        {ok, #{<<"hash">> := Hash}} -> true;
        _ -> false
    end.

record_hash(Db, Path, Hash) ->
    Id = <<"file:", Path/binary>>,
    Doc = case barrel:get_doc(Db, Id) of
        {ok, Old} -> Old#{<<"hash">> => Hash};
        {error, not_found} -> #{<<"id">> => Id}
    end,
    barrel:put_doc(Db, Doc#{<<"hash">> => Hash}).
```

## Chercher

Chaque fonction de recherche est la source `FROM` d’une requête BQL. Elle prend le texte de la requête et `k`, et expose une colonne `_score`. Nommez à côté les champs du document pour les obtenir dans chaque ligne ; `SELECT *` renvoie tous les champs du fragment, `text` compris.

Recherche par mots-clés, pour un identifiant exact ou un message d’erreur :

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, symbol, m._score "
    "FROM bm25_top_k('parse_config', k => 10) AS m").
```

Recherche sémantique, pour une intention :

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, symbol, v._score "
    "FROM vector_top_k('where do we validate the auth "
    "token', k => 10) AS v").
```

La recherche hybride fusionne les deux par reciprocal rank fusion. C’est celle qu’un agent devrait essayer en premier :

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, symbol, h._score "
    "FROM hybrid_top_k('retry a failed request with "
    "backoff', k => 10) AS h").
```

Filtrez sur les métadonnées dans la même requête. La recherche récupère plus de résultats que demandé (3 fois `k`) avant le filtre : elle trouve donc encore des correspondances classées sous les `k` premières sans filtre ; un filtre très sélectif peut tout de même renvoyer moins de `k` lignes.

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    "SELECT id, path, v._score "
    "FROM vector_top_k('read a file into a buffer', "
    "k => 5) AS v "
    "WHERE v.lang = 'rust' AND v.path LIKE 'src/%'").
```

Quand le texte de la requête vient de l’agent, passez-le en paramètre au lieu de l’insérer dans l’instruction :

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    <<"SELECT id, path, h._score "
      "FROM hybrid_top_k($q, k => 10) AS h "
      "WHERE h.lang = $lang">>,
    #{params => #{<<"q">> => Question,
                  <<"lang">> => <<"python">>}}).
```

Voir la [référence BQL](/fr/docs/reference/bql) pour le reste de la grammaire.

## Le garder à jour

Quand un fichier change, ses anciens fragments deviennent obsolètes : les plages de lignes bougent, donc les nouveaux ids de fragments diffèrent des anciens. Les ids de fragments commencent par le chemin du fichier et `#` : listez-les avec un préfixe d’id. Utilisez ici `find/2` plutôt que `LIKE` en BQL : un `LIKE` par préfixe sur `id` est refusé quand le chemin contient `_` ou `%`.

```erlang
chunk_ids(Db, Path) ->
    {ok, Rows, _} = barrel:find(Db,
        #{id_prefix => <<Path/binary, "#">>,
          include_docs => false}),
    [Id || #{<<"id">> := Id} <- Rows].
```

Réindexez le fichier, puis supprimez les fragments qui ne sont pas dans le nouvel ensemble :

```erlang
reindex_file(Db, Path, Lang, Chunks) ->
    Old = chunk_ids(Db, Path),
    Results = index_file(Db, Path, Lang, Chunks),
    New = [Id || {ok, #{<<"id">> := Id}} <- Results],
    [barrel:delete_doc(Db, Id) || Id <- Old -- New],
    ok.
```

Quand un fichier est supprimé, retirez ses fragments et son document de hash :

```erlang
remove_file(Db, Path) ->
    [barrel:delete_doc(Db, Id) || Id <- chunk_ids(Db, Path)],
    barrel:delete_doc(Db, <<"file:", Path/binary>>).
```

`find/2` renvoie au plus 1000 lignes à la fois ; un fichier qui a plus de fragments demande `find/3` avec la `continuation` des métadonnées du résultat.

## Le donner à un agent

Lancez [barrel_server](/fr/docs/guides/rest-server) dans le même nœud, après avoir ouvert l’index comme ci-dessus. L’agent y accède par le Model Context Protocol et cherche avec l’outil `query` (une instruction `hybrid_top_k`) ou l’outil `search` avec `mode` réglé sur `hybrid`. Un résultat est un fragment dont l’id contient le chemin et la plage de lignes, que l’agent ouvre ensuite. La liste des outils est dans [Outils MCP](/fr/docs/reference/mcp-tools).

```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call",
 "params": {"name": "search", "arguments": {
   "db": "code_index", "mode": "hybrid", "k": 10,
   "query": "where do we validate the auth token"}}}
```

Pour un simple client HTTP, le même BQL passe par REST :

```shell
curl -X POST localhost:8080/db/code_index/query \
  -H 'content-type: text/plain' \
  --data-binary "SELECT id, path, h._score
    FROM hybrid_top_k('validate the auth token', k => 10)
    AS h"
```

## Remarques

- Découpez selon la structure, pas selon un nombre fixe de lignes : une fonction ou une classe par fragment donne un résultat qui se suffit à lui-même et une unité cohérente pour l’embedding.
- Limitez `text` au corps du fragment que l’agent doit lire. Mettez le chemin, le langage et le symbole dans leurs propres champs pour pouvoir filtrer dessus.
- `mode => sync` calcule l’embedding à l’écriture. Utilisez `async` pour une première indexation volumineuse ; l’indexeur rattrape en arrière-plan.
- Chaque appel de cette page a été exécuté sur l’umbrella à main `c111ec4`, avec un fournisseur de test à la place de `{local, #{}}` pour tourner hors ligne. Les scores que vous obtenez dépendent du modèle.
