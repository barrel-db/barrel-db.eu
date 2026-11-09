%% A deterministic, offline embedding provider for examples and tests:
%% 64-dimension feature hashing of the words. It matches shared words,
%% it does not understand meaning. Use a real model in production.
-module(hash_embed).
-behaviour(barrel_embed_provider).
-export([name/0, dimension/1, embed/2, embed_batch/2,
         model_info/1]).

-define(DIM, 64).

name() -> hash_embed.
dimension(_Config) -> ?DIM.
model_info(_Config) -> #{model => <<"hash-64">>}.

embed(Text, _Config) -> {ok, vec(Text)}.
embed_batch(Texts, _Config) -> {ok, [vec(T) || T <- Texts]}.

vec(Text) ->
    Words = string:lexemes(string:lowercase(Text),
                           " \n\t.,;:!?()'\""),
    Zero = erlang:make_tuple(?DIM, 0.0),
    Counts = lists:foldl(
        fun(W, Acc) ->
            I = erlang:phash2(W, ?DIM) + 1,
            setelement(I, Acc, element(I, Acc) + 1.0)
        end, Zero, Words),
    L = tuple_to_list(Counts),
    case math:sqrt(lists:sum([X * X || X <- L])) of
        +0.0 -> L;
        N -> [X / N || X <- L]
    end.
