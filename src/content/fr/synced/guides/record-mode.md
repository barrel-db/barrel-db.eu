---
translation_of: src/content/synced/guides/record-mode.md
source_hash: "83c8a3ca77705241"
title: "Mode enregistrement : indexation vectorielle pilotée par une politique"
description: "Le mode enregistrement fait d’un document et de son vecteur une seule unité : vous écrivez des documents, et barrel garde l’index vectoriel synchronisé avec eux, selon une politique d’embedding propre à la base. Le stockage vectoriel ne contient que les vecteurs et les index ; les résultats de recherche lisent le texte et les métadonnées dans les documents courants. Lisez ce guide pour une recherche sémantique ou hybride sur vos documents sans gérer les vecteurs vous-même."
source: "docs/guides/record-mode.md"
---

Le mode enregistrement fait d’un document et de son vecteur une seule unité :
vous écrivez des documents, et barrel garde l’index vectoriel synchronisé
avec eux, selon une politique d’embedding propre à la base. Le stockage
vectoriel ne contient que les vecteurs et les index ; les résultats de
recherche lisent le texte et les métadonnées dans les documents courants.
Lisez ce guide quand vous voulez une recherche sémantique ou hybride sur vos
documents sans gérer les vecteurs vous-même.

## Quand l’utiliser

- Vous écrivez des documents JSON et voulez une recherche vectorielle, BM25
  ou hybride sur des champs choisis, cohérente avec chaque mise à jour et
  chaque suppression.
- Vous ne voulez pas appeler `vector_add` à la main ni dupliquer du texte
  dans un stockage vectoriel.
- Pour une gestion directe des vecteurs (vous gérez identifiants et vecteurs
  séparément des documents), utilisez plutôt une base simple et l’API
  `vector_*`.

## Ouvrir une base en mode enregistrement

Passez une politique `embedding` à `barrel:open/2`. L’application `barrel`
doit être démarrée (elle supervise l’indexeur de chaque base).

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel:open(notes, #{
    embedding => #{
        fields => [<<"title">>, [<<"body">>, <<"text">>]],
        mode => async,                     %% défaut ; sync = lire ses propres écritures
        embedder => {local, #{}},          %% chaîne de fournisseurs barrel_embed
        dimensions => 768,
        metadata_fields => [<<"kind">>]    %% projection optionnelle
    }
}).
```

- `fields` sont des chemins dans le document ; leurs valeurs binaires sont
  jointes (`join`, par défaut `<<"\n">>`) pour former le texte embeddé.
- Sans `metadata_fields`, les métadonnées de recherche sont le document sans
  `id` ni les clés préfixées par `_`.
- En mode enregistrement, BM25 utilise par défaut le backend disque, pour que
  la recherche par mots-clés survive aux redémarrages.
- La politique est persistée dans la base ; rouvrir avec une politique
  différente journalise un avertissement et ne l’applique qu’aux nouvelles
  écritures (pas de réindexation automatique).

## Écrire des documents, les rechercher

```erlang
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>,
                               <<"title">> => <<"quick brown fox">>,
                               <<"kind">> => <<"animal">>}),

