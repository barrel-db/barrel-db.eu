# An MCP session with curl

This script talks to barrel_server's MCP endpoint the way an agent
does, one JSON-RPC message at a time: it initializes a session, lists
the tools, creates a database, writes and reads documents, runs a BQL
query and a substring search, and ends the session. It prints every
request and the tool result it got back. Use it to see the wire format
before you connect an MCP client, or to test a server you deployed.

## Prerequisites

- A running barrel_server (1.13 or later). From a checkout of the
  barrel repository:

  ```sh
  rebar3 as server compile
  rebar3 as server shell
  ```

  The shell starts barrel_server on port 8080, with no auth.
- curl and jq.

## Run

```sh
BARREL_URL=http://localhost:8080 ./run.sh
```

On a server with bearer auth, also set `BARREL_TOKEN`. The script
deletes and recreates the database `mcp_demo` (over REST) so every run
starts empty.

## What it shows

- `POST /mcp` with `initialize` returns the session id in the
  `mcp-session-id` response header; every later request sends it back,
  with `mcp-protocol-version: 2025-06-18`.
- `initialize` and `tools/list` answer plain JSON; `tools/call` answers
  as server-sent events (`data: {...}`). The script keeps the JSON.
- A tool result is a JSON document in the text content. A failed call
  is still a result, with `isError: true`, for example
  `{"error":"not_found"}`.
- `DELETE /mcp` ends the session (204).

## Notes

- `ngram_search` finds exact substrings with no extra setup. `search`
  in `bm25` or `hybrid` mode needs BM25 or an embedder configured on
  the database; on a default server it returns an error result.
- `/mcp` accepts bearer tokens only (a server token or a capability
  token), not signed requests or mTLS.

## Expected output

The requests and the results, in order. The output of a real run is
in `expected.txt`; the session id and revisions differ on every run.
