---
title: Chiffrement au repos
description: Chiffrez toute une base de donnees logique au repos sous une seule cle par base, y compris ses fichiers document, pieces jointes, vecteur et index.
---

Barrel peut chiffrer toute une base de donnees logique au repos sous une seule
cle par base : les stores document et pieces jointes, le store vectoriel, et les
fichiers d'index sur disque (BM25, DiskANN). Lisez ceci quand vos donnees ne
doivent pas etre lisibles depuis le disque, ou quand vous voulez des cles par base
comme frontiere d'isolation entre agents ou locataires.

## Ce que c'est

Vous passez une spec `encryption` a l'ouverture. Les stores RocksDB chiffrent a
travers un EncryptedEnv (AES-256-CTR sur chaque fichier que RocksDB ecrit, y
compris le WAL et les fichiers de blob), et les fichiers plats en mmap des index
sur disque chiffrent par secteur avec la meme cle. Les cles ne vivent jamais sur
disque : un jeton de verification de cle en clair a cote des donnees permet a une
ouverture d'echouer en fermeture avec `wrong_encryption_key` au lieu de faire
surface a une corruption, et distingue les bases de donnees chiffrees des bases en
clair (`db_is_encrypted`, `cannot_encrypt_existing_db`).

La cle est resolue par un `barrel_keyprovider` depuis le KEYSPACE de la base de
donnees, sous lequel les donnees d'identite sont stockees. Une branche de timeline
partage le keyspace de son parent, elle s'ouvre donc avec la cle du parent ; une
base de donnees composee resout une seule cle qui couvre a la fois ses cotes docdb
et vectordb.

## Quand l'utiliser

- Les donnees au repos doivent etre illisibles sans la cle (disque vole, hotes
  partages, sauvegardes de fichiers bruts).
- Bases de donnees par agent ou par locataire ou la cle sert aussi de frontiere
  d'isolation : pas de cle, pas de donnees.

## Comment (fournisseur integre)

Definissez un secret maitre dans l'environnement ; chaque base de donnees derive
sa propre cle de celui-ci (HKDF avec le keyspace) :

```bash
export BARREL_ENCRYPTION_KEY="a long passphrase"   # or 32 raw bytes / 64 hex chars
```

```erlang
%% composed database: docdb + vectordb under one key
{ok, Db} = barrel:open(mydb, #{encryption => default,
                               vectordb => #{db_path => "data/mydb_vec"}}),

%% docdb alone
{ok, _} = barrel_docdb:create_db(<<"mydb">>, #{encryption => default}).
```

Le chiffrement est une config d'execution, exactement comme `channels` :
repassez-le a chaque ouverture. Une base de donnees creee en clair ne peut pas etre
ouverte chiffree et inversement.

## Comment (fournisseur personnalise)

Implementez `barrel_keyprovider` pour des cles derivees d'un KMS ou d'un jeton :

```erlang
-module(my_kms_provider).
-behaviour(barrel_keyprovider).
-export([key_for_db/1]).

key_for_db(Keyspace) ->
    {ok, my_kms:data_key(Keyspace)}.   %% must return exactly 32 bytes
```

```erlang
{ok, Db} = barrel:open(mydb, #{encryption => #{provider => my_kms_provider}}).
```

Une erreur de fournisseur fait echouer l'ouverture (fail-closed).

## Comment (serveur REST)

Configurez la spec dans `sys.config` ; le serveur l'applique a chaque base de
donnees qu'il ouvre. Le materiel de cle ne voyage jamais sur l'API HTTP :

```erlang
{barrel_server, [
    {open_opts, #{encryption => default}}
]}
```

## Comment (timeline)

Rien de plus. Le checkpoint d'une branche est du texte chiffre sous la cle du
parent et la branche partage le keyspace du parent, ainsi `barrel:branch/3`,
PITR (`at => T`), et `barrel:merge/1` fonctionnent sans changement sur les bases
de donnees chiffrees. Le handle de branche herite de la spec de chiffrement du
parent ; rouvrir une branche apres un redemarrage a de nouveau besoin de la spec,
comme toute autre config d'execution.

## Notes

- La migration se fait par replication : creez une base de donnees chiffree neuve
  et repliquez dedans. Il n'y a pas de chiffrement sur place des fichiers
  existants.
- Une cle perdue signifie des donnees perdues. Il n'y a pas de chemin de
  recuperation.
- La rotation de cle n'est pas encore integree ; faites la rotation en repliquant
  dans une base de donnees sous une nouvelle cle.
- Le modele de menace est celui des donnees au repos. CTR (a la fois l'EncryptedEnv
  de RocksDB et le chiffre de secteur) n'est pas authentifie, un attaquant actif
  avec acces en ecriture aux fichiers est donc hors perimetre. Les cles en memoire
  sont des binaires BEAM ordinaires et ne sont pas mises a zero.
- Les index de recherche vectorielle sont couverts : l'etat HNSW et FAISS persiste
  dans le RocksDB chiffre ; les fichiers plats BM25 sur disque et DiskANN utilisent
  le chiffre de secteur, et leurs RocksDB de correspondance d'id s'ouvrent sous le
  meme env. Un index DiskANN chiffre utilise toujours sa propre base de donnees
  d'id autonome.
- Erreurs de mauvaise cle et d'incompatibilite a l'ouverture : `wrong_encryption_key`,
  `db_is_encrypted`, `cannot_encrypt_existing_db`, et pour les fichiers d'index sur
  disque `index_is_encrypted` / `cannot_encrypt_legacy_index`.
