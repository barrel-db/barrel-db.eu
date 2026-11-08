import type { ComponentContent } from './types';

const code = `{ok, Idx} = barrel_faiss:new(4),
Vecs = << <<X:32/float-native>> || X <-
          [1.0,0.0,0.0,0.0, 0.0,1.0,0.0,0.0,
           0.0,0.0,1.0,0.0] >>,
ok = barrel_faiss:add(Idx, Vecs),
Q = << <<X:32/float-native>> || X <- [0.9,0.1,0.0,0.0] >>,
{ok, D, L} = barrel_faiss:search(Idx, Q, 2),
{ok, Bin} = barrel_faiss:serialize(Idx),
{ok, H} = barrel_faiss:index_factory(4, <<"IDMap,Flat">>,
                                     inner_product),
ok = barrel_faiss:add_with_ids(H, Vecs,
    << <<I:64/signed-native>> || I <- [100, 200, 300] >>),
{ok, _, L2} = barrel_faiss:search(H, Q, 1),
barrel_faiss:remove_ids(H, <<100:64/signed-native>>),
ok = barrel_faiss:close(Idx).`;

const output = `ntotal=3 dim=4 trained=true
distances=[0.020000005140900612,1.619999885559082] labels=[0,1]
deserialized ntotal=3 (93 bytes)
IDMap top label=[100]
remove_ids={ok,1} ntotal=2
after close: {error,"index_closed"}`;

const code2 = `{ok, Db} = barrel:open(fdb, #{
    docdb => #{data_dir => Dir},
    vectordb => #{dimension => 3, backend => faiss,
                  db_path => Dir ++ "/fdb_vec"}}),
ok = barrel:vector_add(Db, <<"a">>, <<"alpha">>, #{},
                       [1.0, 0.0, 0.0]),
ok = barrel:vector_add(Db, <<"b">>, <<"beta">>, #{},
                       [0.0, 1.0, 0.0]),
{ok, Hits} = barrel:search_vector(Db, [0.9, 0.1, 0.0],
                                  #{k => 1}).`;

const output2 = `faiss-backed hit: [<<"a">>]
without NIF: {error,{index_init_failed,faiss_not_available}}`;

export const faiss: ComponentContent = {
  slug: 'faiss',
  lead: 'Erlang bindings to the FAISS C++ library, and the optional `faiss` index backend of barrel_vectordb.',
  problem: 'Some workloads want FAISS index types (IVF, PQ, flat, FAISS HNSW) instead of the pure Erlang HNSW. barrel_faiss wraps FAISS as a NIF so barrel_vectordb can use it, and you can also call it directly.',
  useWhen: [
    'You already rely on FAISS index types or their memory and speed trade-offs.',
    'You can install the FAISS library on every node that opens the store.',
  ],
  notWhen: [
    'You want a build with no system libraries: the default HNSW backend is pure Erlang.',
    'You build on Windows: there are no build hooks for it.',
  ],
  dependsOn: [],
  external: 'FAISS library and headers, CMake 3.14 or later, C++17, OpenMP, BLAS',
  standalone: { short: 'Yes', text: 'Yes, as NIF bindings with no Erlang dependencies. It needs FAISS installed on the system.' },
  install: { code: '{barrel_faiss, "~> 1.0"}', lang: 'erlang', label: 'rebar.config deps', note: 'In the umbrella it is not in the default build: use `rebar3 as faiss compile`.' },
  reachedThrough: ['`backend => faiss` in a barrel_vectordb store config', 'Erlang API'],
  config: [
    { title: 'barrel_vectordb store config', rows: [
      { key: 'backend', def: 'hnsw', meaning: 'Set `faiss`' },
      { key: 'faiss.index_type', def: '<<"HNSW32">>', meaning: 'A FAISS factory string' },
      { key: 'faiss.nprobe', def: 'none', meaning: 'For IVF indexes' },
    ] },
  ],
  api: [
    { title: 'Index', rows: [
      { task: 'Create', call: 'barrel_faiss:new/1,2, index_factory/2,3', returns: '`{ok, Index}`; metric `l2` or `inner_product`' },
      { task: 'Train (IVF, PQ)', call: 'barrel_faiss:train/2, is_trained/1', returns: '`ok`, boolean' },
      { task: 'Add', call: 'barrel_faiss:add/2, add_with_ids/3', returns: '`ok`; float32 and int64, native endian' },
      { task: 'Search', call: 'barrel_faiss:search/3', returns: '`{ok, Distances, Labels}`' },
      { task: 'Remove', call: 'barrel_faiss:remove_ids/2', returns: '`{ok, N}`; not on HNSW' },
      { task: 'Save, load', call: 'serialize/1, deserialize/1, write_index/2, read_index/1', returns: 'binary or file' },
      { task: 'Inspect, close', call: 'dimension/1, ntotal/1, close/1', returns: 'integers, `ok`' },
    ] },
  ],
  examples: [
    { title: 'Direct calls', intro: 'From a verified run on a fresh CMake build against FAISS from MacPorts. The run printed the values below; the print statements are left out of the code.', label: 'Erlang', code, output, outputLabel: 'Printed by the run, barrel_faiss 1.0.1' },
    { title: 'As the backend of a barrel vector store', intro: 'The same run, through barrel. The last line is the same open on a build without the NIF.', label: 'Erlang', code: code2, output: output2, outputLabel: 'Printed by the run' },
  ],
  limits: [
    'Needs a system FAISS; the build looks in FAISS_ROOT, /opt/local, /usr/local, /opt/homebrew and /usr.',
    'Runs on dirty schedulers. `remove_ids/2` is not supported on HNSW indexes.',
    'A search on a closed index returns `{error, "index_closed"}`, a string rather than an atom.',
  ],
  guides: [
    { label: 'Vector, keyword and hybrid', href: '/docs/search/hybrid' },
  ],
  apiRef: 'https://hexdocs.pm/barrel_faiss/',
};
