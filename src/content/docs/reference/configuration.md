---
title: Configuration
description: The options you pass when you open a database, and the application environment keys of each Barrel app with their defaults.
---

This page lists the options you pass when you open a database, and the keys each Barrel application reads from its environment (`sys.config`), with their defaults. Use it as a lookup; the guides explain when you would change each one.

## Open a database

`barrel:open/2` takes one map, with a sub-map per layer:

```erlang
{ok, Db} = barrel:open(<<"notes">>, #{
    docdb => #{retention_period => 2592000},
    vectordb => #{db_path => "/var/lib/app/vec/notes",
                  dimensions => 768,
                  bm25_backend => disk},
    encryption => default
}).
```

| Key | Default | Meaning |
|---|---|---|
| `docdb` | `#{}` | Options for the document store, below |
| `vectordb` | `#{}` | The vector store config, below, or `none` for documents only |
| `embedding` | none | An embedding policy: the database runs in [record mode](/docs/guides/record-mode). `stored` reopens with the policy the database saved. |
| `encryption` | `disabled` | `default` (key from `BARREL_ENCRYPTION_KEY`) or `#{provider => Mod}`. Pass it on every open. See [Encryption](/docs/guides/encryption). |
| `read_only` | `false` | Open both stores read only |
| `store_supervised` | `false` | Supervise the vector store instead of linking it to the caller |

### Document store (`docdb`)

These are the options of `barrel_docdb:create_db/2`. `encryption`, `read_only`, `channels`, `conflict_resolver` and the retention settings are not stored: pass them again on every open.

| Key | Default | Meaning |
|---|---|---|
| `data_dir` | the app env `data_dir` | Parent folder of the database |
| `att_opts` | blob in RocksDB | Attachment backend: `#{backend => none}`, or `#{backend => s3, s3 => #{bucket => ...}}` with barrel_att_s3 |
| `retention_period` | `2592000` (30 days, in seconds) | History kept for audit and point-in-time branches; `0` keeps all and turns the sweeper off |
| `retention_check_interval` | `600000` ms | How often the retention sweep runs |
| `ttl_sweep_interval` | `0` (off) | How often expired documents are removed |
| `ttl_sweep_batch` | `512` | Documents removed per sweep step |
| `tombstone_purge_after` | `0` (keep) | Purge delete stubs after this many seconds |
| `channels` | none | `#{Name => [Pattern]}`, fixed at creation |
| `conflict_resolver` | none | A resolver for concurrent versions |
| `max_conflict_versions` | `8` | Concurrent versions kept per document |
| `max_group`, `write_chunk` | `256`, `16` | Group commit sizes |
| `stats_interval` | `60000` ms | How often the size and compaction gauges refresh; `0` turns it off |
| `att_upload_timeout` | `3600` s | Longest an attachment upload may stay open |
| `store_opts` | `#{}` | RocksDB options, see below |

The main `store_opts` keys. Each applies to every column family of the document store, so memtable memory per database can reach `write_buffer_size` × `max_write_buffer_number` × 4.

| Key | Default | Meaning |
|---|---|---|
| `compression`, `bottommost_compression` | `zstd` | rocksdb always builds zstd. `snappy` and `lz4` work only if rocksdb was built with the system library. |
| `bloom_bits` | `10` | Bloom filter bits per key: a read of a missing key skips the files that cannot hold it |
| `block_size` | `4096` | Table block size, in bytes |
| `write_buffer_size` | 64 MiB | Memtable size before a flush |
| `max_write_buffer_number` | `2` | Memtables per column family before writes wait for a flush |
| `min_tombstones_for_range_conversion` | `64` | A run of this many deletes becomes one range delete at flush, so reads skip it at once. `0` turns it off. |
| `use_direct_io_for_compaction_reads` | `false` | Compactions read with direct I/O and leave the page cache to your reads. Also accepted in `att_opts`. Needs a file system with direct I/O (not tmpfs). |

