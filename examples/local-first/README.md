# Local-first with barrel-lite

This project runs two TypeScript clients, a phone and a laptop, each
with its own local copy of one database, synced with a barrel_server.
The phone writes and reads locally, syncs, goes offline and keeps
editing, while the laptop edits the same document. Back online, both
versions are kept as a conflict; the phone resolves it once and the
resolution reaches the laptop and the server. Use it when an app must
keep working without the network.

## Prerequisites

- Node 22.6 or later (this run used Node 22.19). `main.ts` runs with
  Node's type stripping, no build step.
- A running barrel_server (1.13 or later) on `BARREL_URL`, default
  `http://localhost:8080`, with no auth. See the server quickstart.
- barrel-lite, built from the barrel repository. It is not on npm yet:

  ```sh
  cd /path/to/barrel/clients/barrel-lite
  npm install && npm run build
  cd -
  npm install
  npm install --no-save /path/to/barrel/clients/barrel-lite
  ```

## Run

```sh
BARREL_URL=http://localhost:8080 ./run.sh
```

`run.sh` type-checks `main.ts` with `tsc --noEmit`, then runs it. The
program deletes and recreates the database `lf_groceries` on the
server so every run starts empty.

## What it shows

- `Database.open(name, {remote, storage})`: in Node the local store is
  `MemoryAdapter`; in a browser the default is OPFS.
- `put` and `get` work on the local copy, with no request.
- `sync()` pushes local changes, then pulls the server's.
- Offline is simulated with the `remote.fetch` option: a fetch that
  fails makes `sync()` throw a `SyncError` with code `network`; the
  local writes wait and go up on the next sync.
- Two concurrent edits of one document are both kept: `get` returns
  one, `conflicts` returns the other. `resolve` replaces both, here and,
  after a push, everywhere.
- `query` runs BQL locally over the synced copy.

## Notes

- Local data in `MemoryAdapter` is gone when the process exits. In a
  browser, OPFS keeps it, flushed every 200 ms; sync is what makes it
  durable.
- The browser runs (OPFS, several tabs) are covered by barrel-lite's
  own Playwright suite, not by this example.

## Expected output

One line per step. The output of a real run is in `expected.txt`.
