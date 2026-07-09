---
title: REST API (OpenAPI)
description: The OpenAPI 3.1 specification for the barrel_server REST API, and how to test against it.
---

The barrel_server REST API is described by an OpenAPI 3.1 specification you can
download at [`/openapi.yaml`](/openapi.yaml). It covers databases, documents,
attachments, vectors, search, timelines, the changes feed, the BQL query
endpoint, and the agent layer (spaces, grants, sessions, handoffs). Use it when
you want to explore the API interactively, generate a client, or drive requests
from a tool instead of writing them by hand.

## Download the spec

```
curl -O http://localhost:8080/../openapi.yaml   # or fetch it from this site
```

The canonical copy is served at [`/openapi.yaml`](/openapi.yaml). It ships with
the server at `apps/barrel_server/priv/openapi.yaml`.

## Import into Postman or Insomnia

1. Open Postman or Insomnia.
2. Choose Import, then point it at `https://barrel-db.eu/openapi.yaml` (or a
   local copy of the file).
3. The tool builds a request collection from the paths. Set the base URL to
   your server, for example `http://localhost:8080`.
4. If your server runs with auth, add a Bearer token (a global server token, or
   a `bsp_...` capability token scoped to a space).

## View in Swagger Editor or Scalar

- Paste the spec into [editor.swagger.io](https://editor.swagger.io) to browse
  every operation with a live schema view.
- Or render it with [Scalar](https://github.com/scalar/scalar) for an API
  reference you can read and try requests from.

## Generate a client

Use [openapi-generator](https://openapi-generator.tech) to produce a client in
your language:

```
openapi-generator-cli generate \
  -i https://barrel-db.eu/openapi.yaml \
  -g python \
  -o ./barrel-client
```

Swap `-g python` for any supported generator (`typescript-fetch`, `go`, `rust`,
and others).

## Notes

- `GET /` and `GET /health` are public. Every other endpoint accepts a bearer
  token when the server is configured for auth, and needs none when it runs
  open.
- The replication wire (`/db/{db}/_sync/*`) and the MCP endpoint (`/mcp`) are
  separate protocols and are not part of this spec.
