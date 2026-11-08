---
translation_of: src/content/docs/start/install.md
source_hash: "bf40e80cf4addc71"
title: Installer
description: Ajoutez Barrel à un projet Erlang depuis Hex, compilez le serveur depuis l’umbrella, ou compilez barrel-lite pour le navigateur.
---

Cette page indique quoi installer pour chaque façon de faire tourner
Barrel : la bibliothèque `barrel` depuis Hex pour une application Erlang,
la compilation de l’umbrella pour `barrel_server`, et une compilation
locale de `barrel-lite` pour le navigateur. Lisez-la avant un démarrage
rapide si votre machine n’a encore jamais compilé Barrel.

## Prérequis

- Erlang/OTP 26 ou plus récent, et rebar3.
- CMake et un compilateur C/C++. RocksDB, le stockage vectoriel et l’index
  ngram compilent du code natif.
- Pour le serveur depuis les sources : git.
- Pour le client navigateur : Node.js 20 ou plus récent, et npm.
- Optionnel, pour des embeddings locaux : Python 3 (le fournisseur
  `local`) ou un [Ollama](https://ollama.com) en marche. Voir [Choisir un
  fournisseur d’embeddings](/fr/docs/search/embedding-providers).

## Ajouter barrel à un projet Erlang

Toutes les bibliothèques sont sur Hex. Ajoutez `barrel` à `rebar.config` :

```erlang
{deps, [{barrel, "~> 1.12"}]}.
```

Ajoutez-la à la liste `applications` de votre application dans
`src/*.app.src`, puis récupérez et compilez :

```shell
rebar3 compile
```

Ajoutez une bibliothèque seule quand vous n’avez besoin que de cette
partie, par exemple `{barrel_docdb, "~> 2.1"}` pour les documents et la
réplication sans vecteurs, ou `{barrel_ngram, "~> 0.11"}` pour la
recherche de sous-chaînes.

Indiquez où vont les données, dans `config/sys.config` :

```erlang
[{barrel_docdb, [{data_dir, "data/docdb"}]}].
```

La valeur par défaut est `data/barrel_docdb`, relative au répertoire
courant.

## Compiler le serveur depuis l’umbrella

`barrel_server` se trouve derrière le profil `server` de l’umbrella. Il
ne fait pas partie de la compilation par défaut.

```shell
git clone https://github.com/barrel-db/barrel.git
cd barrel
rebar3 as server compile
```

Pour produire une release à la place :

```shell
rebar3 as server,prod release -n barrel_server
```

[Démarrage rapide : serveur](/fr/docs/start/quickstart-server) le lance.

## Parties optionnelles

| Partie | Comment |
|------|-----|
| Backend vectoriel FAISS | `rebar3 as faiss compile`, avec une bibliothèque FAISS système |
| Pièces jointes S3 (`barrel_att_s3`) | `rebar3 as s3 compile`, ou le paquet Hex |
| Reranking (`barrel_rerank`) | Python 3 avec transformers et torch |

## Compiler barrel-lite

`barrel-lite` n’est pas publié sur npm. Compilez-le depuis l’umbrella :

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
  vectoriel dans `./priv/barrel_vectordb_<name>` sous le répertoire
  courant, et non sous `data_dir`. Définissez `db_path` pour chaque base
  qui a des vecteurs.
