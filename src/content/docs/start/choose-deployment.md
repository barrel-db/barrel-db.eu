---
title: Choose a deployment
description: Decide between embedding Barrel in an Erlang release, running barrel_server, and keeping a copy in the browser with barrel-lite.
---

Barrel runs in three places: inside your Erlang release, as a server
over HTTP, and as a local copy in a web browser. You can mix them, since
they replicate with each other. Use this page to pick where to start
from what your clients are and where your data must live.

## Decide

| If you need | Use | Why |
|-------------|-----|-----|
| Your app is Erlang or Elixir and owns the data | Embedded `barrel` | No network hop, full API, record mode, timeline |
| Clients in other languages, or on other machines | `barrel_server` | REST/JSON over HTTP/1.1, HTTP/2 or HTTP/3 |
| An agent to read and write the data | `barrel_server` | MCP endpoint at `/mcp` with 39 tools |
| A web app that works offline | `barrel-lite` and `barrel_server` | Local store in the browser, synced to the server |
| Several sites or devices that all take writes | Any of them, replicating | Every copy accepts writes and converges |
| Documents and sync only, no vectors | `barrel_docdb` | Smaller dependency, same replication |
| Exact substring or regex over documents | `barrel_ngram`, or `barrel_server` | The server exposes it as the `ngram_search` tool |

## What each mode gives you

| | Embedded | Server | Browser |
|-|----------|--------|---------|
| Documents, BQL | yes | yes | yes, local BQL |
| Vector, BM25, hybrid search | yes | yes | on the server, through `queryRemote`; local cosine over synced vectors |
| Attachments | yes | yes | yes |
| Replication | `barrel_rep` | `_sync` routes | push and pull to a server |
| Branch, merge, past state | yes | `_timeline` routes | no |
| Spaces, sessions, handoffs | `barrel_spaces` | `/spaces`, `/handoffs`, MCP | no |
| Authentication | in process, none | bearer, capability tokens, signed requests, mTLS | bearer or capability token |
| Encryption at rest | yes | yes, through `open_opts` | no |

## Things to know before you choose

- **Embedded means your process holds the data.** The vector store is
  linked to the process that opens it. Open long-lived databases through
  `barrel_dbs` or with `store_supervised => true`. See [Embed barrel in an
  Erlang app](/docs/guides/embedding).
- **Capability tokens are enforced by the server.** In process, any code
  can open any space. If agents must be kept apart, put them behind
  `barrel_server`. See [Spaces and capabilities](/docs/concepts/spaces).
- **The browser copy is a cache.** The browser may evict it; the server
  holds the durable copy.
- **Vectors do not replicate.** Each copy rebuilds its own index from the
  documents in record mode.
- **One node is not a cluster.** There is no automatic placement or
  failover. You choose which copies replicate with which.

## Next

- [Quickstart: embedded](/docs/start/quickstart-embedded)
- [Quickstart: server](/docs/start/quickstart-server)
- [Quickstart: browser](/docs/start/quickstart-browser)
- [Synchronization](/docs/guides/synchronization)
