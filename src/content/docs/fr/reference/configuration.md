---
title: Configuration
description: Les options que vous passez a l'ouverture d'une base de donnees, et l'environnement d'application de barrel_server.
---

Ceci liste les reglages que vous definissez quand vous ouvrez une base de donnees,
et les parametres que le serveur lit depuis son environnement d'application.
Utilisez-le comme reference ; les guides expliquent quand vous changeriez chacun.

## Ouvrir une base de donnees

`barrel:open/2` prend des options par couche :

```erlang
{ok, Db} = barrel:open(mydb, #{
    vectordb => #{
        dimension => 768,        %% embedding dimension
        bm25_backend => memory   %% none (default) | memory | disk
    },
    embedding => #{provider => openai},   %% record mode: auto-embed on write
    encryption => default                 %% encrypt at rest with a provided key
}).
```

| Couche / cle | Signification |
|-------------|---------|
| `vectordb.dimension` | Dimension du vecteur (768 par defaut). |
| `vectordb.bm25_backend` | Index de mot-cle : `none`, `memory`, ou `disk`. |
| `vectordb.hnsw_m`, `hnsw_ef_construction`, `hnsw_ef_search` | Reglage de l'index HNSW. |
| `embedding` | Une politique d'embedding pour que les documents calculent leur embedding automatiquement. Voir [Mode enregistrement](/fr/docs/guides/record-mode). |
| `encryption` | `disabled` (par defaut), `default`, ou une spec de fournisseur. Voir [Chiffrement](/fr/docs/guides/encryption). |

## Configuration du serveur

`barrel_server` lit ses parametres depuis l'environnement d'application
`barrel_server` (`sys.config`) :

```erlang
{barrel_server, [
    {http_port, 8080},
    {data_dir, "data"},
    {cors, #{origins => [<<"https://app.example">>]}},
    {auth, #{tokens => [<<"...">>]}},
    {mcp, #{enabled => true}}
]}.
```

| Cle | Signification |
|-----|---------|
| `http_port` | Port d'ecoute (8080 par defaut). |
| `data_dir` | Ou les bases de donnees sont stockees. |
| `dbs_idle_timeout`, `dbs_max_open` | Le gestionnaire de cycle de vie : fermeture a l'inactivite et LRU des handles ouverts. |
| `cors` | Origines autorisees pour les clients navigateur (requis par [barrel-lite](/fr/docs/guides/barrel-lite)). |
| `auth` | Jetons Bearer du serveur ; les jetons de capacite sont emis par espace. |
| `mcp` | Le [point de terminaison MCP](/fr/docs/server/mcp) : `enabled`, `resources`, `live`. |

Voir [Lancer le serveur](/fr/docs/server/rest-server) pour le tableau complet.
