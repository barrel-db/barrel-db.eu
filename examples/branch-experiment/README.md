# Branch, compare, merge, recover

This project tries a change on a branch of a database before it
touches the original. It writes a small price list, raises one price
on the main database, branches it, edits, adds and deletes on the
branch, compares the two with the same BQL query and the version
history, merges the branch back, then opens a second branch of the
main database as it was before any change (point-in-time recovery).
Use it when an agent run, a migration or a bulk edit needs review
before it lands.

## Prerequisites

- Erlang/OTP 26 or later (this run used OTP 29) and rebar3.
- A C compiler and CMake for the native dependencies (first compile
  takes a few minutes).

## Run

```sh
./run.sh
```

`run.sh` compiles the project, deletes `./data`, then runs
`branch_experiment:main/0` once.

## What it shows

- `barrel:changes(Db, first)` returns the cursor of the latest
  change: keep it to come back to that point later.
- `barrel:branch/2` forks the database now. Writes on the branch do
  not touch the parent until you merge.
- `barrel:doc_versions/2` and `barrel:version_body/3` list a
  document's versions and read each one.
- `barrel:merge/1` writes the branch's edits into the parent and
  returns a report.
- `barrel:branch(Db, Name, #{at => Cursor})` opens a branch of the
  past.
- A branch of a branch is refused: `{error, cannot_branch_a_branch}`.

## Notes

- Lineage is one level deep, and a point in time older than the
  retained history fails with `pitr_window_exceeded` (the default
  retention is 30 days).
- This database has no vector store. On a record-mode database a
  branch rebuilds its index from the stored embeddings; a plain
  database's branch carries no vectors.

## Expected output

The price table at each step, the versions of one document and the
merge report. The output of a real run is in `expected.txt`.
