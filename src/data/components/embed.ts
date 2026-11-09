import type { ComponentContent } from './types';

const provider = `-module(my_embedder).
-behaviour(barrel_embed_provider).
-export([embed/2, embed_batch/2, dimension/1, name/0]).

embed(Text, _Config) ->
    <<A:8, B:8, C:8, D:8, _/binary>> =
        crypto:hash(sha256, Text),
    {ok, [A / 255, B / 255, C / 255, D / 255]}.
embed_batch(Texts, Config) ->
    {ok, [V || T <- Texts, {ok, V} <- [embed(T, Config)]]}.
dimension(_Config) -> 4.
name() -> my_embedder.`;

const code = `{ok, _} = application:ensure_all_started(barrel_embed),
{ok, C} = barrel_embed:init(#{
    embedder => {my_embedder, #{}}, dimensions => 4}),
io:format("custom: ~p~n",
          [barrel_embed:embed(<<"hello">>, C)]),
{ok, O} = barrel_embed:init(#{
    embedder => {ollama, #{model => <<"nomic-embed-text">>}},
    dimensions => 768}),
{ok, V} = barrel_embed:embed(<<"hello">>, O),
io:format("ollama dim=~p~n", [length(V)]),
%% a chain: the first provider is down, the second answers
{ok, Ch} = barrel_embed:init(#{embedder => [
    {ollama, #{url => <<"http://127.0.0.1:1">>}},
    {my_embedder, #{}}]}),
io:format("chain: ~p~n",
          [barrel_embed:embed(<<"hello">>, Ch)]),
io:format("not configured: ~p~n",
          [barrel_embed:init(#{})]).`;

const output = `custom: {ok,[0.17254901960784313,0.9490196078431372,
             0.30196078431372547,0.7294117647058823]}
ollama dim=768
Provider barrel_embed_ollama not available, skipping
chain: {ok,[0.17254901960784313,0.9490196078431372,
            0.30196078431372547,0.7294117647058823]}
not configured: {ok,undefined}`;

export const embed: ComponentContent = {
  slug: 'embed',
  lead: 'Text and image embeddings for Erlang, from local models or cloud APIs, with a chain of providers that falls back when one is unavailable.',
  problem: 'Vector search needs embeddings, and the right source changes: a local model on a laptop, Ollama on a server, a cloud API in production. barrel_embed puts every source behind one call, so barrel and barrel_vectordb take an `embedder` config and never call a model directly.',
  useWhen: [
    'You want record mode or text search in barrel or barrel_vectordb.',
    'You want a fallback: try a local model first, then another provider.',
    'You have your own model and want to plug it in as a provider module.',
  ],
  notWhen: [
    'You compute vectors elsewhere and pass them in: you can skip a provider (barrel_vectordb still pulls this library in).',
  ],
  dependsOn: [],
  external: 'hackney; Python 3 for the local Python providers',
  standalone: { short: 'Yes', text: 'Yes. Its only dependency is hackney.' },
  install: { code: '{barrel_embed, "~> 2.6"}', lang: 'erlang', label: 'rebar.config deps' },
  reachedThrough: ['Erlang API', 'the `embedder` option of barrel and barrel_vectordb'],
  config: [
    { title: 'init/1 config', rows: [
      { key: 'embedder', def: 'none', meaning: '`{Provider, Opts}` or a list for a fallback chain; none gives `{ok, undefined}`' },
      { key: 'dimensions', def: '768', meaning: 'Reported by `dimension/1`; set it to match the model' },
      { key: 'batch_size', def: '32', meaning: 'Chunk size for `embed_batch`' },
    ] },
    { title: 'Providers (default model, dimension)', rows: [
      { key: 'local', def: 'BAAI/bge-base-en-v1.5, 768', meaning: 'sentence-transformers in a managed Python venv' },
      { key: 'ollama', def: 'nomic-embed-text, 768', meaning: '`url` default http://localhost:11434' },
      { key: 'fastembed', def: 'BAAI/bge-small-en-v1.5, 384', meaning: 'ONNX in the venv' },
      { key: 'openai', def: 'text-embedding-3-small, 1536', meaning: '`api_key` or OPENAI_API_KEY' },
      { key: 'cohere, voyage, jina, mistral', def: '1024 each', meaning: 'API key from the environment' },
      { key: 'azure, bedrock, vertex', def: 'see the reference', meaning: 'Cloud credentials' },
      { key: 'splade, colbert, clip', def: 'sparse, multi-vector, image', meaning: 'Specialized calls, Python venv' },
    ] },
    { title: 'App env (barrel_embed)', rows: [
      { key: 'venv_dir', def: '<priv>/.venv', meaning: 'Managed Python venv' },
      { key: 'managed_venv', def: 'true', meaning: '`false` skips the venv bootstrap' },
    ] },
  ],
  api: [
    { title: 'Embed', rows: [
      { task: 'Start a provider chain', call: 'barrel_embed:init/1', returns: '`{ok, State}`, `{ok, undefined}` or `{error, no_providers_available}`' },
      { task: 'One text', call: 'barrel_embed:embed/2', returns: '`{ok, [float()]}` or `{error, all_providers_failed}`' },
      { task: 'Many texts', call: 'barrel_embed:embed_batch/2,3', returns: '`{ok, [[float()]]}`' },
      { task: 'Describe', call: 'barrel_embed:info/1, describe/2, dimension/1', returns: '`#{configured, providers, dimension}`' },
      { task: 'Release', call: 'barrel_embed:release/1', returns: '`ok`' },
    ] },
    { title: 'Providers and venv', rows: [
      { task: 'Write a provider', call: 'behaviour barrel_embed_provider: name/0, dimension/1, embed/2, embed_batch/2', returns: 'optional `init/1`, `available/1`, `model_info/1`' },
      { task: 'Python venv', call: 'barrel_embed:venv_path/0, refresh_venv/0, install_provider/1', returns: 'path, `ok`' },
      { task: 'Sparse, multi-vector, image', call: 'barrel_embed_splade:embed_sparse/2, barrel_embed_colbert:embed_multi/2, barrel_embed_clip:embed_image/2', returns: 'take the provider config, not the state' },
    ] },
  ],
  examples: [
    { title: 'A provider of your own', intro: 'Any module that implements the behaviour can be named as a provider.', label: 'my_embedder.erl', code: provider },
    { title: 'Custom, Ollama, and a fallback chain', intro: 'From a verified run, with Ollama running locally and `nomic-embed-text` pulled.', label: 'Erlang', code, output, outputLabel: 'Output, from a run on barrel_embed 2.6.1' },
  ],
  limits: [
    '`dimension/1` returns the configured `dimensions` (768 by default), not the provider\'s size. Pass `dimensions` explicitly, for example 384 for bge-small.',
    'Every embed call first runs the provider\'s `available/1`. For cloud providers that is an extra HTTP request per call.',
    'The first init of a Python provider can pip-install packages and download a model. Python packages are not pinned.',
    'Cloud providers are described from source; they were not run with keys. fastembed, splade, colbert and clip were not run.',
  ],
  guides: [
    { label: 'Choose an embedding provider', href: '/docs/search/embedding-providers' },
    { label: 'Write a provider', href: '/docs/contribute/write-a-provider' },
    { label: 'Record mode', href: '/docs/guides/record-mode' },
  ],
  apiRef: '/docs/lib/embed/',
};
