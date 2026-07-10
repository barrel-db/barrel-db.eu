---
title: Lancer le serveur
description: Exposez une base de donnees barrel via HTTP/1.1 et HTTP/2 avec barrel_server, y compris les endpoints, l'authentification et CORS.
---

`barrel_server` expose la base de donnees `barrel` via HTTP/1.1 et HTTP/2
(REST/JSON) en utilisant `livery`. Il ne detient aucune logique de base de
donnees : chaque handler appelle le module `barrel` a travers un gestionnaire de
cycle de vie de base de donnees. Lisez ceci quand vous voulez atteindre une base
de donnees barrel sur le reseau au lieu de l'embarquer.

## Quand l'utiliser

- Vous voulez un acces HTTP aux documents, pieces jointes, vecteurs, a la
  recherche, et au flux de changements (depuis d'autres langages ou des clients
  distants).
- Pour un usage Erlang en processus, embarquez plutot `barrel` directement (voir
  le guide d'integration).

## Compiler et lancer

`barrel_server` est optionnel, derriere le profil `server` de l'umbrella (il tire
`livery` et ses transports). Il ne fait pas partie du build embarquable par
defaut.

```console
$ rebar3 as server shell
1> application:ensure_all_started(barrel_server).
```

Configurez avec l'app env `barrel_server` : `http_port` (8080 par defaut) et
`data_dir` (ou les bases de donnees sont stockees). Definissez-les avant le
demarrage de l'app, par exemple dans `sys.config`.

## Endpoints

Les bases de donnees s'ouvrent paresseusement au premier usage a travers le
gestionnaire de cycle de vie des bases de Barrel (`barrel_dbs`) : les handles sont mis en
cache par nom, les bases inactives se ferment apres `dbs_idle_timeout` (app env
barrel, 5 minutes par defaut, 0 desactive), et `dbs_max_open` evince la moins
recemment utilisee au-dela d'un plafond.

```
GET    /                          liveness text
GET    /health                    {"status":"ok"}

PUT    /db/:db                     open/create a database
GET    /db/:db                     database info
DELETE /db/:db                     close a database (?purge=true deletes)

PUT    /db/:db/doc/:id             body = JSON document
GET    /db/:db/doc/:id             fetch a document
DELETE /db/:db/doc/:id             delete a document
POST   /db/:db/_bulk_docs          {"docs":[...]} -> {"results":[...]}
POST   /db/:db/_bulk_get           {"ids":[...]}  -> {"results":[...]}
POST   /db/:db/find                body = query, returns rows
POST   /db/:db/query               BQL (ndjson rows; SUBSCRIBE over SSE)
GET    /db/:db/changes            changes feed (JSON, or SSE via Accept)

GET    /db/:db/_history            audit trail (see audit-provenance guide)
GET    /db/:db/doc/:id/_versions[/:rev]   past versions and bodies

GET    /db/:db/_timeline           lineage; POST .../branch, .../merge
POST   /db/:db/_sync/*             replication wire (see synchronization)

PUT    /db/:db/doc/:id/att/:name   body = raw bytes
GET    /db/:db/doc/:id/att/:name   fetch attachment bytes
DELETE /db/:db/doc/:id/att/:name   delete attachment

POST   /db/:db/vector              {"id","text","metadata","vector"}
POST   /db/:db/search/vector       {"vector":[...],"k":10}
POST   /db/:db/search/bm25         {"query":"...","k":10}
POST   /db/:db/search/hybrid       {"query":"...","k":10}

POST|GET /spaces, /spaces/:space, .../grants, .../sessions, /handoffs
                                   the agent layer (see the spaces guide)
POST|GET /mcp                      the MCP endpoint (see the mcp guide)
```

## Authentification

Non configure, le serveur est ouvert. Definissez des jetons Bearer pour le
verrouiller :

```erlang
{barrel_server, [{auth, #{tokens => [<<"s3cret">>]}}]}
```

