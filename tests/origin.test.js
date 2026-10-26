import test from 'node:test';
import assert from 'node:assert/strict';
import { originFrame, ORIGIN_LAYERS, ORIGIN_SHAPES } from '../dist/origin.js';

test('the prologue step follows the scroll and stays in range', () => {
  assert.equal(originFrame(0).step, 0);
  assert.equal(originFrame(-1).step, 0);
  assert.equal(originFrame(NaN).step, 0);
  assert.equal(originFrame(.21).step, 1);
  assert.equal(originFrame(.99).step, ORIGIN_LAYERS.length - 1);
  assert.equal(originFrame(7).step, ORIGIN_LAYERS.length - 1);
});

test('shapes appear one by one within their step', () => {
  const counts = [.4, .45, .5, .55, .59].map((p) => originFrame(p).shapes);
  assert.equal(counts[0], 1);
  counts.slice(1).forEach((count, index) => assert.ok(count >= counts[index]));
  assert.equal(counts.at(-1), ORIGIN_SHAPES);
});

test('the field only splits further and ends as the field of dots', () => {
  ORIGIN_LAYERS.slice(1).forEach((layer, index) => assert.ok(layer > ORIGIN_LAYERS[index]));
});
