---
title: Libraries
description: The independent libraries that make up Barrel, their versions and build profiles, and where to find each one's generated reference.
---

Barrel is one database made of independent Apache 2.0 libraries in one umbrella repository. You use the `barrel` API, run `barrel_server`, or depend on a single library. This page lists them, says what each needs to build, and links its generated reference: the guides it ships plus its module documentation, built with ex_doc from the source.

## The stack

| Library | Version | Role | Reference |
|---|---|---|---|
| `barrel` | 1.13.1 | The database: documents, attachments and vectors under one id, BQL, record mode, timeline, contexts | [/docs/lib/barrel/](/docs/lib/barrel/) |
| `barrel_docdb` | 2.4.1 | Documents, versions, queries, attachments, replication | [/docs/lib/docdb/](/docs/lib/docdb/) |
| `barrel_vectordb` | 2.5.4 | Vector index (HNSW, DiskANN, FAISS), BM25, hybrid search | [/docs/lib/vectordb/](/docs/lib/vectordb/) |
| `barrel_ngram` | 0.11.4 | Exact substring and regex search over a docdb database | [source](https://github.com/barrel-db/barrel/tree/main/apps/barrel_ngram) |
| `barrel_embed` | 2.6.1 | Embedding providers, local or cloud | [/docs/lib/embed/](/docs/lib/embed/) |
| `barrel_rerank` | 1.0.3 | Cross-encoder reranking | [/docs/lib/rerank/](/docs/lib/rerank/) |
| `barrel_crypto` | 1.0.0 | Encryption-at-rest primitives and key providers | [/docs/lib/crypto/](/docs/lib/crypto/) |
| `barrel_spaces` | 1.3.1 | Spaces, capability tokens, sessions, handoffs | [/docs/lib/spaces/](/docs/lib/spaces/) |
| `barrel_server` | 1.14.1 | REST and MCP over HTTP | [/docs/lib/server/](/docs/lib/server/) |
| `barrel_att_s3` | 0.2.1 | Attachments in S3-compatible storage | [source](https://github.com/barrel-db/barrel/tree/main/apps/barrel_att_s3) |
| `barrel_faiss` | 1.0.1 | NIF bindings to FAISS | [HexDocs](https://hexdocs.pm/barrel_faiss) |
| `barrel-lite` | 0.1.0 | TypeScript client with a copy in the browser; not published to npm | [guide](/docs/guides/barrel-lite) |

`barrel_faiss` links against a system FAISS build, so its reference is not built with this site; read it on HexDocs. `barrel_ngram` and `barrel_att_s3` have no reference site here yet; their README and module docs are in the repository.

For the HTTP and MCP surface, use the [REST API](/docs/reference/rest-api) and [MCP tools](/docs/reference/mcp-tools) pages.

## Build profiles

A plain build of the umbrella leaves out the apps that need extra toolchains or pull network dependencies:

```shell
rebar3 compile              # barrel and its libraries
rebar3 as server compile    # adds barrel_server
rebar3 as s3 compile        # adds barrel_att_s3
rebar3 as faiss compile     # adds barrel_faiss
```

- Every app needs OTP 26 or later. barrel_docdb, barrel_vectordb and barrel_ngram build C or C++ code with CMake.
- `barrel_faiss` needs the FAISS library, OpenMP and BLAS. It builds on Linux, macOS and the BSDs, not Windows.
- `barrel_embed` and `barrel_rerank` install Python packages into a venv for their local models.

See [Build and test](/docs/contribute/build-and-test) for the test commands.

## Depend on one library

Each library has its own `rebar.config` and depends on its siblings by version. For example, documents and replication without vectors:

```erlang
{deps, [{barrel_docdb, "~> 2.4"}]}.
```

The source of every library is at [github.com/barrel-db/barrel](https://github.com/barrel-db/barrel), under `apps/`.
