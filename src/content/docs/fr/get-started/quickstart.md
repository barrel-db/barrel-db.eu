---
title: Demarrage rapide
description: Ouvrez une base de donnees, stockez un document, interrogez-le, et lancez une recherche vectorielle, en quelques minutes.
---

Ceci vous mene d'un projet vide au stockage, a l'interrogation et a la recherche
de documents avec l'API embarquee `barrel`. Vous devez avoir Barrel
[installe](/fr/docs/get-started/installation) au prealable.

## Ouvrir une base de donnees

Demarrez l'application et ouvrez une base de donnees. Ouvrez-la depuis un
processus a longue duree de vie (un gen_server ou un superviseur), car la base de
donnees lie son stockage vectoriel au processus qui l'a ouverte.

```erlang
{ok, _} = application:ensure_all_started(barrel),

{ok, Db} = barrel:open(mydb).
```

Pour activer la recherche par mot-cle, ou fixer la dimension du vecteur, passez
des options par couche :

```erlang
{ok, Db} = barrel:open(mydb, #{
    vectordb => #{dimension => 768, bm25_backend => memory}
}).
```

## Stocker et lire un document

Un document est une map. Il partage son id avec ses pieces jointes et son
vecteur.

```erlang
{ok, _}   = barrel:put_doc(Db, #{<<"id">> => <<"a">>, <<"title">> => <<"hello">>}),
{ok, Doc} = barrel:get_doc(Db, <<"a">>).
```

## Interroger avec BQL

Interrogez la base de donnees avec BQL, un dialecte PartiQL. Les chemins du
document sont indexes pour vous, il n'y a donc pas d'index a creer.

```erlang
{ok, Rows, _Meta} = barrel:query(Db,
    <<"SELECT id, title FROM db WHERE title = 'hello'">>).
```

## Ajouter un vecteur et rechercher

Attachez un vecteur a un document, puis recherchez par vecteur ou par mot-cle :

```erlang
ok = barrel:vector_add(Db, <<"a">>, <<"hello world">>, #{}, Vector),

{ok, Hits}  = barrel:search_vector(Db, Vector, #{k => 5}),
{ok, BHits} = barrel:search_bm25(Db, <<"hello">>, #{k => 5}).
```

Pour garder les vecteurs automatiquement en phase avec vos documents, ouvrez la
base de donnees avec une politique d'embedding au lieu d'ajouter les vecteurs a
la main. Voir [Mode enregistrement](/fr/docs/guides/record-mode).

## Etapes suivantes

- Comprenez le [modele de donnees](/fr/docs/concepts/data-model) : un id, trois
  formes.
- Apprenez [les requetes avec BQL](/fr/docs/guides/query-bql) en profondeur.
- [Synchronisez](/fr/docs/guides/synchronization) entre bases de donnees, ou vers
  le [navigateur](/fr/docs/guides/barrel-lite).
