---
translation_of: src/content/synced/contribute/end-to-end-tests.md
source_hash: "1eeaf46ea574d453"
title: "Tests de bout en bout"
description: "Des tests qui exécutent la vraie release dans des processus séparés, pas dans une seule VM."
source: "test/e2e/README.md"
---

Des tests qui exécutent la vraie release dans des processus séparés, pas dans
une seule VM.

## Réplication

`replication.sh` lance deux conteneurs `barrel_server` sur un même réseau et
réplique entre eux en HTTP. Contrairement à `barrel_server_rep_SUITE`, qui
exécute les deux pairs dans une seule VM (le serveur est un singleton
enregistré), ce sont ici de vrais processus OS séparés : le chemin sur le
protocole, l’isolation des processus et le réseau sont tous réels.

```console
$ test/e2e/replication.sh
```

Le script construit l’image, démarre `peer-a` et `peer-b`, puis :

- écrit des documents sur peer-a et les pousse vers peer-b, en vérifiant la
  convergence ;
- écrit sur peer-b et tire vers peer-a ;
- supprime un document sur peer-a et pousse à nouveau, en vérifiant que la
  suppression se propage ;
- démarre une tâche de push continue `barrel_rep_tasks` entre les pairs,
  écrit un document et vérifie qu’il converge, puis ajoute une pièce jointe à
  ce même document **sans autre modification du document** et vérifie
  qu’elle converge aussi. Les pièces jointes ont leur propre flux,
  indépendant du flux de changements des documents : ce scénario ne passe
  donc que si une tâche continue remarque d’elle-même une activité limitée
  aux pièces jointes (réveil borné), et non parce qu’une écriture de document
  vient la relancer par hasard.

Un code de sortie 0 signifie que toutes les vérifications ont réussi. Le
script démonte la pile en sortant.

La réplication est déclenchée dans un pair avec `barrel_server eval`, qui
évalue sur le nœud en cours d’exécution : elle exécute donc le vrai
algorithme `barrel_rep` (ou, pour le scénario de tâche continue,
`barrel_rep_tasks:start_task/1`) contre les points d’accès `_sync` de l’autre
pair.

## Réplication active-active

`active-active.sh` lance trois pairs qui acceptent tous des écritures et
vérifie qu’ils convergent sans perdre d’écriture :

```console
$ test/e2e/active-active.sh
```

Il couvre des modifications concurrentes sur deux pairs, neuf modifications
par-dessus la version gagnante (l’écriture perdante reste), une suppression
face à une modification, une résolution en HTTP avec `_observed`, l’arrivée
d’un nouveau pair vide, un pair qui s’arrête puis revient avec sa propre
modification (en apprenant celles des autres par un relais), deux pairs qui
résolvent en même temps, une réplication filtrée qui transporte une
suppression, et une tâche continue dans les deux sens avec des écritures
concurrentes. Chaque scénario compare le digest d’état des documents
(`_sync/state`) sur chaque pair.

## Versions mélangées

`mixed-version.sh` construit un pair à partir d’une release plus ancienne
(`OLD_REF`, par défaut `barrel_server-v1.11.1`, la dernière release avant la
réplication par état complet) et le réplique avec deux pairs mis à niveau,
dans les deux sens, avec le réplicateur d’un côté ou de l’autre :

```console
$ test/e2e/mixed-version.sh
```

L’ancien pair reçoit la version gagnante de chaque document. Ses
modifications et suppressions atteignent les pairs mis à niveau comme de
nouvelles versions à côté de celles qu’elles remplaçaient : elles y
apparaissent comme des conflits et rien n’est perdu ; une résolution faite
sur un pair mis à niveau atteint l’ancien pair et n’est pas défaite par lui.

## Crashs

`crash.sh` tue des pairs avec SIGKILL pendant la réplication :

```console
$ test/e2e/crash.sh
```

Il tue la cible d’un push continu au milieu d’un lot, puis le pair qui
exécute la tâche (les écritures acquittées doivent survivre et la tâche
restaurée doit aller au bout), puis l’un de deux pairs qui écrivent les
mêmes identifiants pendant qu’une tâche bidirectionnelle tourne. Chaque
écriture acquittée doit se trouver sur les deux pairs une fois qu’ils ont
convergé.

## Coupures de courant

