---
translation_of: src/content/synced/guides/audit-provenance.md
source_hash: "cbcf2d1b250c81ef"
title: "Audit et provenance"
description: "Chaque écriture appliquée laisse une entrée dans le journal d’historique conservé, et une écriture peut porter sa provenance : qui (acteur), dans quelle session, par quelle surface (source). Ensemble, elles répondent à la question « que savait l’agent, et quand » au niveau de la base. Lisez ce guide pour attribuer des écritures à des agents ou reconstituer un document à un instant donné."
source: "docs/guides/audit-provenance.md"
---

Chaque écriture appliquée laisse une entrée dans le journal d’historique
conservé, et une écriture peut porter sa provenance : qui (acteur), dans
quelle session, par quelle surface (source). Ensemble, elles répondent à la
question « que savait l’agent, et quand » au niveau de la base de données.
Lisez ce guide quand vous devez attribuer des écritures à des agents ou
reconstituer l’état d’un document à un instant donné.

## Quand l’utiliser

- Vous faites travailler des agents sur une base partagée et devez savoir
  quel agent a écrit quoi, et quand.
- Vous avez besoin des versions passées d’un document (corps compris) dans
  la fenêtre de rétention.
- Vous exposez barrel en REST ou en MCP et voulez attribuer les écritures
  sans modifier le corps des documents.

## Écrire avec une provenance

Passez `provenance` dans les options d’écriture. Chaque valeur est un
binaire d’au plus 256 octets ; le blob encodé est limité à 1 Kio. Une
provenance invalide fait échouer l’écriture avec `{invalid_provenance, Reason}`.

```erlang
{ok, Db} = barrel:open(<<"mydb">>),
Prov = #{actor => <<"agent-9">>,
         session => <<"ses_abc">>,
         source => <<"planner">>},
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>, <<"v">> => 1},
                         #{provenance => Prov}),
{ok, _} = barrel:delete_doc(Db, <<"a">>, #{provenance => Prov}).
```

En REST, ajoutez les en-têtes à n’importe quelle écriture ; sur `_bulk_docs`,
ils s’appliquent à tout le lot :

```console
$ curl -X PUT localhost:8080/db/mydb/doc/a \
    -H 'content-type: application/json' \
    -H 'x-barrel-actor: agent-9' \
    -H 'x-barrel-session: ses_abc' \
    -H 'x-barrel-source: planner' \
    -d '{"v":1}'
```

Les écritures en MCP portent leur provenance automatiquement : l’acteur est
le sujet authentifié, la session est la session MCP (ou l’argument `session`
de l’outil), la source est `mcp`. Voir le [guide MCP](/fr/docs/guides/mcp).

## Lire la piste d’audit

Le journal d’historique contient une entrée par écriture appliquée (sans les
corps), ordonnée par HLC et purgée par la rétention. Les corps remplacés sont
archivés et lisibles par version jusqu’à leur purge.

```erlang
%% toute la piste conservée, ou une fenêtre
{ok, Entries} = barrel:history(Db),
{ok, Entries2} = barrel:history(Db, #{limit => 100}),
%% chaque entrée : #{hlc, id, version, deleted, cause, provenance?}
%% cause : local | replicated | resolve ; provenance seulement si
%% l'écriture en portait une

%% un document : version courante + versions archivées, puis un corps passé
{ok, Versions} = barrel:doc_versions(Db, <<"a">>),
[#{version := Rev} | _] = Versions,
{ok, OldBody} = barrel:version_body(Db, <<"a">>, Rev),

%% jusqu'où remonte la piste (undefined = rien de purgé pour l'instant)
Floor = barrel:history_floor(Db).
```

Options de `history/2` : `from` et `to` (curseurs HLC, à décoder avec
`barrel:hlc_decode/1`), `limit`, et `id` (filtre sur un document ; un
parcours documenté de la fenêtre).

## En REST

```console
$ curl 'localhost:8080/db/mydb/_history?limit=50'
{"history":[{"id":"a","rev":"...","cause":"local","hlc":"...",
             "provenance":{"actor":"agent-9",...}}]}

$ curl 'localhost:8080/db/mydb/_history?since=<cursor>&until=<cursor>&id=a'
$ curl localhost:8080/db/mydb/doc/a/_versions
$ curl localhost:8080/db/mydb/doc/a/_versions/<rev>   # the archived body
```

`since`/`until` prennent les curseurs HLC que renvoient les autres points
d’accès (le `hlc` d’un changement, le `hlc` d’une entrée d’historique). Des
curseurs ou des limites invalides répondent 400.

## Notes

- La provenance est enregistrée deux fois : sur la version gagnante courante
  (renvoyée par `doc_versions` pour la tête) et dans l’entrée d’historique
  de chaque écriture appliquée (l’enregistrement d’audit durable).
- Une écriture sans provenance efface la colonne de provenance de la version
  gagnante : l’attribution courante ne ment jamais.
- En v1, la provenance ne voyage pas sur le protocole de réplication. Les
  arrivées répliquées portent `cause => replicated` et l’identité de la base
  d’origine ; la piste de l’origine contient l’agent qui a agi.
- Les branches se créent avec l’historique du parent : une branche porte donc
  la provenance de tout ce qui précède la bifurcation (voir
  [timeline](/fr/docs/guides/timeline)).
- La rétention purge ensemble les entrées d’historique et les corps archivés
  (`retention_period`, 30 jours par défaut). `history_floor/1` vous donne le
  plus ancien point conservé.
