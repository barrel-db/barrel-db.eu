---
translation_of: src/content/synced/guides/mcp.md
source_hash: "cb2d7fff419f335b"
title: "Point d’accès MCP"
description: "barrel_server monte un point d’accès MCP (Streamable HTTP) sur /mcp : des outils pour les bases, les documents, BQL, la recherche, la timeline, la couche agents et les contextes, ainsi que des ressources avec abonnements aux requêtes live. Lisez ce guide quand un client MCP (un runtime d’agents, un IDE, barrel_mcp_client) doit parler directement à barrel."
source: "docs/guides/mcp.md"
---

`barrel_server` monte un point d’accès MCP (Streamable HTTP) sur `/mcp` : des
outils pour les bases, les documents, BQL, la recherche, la timeline, la
couche agents et les contextes, ainsi que des ressources avec abonnements
aux requêtes live. Lisez ce guide quand un client MCP (un runtime d’agents,
un IDE, `barrel_mcp_client`) doit parler directement à barrel.

## Quand l’utiliser

- Vos agents accèdent à barrel par un runtime MCP plutôt qu’en REST.
- Vous voulez que les requêtes live soient poussées aux clients sous forme de
  notifications de ressource mise à jour.
- Vous donnez aux agents des jetons de capacité limités à un espace et
  voulez la même limitation sur la surface MCP.

## Activer et configurer

Le point d’accès est actif par défaut dans le build serveur. Configurez-le
avec l’env applicatif `{barrel_server, mcp, #{...}}` :

```erlang
{barrel_server, [
    {mcp, #{
        enabled => true,               %% défaut
        allowed_origins => any,        %% à restreindre pour les clients navigateur
        allow_missing_origin => true,
        resources => full,             %% full | live_only
        live => #{max_per_session => 32, max_global => 1024,
                  sweep_interval_ms => 60000, debounce_ms => 100,
                  orphan_ttl_ms => 600000},
        request_state_key => {file, "/etc/barrel/mcp-state.key"}
    }}
]}
```

Les requêtes live appartiennent à la session MCP qui les a créées ou, sur une
connexion 2026-07-28 (sans sessions), au principal authentifié :
`max_per_session` borne chaque propriétaire, et une requête appartenant à un
principal est abandonnée après `orphan_ttl_ms` sans lecture (une requête
appartenant à une session, quand sa session disparaît).

`request_state_key` (un binaire d’au moins 32 octets aléatoires, ou
`{file, Path}` pour le lire dans un fichier au démarrage) scelle l’état des
requêtes en plusieurs allers-retours. Chaque nœud d’une flotte doit porter la
même clé : sinon, une nouvelle tentative qui arrive sur un autre nœud, ou sur
le même nœud après un redémarrage, est refusée. Sur un nœud unique, laissez-la
non définie : barrel_mcp utilise alors une clé éphémère et l’indique au
démarrage.

## Authentification

`/mcp` s’authentifie par son propre fournisseur, qui accepte deux bearers :

- un jeton serveur (le même ensemble `{barrel_server, auth, #{tokens => [...]}}`
  que vérifie le middleware REST) : accès complet ;
- un jeton de capacité (`bsp_...`, émis par `barrel_caps`) : limité à son
  espace et à ses droits ; chaque outil vérifie la base qu’il touche par
  rapport à l’autorisation. Les refus reviennent comme des erreurs d’outil que
  l’agent peut lire, pas comme des échecs de protocole.

Sans authentification configurée, le point d’accès est ouvert, comme le reste
du serveur.

## Outils

Cœur (entre parenthèses, les droits dont une capacité a besoin) :

```
db_create (write)      db_list (read)          db_info (read)
doc_get (read)         doc_put (write)         doc_delete (write)
query (read)           search (read)           ngram_search (read)
changes (read)         branch_create (admin)  branch_list (read)      merge (admin)
query_subscribe (write)                        query_unsubscribe
```

Couche agents :

```
space_create (management only)   space_info (read)
space_grant (admin)              space_revoke (admin)
session_create (write)           session_touch (write)
session_add_message (write)      session_get_messages (read)
handoff_create (admin)           handoff_list (read)
handoff_accept (token in args)   handoff_complete (token in args)
```

Contextes (voir [contextes](/fr/docs/guides/contexts) pour un pas-à-pas) :

