import type { ComponentContent } from './types';

const code = `%% set venv_path after load and before start (see the gap)
ok = application:load(barrel_rerank),
ok = application:set_env(barrel_rerank, venv_path,
                         "/abs/path/to/.venv"),
{ok, _} = application:ensure_all_started(barrel_rerank),
{ok, S} = barrel_rerank:start_link(#{}),
Docs = [<<"Machine learning is a subset of AI.">>,
        <<"Python is a programming language.">>,
        <<"Deep learning uses neural networks.">>],
Q = <<"What is machine learning?">>,
io:format("rerank: ~p~n", [barrel_rerank:rerank(S, Q, Docs)]),
io:format("top_k=1: ~p~n",
          [barrel_rerank:rerank(S, Q, Docs, #{top_k => 1})]),
ok = barrel_rerank:stop(S).`;

const output = `rerank: {ok,[{0,9.581769943237305},
             {2,-5.255744457244873},
             {1,-9.625640869140625}]}
top_k=1: {ok,[{0,9.581769943237305}]}`;

export const rerank: ComponentContent = {
  slug: 'rerank',
  lead: 'Cross-encoder reranking: a second pass that reorders the results of vector or keyword search by reading the query and each candidate together.',
  problem: 'First-stage search is fast but approximate. A cross-encoder scores each query and document pair directly and puts the best answers first. barrel_rerank runs the model in a Python port and multiplexes concurrent requests over it.',
  useWhen: [
    'The top results of vector or hybrid search are close but in the wrong order.',
    'You can afford a model call per query on a short list of candidates.',
  ],
  notWhen: [
    'You cannot run Python with transformers and torch (about 2 GB) on the node.',
    'You need scores in 0..1: the scores are raw logits.',
  ],
  dependsOn: [],
  external: 'Python 3 with transformers and torch; a HuggingFace model download on first use',
  standalone: { short: 'Yes', text: 'Yes, it has no Erlang dependencies. It needs Python on the node.' },
  install: { code: '{barrel_rerank, "~> 1.0"}', lang: 'erlang', label: 'rebar.config deps' },
  reachedThrough: ['Erlang API only'],
  config: [
    { title: 'start_link/1 config', rows: [
      { key: 'python', def: '"python3"', meaning: 'Use an absolute path if the venv setup fails' },
      { key: 'model', def: 'cross-encoder/ms-marco-MiniLM-L-6-v2', meaning: 'HuggingFace model id' },
      { key: 'timeout', def: '120000 ms', meaning: 'Per request' },
    ] },
    { title: 'App env (barrel_rerank)', rows: [
      { key: 'venv_path', def: 'undefined', meaning: 'Set it to an absolute path (see the gap below)' },
    ] },
  ],
  api: [
    { title: 'Rerank', rows: [
      { task: 'Start a model server', call: 'barrel_rerank:start_link/1', returns: '`{ok, Pid}`; not registered, one per call' },
      { task: 'Rerank candidates', call: 'barrel_rerank:rerank/3,4', returns: '`{ok, [{Index, Score}]}`, best first, 0-based index' },
      { task: 'Keep the best k', call: 'option `top_k`', returns: 'the first k pairs' },
      { task: 'Describe, check', call: 'barrel_rerank:info/1,2, available/1', returns: '`{ok, #{model, type}}`' },
      { task: 'Stop', call: 'barrel_rerank:stop/1', returns: '`ok`' },
      { task: 'Venv', call: 'barrel_rerank_venv:ensure_venv/0, venv_path/0, refresh/0', returns: 'path, `ok`' },
    ] },
  ],
  examples: [
    { title: 'Rerank three passages', intro: 'From a verified run that reused an existing venv with transformers, torch and uvloop.', label: 'Erlang', code, output, outputLabel: 'Output, from a run on barrel_rerank 1.0.2' },
  ],
  limits: [
    'Scores are raw cross-encoder logits (9.58, -5.25 above), not values between 0 and 1.',
    'If the venv setup fails, `start_link/1` opens `"python3"` by name and fails with `{error, {port_open_failed, enoent}}`. Pass an absolute `python` or a working `venv_path`.',
    'The model downloads from HuggingFace on first use.',
  ],
  gaps: [
    'The `venv_path` default is broken: the app declares it as `undefined`, and once the app is loaded the code uses that value as a path. On start it creates a venv in a directory named `undefined` under the current directory. Set `venv_path` with `application:set_env/3` after `application:load/1` and before starting the app.',
  ],
  guides: [
    { label: 'Reranking', href: '/docs/search/reranking' },
    { label: 'Vector, keyword and hybrid', href: '/docs/search/hybrid' },
  ],
  apiRef: '/docs/lib/rerank/',
};
