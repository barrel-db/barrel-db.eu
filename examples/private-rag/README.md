# Private knowledge search

This project builds the retrieval half of a RAG application on your own
machine. It ingests ten support articles into a record-mode database
(each article is embedded and indexed for keyword search in the same
write), runs a keyword search and a hybrid search for a customer
question, can rerank the passages with a cross-encoder, and prints the
prompt your application would send to its LLM. Nothing calls an LLM
and, with the default embedder, nothing leaves the machine.

## Prerequisites

- Erlang/OTP 26 or later (this run used OTP 29) and rebar3.
- A C compiler and CMake for the native dependencies (first compile
  takes a few minutes).
- For `EMBEDDER=ollama`: Ollama on localhost with
  `ollama pull nomic-embed-text`.
- For `RERANK=1`: a Python virtualenv with `transformers` and `torch`
  (the model downloads on first use).

## Run

```sh
./run.sh                       # offline, deterministic
EMBEDDER=ollama ./run.sh       # real embeddings from Ollama
RERANK=1 RERANK_VENV=/path/to/venv ./run.sh
```

`run.sh` compiles the project, deletes `./data`, then runs
`private_rag:main/0` once.

## What it shows

- `barrel:open/2` with an `embedding` policy: `fields` are embedded,
  `metadata_fields` are kept with each vector for filtering.
- `barrel:put_docs/2` writes the article and its vector together.
- `barrel:search_bm25/3` for keywords, and BQL `hybrid_top_k` (vector
  and BM25, fused by rank) filtered on `area`.
- `barrel_rerank:rerank/3` reorders the passages by a cross-encoder
  score (raw logits, higher is better).
- The prompt: an instruction, the top passages with their ids, the
  question.

## About the embedders

`EMBEDDER=hash` (the default) uses `hash_embed`, a deterministic
provider written for this example: it hashes words into 64
dimensions. It finds passages that share words with the question and
does not understand meaning, so its scores say nothing about search
quality. It is there so the run needs no model and gives the same
output every time. `EMBEDDER=ollama` uses `nomic-embed-text` (768
dimensions) for real semantic search.

## Expected output

`expected.txt` comes from the default run, `EMBEDDER=hash` without
rerank: the article count, the keyword and hybrid hits with their
scores, and the prompt. With Ollama or rerank the ranking and scores
differ. Both options were run once by hand (Ollama with
`nomic-embed-text`, rerank with `cross-encoder/ms-marco-MiniLM-L-6-v2`);
they are not part of the automatic check, which must run offline.
