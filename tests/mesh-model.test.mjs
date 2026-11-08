// Run with: node --experimental-strip-types --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/components/demos/mesh-model.ts';

const bodies = (s, site) => M.versions(s, site).map((v) => `${v.kind} ${v.body}`);

test('relay through Lyon, browser offline, conflict, resolve', () => {
  let s = M.initial();
  s = M.toggle(s, 'pb');
  s = M.toggle(s, 'lt');
  s = M.edit(s, 'paris');
  s = M.edit(s, 'tab');
  assert.equal(M.tabStatus(s), 'Offline, 1 local write waiting');

  s = M.sync(s);
  assert.deepEqual(bodies(s, 'berlin'), ['winner blocked']);
  assert.deepEqual(bodies(s, 'lyon'), ['winner blocked']);
  assert.deepEqual(bodies(s, 'tab'), ['winner on site']);
  assert.equal(M.tabStatus(s), 'Offline, 1 local write waiting');
  assert.match(s.caption, /Berlin got Paris’s edit through another peer/);
  assert.match(s.caption, /differ until a link returns/);

  s = M.toggle(s, 'lt');
  s = M.sync(s);
  const w = M.versions(s, 'paris');
  assert.equal(w.length, 2);
  for (const site of M.SITES) assert.deepEqual(M.versions(s, site), w);
  assert.equal(w[0].kind, 'winner');
  assert.equal(w[1].kind, 'conflict');
  assert.match(s.call, /kept as conflicts/);
  assert.equal(M.tabStatus(s), 'Online');

  s = M.resolve(s, 'berlin');
  assert.match(s.call, /resolve_conflict/);
  s = M.sync(s);
  for (const site of M.SITES) assert.deepEqual(bodies(s, site), ['winner merged']);
  assert.equal(M.groups(s.nodes), 1);
  assert.match(s.caption, /Every copy holds the same document/);
});

test('same winner whatever the sync order', () => {
  let s = M.initial();
  s = M.toggle(s, 'pl'); s = M.toggle(s, 'pb'); s = M.toggle(s, 'lb');
  s = M.edit(s, 'paris'); s = M.edit(s, 'berlin'); s = M.edit(s, 'lyon');
  for (const k of ['pl', 'pb', 'lb']) s = M.toggle(s, k);
  s = M.sync(s);
  const w = M.versions(s, 'lyon');
  assert.equal(w.length, 3);
  for (const site of M.SITES) assert.deepEqual(M.versions(s, site), w);
});

test('a write replaces only what it read', () => {
  let s = M.edit(M.initial(), 'lyon');
  s = M.sync(s);
  s = M.edit(s, 'paris');
  s = M.sync(s);
  for (const site of M.SITES) assert.deepEqual(bodies(s, site), ['winner blocked']);
});
