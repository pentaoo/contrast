import test from 'node:test';
import assert from 'node:assert/strict';
import { originStep, ORIGIN_LAYERS } from '../dist/origin.js';

test('the prologue step follows the scroll and stays in range', () => {
  assert.equal(originStep(0), 0);
  assert.equal(originStep(-1), 0);
  assert.equal(originStep(NaN), 0);
  assert.equal(originStep(.21), 1);
  assert.equal(originStep(.99), ORIGIN_LAYERS.length - 1);
  assert.equal(originStep(1), ORIGIN_LAYERS.length - 1);
  assert.equal(originStep(7), ORIGIN_LAYERS.length - 1);
});

test('the field only splits further and ends as the field of dots', () => {
  ORIGIN_LAYERS.slice(1).forEach((layer, index) => assert.ok(layer >= ORIGIN_LAYERS[index]));
  assert.equal(ORIGIN_LAYERS.at(-1), 3);
});
