---
title: The agent layer
description: Spaces, capability tokens, sessions, and handoffs, the pieces for giving agents scoped, shareable memory.
---

The agent layer turns Barrel into memory for agents: shared context, scoped
access, working sessions, and handoffs between agents. Read this to understand the
pieces before you wire an agent runtime to Barrel over REST or MCP.

## Spaces

A space is a shared context database with its own encryption and its own set of
grants. Agents and people work in the same space, so an agent's memory is not a
private silo, it is a place others can read and contribute to.

```erlang
{ok, #{id := Space}} = barrel_spaces:create_space(<<"research-team">>).
```

## Capability tokens

You hand an agent a capability token scoped to one space with `read`, `write`, or
`admin` rights (read is weakest, admin strongest). Access is fail-closed by
default, and you can revoke a token at any time. Give each agent the least it
needs.

```erlang
{ok, Token} = barrel_caps:grant(Space, #{rights => [read, write]}).
```

## Sessions

A session is working memory with a sliding time-to-live: ordered messages,
structured data, and summaries. Sessions expire and are swept when an agent goes
idle, so short-lived context does not accumulate forever.

## Handoffs

A handoff passes a task from one agent to another by reference, carrying a
capability. The receiver accepts it and takes over; the sender's grant is revoked.
This is how work moves between agents without copying the underlying data.

## Over REST and MCP

Everything here is reachable through [barrel_server](/docs/server/rest-server):
the REST routes under `/spaces`, and an [MCP endpoint](/docs/server/mcp) whose
tools carry the same capability scoping. Every write records who did it (actor,
session, source), so agent actions stay auditable.