| Outil | Arguments requis | Renvoie |
|---|---|---|
| `context_capabilities` | aucun | les formes d’instructions acceptées avec des exemples, les fusions, les limites, les budgets des ensembles de travail, l’état hors ligne |
| `context_list` | aucun (`prefix`, `unlisted`) | `{contexts: [card]}` |
| `context_discover` | `q` | `{contexts, summary}` : les fiches où chaque mot de `q` correspond |
| `context_inspect` | `context` (nom ou id) | une fiche |
| `context_query` | `query`, et `contexts` ou `working_set` | `rows` ou `groups`, `sources`, `coverage`, `execution`, `summary` |
| `context_attach` | `context` (`working_set`, `mode`, `credential_ref`) | l’ensemble de travail (un nouveau sans `working_set`) |
| `context_detach` | `working_set`, `context` | l’ensemble de travail |
| `context_materialize` | `from_query` (`query`, `contexts`) | les tranches enregistrées, l’utilisation et le budget |
| `context_import` | `dir` (`working_set`, `name`) | l’ensemble de travail avec le membre importé |
| `context_working_sets` | aucun (`working_set` pour en lire un) | les ensembles de travail, ou un seul en entier |
| `context_working_set_delete` | `working_set` | `{ok: true, deleted}` |
| `context_offline` | aucun (`offline` pour basculer) | `{offline: bool}` |

`context_query` prend aussi `merge`, `offline`, `params`, `deadline_ms`
(5000 par défaut, au plus 60000), `per_context_timeout_ms` et
`max_parallel`.

Un jeton de capacité peut utiliser `context_capabilities`, `context_list`,
`context_discover`, `context_inspect`, `context_query` (chaque contexte local
est vérifié comme une lecture sur sa base) et lire le mode hors ligne. Les
ensembles de travail, les imports et le passage hors ligne demandent un jeton
serveur.

Les outils de contexte signalent les échecs sous une seule forme, la même que
les routes REST :

```json
{"error": "unknown_context",
 "message": "No context has the id or name otp/sasll.",
 "hint": "Did you mean: otp/sasl? context_list (GET /contexts) shows every context.",
 "details": {"context": "otp/sasll", "suggestions": ["..."]}}
```

Un `context_query` auquel aucun contexte n’a répondu (`execution: failed`)
revient comme un résultat d’erreur d’outil (`isError: true`) qui porte la
réponse complète : vous pouvez ainsi lire l’`error` de chaque source.

`query` compile d’abord l’instruction (les erreurs d’analyse sont lisibles),
borne les lignes avec `max_rows` (100 par défaut, plafond 1000) et pagine
avec une `continuation`. Les instructions SUBSCRIBE sont rejetées et
renvoyées vers `query_subscribe`. Chaque écriture porte une provenance :
acteur = sujet authentifié, session = session MCP (ou l’argument `session`
de l’outil), source = `mcp`. Voir
[audit-provenance](/fr/docs/guides/audit-provenance).

## Ressources et requêtes live

Trois modèles :

```
barrel://db/{db}              database info
barrel://db/{db}/doc/{id}     a document body
barrel://db/{db}/live/{sub}   the materialized snapshot of a live query
```

`query_subscribe` démarre une requête live et renvoie l’URI de sa ressource.
Lisez l’URI pour obtenir les lignes courantes (`#{ready, count, rows}`,
triées par id) ; abonnez-vous à elle (`resources/subscribe`) pour recevoir un
`notifications/resources/updated` à chaque changement, temporisé, livré par
le flux SSE GET du client. Le client relit à chaque notification.

```erlang
{ok, C} = barrel_mcp_client:start(#{
    transport => {http, <<"http://localhost:8080/mcp">>},
    auth => {bearer, Token}}),
{ok, R} = barrel_mcp_client:call_tool(C, <<"query_subscribe">>, #{
    <<"db">> => <<"mydb">>,
    <<"query">> => <<"SELECT * FROM db WHERE kind = 'task' SUBSCRIBE">>}),
%% le contenu de R porte {"sub": SubId, "uri": Uri}
{ok, _} = barrel_mcp_client:subscribe(C, Uri),
receive {mcp_resource_updated, Uri, _} -> refetch end,
{ok, Snapshot} = barrel_mcp_client:read_resource(C, Uri).
```

## Notes

- Dans le framework MCP, les lectures de ressources ne portent aucun contexte
  d’authentification (handlers d’arité 1) : les modèles db et doc répondent
  donc à tout appelant authentifié. Définissez `resources => live_only` quand
  vous distribuez des jetons de capacité : les URI live contiennent 16 octets
  aléatoires, leur possession vaut capacité.
- Le pont live possède chaque abonnement : les bases ayant des requêtes live
  actives sont maintenues ouvertes, les abonnements orphelins (dont la
  session MCP a expiré) sont balayés, et des plafonds par session et globaux
  bornent les agents qui s’emballent.
- Les lignes d’un instantané live sont triées par id ; ORDER BY n’est pas
  maintenu d’un delta à l’autre.
- Pour un principal à capacité, la base touchée par un outil doit être
  l’espace autorisé lui-même ; les bases de branche d’un espace ne sont pas
  accessibles avec une capacité en v1.
- `ngram_search` prend `db` et `query`, avec `mode` (`literal`, le défaut, ou
  `regex`) et `limit` ; chaque résultat porte l’id du document et les plages
  de correspondance.
- Aucun point d’entrée stdio (pour les hôtes MCP locaux) n’est câblé ; le
  moteur le permet si vous en avez besoin.
