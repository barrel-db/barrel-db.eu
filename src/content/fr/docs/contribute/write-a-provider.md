---
translation_of: src/content/docs/contribute/write-a-provider.md
source_hash: "364c22ee5508cdd8"
title: Écrire un fournisseur d’embeddings
description: Implémenter le behaviour barrel_embed_provider pour brancher votre propre modèle d’embedding dans Barrel, avec un module de fournisseur minimal que vous pouvez compiler et exécuter.
---

Un fournisseur d’embeddings transforme du texte en vecteurs pour barrel_embed, et par lui pour le mode enregistrement, `search/3`, `vector_top_k` et `hybrid_top_k`. Écrivez-en un quand le modèle dont vous avez besoin ne fait pas partie des [fournisseurs intégrés](/fr/docs/search/embedding-providers) : un service interne, un modèle que vous exécutez dans le processus, ou un embedder déterministe pour les tests. Tout module qui implémente le behaviour `barrel_embed_provider` peut être nommé là où l’on attend un identifiant de fournisseur.

## Les callbacks

| Callback | Obligatoire | Renvoie |
|---|---|---|
| `name() -> atom()` | oui | Le nom du fournisseur, affiché par `info/1` |
| `dimension(Config) -> pos_integer()` | oui | La taille des vecteurs qu’il produit |
| `embed(Text, Config)` | oui | `{ok, [float()]}` ou `{error, Reason}` ; `Text` est un binaire |
| `embed_batch(Texts, Config)` | oui | `{ok, [[float()]]}`, un vecteur par texte, dans l’ordre, ou `{error, Reason}` |
| `init(Config)` | non | `{ok, NewConfig}` ou `{error, Reason}` ; appelé une fois au démarrage de la chaîne |
| `available(Config) -> boolean()` | non | S’il faut utiliser le fournisseur maintenant ; `false` passe au suivant dans une chaîne |
| `model_info(Config)` | non | `#{model := binary() \| undefined, revision => binary()}` ; pure, sans réseau |

`Config` est la map que vous passez à côté du nom du module, telle que renvoyée par `init/1`.

## Un fournisseur minimal

Celui-ci hache les mots dans un nombre fixe de cases et normalise le résultat. Il rapproche les mots en commun, il n’est pas sémantique, mais il ne demande aucun réseau et donne toujours le même vecteur, ce qui le rend utile dans les tests.

```erlang
-module(word_embed).
-behaviour(barrel_embed_provider).

-export([name/0, dimension/1, embed/2, embed_batch/2]).
-export([init/1, available/1, model_info/1]).

-define(DEFAULT_DIM, 64).

name() -> word_embed.

dimension(Config) -> maps:get(dimension, Config, ?DEFAULT_DIM).

init(Config) ->
    {ok, Config#{dimension => dimension(Config)}}.

available(_Config) -> true.

model_info(Config) ->
    #{model => <<"word-hash">>,
      revision => integer_to_binary(dimension(Config))}.

embed(Text, Config) ->
    {ok, vector(Text, dimension(Config))}.

embed_batch(Texts, Config) ->
    Dim = dimension(Config),
    {ok, [vector(T, Dim) || T <- Texts]}.

%% Une case par hash de mot, normalisé à une longueur unité.
vector(Text, Dim) ->
    Words = string:lexemes(string:lowercase(Text),
                           " \n\t.,;:!?()"),
    Counts = lists:foldl(
               fun(W, Acc) ->
                   I = erlang:phash2(W, Dim) + 1,
                   setelement(I, Acc, element(I, Acc) + 1.0)
               end, erlang:make_tuple(Dim, 0.0), Words),
    L = tuple_to_list(Counts),
    case math:sqrt(lists:sum([X * X || X <- L])) of
        +0.0 -> L;
        N -> [X / N || X <- L]
    end.
```

## L’essayer avec barrel_embed

```erlang
{ok, St} = barrel_embed:init(#{
    embedder => {word_embed, #{dimension => 64}},
    dimensions => 64}),
{ok, Vec} = barrel_embed:embed(<<"hello world">>, St),
64 = length(Vec),
barrel_embed:info(St).
```

Sortie du dernier appel, d’une exécution sur l’umbrella à main `c111ec4` :

```text
#{dimension => 64,
  providers =>
      [#{module => word_embed,name => word_embed,
         model => <<"word-hash">>,revision => <<"64">>}],
  configured => true}
```

Passez aussi `dimensions` à `init/1` : `barrel_embed:dimension/1` renvoie cette valeur (768 si elle n’est pas définie), pas celle du fournisseur.

## L’utiliser dans une base

Nommez le module dans une politique d’embedding, ou dans une configuration de magasin de vecteurs :

```erlang
{ok, Db} = barrel:open(<<"notes">>, #{
    embedding => #{
        fields => [<<"title">>, <<"body">>],
        mode => sync,
        embedder => {word_embed, #{dimension => 64}},
        dimensions => 64},
    vectordb => #{db_path => "/var/lib/app/vec/notes"}}).
```

`barrel:embedder_info(Db)` indique alors `provider => word_embed`, le `model` et la `revision` tirés de `model_info/1`, et une `fingerprint` qui identifie l’espace vectoriel. Le modèle et la révision font partie de cette identité : gardez `model_info/1` exact.

## Le placer dans une chaîne

Une liste de fournisseurs forme une chaîne de repli : chaque appel va au premier fournisseur dont `available/1` renvoie true et dont l’appel réussit.

```erlang
{ok, St} = barrel_embed:init(#{
    embedder => [{ollama, #{url => <<"http://localhost:11434">>}},
                 {word_embed, #{dimension => 64}}],
    dimensions => 64}).
```

Quand Ollama est arrêté, l’appel est servi par `word_embed` (vérifié avec Ollama injoignable). Chaque fournisseur d’une chaîne doit produire des vecteurs de la même taille.

## Remarques

- barrel_embed enveloppe vos appels : une exception dans `embed/2` ou `embed_batch/2` devient `{error, {provider_error, Module, _}}` et la chaîne passe au suivant.
- Sans `model_info/1`, le modèle vient de la clé `model` de la configuration. Si aucun modèle n’est connu, il n’y a pas d’empreinte, et les résultats vectoriels ne peuvent pas être comparés entre bases ou contextes.
- `available/1` s’exécute avant chaque appel. Gardez-la légère : un fournisseur distant qui y envoie une requête ajoute un aller-retour par embedding.
- `embed_batch/2` reçoit des blocs de `batch_size` textes (32 par défaut, réglable dans la configuration de `init/1`).
- Si `init/1` échoue pour tous les fournisseurs, `barrel_embed:init/1` renvoie `{error, no_providers_available}` ; quand tous les fournisseurs échouent sur un appel, `{error, all_providers_failed}`.
- L’exemple de la moduledoc de `barrel_embed_provider` construit `embed_batch/2` à partir de `embed/2` et renvoie une liste de tuples `{ok, Vector}` ; renvoyez des vecteurs simples, comme ci-dessus.
