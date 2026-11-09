---
translation_of: src/content/docs/start/install.md
source_hash: "991b1d373b65776c"
title: Installer
description: Ajoutez Barrel à un projet Erlang depuis Hex, compilez le serveur depuis l’umbrella, ou compilez barrel-lite pour le navigateur.
---

Cette page indique quoi installer pour chaque façon de faire tourner
Barrel : la bibliothèque `barrel` depuis Hex pour une application Erlang,
la compilation de l’umbrella pour `barrel_server`, et une compilation
locale de `barrel-lite` pour le navigateur. Lisez-la avant un démarrage
rapide si votre machine n’a encore jamais compilé Barrel.

## Prérequis

Ce qu’il vous faut dépend du mode que vous faites tourner. Chaque élément
ci-dessous dit à quoi il sert : vous pouvez sauter ce que votre mode
n’utilise pas.

- **Erlang/OTP 26 ou plus récent, et rebar3.** Barrel est écrit en
  Erlang : la bibliothèque et le serveur ont besoin du runtime Erlang.
  Le client navigateur n’en a pas besoin, mais il se synchronise avec un
  serveur qui, lui, en a besoin. rebar3 est l’outil de compilation d’Erlang : il
  récupère les dépendances depuis Hex et les compile.
- **CMake et un compilateur C/C++.** Certaines parties de Barrel sont du
  code natif compilé sur votre machine : RocksDB (le moteur de stockage
  qui écrit les documents sur disque), le stockage vectoriel et l’index
  ngram.
- **git**, pour le serveur depuis les sources : vous clonez le dépôt
  Barrel pour compiler `barrel_server`.
- **Node.js 20 ou plus récent, et npm**, pour le client navigateur : ils
  servent à compiler `barrel-lite` et à l’ajouter à votre application
  web.
- **Optionnel, pour des embeddings locaux :** Python 3 (le fournisseur
  `local`) ou un [Ollama](https://ollama.com) en marche. Un
  [embedding](/fr/docs/concepts/glossary#embedding) est la liste de
  nombres qui permet à Barrel de rechercher un texte par son sens ; ces
  outils le calculent sur votre machine au lieu d’appeler une API cloud.
  Voir [Choisir un fournisseur
  d’embeddings](/fr/docs/search/embedding-providers).

## Ajouter barrel à un projet Erlang

Suivez cette partie quand votre application est écrite en Erlang ou en
Elixir et que Barrel tourne à l’intérieur : c’est le mode
[embarqué](/fr/docs/concepts/glossary#embedded). Toutes les
bibliothèques sont sur Hex, le registre de paquets d’Erlang et d’Elixir. Ajoutez `barrel` à `rebar.config` :

```erlang
{deps, [{barrel, "~> 1.12"}]}.
```

Ajoutez-la à la liste `applications` de votre application dans
`src/*.app.src`, pour qu’elle démarre avec votre application, puis
récupérez et compilez :

```shell
rebar3 compile
```

Ajoutez une bibliothèque seule quand vous n’avez besoin que de cette
partie, par exemple `{barrel_docdb, "~> 2.1"}` pour les documents et la
réplication sans vecteurs, ou `{barrel_ngram, "~> 0.11"}` pour la
recherche de sous-chaînes.

Indiquez où vont les données, dans `config/sys.config`. `data_dir` est le
répertoire où les documents sont écrits sur disque :

```erlang
[{barrel_docdb, [{data_dir, "data/docdb"}]}].
```

La valeur par défaut est `data/barrel_docdb`, relative au répertoire
courant.

## Compiler le serveur depuis l’umbrella

Suivez cette partie quand vos clients accèdent à Barrel sur HTTP ou MCP.
[`barrel_server`](/fr/docs/concepts/glossary#barrel-server) se compile
depuis l’umbrella, le dépôt Barrel qui contient toutes les bibliothèques.
Il se trouve derrière le profil `server`, une configuration de
compilation nommée, et ne fait pas partie de la compilation par défaut.

```shell
git clone https://github.com/barrel-db/barrel.git
cd barrel
rebar3 as server compile
```

Pour produire une release à la place, un répertoire autonome que vous
copiez sur une machine et démarrez :

```shell
rebar3 as server,prod release -n barrel_server
```

[Démarrage rapide : serveur](/fr/docs/start/quickstart-server) le lance.

## Parties optionnelles

Elles ajoutent des fonctions dont la plupart des installations n’ont pas
besoin. Installez-les seulement quand vous utilisez la fonction.

| Partie | Comment |
|------|-----|
| Backend vectoriel FAISS | `rebar3 as faiss compile`, avec une bibliothèque FAISS système |
| Pièces jointes S3 (`barrel_att_s3`) | `rebar3 as s3 compile`, ou le paquet Hex |
| Reranking (`barrel_rerank`) | Python 3 avec transformers et torch |

## Compiler barrel-lite

Suivez cette partie quand une application web garde sa propre copie des
données. [`barrel-lite`](/fr/docs/concepts/glossary#barrel-lite) n’est
pas publié sur npm : compilez-le depuis l’umbrella :

```shell
cd barrel/clients/barrel-lite
npm ci
npm run build
```

Puis ajoutez-le à votre application web depuis ce répertoire :

```shell
npm install /path/to/barrel/clients/barrel-lite
```

[Démarrage rapide : navigateur](/fr/docs/start/quickstart-browser)
l’utilise.

## Notes

- Sans `vectordb => #{db_path => ...}`, une base place son stockage
  vectoriel à côté de ses documents, dans `<data_dir>/<name>.vectordb`.
  Un stockage créé avant barrel 1.13.0 dans
  `./priv/barrel_vectordb_<name>` sous le répertoire courant y reste ;
  définissez `db_path` pour le déplacer.
