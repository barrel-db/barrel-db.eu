---
title: Libraries
description: The independent libraries that make up Barrel, and where to find each one's deep reference.
---

Barrel is one database made of independent Apache 2.0 libraries. You use the full
`barrel` facade, or depend on a single library. This page lists them and links the
deeper per-library documentation where it exists.

## The stack

| Library | Role |
|---------|------|
| `barrel` | The facade you use in these docs: documents, blobs, and vectors under one id. |
| `barrel_docdb` | The document layer: version-vector MVCC, BQL, attachments, replication. |
| `barrel_vectordb` | The vector layer: HNSW, DiskANN, FAISS, and BM25 with hybrid search. |
| `barrel_embed` | Embedding generation across providers (OpenAI, Ollama, local, and more). |
| `barrel_rerank` | Cross-encoder reranking. |
| `barrel_crypto` | Encryption-at-rest primitives and key providers. |
| `barrel_spaces` | The agent layer: spaces, capability tokens, sessions, handoffs. |
| `barrel_server` | The REST/JSON and MCP server over the facade. |
| `barrel_faiss` | Optional Erlang NIF bindings for FAISS. |
| `barrel-lite` | The offline-first TypeScript browser client. |

## Per-library documentation

Three libraries have their own reference sites with deeper API detail:

- [barrel_docdb](https://docs.barrel-db.eu/docdb) - the document layer.
- [barrel_vectordb](https://docs.barrel-db.eu/vectordb) - the vector layer.
- [barrel_embed](https://docs.barrel-db.eu/embed) - embedding providers.

The source for every library lives in the umbrella repository at
[github.com/barrel-db/barrel](https://github.com/barrel-db/barrel).