`prune_depth`, `compaction_interval` and `compaction_size_threshold` have no effect since 2.2.0; a database given them logs a warning.

### Vector store (`vectordb`)

| Key | Default | Meaning |
|---|---|---|
| `db_path` (or `path`) | `priv/barrel_vectordb_<name>` under the working directory | Where the store lives. Always set it. |
| `dimensions` (or `dimension`) | `768` | Vector size |
| `embedder` | none | A barrel_embed provider, such as `{ollama, #{model => <<"nomic-embed-text">>}}`. Without one, text calls return `embedder_not_configured`. |
| `backend` | `hnsw` | `hnsw`, `diskann`, or `faiss` (needs barrel_faiss) |
| `hnsw` | `#{m => 16, ef_construction => 200}` | Also `distance_fn` (`cosine` or `euclidean`) and `quantization` (`scalar` by default, `turboquant`, `subspace_turboquant`, `none`) |
| `diskann` | | `#{r, l, base_path}` |
| `faiss` | `#{index_type => <<"HNSW32">>}` | Also `nprobe` |
| `bm25_backend` | `none`; `disk` in record mode | `memory` or `disk` turns keyword search on |
| `read_only` | `false` | Refuse writes |

### Embedding policy (`embedding`)

| Key | Default | Meaning |
|---|---|---|
| `fields` | the whole document | Paths whose text is embedded |
| `join` | `<<"\n">>` | Separator between fields |
| `mode` | `async` | `sync` embeds before the write returns |
| `embedder` | | The barrel_embed provider |
| `dimensions` | `768` | Must match the model |
| `metadata_fields` | the document minus `id` and `_` keys | Fields returned as search metadata |

Other keys are refused with `{error, {unknown_options, Keys}}`.

## Application environment

Set these in `sys.config`. Paths are relative to the working directory of the node unless you give absolute ones.

### barrel_server

| Key | Default | Meaning |
|---|---|---|
| `http_port` | `8080` | Port of the cleartext HTTP listener, when `listeners` is not set |
| `listeners` | one HTTP/1.1 listener | `#{http => ..., https => ..., http3 => ...}` |
| `tls` | none | `#{certfile, keyfile, cacertfile, verify, ssl_opts}` |
| `data_dir` | barrel_docdb's | Copied into the barrel_docdb `data_dir` at start. Vector stores still default to `./priv`. |
| `open_opts` | `#{}` | `barrel:open/2` options for every database the server opens |
| `auth` | none (open server) | `#{tokens => [...]}`, or `#{accept => [bearer, signed, mtls], signers => ..., skew_ms => 300000, require_nonce => ...}`. See [Authentication](/docs/security/authentication). |
| `cors` | none | `#{origins, expose, max_age}`; needed by [barrel-lite](/docs/guides/barrel-lite) |
| `mcp` | `#{}` | `#{enabled => true, allowed_origins, allow_missing_origin, resources => full \| live_only, live}`. See the [MCP guide](/docs/guides/mcp). |
| `max_body` | 1 GiB | Largest request body |
| `sig_replay_sweep_ms` | `60000` | How often seen signature nonces are swept |

```erlang
[{barrel_server, [
    {http_port, 8080},
    {data_dir, "/var/lib/barrel"},
    {auth, #{tokens => [<<"change-me">>]}},
    {cors, #{origins => [<<"https://app.example">>]}}
 ]}].
```

The server also sets barrel_docdb's `task_db_opener`, so replication tasks restored after a restart open their databases the way the server does.

### barrel_docdb

