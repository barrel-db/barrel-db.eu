---
translation_of: src/content/synced/guides/rest-server.md
source_hash: "019b4935fa089382"
title: "Lancer le serveur REST"
description: "barrel_server expose la base barrel comme une API REST/JSON avec livery. Par défaut il sert du HTTP/1.1 en clair ; HTTP/2 et HTTP/3 (sur TLS) s’activent via la configuration listeners (voir synchronization). Il ne contient aucune logique de base de données : chaque handler appelle le module barrel via un gestionnaire de cycle de vie des bases."
source: "docs/guides/rest-server.md"
---

`barrel_server` expose la base `barrel` comme une API REST/JSON avec `livery`.
Par défaut il sert du HTTP/1.1 en clair ; HTTP/2 et HTTP/3 (sur TLS) s’activent
via la configuration `listeners` (voir [synchronization](/fr/docs/guides/synchronization)).
Il ne contient aucune logique de base de données : chaque handler appelle le
module `barrel` via un gestionnaire de cycle de vie des bases. Lisez ce guide si
vous voulez atteindre une base barrel par le réseau au lieu de l’embarquer.

## Quand l’utiliser

- Vous voulez un accès HTTP aux documents, pièces jointes, vecteurs, à la
  recherche, au flux de changements et aux contextes (depuis d’autres langages
  ou des clients distants).
- Pour un usage Erlang dans le même processus, embarquez plutôt `barrel`
  directement (voir le guide embedding).

## Construire et lancer

`barrel_server` est optionnel, derrière le profil `server` de l’umbrella (il
tire `livery` et ses transports). Il ne fait pas partie du build embarquable par
défaut.

```console
$ rebar3 as server shell
1> application:ensure_all_started(barrel_server).
```

Configurez-le avec l’environnement de l’application `barrel_server` :
`http_port` (par défaut `8080`) et `data_dir` (où les bases sont stockées).
Définissez-les avant le démarrage de l’application, par exemple dans
`sys.config`.

## Points d’accès

Les bases s’ouvrent à la demande à la première utilisation via le gestionnaire
de cycle de vie des bases de Barrel (`barrel_dbs`) : les handles sont mis en
cache par nom, les bases inactives se ferment après `dbs_idle_timeout`
(environnement de l’application barrel, 5 minutes par défaut, 0 désactive), et
`dbs_max_open` évince la moins récemment utilisée au-delà d’un plafond.

```
GET    /                          texte de vivacité
GET    /health                    {"status":"ok"}

PUT    /db/:db                     ouvrir/créer une base
GET    /db/:db                     informations sur la base
DELETE /db/:db                     fermer une base (?purge=true supprime)

PUT    /db/:db/doc/:id             corps = document JSON
GET    /db/:db/doc/:id             lire un document
DELETE /db/:db/doc/:id             supprimer un document
POST   /db/:db/_bulk_docs          {"docs":[...]} -> {"results":[...]}
POST   /db/:db/_bulk_get           {"ids":[...]}  -> {"results":[...]}
POST   /db/:db/find                {"where":[...],"limit":10} -> lignes
POST   /db/:db/query               BQL (lignes ndjson ; SUBSCRIBE sur SSE)
GET    /db/:db/query?q=            idem, pour les clients EventSource
GET    /db/:db/changes            flux de changements (JSON, ou SSE via Accept)

GET    /db/:db/_history            piste d'audit (voir le guide audit-provenance)
GET    /db/:db/doc/:id/_versions[/:rev]   versions et corps passés

GET    /db/:db/_timeline           lignée ; POST .../branch, .../merge
POST   /db/:db/_sync/*             protocole de réplication (voir synchronization)

PUT    /db/:db/doc/:id/att/:name   corps = octets bruts
GET    /db/:db/doc/:id/att/:name   lire les octets de la pièce jointe
DELETE /db/:db/doc/:id/att/:name   supprimer la pièce jointe

POST   /db/:db/vector              {"id","text","metadata","vector"}
POST   /db/:db/search/vector       {"vector":[...],"k":10}
POST   /db/:db/search/bm25         {"query":"...","k":10}
POST   /db/:db/search/hybrid       {"query":"...","k":10}

POST|GET /spaces, /spaces/:space, .../grants, .../sessions, /handoffs
                                   la couche agents (voir le guide spaces)
POST|GET /contexts, /contexts/:id, /contexts/_query, /worksets, ...
                                   contextes et ensembles de travail (ci-dessous)
POST|GET /mcp                      le point d'accès MCP (voir le guide mcp)
```

## Trouver des documents par champ

`POST /db/:db/find` prend `where`, une liste de conditions dans la forme des filtres de réplication, plus `limit`, `offset`, `include_docs` et `id_prefix` optionnels. Une requête invalide répond 400 `invalid_query`.

