---
title: Timeline
description: Bifurquez une base de donnees instantanement (a maintenant ou rembobinee a un instant passe), travaillez en isolation, et fusionnez les modifications a nouveau.
---

Barrel peut creer une branche d'une base de donnees : la bifurquer instantanement
(a maintenant, ou rembobinee a un instant passe), travailler sur la branche en
isolation complete, et fusionner les modifications de la branche a nouveau a
travers la meme machinerie a vecteurs de version qu'utilise la replication. Lisez
ceci quand vous voulez des copies de travail par agent ou par experience, une
recuperation a un instant donne, ou un flux revoir-puis-fusionner sur vos donnees.

## Ce que c'est

Une branche est un checkpoint par liens physiques des deux stores RocksDB
(documents et pieces jointes) : en creer une est en O(1) dans la taille des
donnees, et le parent et la branche partagent les fichiers physiques en copie sur
ecriture jusqu'a ce qu'un cote compacte. L'instant de bifurcation est frappe a
l'interieur du writer du parent, ainsi la branche tient exactement les ecritures
appliquees avant elle. La branche est ensuite une base de donnees tout a fait
normale : lectures, ecritures, requetes, canaux, changements, pieces jointes, et
le protocole de replication `/db/:db/_sync/*` fonctionnent tous dessus sans
changement, et ses ecritures sont produites sous son propre id de source.

La fusion n'expedie que ce que la branche a fait : ses changements depuis la
bifurcation s'appliquent au parent a travers `put_version`, ainsi les versions
deja connues sont des no-ops, les modifications atterrissent, et les modifications
concurrentes des deux cotes deviennent des conflits ordinaires (LWW deterministe,
ou le `conflict_merger` du parent). Un checkpoint de fusion rend les fusions
repetees incrementales.

Le lignage est lineaire en v1 : creer une branche d'une branche est rejete.

## Quand l'utiliser

- Donner a un agent ou a une experience une copie de travail privee, puis
  fusionner ce qui a survecu a la revue.
- Recuperer un etat passe (PITR) : creer une branche a un instant dans la fenetre
  de retention et lire ou servir les donnees d'hier a cote de celles
  d'aujourd'hui.
- Prendre un instantane coherent bon marche avant une migration risquee.

## Comment (branche et fusion, docdb)

```erlang
{ok, _} = barrel_docdb:create_db(<<"main">>),
{ok, _} = barrel_docdb:put_doc(<<"main">>, #{<<"id">> => <<"a">>, <<"v">> => 1}),

%% instant fork
{ok, _} = barrel_docdb:branch_db(<<"main">>, <<"exp1">>, #{}),

%% the branch is a normal db; edits stay on it
{ok, #{<<"_rev">> := Rev}} = barrel_docdb:get_doc(<<"exp1">>, <<"a">>),
{ok, _} = barrel_docdb:put_doc(<<"exp1">>, #{<<"id">> => <<"a">>, <<"v">> => 2,
                                             <<"_rev">> => Rev}),

%% ship the branch's edits back; rerun any time, it is incremental
{ok, #{docs_written := 1}} = barrel_docdb:merge_branch(<<"exp1">>, #{}),

barrel_docdb:list_branches(<<"main">>),        %% [<<"exp1">>]
ok = barrel_docdb:delete_db(<<"exp1">>).
```

## Comment (branche a un instant passe, PITR)

`at` prend un curseur de changements (le HLC que le flux renvoie) :

```erlang
{ok, _Changes, T} = barrel_docdb:get_changes(<<"main">>, first),
%% ... more writes happen ...
{ok, _} = barrel_docdb:branch_db(<<"main">>, <<"yesterday">>, #{at => T}).
```

