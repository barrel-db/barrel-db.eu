%% Barrel embedded in an Erlang node: open a database, write
%% documents, query them with BQL, close cleanly. No server.
-module(embedded_erlang).
-export([main/0]).

main() ->
    try run() of
        ok -> halt(0)
    catch C:R:S ->
        io:format(standard_error, "~p:~p~n~p~n", [C, R, S]),
        halt(1)
    end.

run() ->
    {ok, _} = application:ensure_all_started(barrel),

    %% A documents-only database: no vector store.
    {ok, Db} = barrel:open(<<"tasks">>, #{vectordb => none}),
    io:format("opened ~s~n", [maps:get(name, Db)]),

    Tasks = [
        #{<<"id">> => <<"task:1">>, <<"title">> => <<"Write notes">>,
          <<"status">> => <<"open">>, <<"priority">> => 2,
          <<"tags">> => [<<"docs">>]},
        #{<<"id">> => <<"task:2">>, <<"title">> => <<"Fix login">>,
          <<"status">> => <<"open">>, <<"priority">> => 3,
          <<"tags">> => [<<"bug">>, <<"auth">>]},
        #{<<"id">> => <<"task:3">>, <<"title">> => <<"Ship 1.0">>,
          <<"status">> => <<"done">>, <<"priority">> => 1,
          <<"tags">> => [<<"release">>]}
    ],
    Results = barrel:put_docs(Db, Tasks),
    [io:format("put ~s rev ~s~n", [Id, Rev])
     || {ok, #{<<"id">> := Id, <<"rev">> := Rev}} <- Results],

    %% Read one back; the current version comes with _rev.
    {ok, T2} = barrel:get_doc(Db, <<"task:2">>),
    io:format("get task:2 -> ~s~n", [maps:get(<<"title">>, T2)]),

    %% BQL: filter and sort.
    show(barrel:query(Db,
        <<"SELECT title, priority FROM tasks "
          "WHERE status = 'open' ORDER BY priority DESC">>)),

    %% An update carries the _rev it read.
    {ok, _} = barrel:put_doc(Db, T2#{<<"status">> => <<"done">>}),
    io:format("update task:2 -> done~n"),

    %% Writing again with the old _rev is refused.
    Stale = barrel:put_doc(Db, T2#{<<"title">> => <<"Stale">>}),
    io:format("stale write -> ~p~n", [Stale]),

    %% Membership in an array, and a parameter.
    show(barrel:query(Db,
        <<"SELECT id, title FROM tasks "
          "WHERE 'bug' IN tags AND status = $s">>,
        #{params => #{<<"s">> => <<"done">>}})),

    %% One row per array element.
    show(barrel:query(Db,
        <<"SELECT k.id, t AS tag FROM tasks AS k, "
          "UNNEST(k.tags) AS t ORDER BY t">>)),

    %% Close, reopen: the data is on disk.
    ok = barrel:close(Db),
    {ok, Db2} = barrel:open(<<"tasks">>, #{vectordb => none}),
    {ok, Rows, _} = barrel:query(Db2,
        <<"SELECT id, status FROM tasks ORDER BY id">>),
    io:format("after reopen: ~p~n", [Rows]),
    ok = barrel:close(Db2),
    ok = application:stop(barrel),
    io:format("closed~n"),
    ok.

show({ok, Rows, _Meta}) ->
    io:format("rows: ~b~n", [length(Rows)]),
    [io:format("  ~p~n", [R]) || R <- Rows],
    ok.
