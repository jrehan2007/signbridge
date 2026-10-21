import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures, normalizeHand, FEATURE_SIZE, handsInVector } from './features.js';
import { GestureSmoother } from './smoother.js';
import { toCSV, fromCSV, stratifiedSplit } from './dataset.js';

const hand = (ox = 0, oy = 0, s = 1) =>
  Array.from({ length: 21 }, (_, i) => ({ x: ox + s * 0.01 * i, y: oy + s * 0.02 * (i % 5), z: s * 0.001 * i }));

test('normalizeHand is translation and scale invariant', () => {
  const a = normalizeHand(hand(0.1, 0.1, 1));
  const b = normalizeHand(hand(0.6, 0.4, 2.5));
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-5));
  assert.equal(a[0], 0); // wrist at origin
  const maxLen = Math.max(...Array.from({ length: 21 }, (_, i) => Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2])));
  assert.ok(Math.abs(maxLen - 1) < 1e-5);
});

test('extractFeatures slots hands by handedness and zero-fills missing hand', () => {
  assert.equal(extractFeatures([], []), null);
  const one = extractFeatures([hand()], [[{ categoryName: 'Right', score: 0.9 }]]);
  assert.equal(one.length, FEATURE_SIZE);
  assert.ok(one.slice(0, 63).every((v) => v === 0));
  assert.equal(handsInVector(one), 1);
  const two = extractFeatures([hand(), hand(0.5)], [[{ categoryName: 'Left', score: 0.8 }], [{ categoryName: 'Left', score: 0.7 }]]);
  assert.equal(handsInVector(two), 2, 'duplicate handedness falls back to the free slot');
});

test('smoother commits once per stable sign and again after release', () => {
  const s = new GestureSmoother({ window: 4, threshold: 0.8, agreement: 0.75 });
  const p = (label, confidence = 0.9) => ({ label, confidence });
  const commits = [];
  const feed = (x) => { const r = s.push(x); if (r.commit) commits.push(r.commit.label); };
  [p('A'), p('A'), p('A'), p('A'), p('A'), p('A')].forEach(feed);
  assert.deepEqual(commits, ['A'], 'held pose commits once');
  [null, null, null].forEach(feed); // hands leave the frame
  [p('A'), p('A'), p('A')].forEach(feed);
  assert.deepEqual(commits, ['A', 'A'], 'repeat after release');
  [p('B', 0.5), p('B', 0.5), p('B', 0.5), p('B', 0.5)].forEach(feed);
  assert.deepEqual(commits, ['A', 'A'], 'low confidence is ignored');
  [p('B'), p('B'), p('B'), p('B')].forEach(feed);
  assert.deepEqual(commits, ['A', 'A', 'B']);
});

test('CSV round-trip and stratified split', () => {
  const samples = { 'Thank You': Array.from({ length: 10 }, () => Array(FEATURE_SIZE).fill(0.5)), A: Array.from({ length: 5 }, () => Array(FEATURE_SIZE).fill(-0.25)) };
  const back = fromCSV(toCSV(samples));
  assert.deepEqual(Object.keys(back).sort(), ['A', 'Thank You']);
  assert.equal(back['Thank You'].length, 10);
  assert.equal(back.A[0][3], -0.25);
  const { train, val } = stratifiedSplit(back, ['A', 'Thank You'], 0.2);
  assert.equal(train.length + val.length, 15);
  assert.deepEqual([...new Set(val.map((v) => v.y))].sort(), [0, 1]);
  assert.throws(() => fromCSV('label,f0\nA,1'), /expected 127 columns/);
});
