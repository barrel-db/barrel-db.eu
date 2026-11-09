---
title: Glossary
description: The terms used across the Barrel docs, each in plain words, with a link to the page that covers it.
---

This page explains the words the Barrel docs use, in alphabetical order.
Each entry says what the thing is, why it matters to you, and where to
read more. Other pages link here the first time they use a term, so you
can come back whenever a word is unclear.

## Active-active

Every copy of a database takes writes, and the copies converge when they
replicate. You do not pick a primary: a laptop, a phone and two servers
can all accept edits to the same document while apart. Concurrent edits
are kept as a [conflict](#conflict) instead of being lost. See
[Synchronization](/docs/guides/synchronization).

## Attachment

A named binary file stored under a document's id, such as `steps.md` on
the support article `kb-142`. Attachments are not versioned: the last
write wins on its timestamp, and writing one does not change the
document's [revision](#revision). They replicate on their own feed,
alongside documents. See [Attachments](/docs/store/attachments).

## barrel-lite

A TypeScript client that keeps a local copy of a database in the web
browser and syncs it with a [Barrel server](#barrel-server). Your web app
reads and writes locally, keeps working offline, and converges with the
server when it reconnects. The browser may evict local data, so sync is
what makes writes durable. See [barrel-lite](/docs/guides/barrel-lite).

## Barrel server

`barrel_server` puts a Barrel database on the network: REST/JSON over
HTTP, and an [MCP](#mcp) endpoint for agents. Use it when clients are in
other languages, on other machines, or must be held to a
[capability token](#capability-token). It holds no database logic of its
own and is not part of the default embedded build. See [Run the REST
server](/docs/guides/rest-server).

## BM25

A keyword ranking: it returns only the documents that contain the words
of your query, ranked by how well they match. Use it when exact terms
matter, such as an error code or a product name. Its score is the raw
BM25 value and has no upper bound. See [Vector, keyword and
hybrid](/docs/search/hybrid).

## BQL

Barrel's query language, a dialect of PartiQL (SQL for JSON). One
`SELECT` statement can filter documents, run a vector or keyword search
and join the results back to their documents, or subscribe to live
updates. It compiles onto the same engine as the structured `find/2`
API. See [Query with BQL](/docs/guides/query-bql).

## Branch

A fork of a database, made in constant time whatever its size, because
the branch shares its files on disk with its parent.
The branch is a normal database: an agent or an experiment works on it
alone, then you merge back what survived review. Concurrent edits on both
sides become regular [conflicts](#conflict). See [Branch, merge,
recover](/docs/guides/timeline).

## Capability token

A secret string starting with `bsp_` that gives its holder `read`,
`write` or `admin` rights on one [space](#space) and nothing else. It is
shown once when you grant it; Barrel stores only its SHA-256 hash.
`barrel_server` checks it on every request, while inside your own Erlang
node it is advisory. See [Spaces and capabilities](/docs/concepts/spaces).

## Channel

A named set of path patterns, declared when you create a database, that
selects a subset of documents to replicate. Barrel files matching writes
into a per-channel feed as they happen, so a filtered pull reads only that
feed instead of the whole history. Use it to send a phone only its tasks,
for example. See [Synchronization](/docs/guides/synchronization).

## Checkpoint

A small local record, kept on both sides of a [replication](#replication),
of how far the last run got. The next run starts from there instead of
from the beginning, so you can stop and restart replication at any time.
A filtered replication keeps its own checkpoint. See
[Synchronization](/docs/guides/synchronization).

## Conflict

Two copies edited the same document before they synced, so neither
version saw the other. Barrel keeps both as siblings, shows the same
winner on every copy, and lists the others in `_conflicts` until you
resolve them. Separately, a write with a stale `_rev` is refused with
`{error, conflict}`, so you never overwrite a change you did not read.
See [Versions, conflicts, convergence](/docs/concepts/versions).

## Convergence

The guarantee that every copy of a database ends with the same versions,
the same winner, the same body and the same deleted flag, whatever the
order of writes and syncs. It is what lets you write anywhere and sync
later without a coordinator. See [Why it
converges](/docs/concepts/versions#why-it-converges).

## Document

A JSON object with an `id`, such as the support article `kb-142`. Every
write to it creates a new version, and every field in it is indexed, so
you can query any field without declaring an index. Top-level fields that
start with `_` are reserved for Barrel. See [The
record](/docs/concepts/record).

## Embedded

Running Barrel inside your own Erlang or Elixir release, as a library,
with no server and no network hop. You get the full API in process:
documents, search, attachments, [record mode](#record-mode) and the
timeline. Use it when your application owns the data. See [Embed barrel
in an Erlang app](/docs/guides/embedding).

## Embedding

The [vector](#vector) a model computes from a piece of text, so that texts
with close meanings get close vectors. Barrel calls an embedding provider
(a local model, an Ollama server or a cloud API) on every write and on
every text query. Which provider you pick decides where your text goes.
See [Choose an embedding provider](/docs/search/embedding-providers).

## Handoff

A way for one agent to pass a task to another inside a [space](#space).
It issues a [capability token](#capability-token) for the task; whoever
accepts it first gets a [session](#session) in the same space, and a
second accept fails. Nothing is copied: the next agent reads the context
where it is. See [Spaces and capabilities](/docs/concepts/spaces).

## Hybrid search

A search that runs a vector search (by meaning) and a [BM25](#bm25)
search (by keyword), then fuses the two rankings into one. It finds
documents that say the same thing in other words and still ranks exact
terms well. The default fusion uses ranks, not raw scores. See [Vector,
keyword and hybrid](/docs/search/hybrid).

## MCP

The Model Context Protocol, a standard way for agent runtimes and IDEs
to call tools. [Barrel server](#barrel-server) serves an MCP endpoint at
`/mcp` with tools for documents, BQL, search, the timeline, spaces and
contexts. Your agent talks to Barrel directly, held to the same
capability tokens as REST. See [MCP endpoint](/docs/guides/mcp).

## Pin

A piece of context you attach to a [session](#session) with
`pin_context`, such as a key fact the agent must keep in view. Pins are
stored as documents in the space and listed with `list_pinned`, so
anyone holding a token for the space can read them. See [Spaces, sessions,
handoffs](/docs/guides/spaces).

## Point-in-time recovery

Reading a database as it was at a past instant, by creating a
[branch](#branch) at that instant. You get yesterday's data next to
today's, without restoring a backup over the live database. It works
inside the retention window (30 days by default); older history is gone.
See [Backups and recovery](/docs/operate/backups#recover-a-past-state).

## Record

Everything Barrel keeps under one id: the [document](#document), its
[attachments](#attachment) and, in [record mode](#record-mode), its
[vector](#vector). You read, write, replicate and delete them by that id,
so they never drift apart. See [The record](/docs/concepts/record).

## Record mode

A database setting that tells Barrel which fields to embed, with which
provider and at which dimension. Barrel then computes the vector on every
write and drops it on delete, so search always matches the current
documents and you never call `vector_add` yourself. See [Record
mode](/docs/guides/record-mode).

## Replication

Copying versions from one database to another, in the same Erlang VM or
over HTTP to a [Barrel server](#barrel-server). It runs once or
continuously, resumes from its [checkpoint](#checkpoint), and can carry
only a subset with a [channel](#channel). Sending a version twice is safe.
See [Synchronization](/docs/guides/synchronization).

## Revision

The `_rev` field Barrel adds when you read a document: the token of its
winning version, built from a clock and the id of the database that
wrote it. Send it back when you update the document; a missing or stale
`_rev` returns `{error, conflict}`. See [The version
token](/docs/concepts/versions#the-version-token).

## Session

An agent's working context inside a [space](#space): its messages,
key/value data and [pins](#pin), stored as documents in the space. It
expires after a period without activity (3600 seconds by default) unless
you make it durable. Anyone holding a token for the space can read it.
See [Spaces and capabilities](/docs/concepts/spaces).

## Space

A Barrel database that several agents share, each holding a
[capability token](#capability-token) for it. Its name is `sp_` followed
by 16 characters, and a registry records who was granted what. Use one
space per piece of shared work, such as a joint research draft. See
[Spaces and capabilities](/docs/concepts/spaces).

## Vector

A list of numbers that stands for the meaning of a document's text, used
to find documents by similarity. In [record mode](#record-mode) it follows
the document: written with it, dropped with it. Vectors are not
replicated; each copy computes its own. See [Vector, keyword and
hybrid](/docs/search/hybrid).
