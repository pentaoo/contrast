import test from 'node:test';
import assert from 'node:assert/strict';
import { seaAt, seaTiming } from '../dist/stranger.js';

test('the crests wait at the bottom, then the reader descends into the sea', () => {
  assert.deepEqual(seaAt(0), { level: seaTiming.shore, first: 1, second: 0 });
  const middle = seaAt(.35);
  assert.equal(middle.first, 0);
  assert.equal(middle.second, 0);
  assert.ok(middle.level > seaTiming.shore && middle.level < 1);
  assert.deepEqual(seaAt(1), { level: 1, first: 0, second: 1 });
});

