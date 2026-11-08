%% Private knowledge search: ingest support articles in record mode,
%% run hybrid search for a question, optionally rerank, and print
%% the prompt an application would send to its LLM.
-module(private_rag).
-export([main/0]).

-define(QUESTION, <<"A customer was charged twice this month. "
                    "How do I refund one of the payments?">>).

main() ->
    try run() of
        ok -> halt(0)
    catch C:R:S ->
        io:format(standard_error, "~p:~p~n~p~n", [C, R, S]),
        halt(1)
    end.

run() ->
    {ok, _} = application:ensure_all_started(barrel),
    {Embedder, Dim} = embedder(os:getenv("EMBEDDER", "hash")),

    %% Record mode: title and body are embedded in the same write,
    %% and indexed for BM25 keyword search.
    Policy = #{fields => [<<"title">>, <<"body">>], mode => sync,
               embedder => Embedder, dimensions => Dim,
               metadata_fields => [<<"area">>, <<"title">>]},
    {ok, Db} = barrel:open(<<"kb">>, #{
        embedding => Policy,
        vectordb => #{db_path => filename:absname("data/vec/kb")}}),
    {ok, Info} = barrel:embedder_info(Db),
    io:format("embedder: ~p ~s, ~b dimensions~n",
              [maps:get(provider, Info), maps:get(model, Info),
               maps:get(dimensions, Info)]),

    %% Ingest.
    Path = filename:join(code:priv_dir(private_rag), "articles.eterm"),
    {ok, Articles} = file:consult(Path),
    Docs = [#{<<"id">> => Id, <<"area">> => Area,
              <<"title">> => T, <<"body">> => B}
            || {Id, Area, T, B} <- Articles],
    Written = [ok || {ok, _} <- barrel:put_docs(Db, Docs)],
    io:format("ingested ~b articles~n", [length(Written)]),

    %% Keyword only, then hybrid (vector + BM25, fused by rank).
    io:format("~n~s", [wrap(<<"question: ", ?QUESTION/binary>>)]),
    {ok, Kw} = barrel:search_bm25(Db, <<"refund charged twice">>,
                                  #{k => 3}),
    io:format("~nbm25 \"refund charged twice\":~n"),
    [io:format("  ~.4f ~s~n", [S, Id]) || {Id, S} <- Kw],

    {ok, Rows0, _} = barrel:query(Db,
        <<"SELECT h.id, h._score, title, body "
          "FROM hybrid_top_k($q, k => 4) AS h "
          "WHERE h.area = 'billing'">>,
        #{params => #{<<"q">> => ?QUESTION}}),
    %% Best score first; equal scores by id, so the output is stable.
    Rows = lists:sort(fun(A, B) -> key(A) =< key(B) end, Rows0),
    io:format("~nhybrid, billing articles only:~n"),
    [io:format("  ~.4f ~s~n", [maps:get(<<"_score">>, R),
                               maps:get(<<"id">>, R)])
     || R <- Rows],

    Context = rerank(Rows, os:getenv("RERANK", "0")),
    io:format("~n--- prompt (printed, not sent) ---~n~s",
              [prompt(lists:sublist(Context, 3))]),
    ok = barrel:close(Db),
    ok.

key(#{<<"_score">> := S, <<"id">> := Id}) -> {-S, Id}.

%% EMBEDDER=hash is offline and deterministic: it matches shared
%% words, it does not understand meaning. EMBEDDER=ollama needs
%% `ollama pull nomic-embed-text` on localhost.
embedder("hash") ->
    {{hash_embed, #{}}, 64};
embedder("ollama") ->
    {{ollama, #{url => <<"http://localhost:11434">>,
                model => <<"nomic-embed-text">>}}, 768}.

%% RERANK=1 reorders the passages with a cross-encoder (Python,
%% transformers and torch in RERANK_VENV).
rerank(Rows, "1") ->
    ok = application:load(barrel_rerank),
    ok = application:set_env(barrel_rerank, venv_path,
                             os:getenv("RERANK_VENV")),
    {ok, _} = application:ensure_all_started(barrel_rerank),
    {ok, Pid} = barrel_rerank:start_link(#{}),
    Texts = [maps:get(<<"body">>, R) || R <- Rows],
    {ok, Ranked} = barrel_rerank:rerank(Pid, ?QUESTION, Texts),
    ok = barrel_rerank:stop(Pid),
    io:format("~nreranked:~n"),
    [io:format("  ~.3f ~s~n", [S, maps:get(<<"id">>,
                                           lists:nth(I + 1, Rows))])
     || {I, S} <- Ranked],
    [lists:nth(I + 1, Rows) || {I, _} <- Ranked];
rerank(Rows, _) ->
    io:format("~nrerank: skipped (set RERANK=1)~n"),
    Rows.

prompt(Passages) ->
    Head = <<"Answer the question using only the support articles "
             "below. Cite the article id for each step. If the "
             "articles do not cover it, say so.">>,
    [wrap(Head),
     [[$\n, $[, Id, "] ", T, $\n, wrap(B)]
      || #{<<"id">> := Id, <<"title">> := T, <<"body">> := B}
             <- Passages],
     $\n, wrap(<<"Question: ", ?QUESTION/binary>>)].

%% Word-wrap to lines of at most 64 characters.
wrap(Text) ->
    Words = string:lexemes(Text, " "),
    {Lines, Last} = lists:foldl(
        fun(W, {Acc, <<>>}) -> {Acc, W};
           (W, {Acc, Cur}) ->
                case string:length(Cur) + 1 + string:length(W) of
                    L when L > 64 -> {[Cur | Acc], W};
                    _ -> {Acc, <<Cur/binary, " ", W/binary>>}
                end
        end, {[], <<>>}, Words),
    [[L, $\n] || L <- lists:reverse([Last | Lines])].
