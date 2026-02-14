<div align="center">

<img src="https://barrel-db.eu/logo-symbol-coral.svg" alt="Barrel DB" width="80" />

# Barrel DB

**Open Source AI-Native Databases — Built in Europe**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Website](https://img.shields.io/badge/Website-barrel--db.eu-coral)](https://barrel-db.eu)
[![Docs](https://img.shields.io/badge/Docs-docs.barrel--db.eu-teal)](https://docs.barrel-db.eu)

High-performance vector and document databases built in Erlang.

---

</div>

## Projects

| Project | Description | Status |
|---------|-------------|--------|
| [**barrel_vectordb**](barrel_vectordb) | Vector database with HNSW, DiskANN, FAISS, BM25 | Alpha |
| [**barrel_docdb**](barrel_docdb) | Document database with MVCC, P2P replication | Alpha |
| [**barrel_embed**](barrel_embed) | Embedding library with 15+ providers | v1.0.0 |

## Quick Start

```erlang
% Vector database
{ok, Db} = barrel_vectordb:open("my_vectors", #{dim => 384}),
barrel_vectordb:insert(Db, <<"doc1">>, Embedding, #{title => "Hello"}).

% Document database
{ok, Db} = barrel_docdb:open("my_docs"),
barrel_docdb:put(Db, #{<<"_id">> => <<"doc1">>, <<"title">> => <<"Hello">>}).
```

## Links

- **Website**: [barrel-db.eu](https://barrel-db.eu)
- **Documentation**: [docs.barrel-db.eu](https://docs.barrel-db.eu)
- **Contact**: [barrel-db.eu/contact](https://barrel-db.eu/contact)

## License

Apache 2.0 — Use commercially, modify, distribute freely.

---

<div align="center">

**Enki Multimedia** — French company, EU infrastructure

</div>
