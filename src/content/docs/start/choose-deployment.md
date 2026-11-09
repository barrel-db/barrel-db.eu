---
title: Choose a deployment
description: Decide between embedding Barrel in an Erlang release, running barrel_server, and keeping a copy in the browser with barrel-lite.
---

Barrel runs in three places: inside your Erlang release, as a server
over HTTP, and as a local copy in a web browser. You can mix them, since
they replicate with each other: a server can sync with browsers and with
other servers, and every copy takes writes. Use this page to pick where
to start from what your clients are and where your data must live.

## The three options

### Embedded

In [embedded](/docs/concepts/glossary#embedded) mode the `barrel`
library runs inside your own Erlang or Elixir release, and your code
calls it as functions. It fits an application that owns its data and is
written in Erlang or Elixir, such as an agent runtime on an edge device.
You get the full API with no network hop: [record
mode](/docs/concepts/glossary#record-mode), the timeline, spaces. The
cost is that only code in the same release can reach the data, and
nothing enforces access rules between parts of that code.

### Server

[`barrel_server`](/docs/concepts/glossary#barrel-server) runs Barrel as
a service and serves it over HTTP: a REST/JSON API and an
[MCP](/docs/concepts/glossary#mcp) endpoint that agents call as tools. It
fits clients written in other languages, clients on other machines, and
agents. The cost is a service to run and secure: every call crosses the
network, and the server has no authentication until you configure it.

### Browser

[`barrel-lite`](/docs/concepts/glossary#barrel-lite) keeps a copy of a
database inside a web app, so reads and writes are local and keep
working offline. It fits a web app that must stay usable without a
network. The cost is that it needs a `barrel_server` to sync with, the
browser may evict its copy, and vector, keyword and hybrid search run on
the server, not locally.

## Decide

The table maps a need to the option that answers it.

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

This table lists which features each mode has, so you can check that the
one you picked covers what you need.

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

These are the limits that most often change a choice.

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
