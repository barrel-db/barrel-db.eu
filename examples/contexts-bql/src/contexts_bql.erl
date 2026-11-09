%% Two databases registered as contexts and queried together with
%% one BQL statement; a third context that cannot answer shows a
%% partial result.
-module(contexts_bql).
-export([main/0]).

-define(Q, <<"SELECT id, subject, minutes FROM c "
             "ORDER BY minutes DESC LIMIT 3">>).

main() ->
    try run() of
        ok -> halt(0)
    catch C:R:S ->
        io:format(standard_error, "~p:~p~n~p~n", [C, R, S]),
        halt(1)
    end.

run() ->
    {ok, _} = application:ensure_all_started(barrel),

    %% Two ordinary databases, one per region.
    {ok, Eu} = barrel_dbs:ensure(<<"tickets_eu">>, #{vectordb => none}),
    {ok, Us} = barrel_dbs:ensure(<<"tickets_us">>, #{vectordb => none}),
    _ = barrel:put_docs(Eu, [
        ticket(<<"t:1">>, <<"Invoice PDF missing">>, 42),
        ticket(<<"t:2">>, <<"SSO loop on Safari">>, 95),
        ticket(<<"t:3">>, <<"CSV export times out">>, 30)]),
    _ = barrel:put_docs(Us, [
        ticket(<<"t:7">>, <<"Password reset email late">>, 61),
        ticket(<<"t:8">>, <<"Webhook retries twice">>, 12)]),

    %% One card per context. A card names where the data lives.
    ok = add_context(<<"support/eu">>, local(<<"tickets_eu">>)),
    ok = add_context(<<"support/us">>, local(<<"tickets_us">>)),
    %% A remote node that is down (nothing listens on port 1).
    ok = add_context(<<"support/apac">>,
                  #{<<"kind">> => <<"remote">>,
                    <<"endpoint">> => <<"http://127.0.0.1:1">>,
                    <<"db">> => <<"tickets_apac">>}),

    io:format("== eu and us~n"),
    report(barrel_ctx:query(#{
        query => ?Q,
        contexts => [<<"support/eu">>, <<"support/us">>]})),

    io:format("~n== eu, us and apac (apac is down)~n"),
    report(barrel_ctx:query(#{
        query => ?Q,
        contexts => [<<"support/eu">>, <<"support/us">>,
                     <<"support/apac">>]})),

    io:format("~n== the same, offline~n"),
    report(barrel_ctx:query(#{
        query => ?Q, offline => true,
        contexts => [<<"support/eu">>, <<"support/us">>,
                     <<"support/apac">>]})),

    io:format("~n== a row query without LIMIT~n"),
    io:format("~p~n", [barrel_ctx:query(#{
        query => <<"SELECT id FROM c">>,
        contexts => [<<"support/eu">>]})]),
    ok.

ticket(Id, Subject, Minutes) ->
    #{<<"id">> => Id, <<"subject">> => Subject,
      <<"minutes">> => Minutes}.

local(Db) -> #{<<"kind">> => <<"local">>, <<"db">> => Db}.

add_context(Name, Location) ->
    {ok, _Card} = barrel_ctx:register(
        #{<<"name">> => Name, <<"locations">> => [Location]}),
    ok.

report({ok, R}) ->
    io:format("execution: ~p, merge: ~p~n",
              [maps:get(execution, R), maps:get(merge, R)]),
    io:format("rows:~n"),
    [io:format("  ~-12s ~-5s ~3b  ~s~n",
               [maps:get(<<"_ctx_name">>, Row), maps:get(<<"id">>, Row),
                maps:get(<<"minutes">>, Row),
                maps:get(<<"subject">>, Row)])
     || Row <- maps:get(rows, R)],
    io:format("sources:~n"),
    [source(S) || S <- maps:get(sources, R)],
    C = maps:get(coverage, R),
    io:format("coverage: requested ~b, answered ~b, failed ~b, "
              "skipped ~b~n",
              [maps:get(K, C) || K <- [requested, answered, failed,
                                       skipped]]),
    io:format("summary:~n"),
    [io:format("  ~s~n", [L]) || L <- wrap(maps:get(summary, R), 62)],
    ok.

source(#{name := N, status := St} = S) ->
    case S of
        #{error := #{reason := Why}} ->
            io:format("  ~-12s ~p: ~p~n", [N, St, Why]);
        #{rows := Rows, bound := Bound} ->
            io:format("  ~-12s ~p, ~b rows, ~p~n", [N, St, Rows, Bound])
    end.

%% Word-wrap a binary to lines of at most Width characters.
wrap(Text, Width) ->
    Words = string:lexemes(Text, " "),
    {Lines, Last} = lists:foldl(
        fun(W, {Acc, <<>>}) -> {Acc, W};
           (W, {Acc, Cur}) ->
                case string:length(Cur) + 1 + string:length(W) of
                    L when L > Width -> {[Cur | Acc], W};
                    _ -> {Acc, <<Cur/binary, " ", W/binary>>}
                end
        end, {[], <<>>}, Words),
    lists:reverse([Last | Lines]).
