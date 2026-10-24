import test from 'node:test';
import assert from 'node:assert/strict';
import { seaAt, crestPath } from '../dist/stranger.js';

test('the sea rises after the first text fades and before the second appears', () => {
  assert.deepEqual(seaAt(0), { level: 0, first: 1, second: 0 });
  const middle = seaAt(.4);
  assert.equal(middle.first, 0);
  assert.equal(middle.second, 0);
  assert.ok(middle.level > 0 && middle.level < 1);
  assert.deepEqual(seaAt(1), { level: 1, first: 0, second: 1 });
});

test('the crest covers the whole width and closes at the bottom', () => {
  const shape = crestPath(2880, 180, 15, 40, 100);
  assert.match(shape.body, /^M-180/);
  assert.match(shape.body, /L3060 100L-180 100Z$/);
  assert.ok(shape.foam.startsWith('M') && shape.line.startsWith('M'));
});
