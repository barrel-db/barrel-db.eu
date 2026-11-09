---
translation_of: src/content/synced/guides/encryption.md
source_hash: "ccc12877b3d44c16"
title: "Chiffrement au repos"
description: "Barrel peut chiffrer au repos toute une base logique sous une clé propre à la base : les stockages de documents et de pièces jointes, le stockage vectoriel et les fichiers d’index sur disque (BM25, DiskANN). Lisez ce guide quand vos données ne doivent pas être lisibles depuis le disque, ou quand vous voulez des clés par base comme frontière d’isolation entre agents ou locataires."
source: "docs/guides/encryption.md"
---

Barrel peut chiffrer au repos toute une base logique sous une clé propre à
cette base : les stockages de documents et de pièces jointes, le stockage
vectoriel et les fichiers d’index sur disque (BM25, DiskANN). Lisez ce guide
quand vos données ne doivent pas être lisibles depuis le disque, ou quand
vous voulez des clés par base comme frontière d’isolation entre agents ou
locataires.

## Ce que c’est

Vous passez une spécification `encryption` à l’ouverture. Les stockages
RocksDB chiffrent via un EncryptedEnv (AES-256-CTR sur chaque fichier écrit
par RocksDB, WAL et fichiers blob compris), et les fichiers plats mappés en
mémoire (mmap) des index disque sont chiffrés par secteur avec la même clé.
Les clés ne résident jamais sur disque : un jeton de vérification de clé en
clair, posé à côté des données, permet à l’ouverture d’échouer de façon
sûre avec `wrong_encryption_key` au lieu de remonter une corruption, et
distingue les bases chiffrées des bases en clair (`db_is_encrypted`,
`cannot_encrypt_existing_db`).

La clé est résolue par un `barrel_keyprovider` à partir du KEYSPACE de la
base, l’identité sous laquelle les données sont stockées. Une branche de
timeline partage le keyspace de son parent et s’ouvre donc avec la clé du
parent ; une base composée résout une seule clé qui couvre à la fois son
côté docdb et son côté vectordb.

## Quand l’utiliser

- Les données au repos doivent être illisibles sans la clé (disque volé,
  hôtes partagés, sauvegardes de fichiers bruts).
- Des bases par agent ou par locataire, où la clé sert aussi de frontière
  d’isolation : pas de clé, pas de données.

## Comment faire (fournisseur intégré)

Définissez un secret maître dans l’environnement ; chaque base en dérive sa
propre clé (HKDF avec le keyspace) :

```bash
export BARREL_ENCRYPTION_KEY="a long passphrase"   # ou 32 octets bruts / 64 caractères hex
```

```erlang
%% base composée : docdb + vectordb sous une même clé
{ok, Db} = barrel:open(mydb, #{encryption => default,
                               vectordb => #{db_path => "data/mydb_vec"}}),

%% docdb seule
{ok, _} = barrel_docdb:create_db(<<"mydb">>, #{encryption => default}).
```

Le chiffrement est une configuration d’exécution, exactement comme
`channels` : passez-le à nouveau à chaque ouverture. Une base créée en clair
ne peut pas être ouverte chiffrée, et inversement.

## Comment faire (fournisseur personnalisé)

Implémentez `barrel_keyprovider` pour des clés issues d’un KMS ou dérivées
d’un jeton :

```erlang
-module(my_kms_provider).
-behaviour(barrel_keyprovider).
-export([key_for_db/1]).

key_for_db(Keyspace) ->
    {ok, my_kms:data_key(Keyspace)}.   %% doit renvoyer exactement 32 octets
```

```erlang
{ok, Db} = barrel:open(mydb, #{encryption => #{provider => my_kms_provider}}).
```

Une erreur du fournisseur fait échouer l’ouverture (échec sûr).

## Comment faire (serveur REST)

Configurez la spécification dans `sys.config` ; le serveur l’applique à
chaque base qu’il ouvre. Le matériel de clé ne passe jamais par l’API HTTP :

```erlang
{barrel_server, [
    {open_opts, #{encryption => default}}
]}
```

## Comment faire (timeline)

Rien de plus. Le checkpoint d’une branche est chiffré sous la clé du parent
et la branche partage le keyspace du parent : `barrel:branch/3`, la PITR
(`at => T`) et `barrel:merge/1` fonctionnent sans changement sur des bases
chiffrées. Le handle de branche hérite de la spécification de chiffrement du
parent ; rouvrir une branche après un redémarrage demande de repasser la
spécification, comme toute autre configuration d’exécution.

## Notes

- La migration passe par la réplication : créez une nouvelle base chiffrée
  et répliquez dedans. Il n’y a pas de chiffrement sur place des fichiers
  existants.
- Une clé perdue, ce sont des données perdues. Il n’existe aucun moyen de
  récupération.
- La rotation de clé n’est pas encore intégrée ; pour faire tourner une clé,
  répliquez vers une base sous une nouvelle clé.
- Le modèle de menace couvre les données au repos. Le mode CTR (l’EncryptedEnv
  de RocksDB comme le chiffrement par secteur) n’est pas authentifié : un
  attaquant actif ayant accès en écriture aux fichiers est hors périmètre.
  Les clés en mémoire sont des binaires BEAM ordinaires et ne sont pas
  remises à zéro.
- Les index de recherche vectorielle sont couverts : l’état HNSW et FAISS est
  persisté dans le RocksDB chiffré ; les fichiers plats BM25 disque et
  DiskANN utilisent le chiffrement par secteur, et leurs RocksDB de
  correspondance d’identifiants s’ouvrent sous le même env. Un index DiskANN
  chiffré utilise toujours sa propre base d’identifiants autonome.
- Erreurs de mauvaise clé ou d’incohérence à l’ouverture :
  `wrong_encryption_key`, `db_is_encrypted`, `cannot_encrypt_existing_db`,
  et pour les fichiers d’index disque `index_is_encrypted` /
  `cannot_encrypt_legacy_index`.
