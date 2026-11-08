%% Try a change on a branch, compare it with the parent, merge it,
%% then open a branch of the past (point-in-time recovery).
-module(branch_experiment).
-export([main/0]).

-define(Q, <<"SELECT id, price FROM plans ORDER BY id">>).

main() ->
    try run() of
        ok -> halt(0)
    catch C:R:S ->
        io:format(standard_error, "~p:~p~n~p~n", [C, R, S]),
        halt(1)
    end.

run() ->
    {ok, _} = application:ensure_all_started(barrel),
    {ok, Db} = barrel:open(<<"pricing">>, #{vectordb => none}),
    _ = barrel:put_docs(Db, [plan(<<"free">>, 0),
                             plan(<<"pro">>, 20),
                             plan(<<"team">>, 50)]),
    %% The changes cursor after the first writes: a point in time.
    {ok, _, T1} = barrel:changes(Db, first),
    table("main, initial", Db),

    %% Later, on main: pro goes up.
    ok = set_price(Db, <<"plan:pro">>, 25),
    table("main, pro raised to 25", Db),

    %% A branch shares the parent's history up to now.
    {ok, Exp} = barrel:branch(Db, <<"pricing_exp">>),
    ok = set_price(Exp, <<"plan:team">>, 45),
    {ok, _} = barrel:put_doc(Exp, plan(<<"edu">>, 5)),
    {ok, Free} = barrel:get_doc(Exp, <<"plan:free">>),
    {ok, _} = barrel:delete_doc(Exp, <<"plan:free">>,
                                #{rev => maps:get(<<"_rev">>, Free)}),
    io:format("~nbranches of pricing: ~p~n",
              [barrel_docdb:list_branches(<<"pricing">>)]),

    %% Compare: the same query on both sides.
    table("branch", Exp),
    table("main, unchanged", Db),
    {ok, Versions} = barrel:doc_versions(Exp, <<"plan:team">>),
    io:format("~nplan:team versions on the branch:~n"),
    [begin
         {ok, B} = barrel:version_body(Exp, <<"plan:team">>, V),
         io:format("  ~s price ~p~n", [S, maps:get(<<"price">>, B)])
     end || #{status := S, version := V} <- Versions],

    %% Merge the branch back into main.
    {ok, Report} = barrel:merge(Exp),
    io:format("~nmerge: ~p~n",
              [maps:with([docs_read, docs_written, failed], Report)]),
    table("main, after merge", Db),

    %% Point-in-time: a branch of main as it was at T1.
    {ok, Past} = barrel:branch(Db, <<"pricing_t1">>, #{at => T1}),
    table("branch at the first cursor", Past),

    %% Branches are one level deep.
    io:format("~nbranch of a branch: ~p~n",
              [barrel:branch(Exp, <<"nested">>)]),

    ok = barrel:delete(Exp),
    ok = barrel:delete(Past),
    ok = barrel:close(Db),
    ok.

plan(Name, Price) ->
    #{<<"id">> => <<"plan:", Name/binary>>, <<"type">> => <<"plan">>,
      <<"price">> => Price}.

set_price(Db, Id, Price) ->
    {ok, Doc} = barrel:get_doc(Db, Id),
    {ok, _} = barrel:put_doc(Db, Doc#{<<"price">> => Price}),
    ok.

table(Title, Db) ->
    {ok, Rows, _} = barrel:query(Db, ?Q),
    io:format("~n~s:~n", [Title]),
    [io:format("  ~-10s ~p~n", [Id, P])
     || #{<<"id">> := Id, <<"price">> := P} <- Rows],
    ok.