`power-fail.sh` place le répertoire de données de chaque pair sur
[LazyFS](https://github.com/dsrhaslab/lazyfs), un système de fichiers FUSE
qui garde dans sa propre mémoire chaque écriture qui n’a pas été synchronisée
par fsync. Une coupure de courant tue le serveur, efface cette mémoire et
redémarre le conteneur : ce qui n’était pas synchronisé disparaît, comme
après une vraie perte d’alimentation. Les conteneurs tournent en mode
privilégié (FUSE).

```console
$ test/e2e/power-fail.sh
```

Il vérifie d’abord le harnais (un fichier non synchronisé perd ses données,
un fichier synchronisé les garde), puis : les écritures faites avec
`sync => true` survivent ; une cible qui perd un lot qu’elle avait acquitté
le reçoit à nouveau, depuis une exécution ponctuelle comme depuis une tâche
continue ; et un pair qui perd des écritures ayant déjà atteint l’autre pair
les récupère par une tâche bidirectionnelle.

## Backend de pièces jointes S3

`attachments-s3.sh` lance de vrais conteneurs RustFS et Garage ainsi que
deux pairs `barrel_server` construits avec le backend de pièces jointes S3
(le profil rebar3 `s3_server`), et l’exerce par de vraies routes HTTP et un
vrai réseau, et non par la suite CT directement contre le module du backend
(celle-ci est `apps/barrel_att_s3/test/barrel_att_s3_SUITE.erl`).

```console
$ test/e2e/attachments-s3.sh
```

peer-a garde le backend de pièces jointes par défaut (RocksDB) ; les bases de
peer-b pointent leurs `att_opts` vers RustFS ou Garage. Le script :

- provisionne RustFS et Garage (`attachments-s3-setup.sh`, voir plus bas),
  puis fait l’aller-retour d’une petite pièce jointe et d’une grande (qui
  passe en multipart) sur chaque stockage, et confirme qu’une suppression
  renvoie bien 404 ensuite ;
- exerce la détection de conflit d’écriture `create_only` directement sur le
  nœud en cours d’exécution avec `barrel_server eval` (il n’y a pas encore de
  câblage `If-Match`/`If-None-Match` au niveau HTTP : c’est donc limité à
  l’API Erlang, comme aujourd’hui en dehors de HTTP) ; il confirme que RustFS
  rejette réellement une écriture en collision, et que Garage refuse vite
  avec `conditional_writes_unsupported` au lieu d’accepter en silence une
  écriture non protégée. Garage ne peut pas garantir cela, par conception
  documentée, et tout l’intérêt de la sonde de capacité dans
  `barrel_att_s3_store:open/2` est d’échouer bruyamment au lieu de faire
  semblant ;
- réplique un document et sa pièce jointe de peer-a (RocksDB) vers peer-b
  (S3/RustFS) par le vrai transport HTTP `barrel_rep`, en confirmant que
  l’asymétrie documentée (la source a un flux, la cible n’en a pas)
  n’empêche pas les écritures d’arriver.

### attachments-s3-setup.sh

Démarre `docker-compose.attachments-s3.yml` (RustFS + Garage + deux images de
pairs) et provisionne les deux stockages : `barrel_att_s3_store:open/2` ne
crée jamais de bucket lui-même, et Garage demande en plus une affectation de
layout unique avant de servir la moindre requête S3. Utilisé à la fois par
`attachments-s3.sh` et par la branche `s3` de la CI ; vous pouvez le lancer
seul pour itérer en local contre la suite CT :

```console
$ eval "$(test/e2e/attachments-s3-setup.sh)"
$ rebar3 as s3 ct --suite apps/barrel_att_s3/test/barrel_att_s3_SUITE
```

Idempotent pour RustFS. Pas idempotent pour Garage après la première
exécution : Garage ne révèle plus jamais le secret d’une clé après sa
création, donc relancer sur un volume déjà provisionné échoue bruyamment
plutôt que de réutiliser en silence une clé dont le secret est perdu. Lancez
d’abord `docker compose -f
test/e2e/docker-compose.attachments-s3.yml down -v` pour repartir de zéro.

## Prérequis

Docker et le plugin Compose. L’image construit la release `barrel_server`
sur Debian (en compilant rocksdb et la NIF vectorielle) : la première
exécution prend donc quelques minutes ; les suivantes réutilisent l’image en
cache. `attachments-s3.sh` tire en plus les images épinglées `rustfs/rustfs`
et `dxflrs/garage` ; le script de configuration sort avec un code non nul,
sans rien afficher, si un tirage ou une étape de provisionnement échoue.