{ok, Hits}  = barrel:search(Db, <<"fast fox">>, #{k => 5}),
{ok, HHits} = barrel:search_hybrid(Db, <<"fox">>, #{k => 5}),
{ok, BHits} = barrel:search_bm25(Db, <<"fox">>, #{k => 5}).
```

Les résultats portent `key`, `score`, ainsi que le `text` et les `metadata`
dérivés du document. Les mises à jour ré-embeddent ; les suppressions
retirent le vecteur ; les documents sans champs de la politique n’ont pas de
vecteur.

Pour embedder vous-même du texte avec l’embedder de la politique (pour une
requête `search_vector/3`, ou pour stocker le vecteur ailleurs), passez par
le handle plutôt que par ses champs :

```erlang
{ok, Vector}  = barrel:embed(Db, <<"fast fox">>),
{ok, Vectors} = barrel:embed_batch(Db, [<<"a">>, <<"b">>]),
{ok, #{dimensions := Dim}} = barrel:embedder_info(Db).
```

## Vérifier que deux bases embeddent de la même façon

`embedder_info/1` renvoie aussi l’identité de l’embedder, et `info/1` porte
la même map sous `embedder`. Deux bases avec la même `fingerprint` produisent
des scores vectoriels comparables : une requête de contexte ne fusionne les
résultats `vector_top_k` par score que lorsque chaque base déclare la même
empreinte et la distance cosinus (voir [contextes](/fr/docs/guides/contexts)).

```erlang
{ok, Db} = barrel:open(notes, #{embedding => #{
    fields => [<<"title">>], dimensions => 768,
    embedder => {ollama, #{model => <<"nomic-embed-text">>}}}}),
{ok, Info} = barrel:embedder_info(Db).
%% #{provider => ollama, model => <<"nomic-embed-text:latest">>,
%%   dimensions => 768, distance => cosine,
%%   preprocessing => #{fields => [[<<"title">>]], join => <<"\n">>},
%%   fingerprint => <<"sha256:1b7105d2466397b07e625dbd608d33f5e76ecdf03c4f37aabaf8caa905165890">>,
%%   ...}
```

- `fingerprint` est le `sha256:` du JSON canonique du fournisseur, du modèle,
  de `revision` (quand le fournisseur en déclare une), des dimensions, de la
  distance et du prétraitement. Chaque fournisseur d’une chaîne de repli en
  fait partie.
- Pas d’empreinte sans embedder configuré, ni quand un fournisseur ne nomme
  pas son modèle. Une base simple déclare `preprocessing => none`.

## Asynchrone et synchrone

`mode => async` (défaut) : les écritures rendent la main tout de suite et un
indexeur supervisé embedde en arrière-plan. L’écriture et son intention
d’indexation sont commitées atomiquement : un crash à n’importe quel moment
est réparé par l’indexeur ; aucune écriture n’est jamais perdue entre le
document et son vecteur.

`mode => sync` : le texte est embeddé avant l’écriture et le vecteur est
indexé avant que `put_doc` ne rende la main : une recherche lancée juste
après voit le document. Un échec d’embedding fait échouer l’écriture avec
`{error, {embed_failed, Reason}}` et rien n’est écrit.

## La propriété _embedding

Le vecteur de chaque document indexé vit dans la propriété réservée
`_embedding`, quel que soit celui qui l’a calculé. Il est stocké comme donnée
dérivée à côté du document (jamais dans le corps, il ne change donc pas la
révision), il n’est jamais indexé par chemin et n’apparaît jamais dans les
métadonnées de recherche.

Fournissez votre propre embedding en le portant dans le document, sous forme
de vecteur nu ou d’objet ; il est indexé à la place de tout ce que la
politique aurait embeddé :

```erlang
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>,
                               <<"title">> => <<"quick fox">>,
                               <<"_embedding">> => Vector}).
```

Avec des embeddings fournis par le client, la politique peut être vide :
ouvrez avec `embedding => #{dimensions => 768}` (sans `fields`) et aucun
embedder n’est nécessaire. La longueur du vecteur est vérifiée par rapport à
la dimension de la base avant l’écriture ; les lots contenant un
`_embedding` de mauvaise longueur sont rejetés en entier.

Les vecteurs calculés par la politique sont eux aussi stockés dans
`_embedding` : atomiquement avec l’écriture en mode synchrone, via
l’indexeur en mode asynchrone. Relisez la propriété avec
`include_embedding` ; elle renvoie toujours la forme objet, qui porte sa
provenance :

```erlang
{ok, Doc} = barrel:get_doc(Db, <<"a">>, #{include_embedding => true}),
#{<<"vector">> := Vector, <<"source">> := Source} = maps:get(<<"_embedding">>, Doc),
%% Source vaut <<"client">> ou <<"computed">>
```

Comme la source voyage dans l’objet, un cycle lecture-modification-écriture
qui renvoie un `_embedding` calculé ne fige jamais un vecteur périmé : la
politique ré-embedde quand le texte change. Seuls les vecteurs marqués comme
saisie client (ou ayant cette forme) remplacent la politique.

L’option d’écriture `vector` est un raccourci pour fournir un vecteur client
sur une écriture :

```erlang
{ok, _} = barrel:put_doc(Db, Doc, #{vector => Vector}).
```

Ordre de priorité quand plusieurs sources sont présentes : l’option
`vector`, puis un `_embedding` client porté dans le document, puis les champs
de la politique.

## Notes

- `vector_add` et `vector_add_batch` renvoient `{error, record_mode}` sur les
  bases en mode enregistrement : le document est le seul chemin d’écriture.
- Les échecs d’embedding en mode asynchrone sont réessayés par document ;
  après 5 échecs, le document est mis de côté (journalisé, son entrée
  d’indexation reste en attente et visible) et le reste de la file continue
  d’avancer.
- `barrel:info/1` indique la politique et la dimension actives.
- Les bases qui utilisent le même modèle local (`local`, `fastembed`, `clip`,
  `splade`, `colbert` : même modèle, même Python et même virtualenv)
  partagent un seul processus de modèle ; il s’arrête quand la dernière
  d’entre elles se ferme. Le processus traite les requêtes de toutes ces
  bases en parallèle.
- Sur `barrel_server`, définissez l’env applicatif `open_opts` de
  `barrel_server` pour ouvrir chaque base avec une politique, par exemple
  `{barrel_server, [{open_opts, #{embedding => ...}}]}` dans `sys.config`.
