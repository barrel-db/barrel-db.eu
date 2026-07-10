---
title: Libraries
description: The independent libraries that make up Barrel, and where to find each one's deep reference.
---

Barrel is one database made of independent Apache 2.0 libraries. You use the full
full `barrel` API, or depend on a single library. This page lists them and links the
deeper per-library documentation where it exists.

## The stack

| Library | Role |
|---------|------|
| `barrel` | The API you use in these docs: documents, blobs, and vectors under one id. |
| `barrel_docdb` | The document layer: version-vector MVCC, BQL, attachments, replication. |
| `barrel_vectordb` | The vector layer: HNSW, DiskANN, FAISS, and BM25 with hybrid search. |
| `barrel_embed` | Embedding generation across providers (OpenAI, Ollama, local, and more). |
| `barrel_rerank` | Cross-encoder reranking. |
| `barrel_crypto` | Encryption-at-rest primitives and key providers. |
| `barrel_spaces` | The agent layer: spaces, capability tokens, sessions, handoffs. |
| `barrel_server` | The REST/JSON and MCP server over the `barrel` API. |
| `barrel_faiss` | Optional Erlang NIF bindings for FAISS. |
| `barrel-lite` | The offline-first TypeScript browser client. |

## Per-library documentation

Each library publishes its own reference site: the guides it ships, plus an API
reference generated from the module documentation, so it cannot drift from the
source.

- [barrel](/docs/lib/barrel/) - the full database.
- [barrel_docdb](/docs/lib/docdb/) - the document layer.
- [barrel_vectordb](/docs/lib/vectordb/) - the vector layer.
- [barrel_embed](/docs/lib/embed/) - embedding providers.
- [barrel_server](/docs/lib/server/) - the REST/JSON and MCP server.
- [barrel_spaces](/docs/lib/spaces/) - the agent layer.
- [barrel_rerank](/docs/lib/rerank/) - cross-encoder reranking.
- [barrel_crypto](/docs/lib/crypto/) - encryption at rest.

`barrel_faiss` links against a system FAISS build, so its reference ships on
[HexDocs](https://hexdocs.pm/barrel_faiss) rather than here. Every library is on
HexDocs under its own name.

The source for every library lives in the umbrella repository at
[github.com/barrel-db/barrel](https://github.com/barrel-db/barrel).
