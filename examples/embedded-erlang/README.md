# Embed barrel in an Erlang app

This project runs barrel inside your own Erlang node: it opens a
database, writes three documents, updates one, queries them with BQL,
closes the database and reopens it to read the data back from disk.
There is no server and no network. Start here when your application
runs on the BEAM and owns its data.

## Prerequisites

- Erlang/OTP 26 or later (this run used OTP 29) and rebar3.
- A C compiler and CMake: rocksdb and the vector store build their
  native code on the first compile, which takes a few minutes.

## Run

```sh
./run.sh
```

`run.sh` compiles the project (`rebar3 compile`, dependencies from
Hex), deletes `./data`, then runs `embedded_erlang:main/0` in a fresh
node with `erl -noshell -config config/sys`. `config/sys.config` puts
the data under `./data/docdb` and sends logs to stderr.

To use barrel in your own app, add the dependency and list `barrel`
in the `applications` of your `.app.src`:

```erlang
{deps, [{barrel, "~> 1.12"}]}.
```

## What it shows

- `barrel:open/2` with `vectordb => none`: documents only, no vector
  store.
- `barrel:put_docs/2` returns one result per document, each with its
  revision.
- An update must carry the `_rev` it read; a stale `_rev` returns
  `{error, conflict}`.
- BQL with `WHERE`, `ORDER BY`, a `$parameter`, `IN` on an array and
  `UNNEST`.
- `barrel:close/1`, then a reopen that reads the same data.

## Expected output

Each step prints one line or a list of rows. The output of a real run
is in `expected.txt`; revisions differ on every run.
