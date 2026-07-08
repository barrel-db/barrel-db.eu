---
title: Version vectors
description: How Barrel versions writes and resolves conflicts, so sync converges without a coordinator.
---

Barrel uses hybrid logical clocks and version vectors instead of a revision tree.
Read this when you sync or replicate databases, or write from more than one place,
and you want to know how concurrent edits are resolved.

## Every write is a version

Each write gets a version token of the form `<hex(hlc)>@<author>`: a hybrid
logical clock timestamp, plus the id of the database that authored it. You see
this token as the `<<"_rev">>` of a document. It is not a revision tree, and there
is no parent chain to walk.

## Version vectors track causality

Every document carries a version vector: the highest clock it has seen from each
author. When two databases sync, the target compares vectors by containment to
decide, per document, what it is missing. This is how sync stays incremental and
coordinator-free: no node has to be the primary.

## Conflicts are kept, not lost

When two writes are genuinely concurrent (neither version vector contains the
other), Barrel picks a deterministic last-write-wins winner and **retains the
losing version as a conflict sibling**. Nothing is silently dropped. You can:

- resolve conflicts by choosing a winner, or
- set a merge function that Barrel calls to produce the resolved value.

```erlang
case barrel:get_conflicts(Db, <<"a">>) of
    {ok, []}        -> ok;              %% no conflict
    {ok, Conflicts} -> barrel:resolve_conflict(Db, <<"a">>, Winner, choose)
end.
```

## Why not plain last-write-wins?

A pure last-write-wins database throws away a write the moment two replicas edit
the same document, and it cannot tell a genuine conflict from a stale resend.
Version vectors let Barrel tell the difference, keep the loser for you to inspect,
and converge every replica to the same winner and body. See
[Synchronization](/docs/guides/synchronization) for how this plays out on the
wire.