```console
$ curl -XPOST localhost:8080/db/mydb/find -H 'content-type: application/json' \
    -d '{"where": [["path", ["kind"], "user"]], "limit": 10}'
{"rows":[...],"meta":{...}}
```

## Borner une requête et lire ce qui a répondu

`POST /db/:db/query` prend l’instruction en texte BQL brut, ou en JSON avec
`query`, `params`, `continuation`, `max_rows` et `deadline_ms`. `GET` prend les
mêmes valeurs en `?q=`, `?max_rows=`, `?deadline_ms=`.

```console
$ curl -XPOST localhost:8080/db/mydb/query -H 'content-type: application/json' \
    -d '{"query": "SELECT id, title FROM c ORDER BY id LIMIT 2", "max_rows": 100, "deadline_ms": 2000}'
{"row":{"id":"a","title":"hello"}}
{"row":{"id":"b","title":"world"}}
{"meta":{"has_more":false,"bound":"limit_reached","instance_id":"19ab40285574d671","last_seq":"AAABoNO_U7sAAAAE"}}
```

- `max_rows` plafonne les lignes envoyées (au plus 1000) ; `deadline_ms` borne
  la requête (au plus 300000). Une valeur qui n’est pas un entier positif répond
  400 `invalid_max_rows` ou `invalid_deadline_ms`.
- La dernière ligne est `{"meta": ...}` : `bound` vaut `limit_reached` quand le
  plafond a coupé le flux ou que le `LIMIT` ou le `k` de l’instruction a été
  atteint (d’autres lignes peuvent exister), `exhausted` sinon ; `instance_id`
  et `last_seq` (base64url) désignent l’état de la base qui a répondu ;
  `continuation` est présent quand l’instruction est paginée.
- Une réponse `vector_top_k` ajoute `embedding: {fingerprint, distance,
  dimensions}` à la méta, pour qu’un appelant qui fusionne des réponses de
  plusieurs bases puisse vérifier que leurs scores sont comparables.
- Quand l’échéance passe après le début des lignes, le flux se termine par une
  ligne `{"error":"deadline"}` dans le flux et sans méta. Tout autre échec après
  la première ligne se termine de la même façon, avec sa raison.

## Contextes et ensembles de travail

Le groupe de routes `contexts` sert les fiches de contexte, les requêtes
fédérées et les ensembles de travail. Le [guide des contextes](/fr/docs/guides/contexts)
parcourt chaque appel avec de vraies réponses.

```
POST   /contexts                    enregistrer une fiche (201)
GET    /contexts                    lister (?prefix=, ?unlisted=true) ; ?q= découvre
GET    /contexts/:id                une fiche, par id ou nom encodé en URL
DELETE /contexts/:id                désenregistrer
GET    /contexts/_capabilities      formes de requête acceptées, fusions, limites, budgets
POST   /contexts/_query             une instruction BQL sur plusieurs contextes
GET    /contexts/_offline           {"offline": bool}
PUT    /contexts/_offline           {"offline": true | false}

POST   /worksets                    créer ({"owner", "budget"}, 201)
GET    /worksets                    lister
GET    /worksets/:ws                en lire un
DELETE /worksets/:ws                le supprimer avec ses tranches
POST   /worksets/:ws/members        attacher {"context", "mode", "credential_ref"}
DELETE /worksets/:ws/members/:ctx   détacher
POST   /worksets/:ws/_materialize   enregistrer les documents d'une requête en tranches
POST   /worksets/:ws/_import        importer un snapshot exporté {"dir", "name"}
```

```console
$ curl -XPOST localhost:8080/contexts/_query -H 'content-type: application/json' \
    -d '{"query": "SELECT id, path FROM c ORDER BY path LIMIT 10",
         "contexts": ["otp/tools", "otp/sasl"]}'
```

La réponse (200) porte `execution` (`succeeded`, `partial`, `failed`), `rows` ou
`groups`, une entrée `sources` par contexte, `coverage` et un `summary`. Un
contexte qui n’a pas répondu est signalé dans sa source, pas comme une erreur de
requête. Une erreur de requête répond avec une seule forme et un statut HTTP par
code (400 pour un argument ou une instruction invalide, 404 `unknown_context`,
409 `ambiguous_context`, 413 `over_budget`, 403 `forbidden`, 502
`source_unavailable`, 500 `internal`) :

```json
{"error": "limit_required",
 "message": "A row query over contexts needs a LIMIT.",
 "hint": "Add LIMIT n (n <= 1000), and ORDER BY a selected field to merge rows in order.",
 "details": {"max_limit": 1000}}
```

