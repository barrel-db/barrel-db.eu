---
title: Audit et provenance
description: Attribuez chaque ecriture a un agent, une session et une source, et lisez les versions passees d'un document dans la fenetre de retention.
---

Chaque ecriture appliquee laisse une entree dans le journal d'historique retenu,
et une ecriture peut porter une provenance : qui (acteur), dans quelle session, a
travers quelle surface (source). Ensemble elles repondent a "que savait l'agent
et quand" au niveau de la base de donnees. Lisez ceci quand vous devez attribuer
des ecritures a des agents ou reconstruire a quoi ressemblait un document a un
instant donne.

## Quand l'utiliser

- Vous executez des agents contre une base de donnees partagee et devez savoir
  quel agent a ecrit quoi, et quand.
- Vous avez besoin des versions passees d'un document (corps compris) dans la
  fenetre de retention.
- Vous exposez barrel via REST ou MCP et voulez que les ecritures soient
  attribuees sans changer les corps de document.

## Ecrire avec provenance

Passez `provenance` dans les options d'ecriture. Chaque valeur est un binaire d'au
plus 256 octets ; le blob encode est plafonne a 1 KiB. Une provenance invalide
fait echouer l'ecriture avec `{invalid_provenance, Reason}`.

```erlang
{ok, Db} = barrel:open(<<"mydb">>),
Prov = #{actor => <<"agent-9">>,
         session => <<"ses_abc">>,
         source => <<"planner">>},
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>, <<"v">> => 1},
                         #{provenance => Prov}),
{ok, _} = barrel:delete_doc(Db, <<"a">>, #{provenance => Prov}).
```

Via REST, posez des en-tetes sur n'importe quelle ecriture ; ils s'appliquent a
tout le lot sur `_bulk_docs` :

```console
$ curl -X PUT localhost:8080/db/mydb/doc/a \
    -H 'content-type: application/json' \
    -H 'x-barrel-actor: agent-9' \
    -H 'x-barrel-session: ses_abc' \
    -H 'x-barrel-source: planner' \
    -d '{"v":1}'
```

Les ecritures via MCP portent la provenance automatiquement : l'acteur est le
sujet authentifie, la session est la session MCP (ou l'argument `session` de
l'outil), la source est `mcp`. Voir le [guide MCP](/fr/docs/server/mcp).

## Lire la piste d'audit

Le journal d'historique tient une entree par ecriture appliquee (pas de corps),
ordonnee par HLC, balayee par la retention. Les corps supplantes sont archives et
lisibles par version jusqu'a leur balayage.

```erlang
%% the whole retained trail, or a window
{ok, Entries} = barrel:history(Db),
{ok, Entries2} = barrel:history(Db, #{limit => 100}),
%% each entry: #{hlc, id, version, deleted, cause, provenance?}
%% cause: local | replicated | resolve; provenance only when the
%% write carried one

%% one document: current + archived versions, then a past body
{ok, Versions} = barrel:doc_versions(Db, <<"a">>),
[#{version := Rev} | _] = Versions,
{ok, OldBody} = barrel:version_body(Db, <<"a">>, Rev),

%% how far back the trail goes (undefined = nothing swept yet)
Floor = barrel:history_floor(Db).
```

Options de `history/2` : `from` et `to` (curseurs HLC, decodez avec
`barrel:hlc_decode/1`), `limit`, et `id` (filtre sur un seul document ; un
balayage documente sur la fenetre).

## Via REST

```console
$ curl 'localhost:8080/db/mydb/_history?limit=50'
{"history":[{"id":"a","rev":"...","cause":"local","hlc":"...",
             "provenance":{"actor":"agent-9",...}}]}

$ curl 'localhost:8080/db/mydb/_history?since=<cursor>&until=<cursor>&id=a'
$ curl localhost:8080/db/mydb/doc/a/_versions
$ curl localhost:8080/db/mydb/doc/a/_versions/<rev>   # the archived body
```

`since`/`until` prennent les curseurs HLC que renvoient les autres endpoints (le
`hlc` d'un changement, le `hlc` d'une entree d'historique). Les mauvais curseurs et
limites repondent 400.

## Notes

- La provenance est persistee deux fois : sur le gagnant courant (renvoye par
  `doc_versions` pour la tete) et dans l'entree d'historique de chaque ecriture
  appliquee (l'enregistrement d'audit durable).
- Une ecriture sans provenance efface la colonne de provenance du gagnant :
  l'attribution courante ne ment jamais.
- La provenance ne voyage pas sur le reseau de replication en v1. Les arrivees
  repliquees portent `cause => replicated` et l'identite de la base de donnees
  d'origine ; la propre piste de l'origine tient l'agent agissant.
- Les branches se bifurquent avec l'historique du parent, ainsi une branche porte
  la provenance de tout ce qui precede la bifurcation (voir
  [timeline](/fr/docs/guides/timeline)).
- La retention balaie ensemble les entrees d'historique et les corps archives
  (`retention_period`, 30 jours par defaut). `history_floor/1` vous indique le
  plus ancien point survivant.
