# Query two databases as contexts

This project registers two databases, support tickets for two regions,
as contexts and runs one BQL statement over both. The answer merges
the rows in `ORDER BY` order and says which context each row came
from, which contexts answered and what each answer covers. A third
context points at a node that is down: the same query then returns a
partial answer, with the reason. Use contexts when an agent must
search data spread over several databases or nodes and needs to know
what it did not see.

## Prerequisites

- Erlang/OTP 26 or later (this run used OTP 29) and rebar3.
- A C compiler and CMake for the native dependencies (first compile
  takes a few minutes).

## Run

```sh
./run.sh
```

`run.sh` compiles the project, deletes `./data`, then runs
`contexts_bql:main/0` once.

## What it shows

- `barrel_ctx:register/1`: a card with a name and a location, local
  (a database on this node) or remote (a barrel_server endpoint and
  a database there).
- `barrel_ctx:query/1` with `query` and `contexts`: every context runs
  the same statement; the `FROM` name is ignored.
- `execution` is `succeeded`, `partial` or `failed`; `sources` has one
  entry per context with its status, row count and `bound`;
  `coverage` counts them; `summary` says the same in one paragraph.
- With `offline => true` remote contexts are skipped, not contacted.
- A row query over contexts needs `LIMIT`: without it the request is
  refused before any context runs.

## Notes

- Not supported across contexts: `SUBSCRIBE`, `OFFSET`, `UNNEST`,
  continuations, and merging BM25 or hybrid scores (those come back
  grouped per context).
- The same queries run over REST (`POST /contexts/_query`) and MCP
  (`context_query`) on barrel_server.

## Expected output

Three answers and one refusal. The output of a real run is in
`expected.txt`.
