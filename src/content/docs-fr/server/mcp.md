---
title: Point de terminaison MCP
description: Parlez a barrel via MCP (Streamable HTTP) avec des outils pour les bases de donnees, documents, BQL, la recherche, la timeline, et la couche agent.
---

`barrel_server` monte un point de terminaison MCP (Streamable HTTP) a `/mcp` : des
outils pour les bases de donnees, documents, BQL, la recherche, la timeline, et la
couche agent, plus des ressources avec des abonnements de requetes en direct. Lisez
ceci quand un client MCP (un runtime d'agent, un IDE, `barrel_mcp_client`) doit
parler a barrel directement.

## Quand l'utiliser

- Les agents atteignent barrel a travers un runtime MCP au lieu de REST.
- Vous voulez des requetes en direct poussees aux clients comme des notifications
  resource-updated.
- Vous remettez aux agents des jetons de capacite cadres sur un espace et voulez
  le meme cadrage sur la surface MCP.

## Activer et configurer

Le point de terminaison est active par defaut dans le build serveur. Configurez-le
avec l'app env `{barrel_server, mcp, #{...}}` :

```erlang
{barrel_server, [
    {mcp, #{
        enabled => true,               %% default
        allowed_origins => any,        %% tighten for browser clients
        allow_missing_origin => true,
        resources => full,             %% full | live_only
        live => #{max_per_session => 32, max_global => 1024,
                  sweep_interval_ms => 60000, debounce_ms => 100}
    }}
]}
```

## Authentification

`/mcp` authentifie a travers son propre fournisseur, qui accepte deux bearers :

- un jeton serveur (le meme ensemble `{barrel_server, auth, #{tokens => [...]}}`
  que verifie le middleware REST) : acces complet ;
- un jeton de capacite (`bsp_...`, emis par `barrel_caps`) : cadre sur son espace
  et ses droits ; chaque outil verifie la base de donnees qu'il touche contre
  l'autorisation. Les refus reviennent comme des erreurs d'outil que l'agent peut
  lire, pas comme des echecs de protocole.

Sans authentification configuree le point de terminaison est ouvert, comme le
reste du serveur.

## Outils

Coeur (droits qu'une capacite requiert entre parentheses) :

```
db_create (write)      db_list (read)          db_info (read)
doc_get (read)         doc_put (write)         doc_delete (write)
query (read)           search (read)           changes (read)
branch_create (admin)  branch_list (read)      merge (admin)
query_subscribe (write)                        query_unsubscribe
```

Couche agent :

```
space_create (management only)   space_info (read)
space_grant (admin)              space_revoke (admin)
session_create (write)           session_touch (write)
session_add_message (write)      session_get_messages (read)
handoff_create (admin)           handoff_list (read)
handoff_accept (token in args)   handoff_complete (token in args)
```

`query` compile d'abord l'instruction (les erreurs d'analyse sont lisibles), borne
les lignes avec `max_rows` (100 par defaut, plafond 1000), et pagine avec une
`continuation`. Les instructions SUBSCRIBE sont rejetees vers `query_subscribe`.
Chaque ecriture porte une provenance : acteur = sujet authentifie, session =
session MCP (ou l'argument `session` de l'outil), source = `mcp`. Voir
[audit-provenance](/fr/docs/guides/audit-provenance).

## Ressources et requetes en direct

Trois modeles :

```
barrel://db/{db}              database info
barrel://db/{db}/doc/{id}     a document body
barrel://db/{db}/live/{sub}   the materialized snapshot of a live query
```

`query_subscribe` demarre une requete en direct et renvoie son URI de ressource.
Lisez l'URI pour les lignes courantes (`#{ready, count, rows}`, triees par id) ;
abonnez-vous a lui (`resources/subscribe`) pour recevoir un
`notifications/resources/updated` a chaque changement, debounce, livre sur le flux
GET SSE du client. Le client relit a la notification.

```erlang
{ok, C} = barrel_mcp_client:start(#{
    transport => {http, <<"http://localhost:8080/mcp">>},
    auth => {bearer, Token}}),
{ok, R} = barrel_mcp_client:call_tool(C, <<"query_subscribe">>, #{
    <<"db">> => <<"mydb">>,
    <<"query">> => <<"SELECT * FROM db WHERE kind = 'task' SUBSCRIBE">>}),
%% R's content carries {"sub": SubId, "uri": Uri}
{ok, _} = barrel_mcp_client:subscribe(C, Uri),
receive {mcp_resource_updated, Uri, _} -> refetch end,
{ok, Snapshot} = barrel_mcp_client:read_resource(C, Uri).
```

## Notes

- Les lectures de ressource ne portent aucun contexte d'authentification dans le
  framework MCP (handlers d'arite 1), ainsi les modeles db et doc repondent a
  n'importe quel appelant authentifie. Mettez `resources => live_only` quand vous
  distribuez des jetons de capacite : les URIs en direct incorporent 16 octets
  aleatoires, la possession est la capacite.
- Le pont en direct possede chaque abonnement : les bases de donnees avec des
  requetes en direct actives sont epinglees ouvertes, les abonnements orphelins
  (leur session MCP a expire) sont balayes, et des plafonds par session/globaux
  bornent les agents emballes.
- Les lignes d'un instantane en direct sont triees par id ; ORDER BY n'est pas
  maintenu a travers les deltas.
- Pour un principal de capacite, la base de donnees qu'un outil touche doit etre
  l'espace octroye lui-meme ; les bases de donnees de branche d'un espace ne sont
  pas atteignables avec une capacite en v1.
- Un point d'entree stdio (pour les hotes MCP locaux) n'est pas cable ; le moteur
  le supporte si vous en avez besoin.
