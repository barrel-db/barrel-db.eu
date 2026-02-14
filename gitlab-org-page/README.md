## Quick Start

### Barrel Vector (vector database)

```erlang
% Create a vector database
{ok, Db} = barrel_vectordb:open("my_vectors", #{dim => 384}),

% Insert vectors with metadata
Embedding = barrel_embed:embed("Hello world", #{provider => ollama}),
barrel_vectordb:insert(Db, <<"doc1">>, Embedding, #{title => "Hello"}).

% Search
{ok, Results} = barrel_vectordb:search(Db, QueryVector, #{limit => 10}).
```

### Barrel Docs (document database)

```erlang
% Create a document database
{ok, Db} = barrel_docdb:open("my_docs"),

% Insert documents
Doc = #{<<"_id">> => <<"user:1">>, <<"name">> => <<"Alice">>, <<"role">> => <<"admin">>},
{ok, _Rev} = barrel_docdb:put(Db, Doc).

% Query
{ok, Results} = barrel_docdb:query(Db, #{<<"role">> => <<"admin">>}).

% Subscribe to changes
barrel_docdb:subscribe(Db, fun(Change) -> io:format("~p~n", [Change]) end).
```

### Barrel Embed (embeddings)

```erlang
% Local embeddings with Ollama
Embedding = barrel_embed:embed("Your text", #{provider => ollama, model => "nomic-embed-text"}).

% Or use OpenAI, Cohere, Voyage, etc.
Embedding = barrel_embed:embed("Your text", #{provider => openai, model => "text-embedding-3-small"}).
```

## Features

| | barrel_vectordb | barrel_docdb | barrel_embed |
|---|---|---|---|
| **Use case** | Similarity search | Document storage | Text → vectors |
| **Backends** | HNSW, DiskANN, FAISS, BM25 | LMDB, RocksDB | 15+ providers |
| **Replication** | - | P2P, CRDT-based | - |
| **Status** | Alpha | Alpha | v1.0.0 |

## Installation

Add to your `rebar.config`:

```erlang
{deps, [
    {barrel_vectordb, {git, "https://gitlab.enki.io/barrel-db/barrel_vectordb.git", {branch, "main"}}},
    {barrel_docdb, {git, "https://gitlab.enki.io/barrel-db/barrel_docdb.git", {branch, "main"}}},
    {barrel_embed, {git, "https://gitlab.enki.io/barrel-db/barrel_embed.git", {tag, "v1.0.0"}}}
]}.
```

## Documentation

- [barrel_vectordb docs](https://docs.barrel-db.eu/vectordb)
- [barrel_docdb docs](https://docs.barrel-db.eu/docdb)
- [barrel_embed docs](https://docs.barrel-db.eu/embed)

## Contributing

Issues and merge requests welcome. See each project's `CONTRIBUTING.md`.

## License

All projects are Apache 2.0 licensed.
