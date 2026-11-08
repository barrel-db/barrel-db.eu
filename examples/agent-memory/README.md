# Agent memory across restarts

This project keeps an agent's memory in a Barrel space: a session with
its messages, pinned context and working data, plus long-term facts
stored as documents that are embedded when they are written (record
mode) and recalled by search. A first node writes the memory and
stops; a second node opens the same data and recalls it. Use it as a
starting point when an agent must remember across runs and crashes.

## Prerequisites

- Erlang/OTP 26 or later (this run used OTP 29) and rebar3.
- A C compiler and CMake for the native dependencies (first compile
  takes a few minutes).
- No model and no network: the embedder is `hash_embed`, below.

## Run

```sh
./run.sh
```

`run.sh` compiles the project, deletes `./data`, then starts two
separate nodes on the same data directory: `agent_memory:main(write)`
and `agent_memory:main(recall)`.

## What it shows

- `barrel_spaces:create_space/1` with an `embedding` policy: every
  document with a `content` field, messages included, is embedded in
  the same write.
- `barrel_session`: `create/2` with `ttl => infinity`, `add_message/3`,
  `pin_context/3` (lower priority comes first), `set_data/4`.
- On the second node, `barrel_spaces:open_space/1` reopens the space in
  record mode with the embedder from `config/sys.config`
  (`{barrel_spaces, [{embedder, ...}]}`), and messages, pins, data and
  the vector index are all there.
- `barrel:search/3` over facts and messages together; `type` in the
  metadata tells them apart.

## About the embedder

`hash_embed` is a small deterministic provider written for this
example: it hashes words into 64 dimensions, so it matches shared
words and does not understand meaning. It keeps the run offline and
the output stable. Its scores are not a measure of search quality.
For real recall, use a model: set the space's `embedder` (and the
`barrel_spaces` env) to `{ollama, #{url => ..., model => ...}}` or
`{local, #{}}`, with the matching `dimensions`. See
[choose an embedding provider](https://barrel-db.eu/docs/search/embedding-providers).

## Expected output

Node 1 prints the session id and the first search; node 2 prints the
messages, pins and data it read back and two searches. The output of
a real run is in `expected.txt`; the session id differs on every run.
