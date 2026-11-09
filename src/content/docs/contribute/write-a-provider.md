---
title: Write an embedding provider
description: Implement the barrel_embed_provider behaviour to plug your own embedding model into Barrel, with a minimal provider module you can compile and run.
---

An embedding provider turns text into vectors for barrel_embed, and through it for record mode, `search/3`, `vector_top_k` and `hybrid_top_k`. Write one when the model you need is not among the [built-in providers](/docs/search/embedding-providers): an internal service, a model you run in-process, or a deterministic embedder for tests. Any module that implements the `barrel_embed_provider` behaviour can be named where a provider id goes.

## The callbacks

| Callback | Required | Returns |
|---|---|---|
| `name() -> atom()` | yes | The provider's name, shown by `info/1` |
| `dimension(Config) -> pos_integer()` | yes | The size of the vectors it produces |
| `embed(Text, Config)` | yes | `{ok, [float()]}` or `{error, Reason}`; `Text` is a binary |
| `embed_batch(Texts, Config)` | yes | `{ok, [[float()]]}`, one vector per text, in order, or `{error, Reason}` |
| `init(Config)` | no | `{ok, NewConfig}` or `{error, Reason}`; called once when the chain starts |
| `available(Config) -> boolean()` | no | Whether to use the provider now; `false` skips to the next one in a chain |
| `model_info(Config)` | no | `#{model := binary() \| undefined, revision => binary()}`; pure, no network |

`Config` is the map you pass next to the module name, as returned by `init/1`.

## A minimal provider

This one hashes words into a fixed number of slots and normalizes the result. It matches shared words, it is not semantic, but it needs no network and gives the same vector every time, which makes it useful in tests.

```erlang
-module(word_embed).
-behaviour(barrel_embed_provider).

-export([name/0, dimension/1, embed/2, embed_batch/2]).
-export([init/1, available/1, model_info/1]).

-define(DEFAULT_DIM, 64).

name() -> word_embed.

dimension(Config) -> maps:get(dimension, Config, ?DEFAULT_DIM).

init(Config) ->
    {ok, Config#{dimension => dimension(Config)}}.

available(_Config) -> true.

model_info(Config) ->
    #{model => <<"word-hash">>,
      revision => integer_to_binary(dimension(Config))}.

embed(Text, Config) ->
    {ok, vector(Text, dimension(Config))}.

embed_batch(Texts, Config) ->
    Dim = dimension(Config),
    {ok, [vector(T, Dim) || T <- Texts]}.

%% One slot per word hash, normalized to unit length.
vector(Text, Dim) ->
    Words = string:lexemes(string:lowercase(Text),
                           " \n\t.,;:!?()"),
    Counts = lists:foldl(
               fun(W, Acc) ->
                   I = erlang:phash2(W, Dim) + 1,
                   setelement(I, Acc, element(I, Acc) + 1.0)
               end, erlang:make_tuple(Dim, 0.0), Words),
    L = tuple_to_list(Counts),
    case math:sqrt(lists:sum([X * X || X <- L])) of
        +0.0 -> L;
        N -> [X / N || X <- L]
    end.
```

## Try it with barrel_embed

```erlang
{ok, St} = barrel_embed:init(#{
    embedder => {word_embed, #{dimension => 64}},
    dimensions => 64}),
{ok, Vec} = barrel_embed:embed(<<"hello world">>, St),
64 = length(Vec),
barrel_embed:info(St).
```

Output of the last call, from a run against the umbrella at main `c111ec4`:

```text
#{dimension => 64,
  providers =>
      [#{module => word_embed,name => word_embed,
         model => <<"word-hash">>,revision => <<"64">>}],
  configured => true}
```

Pass `dimensions` to `init/1` as well: `barrel_embed:dimension/1` returns that value (768 when unset), not the provider's.

## Use it in a database

Name the module in an embedding policy, or in a vector store config:

```erlang
{ok, Db} = barrel:open(<<"notes">>, #{
    embedding => #{
        fields => [<<"title">>, <<"body">>],
        mode => sync,
        embedder => {word_embed, #{dimension => 64}},
        dimensions => 64},
    vectordb => #{db_path => "/var/lib/app/vec/notes"}}).
```

`barrel:embedder_info(Db)` then reports `provider => word_embed`, the `model` and `revision` from `model_info/1`, and a `fingerprint` that identifies the vector space. The model and revision are part of that identity, so keep `model_info/1` accurate.

## Put it in a chain

A list of providers is a fallback chain: each call goes to the first provider whose `available/1` returns true and whose call succeeds.

```erlang
{ok, St} = barrel_embed:init(#{
    embedder => [{ollama, #{url => <<"http://localhost:11434">>}},
                 {word_embed, #{dimension => 64}}],
    dimensions => 64}).
```

With Ollama down, the call is served by `word_embed` (checked with Ollama unreachable). Every provider in a chain must produce vectors of the same size.

## Notes

- barrel_embed wraps your calls: an exception in `embed/2` or `embed_batch/2` becomes `{error, {provider_error, Module, _}}` and the chain moves on.
- Without `model_info/1`, the model comes from the `model` key of the config. With no model known, there is no fingerprint, and vector results cannot be compared across databases or contexts.
- `available/1` runs before every call. Keep it cheap: a remote provider that sends a request there adds one round trip per embed.
- `embed_batch/2` receives chunks of `batch_size` texts (32 by default, set it in the `init/1` config).
- If `init/1` fails for every provider, `barrel_embed:init/1` returns `{error, no_providers_available}`; when every provider fails on a call, `{error, all_providers_failed}`.
- The example in the `barrel_embed_provider` moduledoc builds `embed_batch/2` from `embed/2` and returns a list of `{ok, Vector}` tuples; return plain vectors, as above.
