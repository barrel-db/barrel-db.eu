---
title: Installation
description: Ajoutez Barrel a votre projet Erlang, et les options pour le serveur et le client navigateur.
---

Vous ajoutez Barrel a votre projet comme une dependance Hex et vous le demarrez
comme n'importe quelle autre application OTP. Lisez ceci quand vous mettez en
place un nouveau projet, ou quand vous ajoutez Barrel a un projet existant.

## Prerequis

- Erlang/OTP 28 ou plus recent
- rebar3
- Un compilateur C/C++ et CMake (la couche vectorielle compile un petit NIF)

## Ajouter la dependance

Ajoutez `barrel` a votre `rebar.config` :

```erlang
{deps, [
    {barrel, "~> 1.0"}
]}.
```

Puis demarrez-le. Demarrer `barrel` lance les couches document et vecteur qu'il
compose :

```erlang
{ok, _} = application:ensure_all_started(barrel).
```

Vous etes pret a [ouvrir une base de donnees](/fr/docs/get-started/quickstart).

## Utiliser une seule couche

Barrel est une seule base de donnees faite de bibliotheques independantes. Si
vous n'en avez besoin que d'une, dependez-en directement a la place :

```erlang
{deps, [
    {barrel_docdb, "~> 1.0"},     %% documents only
    {barrel_vectordb, "~> 2.1"}   %% vectors only
]}.
```

## Ajouter le serveur

Pour exposer la meme base de donnees via HTTP (REST/JSON) et MCP, ajoutez
`barrel_server` :

```erlang
{deps, [
    {barrel_server, "~> 1.0"}
]}.
```

Voir [Lancer le serveur](/fr/docs/server/rest-server) pour la configuration et
les routes.

## L'utiliser dans le navigateur

`barrel-lite` est le client TypeScript offline-first. Il vit dans le depot Barrel
sous `clients/barrel-lite` et se synchronise avec un `barrel_server` en cours
d'execution. Voir le [guide du client navigateur](/fr/docs/guides/barrel-lite).
