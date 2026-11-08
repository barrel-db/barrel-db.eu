---
translation_of: src/content/synced/guides/timeline.md
source_hash: "8f862115cc03b989"
title: "Timeline"
description: "Barrel peut créer une branche d’une base : la bifurquer instantanément (maintenant, ou en revenant à un instant passé), travailler sur la branche en isolation complète, puis fusionner ses modifications avec la même mécanique de vecteurs de versions que la réplication. Lisez ce guide pour des copies de travail par agent ou par expérience, la restauration à un instant donné, ou un flux revue puis fusion sur vos données."
source: "docs/guides/timeline.md"
---

Barrel peut créer une branche d’une base de données : la bifurquer
instantanément (maintenant, ou en revenant à un instant passé), travailler
sur la branche en isolation complète, puis fusionner les modifications de la
branche avec la même mécanique de vecteurs de versions que la réplication.
Lisez ce guide quand vous voulez des copies de travail par agent ou par
expérience, une restauration à un instant donné (PITR), ou un flux « revue
puis fusion » sur vos données.

## Ce que c’est

Une branche est un checkpoint par liens physiques des deux stockages RocksDB
(documents et pièces jointes) : en créer une est en O(1) par rapport à la
taille des données, et parent et branche partagent les fichiers physiques en
copie sur écriture jusqu’à ce que l’un des deux compacte. L’instant de
bifurcation est émis dans le writer du parent : la branche contient donc
exactement les écritures appliquées avant lui. La branche est ensuite une
base tout à fait normale : lectures, écritures, requêtes, channels,
changements, pièces jointes et le protocole de réplication
`/db/:db/_sync/*` y fonctionnent sans changement, et ses écritures sont
signées de son propre identifiant de source.

La fusion n’envoie que ce que la branche a fait : les documents qu’elle a
modifiés depuis la bifurcation sont fusionnés dans le parent comme états
complets. Les versions connues ne changent rien, les modifications arrivent,
et les modifications concurrentes des deux côtés deviennent des conflits
ordinaires (ou sont résolues par le `conflict_resolver` du parent). Un
checkpoint de fusion rend les fusions répétées incrémentales.

La lignée est linéaire en v1 : créer une branche d’une branche est refusé.

## Quand l’utiliser

- Donner à un agent ou à une expérience une copie de travail privée, puis
  fusionner ce qui a passé la revue.
- Retrouver un état passé (PITR) : créer une branche à un instant de la
  fenêtre de rétention, et lire ou servir les données d’hier à côté de celles
  d’aujourd’hui.
- Prendre un instantané cohérent et peu coûteux avant une migration risquée.

## Comment faire (branche et fusion, docdb)

```erlang
{ok, _} = barrel_docdb:create_db(<<"main">>),
{ok, _} = barrel_docdb:put_doc(<<"main">>, #{<<"id">> => <<"a">>, <<"v">> => 1}),

%% bifurcation instantanée
{ok, _} = barrel_docdb:branch_db(<<"main">>, <<"exp1">>, #{}),

%% la branche est une base normale ; les modifications y restent
{ok, #{<<"_rev">> := Rev}} = barrel_docdb:get_doc(<<"exp1">>, <<"a">>),
{ok, _} = barrel_docdb:put_doc(<<"exp1">>, #{<<"id">> => <<"a">>, <<"v">> => 2,
                                             <<"_rev">> => Rev}),

%% renvoyer les modifications de la branche ; relançable à tout moment, c'est incrémental
{ok, #{docs_written := 1}} = barrel_docdb:merge_branch(<<"exp1">>, #{}),

barrel_docdb:list_branches(<<"main">>),        %% [<<"exp1">>]
ok = barrel_docdb:delete_db(<<"exp1">>).
```

## Comment faire (branche à un instant passé, PITR)

`at` prend un curseur de changements (la HLC que renvoie le flux) :

```erlang
{ok, _Changes, T} = barrel_docdb:get_changes(<<"main">>, first),
%% ... d'autres écritures ont lieu ...
{ok, _} = barrel_docdb:branch_db(<<"main">>, <<"yesterday">>, #{at => T}).
```

Chaque document modifié après T est restauré dans son dernier état à T ou
avant (versions sœurs en conflit comprises si l’instant tombe dans une
fenêtre concurrente) ; les documents créés après T n’existent pas sur la
branche. La fenêtre est celle de la rétention : un T sous le plancher
d’historique échoue avec `pitr_window_exceeded`, de même qu’un document dont
l’historique antérieur à T a déjà été purgé (la bifurcation s’interrompt
proprement, rien n’est laissé derrière).

