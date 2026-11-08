%% An agent's memory in a Barrel space. main(write) runs on a first
%% node; main(recall) runs on a second node over the same data.
-module(agent_memory).
-export([main/1, write/0, recall/0]).

-define(LABEL, <<"assistant memory">>).

main(Phase) ->
    try
        {ok, _} = application:ensure_all_started(barrel_spaces),
        ok = ?MODULE:Phase(),
        halt(0)
    catch C:R:S ->
        io:format(standard_error, "~p:~p~n~p~n", [C, R, S]),
        halt(1)
    end.

%% Record mode: every document with a "content" field is embedded
%% in the same write. hash_embed is a stand-in for a real model.
policy() ->
    #{fields => [<<"content">>], mode => sync,
      embedder => {hash_embed, #{}}, dimensions => 64,
      metadata_fields => [<<"type">>]}.

write() ->
    io:format("== node 1: write~n"),
    {ok, Space} = barrel_spaces:create_space(
        #{label => ?LABEL, owner => <<"assistant">>,
          embedding => policy()}),
    Db = maps:get(db, Space),

    %% A session with no expiry, and the conversation so far.
    {ok, Sid} = barrel_session:create(
        Space, #{agent => <<"assistant">>, ttl => infinity}),
    io:format("session ~s~n", [Sid]),
    Turns = [
        {<<"user">>, <<"Our staging database runs on host db2">>},
        {<<"assistant">>, <<"Noted: staging is on db2">>},
        {<<"user">>, <<"Never deploy to production on Friday">>}
    ],
    [{ok, _} = barrel_session:add_message(
                 Space, Sid, #{role => R, content => C})
     || {R, C} <- Turns],
    io:format("messages added: ~b~n", [length(Turns)]),

    %% Pinned context comes back first, by priority.
    {ok, _} = barrel_session:pin_context(
        Space, Sid, #{content => <<"Reply in short sentences">>,
                      priority => 0}),
    {ok, _} = barrel_session:pin_context(
        Space, Sid, #{content => <<"Project codename: Atlas">>,
                      priority => 1}),

    %% Working state, keyed.
    {ok, _} = barrel_session:set_data(
        Space, Sid, <<"current_task">>, <<"upgrade billing">>),

    %% Long-term facts: plain documents, embedded on write.
    Facts = [
        <<"The billing service is written in Erlang">>,
        <<"Backups of db2 run every night at 02:00">>,
        <<"Production deploys need a review from Sam">>
    ],
    [{ok, _} = barrel:put_doc(Db, #{
         <<"id">> => <<"fact:", (integer_to_binary(N))/binary>>,
         <<"type">> => <<"fact">>, <<"content">> => F})
     || {N, F} <- lists:zip(lists:seq(1, length(Facts)), Facts)],
    io:format("facts written: ~b~n", [length(Facts)]),

    recall(Db, <<"when can I deploy to production">>),
    ok = barrel_spaces:close_space(maps:get(id, Space)),
    ok.

recall() ->
    io:format("== node 2: recall after a restart~n"),
    {ok, Spaces} = barrel_spaces:list_spaces(),
    [Id] = [maps:get(<<"space">>, S) || S <- Spaces,
            maps:get(<<"label">>, S) =:= ?LABEL],
    %% Reopens in record mode with the embedder from sys.config.
    {ok, Space} = barrel_spaces:open_space(Id),
    {ok, [Session]} = barrel_session:list(Space),
    Sid = maps:get(<<"session">>, Session),
    io:format("session ~s (agent ~s)~n",
              [Sid, maps:get(<<"agent">>, Session)]),

    {ok, Msgs} = barrel_session:get_messages(Space, Sid),
    io:format("messages:~n"),
    [io:format("  ~s: ~s~n", [maps:get(<<"role">>, M),
                              maps:get(<<"content">>, M)])
     || M <- Msgs],

    {ok, Pins} = barrel_session:list_pinned(Space, Sid),
    io:format("pinned:~n"),
    [io:format("  ~b ~s~n", [maps:get(<<"priority">>, P),
                             maps:get(<<"content">>, P)])
     || P <- Pins],

    {ok, Task} = barrel_session:get_data(
        Space, Sid, <<"current_task">>),
    io:format("current_task: ~s~n", [Task]),

    Db = maps:get(db, Space),
    recall(Db, <<"when can I deploy to production">>),
    recall(Db, <<"where is the staging database">>),
    ok = barrel_spaces:close_space(Id),
    ok.

%% Top 3 by vector search; scores come from hash_embed, so they
%% measure shared words, not meaning.
recall(Db, Question) ->
    {ok, Hits} = barrel:search(Db, Question,
                               #{k => 3, include_text => true}),
    io:format("search \"~s\":~n", [Question]),
    [io:format("  ~.3f ~s ~s~n",
               [S, maps:get(<<"type">>, M, <<"?">>), T])
     || #{score := S, metadata := M, text := T} <- Hits],
    ok.
