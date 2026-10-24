import test from 'node:test';
import assert from 'node:assert/strict';
import { tritonNotes, tritonTiming, tritonFrameAt, createTritonSchedule } from '../dist/triton.js';
import { createMelody } from '../dist/melody.js';

test('the six-semitone dyad starts at the first broken-piano frame', () => {
  assert.deepEqual(tritonNotes, [60, 66]);
  assert.equal(tritonNotes[1] - tritonNotes[0], 6);
  assert.equal(tritonFrameAt(tritonTiming.impact - .001).broken, false);
  assert.equal(tritonFrameAt(tritonTiming.impact).pose, 'impact');
  assert.equal(tritonFrameAt(tritonTiming.impact).lift, 0);
  assert.equal(tritonFrameAt(tritonTiming.impact).broken, true);
  assert.ok(tritonTiming.impact + tritonTiming.sustain + .02 < tritonTiming.duration);
});

test('the fall advances in discrete steps, continues through the keyboard and leaves the screen', () => {
  let lastLift = 1;
  for (let at = 0; at < tritonTiming.impact; at += .01) {
    const frame = tritonFrameAt(at);
    assert.equal(frame.pose, 'fall');
    assert.ok(frame.lift <= lastLift);
    assert.ok(frame.lift >= 0);
    lastLift = frame.lift;
  }
  assert.deepEqual(tritonFrameAt(.13), tritonFrameAt(.23));
  assert.notEqual(tritonFrameAt(.13).frame, tritonFrameAt(.25).frame);
  assert.equal(tritonFrameAt(tritonTiming.exit).pose, 'rest');
  assert.ok(tritonFrameAt(1.4).lift < 0);
  assert.ok(tritonFrameAt(1.7).lift < tritonFrameAt(1.4).lift);
  assert.ok(tritonFrameAt(1.7).debris > tritonFrameAt(1.4).debris);
  assert.equal(tritonFrameAt(tritonTiming.gone - .001).gone, false);
  assert.equal(tritonFrameAt(tritonTiming.gone).gone, true);
  assert.equal(tritonFrameAt(20).gone, true);
});

test('reduced motion uses a single resting pose without a fall or alternating frames', () => {
  for (const at of [0, .2, .72, 1.3, 2.6]) {
    const frame = tritonFrameAt(at, true);
    assert.equal(frame.pose, 'rest');
    assert.equal(frame.frame, 0);
    assert.equal(frame.lift, 0);
    assert.equal(frame.debris, 0);
    assert.equal(frame.broken, true);
    assert.equal(frame.gone, at >= .7);
  }
});

test('the automatic surprise starts after the complete octave and finishes after the impact sound', () => {
  const melody = createMelody('correct');
  for (const reduced of [false, true]) {
    const schedule = createTritonSchedule(melody.duration, reduced);
    assert.ok(schedule.start > melody.duration);
    assert.ok(Math.abs(schedule.impact - schedule.start - (reduced ? 0 : tritonTiming.impact)) < 1e-9);
    for (const event of melody.events) assert.ok(event.at + event.duration + .02 < schedule.impact);
    assert.ok(schedule.impact + tritonTiming.sustain + .02 < schedule.duration);
  }
});