Un jeton de capacité peut lire les fiches et lancer `POST /contexts/_query` ;
chaque contexte local est vérifié comme un `POST /db/:db/query` sur cette base.
Enregistrer des fiches, gérer les ensembles de travail, importer et passer hors
ligne nécessitent un jeton global. Les jetons des serveurs distants vivent dans
les `ctx_credentials` du nœud, jamais dans une fiche.

## Authentification

Sans configuration, le serveur est ouvert. Définissez des jetons bearer pour le
verrouiller :

```erlang
{barrel_server, [{auth, #{tokens => [<<"s3cret">>]}}]}
```

Chaque route sauf `/health` exige alors `Authorization: Bearer <token>`. Il y a
deux sortes de bearer : les jetons globaux (la liste ci-dessus, accès complet ;
une liste permet la rotation) et les jetons de capacité (`bsp_...`, émis par
espace par `barrel_caps`). Un jeton de capacité authentifie les routes `/spaces`
et `/handoffs`, ainsi que les routes `/db/:db/*` de son propre espace quand
`:db` est l’espace accordé : `read` ouvre le sens pull (GET, `changes`, `query`,
`search` et les lectures `_sync`), `write` ajoute les écritures de documents et
le sens push (PUT `_sync/doc`, écritures `_sync/local` et `_sync/att`). Le cycle
de vie des bases (`PUT`/`DELETE /db/:db`), `_timeline` et toute route non
couverte restent interdits aux jetons de capacité (403, fermé par défaut) ; pour
les routes de contextes, voir
[Contextes et ensembles de travail](#contextes-et-ensembles-de-travail) ; les
jetons expirés ou d’un autre espace répondent 401. `/mcp` s’authentifie via son
propre fournisseur, qui couvre les deux sortes. Voir [spaces](/fr/docs/guides/spaces),
[mcp](/fr/docs/guides/mcp) et [barrel-lite](/fr/docs/guides/barrel-lite).

Le comportement bearer ci-dessus est inchangé et c’est ce que vous obtenez sans
configuration supplémentaire. Deux méthodes plus fortes sont **optionnelles**,
ajoutées par une liste `accept` sur la même clé `auth` (son absence laisse tout
exactement comme décrit ci-dessus) : les **requêtes signées** Ed25519 (protégées
contre le rejeu, sans TLS requis) et un filtrage de transport **mTLS**.
`accept => [bearer, signed]` accepte l’un ou l’autre, pour qu’une flotte puisse
basculer nœud par nœud. Voir le [guide de synchronisation](/fr/docs/guides/synchronization)
pour la configuration et le côté client.

## CORS

Les clients navigateur ont besoin de CORS. Sans configuration, aucun en-tête
CORS n’est envoyé ; définissez une politique d’origine pour l’activer :

```erlang
{barrel_server, [{cors, #{
    origins => '*',                        %% ou [<<"https://app.example">>]
    expose  => [<<"x-barrel-hlc">>,        %% par défaut ; le client l'intègre
                <<"x-barrel-digest">>, <<"x-barrel-att-length">>],
    max_age => 600
}}]}
```

Les requêtes de pré-vérification `OPTIONS` reçoivent une réponse sans bearer, et
les réponses d’erreur portent quand même les en-têtes CORS pour que le JS du
navigateur puisse les lire. `/mcp` garde sa propre politique d’origine. Voir
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

- Le flux de changements renvoie du JSON par défaut. Demandez
  `Accept: text/event-stream` (ou `?feed=sse`) pour des Server-Sent Events (en
  une fois : la fenêtre courante puis fermeture). `?feed=continuous` garde le
  flux SSE ouvert et pousse chaque changement comme une ligne de données avec un
  heartbeat de 30 s, jusqu’à ce que le client se déconnecte. `?since=<cursor>`
  prend un curseur issu du champ `last` d’une réponse précédente (ou du `hlc`
  d’un changement).
- Les bases s’ouvrent avec le stockage vectoriel par défaut (768 dimensions,
  BM25 désactivé). Les points d’accès `/search/bm25` et `/search/hybrid`
  nécessitent BM25 activé, et l’hybride nécessite un embedder.
- Concurrence optimiste : `PUT /db/:db/doc/:id` avec dans le corps un `_rev` qui
  n’est pas le gagnant actuel répond 409 `{"error":"conflict"}`.
- La réplication sur le réseau est disponible aujourd’hui (les points d’accès
  `/db/:db/_sync/*` ; voir [synchronization](/fr/docs/guides/synchronization)),
  avec authentification bearer, requêtes signées Ed25519 et mTLS (toutes
  optionnelles ; bearer par défaut). Le service HTTP/2 et HTTP/3 est disponible
  (optionnel via `listeners`) ; notez que H3 sert en TLS mais ne filtre pas
  encore par certificat client. gRPC, WebTransport, un adaptateur socket unix et
  OpenAPI viendront dans des phases ultérieures.
