%% Two agents share a space: alice owns it, carol gets a read
%% token, bob takes the work over through a handoff.
-module(agents_handoff).
-export([main/0]).

main() ->
    try run() of
        ok -> halt(0)
    catch C:R:S ->
        io:format(standard_error, "~p:~p~n~p~n", [C, R, S]),
        halt(1)
    end.

run() ->
    {ok, _} = application:ensure_all_started(barrel_spaces),

    %% alice creates the space and starts the work.
    {ok, #{id := SpaceId, db := Db} = Space} =
        barrel_spaces:create_space(
            #{label => <<"joint research">>, owner => <<"alice">>,
              vectordb => none}),
    io:format("alice created space ~s~n", [SpaceId]),
    {ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"notes">>,
                                   <<"text">> => <<"draft v1">>}),
    {ok, Sid} = barrel_session:create(
        Space, #{agent => <<"alice">>, ttl => 1800}),
    {ok, _} = barrel_session:add_message(
        Space, Sid, #{role => <<"user">>,
                      content => <<"draft is half done">>}),
    {ok, _} = barrel_session:pin_context(
        Space, Sid, #{content => <<"deadline friday">>}),

    %% carol gets a read token.
    {ok, ReadTok, _} = barrel_caps:grant(
        SpaceId, #{rights => [read], subject => <<"carol">>}),
    io:format("~ncarol holds a read token~n"),
    can("read the space", barrel_caps:verify(ReadTok, SpaceId, read)),
    can("use it on another space",
        barrel_caps:verify(ReadTok, <<"sp_other">>, read)),
    can("use a tampered token",
        barrel_caps:verify(<<ReadTok/binary, "x">>, SpaceId, read)),
    can("write notes",
        write_with(ReadTok, Space, <<"carol">>, <<"carol was here">>)),

    %% alice hands the task to bob: the token is the handoff.
    {ok, #{token := HTok}} = barrel_handoff:create(Space, #{
        task_name => <<"finish the draft">>,
        from_agent => <<"alice">>, to_agent => <<"bob">>,
        from_session => Sid,
        pending => [<<"polish conclusion">>]}),
    io:format("~nalice handed off \"finish the draft\" to bob~n"),
    {ok, [Pending]} = barrel_handoff:list(
        #{to_agent => <<"bob">>, status => <<"pending">>}),
    io:format("bob's pending handoffs: ~s~n",
              [maps:get(<<"task_name">>, Pending)]),
    can("write with the handoff token",
        barrel_caps:verify(HTok, SpaceId, write)),
    can("administer the space",
        barrel_caps:verify(HTok, SpaceId, admin)),

    %% bob accepts: he gets the space and a session of his own.
    {ok, #{handoff := H, space := BobSpace, session := BobSid}} =
        barrel_handoff:accept(HTok, #{agent => <<"bob">>}),
    io:format("~nbob accepted: ~s by ~s~n",
              [maps:get(<<"status">>, H),
               maps:get(<<"accepted_by">>, H)]),
    can("accept the same handoff again (mallory)",
        barrel_handoff:accept(HTok, #{agent => <<"mallory">>})),

    %% bob reads alice's context in place.
    {ok, Notes} = barrel:get_doc(maps:get(db, BobSpace), <<"notes">>),
    io:format("bob reads notes: ~s~n", [maps:get(<<"text">>, Notes)]),
    {ok, Msgs} = barrel_session:get_messages(BobSpace, Sid),
    io:format("bob reads alice's messages: ~p~n",
              [[maps:get(<<"content">>, M) || M <- Msgs]]),
    {ok, Pins} = barrel_session:list_pinned(BobSpace, Sid),
    io:format("bob reads alice's pins: ~p~n",
              [[maps:get(<<"content">>, P) || P <- Pins]]),
    {ok, BobSession} = barrel_session:get(BobSpace, BobSid),
    io:format("bob's session points at handoff: ~s~n",
              [maps:get(<<"handoff_id">>,
                        maps:get(<<"data">>, BobSession))]),
    can("write notes",
        write_with(HTok, BobSpace, <<"bob">>, <<"draft v2">>)),

    %% bob completes: the token is revoked.
    {ok, Done} = barrel_handoff:complete(
        HTok, #{result => <<"draft v2 ready">>}),
    io:format("~nbob completed: ~s, result ~s~n",
              [maps:get(<<"status">>, Done),
               maps:get(<<"result">>, Done)]),
    can("use the handoff token after completion",
        barrel_caps:verify(HTok, SpaceId, read)),

    %% alice revokes carol.
    ok = barrel_caps:revoke(ReadTok),
    io:format("~nalice revoked carol's token~n"),
    can("read the space (carol)",
        barrel_caps:verify(ReadTok, SpaceId, read)),

    {ok, Final} = barrel:get_doc(Db, <<"notes">>),
    io:format("~nnotes now: ~s (~s)~n",
              [maps:get(<<"text">>, Final),
               maps:get(<<"author">>, Final)]),
    ok = barrel_spaces:close_space(SpaceId),
    ok.

%% Tokens are checked by the code that holds them: in-process, the
%% Erlang API takes no token, so verify before acting. barrel_server
%% does this for every REST and MCP request.
write_with(Token, #{id := SpaceId, db := Db}, Who, Text) ->
    case barrel_caps:verify(Token, SpaceId, write) of
        {ok, _Grant} ->
            {ok, Cur} = barrel:get_doc(Db, <<"notes">>),
            {ok, _} = barrel:put_doc(Db, Cur#{<<"text">> => Text,
                                              <<"author">> => Who}),
            ok;
        {error, _} = Err ->
            Err
    end.

can(What, ok) -> io:format("  can    ~s~n", [What]);
can(What, {ok, _}) -> io:format("  can    ~s~n", [What]);
can(What, {error, Reason}) ->
    io:format("  cannot ~s: ~p~n", [What, Reason]).
