#!/usr/bin/env node
// Regenerate src/data/mcp-tools.json from a running barrel_server, so the
// MCP tools reference is the server's own tools/list answer, not a copy.
//
// 1. Start an open server (no `auth` in sys.config) from the barrel checkout:
//      rebar3 as server compile
//      erl -noshell -pa _build/server/lib/*/ebin -config sys \
//          -eval 'application:ensure_all_started(barrel_server).'
//    Run erl from a scratch directory if you do not want vector stores
//    created under ./priv.
// 2. Point this script at it (default http://localhost:8080):
//      MCP_URL=http://localhost:8080/mcp node scripts/update-mcp-tools.mjs
//    For a locked server, also set MCP_TOKEN to a server bearer token.
//    Set SERVER_VERSION to the barrel_server version you started (the MCP
//    serverInfo reports the barrel_mcp engine version, not the server's).
//
// The script sends initialize, notifications/initialized, then tools/list
// (following nextCursor), ends the session, and writes the tools sorted by name.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.MCP_URL || 'http://localhost:8080/mcp';
const token = process.env.MCP_TOKEN;
const protocolVersion = '2025-06-18';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'mcp-tools.json');

let session;
let nextId = 1;

function headers() {
  const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (session) { h['mcp-session-id'] = session; h['mcp-protocol-version'] = protocolVersion; }
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

// A response is plain JSON or an SSE stream of `data:` frames; take the frame
// that answers our id.
async function readMessage(res, id) {
  const text = await res.text();
  if (!(res.headers.get('content-type') || '').includes('text/event-stream')) return JSON.parse(text);
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const msg = JSON.parse(line.slice(5));
    if (msg.id === id) return msg;
  }
  throw new Error(`no answer for request ${id} in the event stream`);
}

async function call(method, params) {
  const id = nextId++;
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${await res.text()}`);
  session = session || res.headers.get('mcp-session-id') || undefined;
  const msg = await readMessage(res, id);
  if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
  return msg.result;
}

const init = await call('initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'barrel-db.eu', version: '1' } });
await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });

const tools = [];
let cursor;
do {
  const page = await call('tools/list', cursor ? { cursor } : {});
  tools.push(...page.tools);
  cursor = page.nextCursor;
} while (cursor);

if (session) await fetch(url, { method: 'DELETE', headers: headers() }).catch(() => {});

tools.sort((a, b) => a.name.localeCompare(b.name));
const doc = {
  barrelServer: process.env.SERVER_VERSION || null,
  serverInfo: init.serverInfo,
  protocolVersion: init.protocolVersion,
  generated: new Date().toISOString().slice(0, 10),
  tools,
};
writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
console.log(`wrote ${tools.length} tools from ${init.serverInfo?.name} ${init.serverInfo?.version} to ${out}`);
