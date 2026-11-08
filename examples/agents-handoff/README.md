# Share a space between agents

This project runs three agents against one shared space. alice creates
the space and starts a task. carol gets a read-only capability token.
alice hands the task to bob: bob accepts the handoff, reads alice's
notes, messages and pins in place, writes his result and completes the
handoff, which revokes its token. At each step the program prints what
each agent can and cannot do. Use it when several agents must share
context without sharing everything.

## Prerequisites

- Erlang/OTP 26 or later (this run used OTP 29) and rebar3.
- A C compiler and CMake for the native dependencies (first compile
  takes a few minutes).

## Run

```sh
./run.sh
```

`run.sh` compiles the project, deletes `./data`, then runs
`agents_handoff:main/0` once.

## What it shows

- `barrel_caps:grant/2` issues a token for one space with given
  rights; `barrel_caps:verify/3` answers `ok` or a reason:
  `forbidden`, `wrong_space`, `invalid_token`, `revoked`.
- `barrel_handoff:create/2` issues the handoff as a token (read and
  write by default, never admin). `accept/2` works once:
  a second accept gets `already_accepted`.
- The accepting agent reads the sender's session in place and gets a
  session of its own that points at the handoff.
- `barrel_handoff:complete/2` revokes the handoff token;
  `barrel_caps:revoke/1` revokes carol's.

## Notes

- In-process, tokens are advisory: `barrel_spaces:open_space/1` and
  the `barrel_session` functions take no token, so your code calls
  `barrel_caps:verify/3` before it acts, as `write_with/4` does here.
  `barrel_server` checks tokens on every REST and MCP request.
- `accept`, `complete` and `chain` check only the `read` right of the
  handoff token.
- Per-space encryption is the isolation boundary inside one node; see
  the spaces guide.

## Expected output

One block per agent with `can` and `cannot` lines. The output of a
real run is in `expected.txt`; space and handoff ids differ on every
run.