| Key | Default | Meaning |
|---|---|---|
| `data_dir` | `"data/barrel_docdb"` | Where databases live |
| `default_store` | `barrel_store_rocksdb` | Storage module |
| `block_cache_size` | 512 MiB | RocksDB block cache shared by every database |
| `block_cache_type` | `clock` | Cache kind |
| `query_timeout_ms` | `30000` | Query deadline |
| `hlc_max_offset` | `0` (off) | Largest clock offset accepted from a peer, in ms |
| `body_async_io` | `false` | Experimental |
| `metrics` | `[]` | `[{exporter, none \| console \| otlp \| {Mod, Map}}, {otlp_endpoint, Url}, {otlp_headers, #{}}, {otlp_compression, none \| gzip}]` |
| `tracing` | `[]` | `[{enabled, true}, {exporter, ...}, {otlp_endpoint, Url}]` |
| `logging` | `[]` | `[{exporter, none \| console \| file \| otlp \| {Mod, Map}}, {file_path, ...}, {file_format, text \| json}, ...]` |
| `sync_auth`, `sync_signing`, `sync_ssl` | `#{}` | Credentials for HTTP replication, keyed by origin or database URL |
| `task_db_opener` | none | `{Mod, Fun}` that opens a database for a restored task |

See [Monitoring](/docs/operate/monitoring) for the exporters.

### barrel

| Key | Default | Meaning |
|---|---|---|
| `dbs_idle_timeout` | `300000` ms | `barrel_dbs` closes an unused database after this; `0` never |
| `dbs_max_open` | `0` (no limit) | Most databases `barrel_dbs` keeps open |
| `dbs_evict_guard` | `5000` ms | At the `dbs_max_open` cap, only a database idle this long is evicted; otherwise the open fails with `too_many_open_dbs` |
| `ctx_max_contexts` | `8` | Contexts per query |
| `ctx_deadline_ms` | `5000` (at most 60000) | Context query deadline |
| `ctx_member_timeout_ms` | `4000` | Time per member |
| `ctx_max_parallel` | `8` (at most 16) | Members queried at once |
| `ctx_offline` | `false` | Start in offline mode |
| `ctx_catalog_db` | `_barrel_catalog` | Database holding the context cards |
| `ctx_dir` | `<docdb data_dir>/_ctx` | Slices and imports |
| `ctx_credentials` | `#{}` | Credentials for remote contexts |

### barrel_embed

| Key | Default | Meaning |
|---|---|---|
| `managed_venv` | `true` | Create a Python venv and install provider packages on first use; `false` uses your own `python` |
| `venv_dir` | `<priv>/.venv` | Where the managed venv lives |

### barrel_crypto

| Key | Default | Meaning |
|---|---|---|
| `encryption_key` | none | Master secret when `BARREL_ENCRYPTION_KEY` is not set: 32 bytes, 64 hex characters or a passphrase |
| `encryption_salt` | `barrel_default_salt_v1` | Salt when `BARREL_ENCRYPTION_SALT` is not set |

### barrel_spaces

| Key | Default | Meaning |
|---|---|---|
| `registry_db` | `_barrel_spaces` | The registry database |
| `embedder` | none | Embedder used to reopen record-mode spaces |
| `janitor_interval` | `300000` ms | How often leftovers of expired sessions are removed |

### barrel_ngram

| Key | Default | Meaning |
|---|---|---|
| `data_dir` | `"data/barrel_ngram"` | Where indexes live; everything else is per corpus |

### barrel_att_s3

| Key | Default | Meaning |
|---|---|---|
| `multipart_gc_interval` | 1 hour, in ms; `0` off | Sweep of abandoned multipart uploads |
| `multipart_gc_max_age` | 24 hours, in seconds | Age after which an upload is abandoned |

### barrel_rerank

| Key | Default | Meaning |
|---|---|---|
| `venv_path` | `undefined` | Set it to an absolute path before the app starts; left at `undefined`, a venv is created in a folder named `undefined` |

### barrel_vectordb

Its `.app.src` declares `default_dimensions`, `default_embedder`, `hnsw_m`, `hnsw_ef_construction`, `hnsw_ef_search` and `embed_cache_size`, but none is read. Set these per store in `vectordb`.
