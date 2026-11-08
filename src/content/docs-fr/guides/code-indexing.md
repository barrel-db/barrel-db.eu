---
title: Indexer une base de code pour un agent
description: Construisez un index de recherche qu'un agent de code interroge par le sens, pas seulement par mots-cles. Barrel garde un enregistrement par fragment (texte et vecteur ensemble), l'embarque pour vous, et repond aux recherches plein texte, semantiques et hybrides en un appel.
---

Un agent de code travaille mieux quand il peut demander "ou est la logique
d'authentification" et recevoir le bon code, pas seulement des fichiers qui
contiennent le mot "auth". Cela demande une recherche semantique a cote de la
recherche par mots-cles, sur une base de code qui change sans cesse. Lisez ceci
quand vous voulez donner cet index a un agent. Vous stockez un enregistrement par
fragment de code, Barrel l'embarque, et vous l'interrogez en recherche plein
texte, vectorielle ou hybride depuis un seul appel. Exposez-le via MCP et l'agent
l'utilise comme un outil.

## Comment cela s'assemble

- **Un enregistrement par fragment.** Un fragment est une tranche de fichier (une
  fonction, une classe, une plage de lignes). Vous le stockez comme un document.
  En [mode enregistrement](/docs/guides/record-mode) Barrel garde un vecteur pour
  ce document synchronise, si bien que le texte d'un fragment et son embedding
  forment un enregistrement sous un seul id. Pas de table d'embeddings separee,
  pas d'appels d'embedding manuels.
- **Les metadonnees suivent.** Le chemin, le langage et le nom du symbole sont des
  champs du document, vous pouvez donc filtrer une recherche ("seulement Python",
  "seulement sous `src/`") sans jointure.
- **Une requete pour trois recherches.** BQL expose `bm25_top_k` (mots-cles),
  `vector_top_k` (semantique) et `hybrid_top_k` (les deux, fusionnes). Le cas
  hybride est integre ; vous ne fusionnez pas les resultats vous-meme.
- **L'agent y accede via MCP.** [barrel_server](/docs/server/mcp) expose la meme
  base a un agent, la recherche est donc un appel d'outil.

## Ouvrir l'index

Ouvrez une base en mode enregistrement. La politique `embedding` nomme le champ a
embarquer (le texte du fragment) et les champs de metadonnees a projeter dans les
resultats. L'application `barrel` doit tourner ; elle supervise l'indexeur.

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel:open(code_index, #{
    embedding => #{
        fields => [<<"text">>],                 %% embarque le corps du fragment
        mode => sync,                           %% lecture apres ecriture
        embedder => {local, #{}},               %% un fournisseur barrel_embed
        dimensions => 768,
        metadata_fields => [<<"path">>, <<"lang">>, <<"symbol">>]
    },
    vectordb => #{dimension => 768}
}).
```

## Indexer un fichier

Un fragment a besoin d'un **id stable** pour que la re-indexation remplace le meme
enregistrement au lieu de le dupliquer. Derivez-le du chemin du fichier et de la
plage de lignes, par exemple `src/auth.py#40-88`. Ecrivez les fragments avec
`put_docs/2` ; une ecriture avec un id existant remplace ce document, et le mode
enregistrement le re-embarque.

```erlang
index_file(Db, Path, Lang, Chunks) ->
    Docs = [#{<<"id">>    => chunk_id(Path, Chunk),
             <<"path">>   => Path,
             <<"lang">>   => Lang,
             <<"symbol">> => maps:get(symbol, Chunk),
             <<"text">>   => maps:get(body, Chunk)}
            || Chunk <- Chunks],
    barrel:put_docs(Db, Docs).

chunk_id(Path, #{start_line := S, end_line := E}) ->
    iolist_to_binary([Path, "#", integer_to_binary(S), "-", integer_to_binary(E)]).
```

Ignorez les fichiers inchanges. Stockez le hash du contenu de chaque fichier dans
un petit document de metadonnees et comparez avant de re-indexer :

```erlang
unchanged(Db, Path, Hash) ->
    case barrel:get_doc(Db, <<"file:", Path/binary>>) of
        {ok, #{<<"hash">> := Hash}} -> true;   %% meme hash, ignorer
        _ -> false
    end.

record_hash(Db, Path, Hash) ->
    barrel:put_doc(Db, #{<<"id">> => <<"file:", Path/binary>>,
                         <<"hash">> => Hash}).
```

## Rechercher