Chaque document modifie apres T est restaure a son dernier etat a T ou avant
(y compris les freres de conflit vivants si l'instant est tombe dans une fenetre
concurrente) ; les documents crees apres T n'existent pas sur la branche. La
fenetre est la fenetre de retention : un T sous le plancher de l'historique echoue
avec `pitr_window_exceeded`, tout comme un document dont l'historique pre-T a deja
ete balaye (la bifurcation avorte proprement, rien n'est laisse derriere).

## Comment (facade, y compris mode enregistrement)

```erlang
{ok, Db} = barrel:open(main, #{embedding => #{fields => [<<"title">>]},
                               vectordb => #{db_path => "data/main_vec"}}),
{ok, Branch} = barrel:branch(Db, exp1,
                             #{vectordb => #{db_path => "data/exp1_vec"}}),
%% search works on the branch right away (see backfill below)
{ok, _Hits} = barrel:search(Branch, <<"query">>, #{k => 5}),
{ok, _Report} = barrel:merge(Branch),
ok = barrel:delete(Branch).
```

Une branche en mode enregistrement obtient un store vectoriel NEUF, reconstruit de
maniere synchrone pendant `branch/3` a partir des embeddings deja stockes dans les
corps de document : les documents portant un `_embedding` (client ou calcule)
s'indexent avec zero appel d'embedder ; les documents restaures par un
rembobinage PITR ont perdu cette colonne et recalculent leur embedding depuis leur
texte restaure. `backfill => none` saute la passe ;
`barrel_record_backfill:run/1` l'execute manuellement et renvoie
`#{indexed, embedded, skipped, failed}`.

Apres une fusion, le parent reindexe les documents fusionnes a travers son propre
outbox marque ; `barrel:merge` pousse son indexeur quand il est ouvert localement.

## Comment (REST)

```bash
# fork at now, or at a cursor from /db/main/changes ("at"), or a
# wall-clock instant ("at_time", RFC3339)
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

Les branches utilisent toute l'API existante, y compris la replication sous
`/db/exp1/_sync/*`. Erreurs : 400 `invalid_name` / `bad_at` /
`pitr_window_exceeded`, 409 `already_exists` / `cannot_branch_a_branch` /
`not_a_branch`.

## Notes

- Rouvrir une branche apres un redemarrage suit le contrat normal : son identite
  (parent, instant de bifurcation) persiste sur disque, mais la config d'execution
  (canaux, conflict_merger, retention) doit etre repassee a `create_db`,
  exactement comme pour n'importe quelle base de donnees. Les canaux sont toujours
  herites au moment de la bifurcation.
- Supprimer le parent est sur pour ses branches (les liens physiques les rendent
  independantes). Une branche qui n'est pas ouverte n'est pas listee par
  `list_branches`.
- Une branche se bifurque avec l'historique retenu du parent, ainsi la provenance
  d'audit (qui a ecrit quoi avant la bifurcation) voyage avec elle ; les ecritures
  post-bifurcation construisent la propre piste de chaque cote. Voir
  [audit-provenance](/fr/docs/guides/audit-provenance).
- Pieces jointes : une branche PITR garde les pieces jointes de l'instant de
  bifurcation (elles sont un etat LWW sans historique, leur etat a T n'est donc
  pas reconstructible). Les fusions portent le travail de pieces jointes
  post-bifurcation, deduplique par digest.
- Fusionnez au moins une fois par fenetre de retention : la retention de branche
  peut oublier un tombstone expire, et une suppression oubliee n'est jamais
  expediee.
- Un rembobinage PITR lui-meme n'est pas fusionne (les versions restaurees
  precedent la bifurcation) ; "revenir le parent a T" est une operation
  differente et n'est pas dans la v1.
- Les branches de facade simples (hors mode enregistrement) ne portent pas de
  vecteurs : ils vivent uniquement dans le store vectoriel, que la branche obtient
  neuf. Reajoutez-les ou utilisez le mode enregistrement.
- Le conflict_merger du parent est une config au moment de l'ouverture de la base
  de donnees ; il n'y a pas de surcharge par fusion, et le rapport de fusion porte
  des statistiques, pas le detail de conflit par document.
