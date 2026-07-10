---
title: Installation
description: Add Barrel to your Erlang project, and the options for the server and the browser client.
---

You add Barrel to your project as a Hex dependency and start it like any other
OTP application. Read this when you are setting up a new project, or adding
Barrel to an existing one.

## Requirements

- Erlang/OTP 28 or newer
- rebar3
- A C/C++ compiler and CMake (the vector layer builds a small NIF)

## Add the dependency

Add `barrel` to your `rebar.config`:

```erlang
{deps, [
    {barrel, "~> 1.0"}
]}.
```

Then start it. Starting `barrel` brings up the document and vector layers it
composes:

```erlang
{ok, _} = application:ensure_all_started(barrel).
```

You are ready to [open a database](/docs/get-started/quickstart).

## Use just one layer

Barrel is one database made of independent libraries. If you only need one, depend
on it directly instead:

```erlang
{deps, [
    {barrel_docdb, "~> 1.0"},     %% documents only
    {barrel_vectordb, "~> 2.1"}   %% vectors only
]}.
```

## Add the server

To expose the same database over HTTP (REST/JSON) and MCP, add `barrel_server`:

```erlang
{deps, [
    {barrel_server, "~> 1.0"}
]}.
```

See [Running the server](/docs/server/rest-server) for configuration and routes.

## Use it in the browser

`barrel-lite` is the offline-first TypeScript client. It lives in the Barrel repo
under `clients/barrel-lite` and syncs to a running `barrel_server`. See the
[browser client guide](/docs/guides/barrel-lite).
