---
title: Mode enregistrement
description: Indexation vectorielle pilotee par politique qui garde chaque document et son vecteur synchronises pour une recherche semantique et hybride sans gerer les vecteurs.
---

Le mode enregistrement fait d'un document et de son vecteur une seule unite :
vous ecrivez des documents, et barrel garde l'index vectoriel synchronise avec
eux, pilote par une politique d'embedding par base de donnees. Le store vectoriel
ne contient que des vecteurs et des index ; les resultats de recherche lisent le
texte et les metadonnees dans les documents courants. Lisez ceci quand vous
voulez une recherche semantique ou hybride sur vos documents sans gerer les
vecteurs vous-meme.

## Quand l'utiliser

- Vous ecrivez des documents JSON et voulez une recherche vecteur/BM25/hybride sur
  des champs choisis, maintenue coherente a chaque mise a jour et suppression.
- Vous ne voulez pas appeler `vector_add` a la main ni dupliquer du texte dans un
  store vectoriel.
- Pour une gestion vectorielle directe (vous possedez les ids et les vecteurs
  separement des documents), utilisez plutot une base de donnees ordinaire et
  l'API `vector_*`.

## Ouvrir une base en mode enregistrement

Passez une politique `embedding` a `barrel:open/2`. L'application `barrel` doit
etre en cours d'execution (elle supervise l'indexeur par base de donnees).

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel:open(notes, #{
    embedding => #{
        fields => [<<"title">>, [<<"body">>, <<"text">>]],
        mode => async,                     %% default; sync = read-your-write
        embedder => {local, #{}},          %% barrel_embed provider chain
        dimensions => 768,
        metadata_fields => [<<"kind">>]    %% optional projection
    }
}).
```

- `fields` sont des chemins dans le document ; leurs valeurs binaires sont jointes
  (`join`, par defaut `<<"\n">>`) dans le texte dont l'embedding est calcule.
- Sans `metadata_fields`, les metadonnees de recherche sont le document moins `id`
  et les cles prefixees par `_`.
- BM25 utilise par defaut le backend disque en mode enregistrement pour que la
  recherche par mot-cle survive aux redemarrages.
- La politique est persistee dans la base de donnees ; rouvrir avec une politique
  differente journalise un avertissement et ne l'applique qu'aux nouvelles
  ecritures (pas de reindexation automatique).

## Ecrire des documents, les rechercher

```erlang
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>,
                               <<"title">> => <<"quick brown fox">>,
                               <<"kind">> => <<"animal">>}),

{ok, Hits}  = barrel:search(Db, <<"fast fox">>, #{k => 5}),
{ok, HHits} = barrel:search_hybrid(Db, <<"fox">>, #{k => 5}),
{ok, BHits} = barrel:search_bm25(Db, <<"fox">>, #{k => 5}).
```

Les resultats portent `key`, `score`, ainsi que le `text` et les `metadata`
derives du document. Les mises a jour recalculent l'embedding ; les suppressions
retirent le vecteur ; les documents sans champ de politique n'ont pas de vecteur.

## Async et sync

`mode => async` (par defaut) : les ecritures reviennent immediatement et un
indexeur supervise calcule l'embedding en arriere-plan. L'ecriture et son
intention d'indexation sont validees de maniere atomique, ainsi un crash a
n'importe quel moment est repare par l'indexeur ; aucune ecriture n'est jamais
perdue entre le document et son vecteur.

`mode => sync` : l'embedding du texte est calcule avant l'ecriture et le vecteur
est indexe avant que `put_doc` ne retourne, ainsi une recherche lancee juste apres
voit le document. Un echec d'embedding fait echouer le put avec
`{error, {embed_failed, Reason}}` et rien n'est ecrit.

## La propriete _embedding

Le vecteur de chaque document indexe vit dans la propriete reservee `_embedding`,
quel que soit ce qui l'a calcule. Il est stocke comme donnee derivee a cote du
document (jamais dans le corps, il ne change donc pas la revision), il n'est
jamais indexe par chemin, et il n'apparait jamais dans les metadonnees de
recherche.

Fournissez votre propre embedding en le portant dans le document, sous forme de
vecteur nu ou d'objet ; il est indexe a la place de tout ce que la politique
calculerait :

```erlang
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>,
                               <<"title">> => <<"quick fox">>,
                               <<"_embedding">> => Vector}).
```

Avec des embeddings fournis par le client, la politique peut etre vide : ouvrez
avec `embedding => #{dimensions => 768}` (sans `fields`) et aucun embedder n'est
necessaire. La longueur du vecteur est verifiee par rapport a la dimension de la
base de donnees avant l'ecriture ; les lots avec un `_embedding` de mauvaise
longueur sont rejetes en entier.

Les vecteurs calcules par la politique sont aussi stockes dans `_embedding` : de
maniere atomique avec l'ecriture en mode sync, via l'indexeur en mode async.
Relisez la propriete avec `include_embedding` ; elle renvoie toujours la forme
objet, qui porte sa provenance :

```erlang
{ok, Doc} = barrel:get_doc(Db, <<"a">>, #{include_embedding => true}),
#{<<"vector">> := Vector, <<"source">> := Source} = maps:get(<<"_embedding">>, Doc),
%% Source is <<"client">> or <<"computed">>
```

Parce que la source voyage a l'interieur de l'objet, une lecture-modification-
ecriture qui renvoie un `_embedding` calcule ne fige jamais un vecteur perime : la
politique recalcule l'embedding quand le texte change. Seuls les vecteurs marques
(ou formes) comme une entree client supplantent la politique.

L'option de put `vector` est un raccourci pour fournir un vecteur client sur une
ecriture :

```erlang
{ok, _} = barrel:put_doc(Db, Doc, #{vector => Vector}).
```

Priorite quand plusieurs sources sont presentes : l'option `vector`, puis un
`_embedding` client porte dans le document, puis les champs de la politique.

## Notes

- `vector_add` et `vector_add_batch` renvoient `{error, record_mode}` sur les
  bases de donnees en mode enregistrement : le document est le seul chemin
  d'ecriture.
- Les echecs d'embedding en mode async reessaient par document ; apres 5 echecs le
  document est parque (journalise, son entree d'indexation reste en attente et
  visible) et le reste de la file continue d'avancer.
- `barrel:info/1` rapporte la politique active et la dimension.
- Sur `barrel_server`, definissez l'app env `open_opts` de `barrel_server` pour
  ouvrir chaque base de donnees avec une politique, par exemple
  `{barrel_server, [{open_opts, #{embedding => ...}}]}` dans `sys.config`.