Chaque fonction de recherche est la source `FROM` d'une requete BQL. Elle prend le
texte de la requete et `k`, et expose une colonne `_score`. `SELECT *` aplatit les
champs du document trouve (path, symbol, text) dans chaque ligne.

Recherche par mots-cles, pour un identifiant exact ou un message d'erreur :

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, symbol, m._score "
    "FROM bm25_top_k('parse_config', k => 10) AS m").
```

Recherche semantique, pour l'intention :

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, symbol, v._score "
    "FROM vector_top_k('ou valide-t-on le jeton d''auth', k => 10) AS v").
```

La recherche hybride fusionne les deux et est le choix par defaut d'un agent. Vous
ne fusionnez ni ne re-classez rien vous-meme :

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, symbol, h._score "
    "FROM hybrid_top_k('reessayer une requete echouee avec backoff', k => 10) AS h").
```

Filtrez par metadonnees dans la meme requete. La recherche sur-echantillonne, un
filtre trouve donc des correspondances classees sous les `k` premieres non
filtrees :

```erlang
{ok, Rows, _} = barrel:query(Db,
    "SELECT id, path, v._score "
    "FROM vector_top_k('lire un fichier dans un buffer', k => 5) AS v "
    "WHERE v.lang = 'rust' AND v.path LIKE 'src/%'").
```

`vector_top_k` et `hybrid_top_k` embarquent la requete, ils ont donc besoin d'un
embedder configure ; `bm25_top_k` a besoin d'un backend BM25. Voir la
[reference BQL](/docs/reference/bql).

## Garder l'index a jour

Quand un fichier change, ses anciens fragments sont perimes : les plages de lignes
bougent, donc les nouveaux ids de fragment different des anciens. Re-indexez le
fichier, puis supprimez les fragments qui appartiennent au fichier mais ne sont
pas dans le nouvel ensemble. Les ids de fragment partagent le chemin du fichier
comme prefixe, vous pouvez donc les lister :

```erlang
reindex_file(Db, Path, Lang, Chunks) ->
    {ok, Old, _} = barrel:query(Db,
        "SELECT id FROM db WHERE id LIKE '" ++ binary_to_list(Path) ++ "#%'"),
    OldIds = [maps:get(<<"id">>, R) || R <- Old],
    Results = index_file(Db, Path, Lang, Chunks),
    NewIds = [Id || #{<<"id">> := Id} <- [D || {ok, D} <- Results]],
    Stale = OldIds -- NewIds,
    [barrel:delete_doc(Db, Id) || Id <- Stale],
    ok.
```

Quand un fichier est supprime, retirez tous ses fragments :

```erlang
remove_file(Db, Path) ->
    {ok, Rows, _} = barrel:query(Db,
        "SELECT id FROM db WHERE id LIKE '" ++ binary_to_list(Path) ++ "#%'"),
    [barrel:delete_doc(Db, maps:get(<<"id">>, R)) || R <- Rows],
    barrel:delete_doc(Db, <<"file:", Path/binary>>).
```

## Le donner a un agent

Lancez [barrel_server](/docs/server/mcp) devant l'index et l'agent y accede via le
Model Context Protocol : il liste les bases, execute du BQL et lit les documents
comme des appels d'outil. Une recherche est un `POST` d'une requete `hybrid_top_k`
; un resultat est un fragment avec son chemin et sa plage de lignes, que l'agent
ouvre.

Pour un client HTTP simple plutot que MCP, la meme requete passe par REST :

```bash
curl -X POST localhost:8080/db/code_index/query \
    -H 'content-type: application/json' \
    -d '{"query":"SELECT id, path, h._score FROM hybrid_top_k('"'"'ou valide-t-on le jeton d auth'"'"', k => 10) AS h"}'
```

## Notes

- Fragmentez sur la structure, pas sur un nombre de lignes fixe : une fonction ou
  une classe par fragment garde un resultat autonome et donne a l'embedding une
  unite coherente.
- Gardez `text` au corps du fragment qu'un agent doit lire. Mettez le chemin, le
  langage et le symbole dans des champs de metadonnees pour pouvoir filtrer dessus.
- `mode => sync` embarque a l'ecriture, un fragment est donc consultable des que
  `put_docs` retourne. Utilisez `async` pour une grande passe d'indexation
  initiale, puis l'indexeur rattrape en arriere-plan.
- Les formes de requete ici sont exercees par `barrel_bql_facade_SUITE` dans
  l'umbrella, qui execute les trois fonctions `top_k` et les filtres de
  metadonnees sur une base en mode enregistrement.