## Comment faire (l’API `barrel`, mode enregistrement compris)

```erlang
{ok, Db} = barrel:open(main, #{embedding => #{fields => [<<"title">>]},
                               vectordb => #{db_path => "data/main_vec"}}),
{ok, Branch} = barrel:branch(Db, exp1,
                             #{vectordb => #{db_path => "data/exp1_vec"}}),
%% la recherche fonctionne tout de suite sur la branche (voir le backfill plus bas)
{ok, _Hits} = barrel:search(Branch, <<"query">>, #{k => 5}),
{ok, _Report} = barrel:merge(Branch),
ok = barrel:delete(Branch).
```

Une branche en mode enregistrement reçoit un stockage vectoriel NEUF,
reconstruit de façon synchrone pendant `branch/3` à partir des embeddings
déjà stockés dans le corps des documents : les documents qui portent un
`_embedding` (fourni par le client ou calculé) sont indexés sans aucun appel
à l’embedder ; les documents restaurés par un retour PITR ont perdu cette
colonne et sont ré-embeddés à partir de leur texte restauré.
`backfill => none` saute cette passe ; `barrel_record_backfill:run/1` la
lance à la main et renvoie `#{indexed, embedded, skipped, failed}`.

Après une fusion, le parent réindexe les documents fusionnés via sa propre
outbox étiquetée ; `barrel:merge` relance son indexeur quand il est ouvert
localement.

## Comment faire (REST)

```bash
# bifurquer maintenant, ou à un curseur de /db/main/changes ("at"), ou à un
# instant d'horloge murale ("at_time", RFC3339)
curl -XPOST localhost:8080/db/main/_timeline/branch \
     -H 'content-type: application/json' -d '{"name": "exp1"}'

curl localhost:8080/db/main/_timeline
# {"db":"main","branches":["exp1"]}
curl localhost:8080/db/exp1/_timeline
# {"db":"exp1","parent":"main","fork_hlc":"...", "branches":[]}

curl -XPOST localhost:8080/db/exp1/_timeline/merge -d '{}'
# {"docs_written":1,...,"last_merged":"..."}

curl -XDELETE 'localhost:8080/db/exp1?purge=true'
```

Les branches utilisent toute l’API existante, réplication sous
`/db/exp1/_sync/*` comprise. Erreurs : 400 `invalid_name` / `bad_at` /
`pitr_window_exceeded`, 409 `already_exists` / `cannot_branch_a_branch` /
`not_a_branch`.

## Notes

- Rouvrir une branche après un redémarrage suit le contrat habituel : son
  identité (parent, instant de bifurcation) est persistée sur disque, mais la
  configuration d’exécution (channels, conflict_resolver, rétention) doit être
  repassée à `create_db`, exactement comme pour toute base. Les channels sont
  toujours hérités au moment de la bifurcation.
- Supprimer le parent est sans danger pour ses branches (les liens physiques
  les rendent indépendantes). Une branche qui n’est pas ouverte n’est pas
  listée par `list_branches`.
- Une branche se crée avec l’historique conservé du parent : la provenance
  d’audit (qui a écrit quoi avant la bifurcation) l’accompagne ; les
  écritures postérieures construisent la piste propre de chaque côté. Voir
  [audit-provenance](/fr/docs/guides/audit-provenance).
- Pièces jointes : une branche PITR garde les pièces jointes du moment de la
  bifurcation (ce sont des états LWW sans historique, leur état à T n’est
  donc pas reconstructible). Les fusions transportent le travail sur les
  pièces jointes postérieur à la bifurcation, dédupliqué par digest.
- Une suppression plus ancienne que la fenêtre de rétention fusionne quand
  même : elle est gardée comme stub avec sa ligne de changement. Seul
  `tombstone_purge_after` la retire.
- Un retour PITR n’est pas lui-même fusionné (les versions restaurées sont
  antérieures à la bifurcation) ; « ramener le parent à T » est une autre
  opération, absente de la v1.
- Les branches `barrel` simples (hors mode enregistrement) ne transportent
  pas les vecteurs : ils ne vivent que dans le stockage vectoriel, que la
  branche reçoit neuf. Ajoutez-les à nouveau ou utilisez le mode
  enregistrement.
- Le conflict_resolver du parent est une configuration fixée à l’ouverture
  de la base ; il n’y a pas de surcharge par fusion, et le rapport de fusion
  contient des statistiques, pas le détail des conflits par document.
