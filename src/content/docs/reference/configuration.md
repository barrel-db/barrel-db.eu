---
title: Configuration
description: The options you pass when opening a database, and the barrel_server app environment.
---

This lists the knobs you set when you open a database, and the settings the server
reads from its app environment. Use it as a lookup; the guides explain when you
would change each one.

## Opening a database

`barrel:open/2` takes options per layer:

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

| Layer / key | Meaning |
|-------------|---------|
| `vectordb.dimension` | Vector dimension (default 768). |
| `vectordb.bm25_backend` | Keyword index: `none`, `memory`, or `disk`. |
| `vectordb.hnsw_m`, `hnsw_ef_construction`, `hnsw_ef_search` | HNSW index tuning. |
| `embedding` | An embedding policy so documents auto-embed. See [Record mode](/docs/guides/record-mode). |
| `encryption` | `disabled` (default), `default`, or a provider spec. See [Encryption](/docs/guides/encryption). |

## Server configuration

`barrel_server` reads its settings from the `barrel_server` app environment
(`sys.config`):

```erlang
{barrel_server, [
    {http_port, 8080},
    {data_dir, "data"},
    {cors, #{origins => [<<"https://app.example">>]}},
    {auth, #{tokens => [<<"...">>]}},
    {mcp, #{enabled => true}}
]}.
```

| Key | Meaning |
|-----|---------|
| `http_port` | Listen port (default 8080). |
| `data_dir` | Where databases are stored. |
| `dbs_idle_timeout`, `dbs_max_open` | The lifecycle manager: idle close and the open-handle LRU. |
| `cors` | Allowed origins for browser clients (needed by [barrel-lite](/docs/guides/barrel-lite)). |
| `auth` | Server bearer tokens; capability tokens are issued per space. |
| `mcp` | The [MCP endpoint](/docs/server/mcp): `enabled`, `resources`, `live`. |

See [Running the server](/docs/server/rest-server) for the full picture.