Chaque route sauf `/health` exige alors `Authorization: Bearer <token>`. Deux
sortes de bearer : les jetons globaux (la liste ci-dessus, acces complet, une
liste rend la rotation possible) et les jetons de capacite (`bsp_...`, emis par
espace par `barrel_caps`). Un jeton de capacite authentifie les routes `/spaces`
et `/handoffs`, et les routes `/db/:db/*` de son propre espace quand `:db` est
l'espace octroye : `read` ouvre la branche pull (GET, `changes`, `query`,
`search`, et les lectures `_sync`), `write` ajoute les ecritures de document et la
branche push (PUT `_sync/doc`, ecritures `_sync/local` et `_sync/att`). Le cycle
de vie de la base de donnees (`PUT`/`DELETE /db/:db`), `_timeline`, et toute route
non mappee restent hors de portee des jetons de capacite (403, fail-closed) ; les
jetons morts ou d'un mauvais espace repondent 401. `/mcp` authentifie a travers son
propre fournisseur couvrant les deux sortes. Voir
[espaces](/fr/docs/server/spaces), [mcp](/fr/docs/server/mcp), et
[barrel-lite](/fr/docs/guides/barrel-lite).

## CORS

Les clients navigateur ont besoin de CORS. Non configure, aucun en-tete CORS n'est
envoye ; definissez une politique d'origine pour l'activer :

```erlang
{barrel_server, [{cors, #{
    origins => '*',                        %% or [<<"https://app.example">>]
    expose  => [<<"x-barrel-hlc">>,        %% default; the client folds this
                <<"x-barrel-digest">>, <<"x-barrel-att-length">>],
    max_age => 600
}}]}
```

Les requetes de preflight `OPTIONS` sont repondues sans bearer, et les reponses
d'erreur portent quand meme les en-tetes CORS pour que le JS du navigateur puisse
les lire. `/mcp` garde sa propre politique d'origine. Voir
[barrel-lite](/fr/docs/guides/barrel-lite).

## Exemples

```console
$ curl -X PUT localhost:8080/db/mydb
{"db":"mydb","ok":true}

$ curl -X PUT localhost:8080/db/mydb/doc/a \
    -H 'content-type: application/json' -d '{"title":"hello"}'
{"id":"a","ok":true,...}

$ curl localhost:8080/db/mydb/doc/a
{"_rev":"1-...","id":"a","title":"hello"}

$ curl -X POST localhost:8080/db/mydb/_bulk_docs \
    -H 'content-type: application/json' -d '{"docs":[{"id":"b"},{"id":"c"}]}'
{"results":[{"id":"b",...},{"id":"c",...}]}

$ curl localhost:8080/db/mydb/changes
{"changes":[{"id":"a","rev":"1-...","hlc":"..."}],"last":"..."}
```

## Notes

- Le flux de changements renvoie du JSON par defaut. Demandez
  `Accept: text/event-stream` (ou `?feed=sse`) pour des Server-Sent Events (unique :
  la fenetre courante puis fermeture). `?feed=continuous` tient le flux SSE ouvert,
  poussant chaque changement comme une ligne de donnees avec un battement toutes
  les 30s, jusqu'a ce que le client se deconnecte. `?since=<cursor>` prend un
  curseur du champ `last` d'une reponse anterieure (ou le `hlc` d'un changement).
- Les bases de donnees s'ouvrent avec le store vectoriel par defaut (768
  dimensions, BM25 desactive). Les endpoints `/search/bm25` et `/search/hybrid`
  ont besoin de BM25 active, et l'hybride a besoin d'un embedder.
- Concurrence optimiste : `PUT /db/:db/doc/:id` avec un `_rev` dans le corps qui
  n'est pas le gagnant courant repond 409 `{"error":"conflict"}`.
- La replication sur le reseau est expediee aujourd'hui (les endpoints
  `/db/:db/_sync/*` ; voir
  [synchronisation](/fr/docs/guides/synchronization)). gRPC, HTTP/3,
  WebTransport, un adaptateur unix-socket, et OpenAPI sont des phases ulterieures.
