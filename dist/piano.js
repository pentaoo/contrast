import { computerKeys, describeChord, noteName } from './notes.js?v=type-3';
import { LOOKAHEAD, advance, dueEvents } from './listening.js?v=type-3';
import { createMelody, finalNotes, keyboardRange, noteFrequency } from './melody.js?v=type-3';
import { mountSpectrum } from './spectrum.js?v=type-3';
import { mountBall } from './ball.js?v=type-3';
import { mountTritonFinale, tritonNotes, tritonTiming, createTritonSchedule } from './triton.js?v=type-3';

export function mountPianoExperience({ reducedMotion }) {
  const piano = document.querySelector('#piano');
  const lab = document.querySelector('#sound-lab');
  const unlock = document.querySelector('#sound-unlock');
  const tracks = [...document.querySelectorAll('.sound-track')];
  const tonesCopy = document.querySelector('#sound-tones-copy');
  const instrument = document.querySelector('.sound-instrument');
  const status = document.querySelector('#sound-status');
  const error = document.querySelector('#audio-error');
  const spectrum = mountSpectrum(document.querySelector('#spectrum-canvas'), document.querySelector('#spectrum-caption'), reducedMotion);
  const ball = mountBall({ floor: document.querySelector('#ball-floor'), spectrum, reducedMotion });
  const finale = mountTritonFinale({ lab, piano, stage: document.querySelector('#piano-stage'), reducedMotion });
  const keys = new Map();
  const centers = new Map();
  const voices = new Set();
  const sources = new Map();
  let freeFrame;
  let ringingUntil = 0;
  let lastChord = [];
  let context;
  let output;
  let finalOutputs;
  // The performance the scroll is in: which ending, how far it has played.
  let active = null;
  let heard = { mistake: false, correct: false };
  let frame;
  let lastNow = 0;

  // The outer black keys sit off the white-key seams: the two-key group
  // spreads slightly outward, as does the three-key group around G-sharp.
  const blackOffsets = { 1: -.1, 3: .1, 6: -.2, 8: 0, 10: .2 };
  const isBlack = (note) => Object.hasOwn(blackOffsets, note % 12);
  const whiteCount = Array.from({ length: keyboardRange[1] - keyboardRange[0] + 1 }, (_, index) => keyboardRange[0] + index).filter((note) => !isBlack(note)).length;
  let whiteIndex = 0;
  for (let note = keyboardRange[0]; note <= keyboardRange[1]; note++) {
    const key = document.createElement('span');
    const black = isBlack(note);
    key.className = `piano-key ${black ? 'is-black' : 'is-white'}`;
    key.dataset.note = String(note);
    if (note % 12 === 0) key.dataset.label = noteName(note);
    key.setAttribute('aria-hidden', 'true');
    key.style.left = `${(whiteIndex + (black ? blackOffsets[note % 12] - .3 : 0)) / whiteCount * 100}%`;
    key.style.width = `${(black ? .6 : 1) / whiteCount * 100}%`;
    const central = note >= 59 && note <= 76;
    key.style.setProperty('--break-x', `${central ? Math.sin(note * 3.1) * 35 : (note < 59 ? -8 : 8)}px`);
    key.style.setProperty('--break-y', `${central ? 30 + (note * 17 % 75) : 5 + note % 8}px`);
    key.style.setProperty('--break-angle', `${central ? (note * 13 % 65) - 32 : (note < 59 ? -5 : 6)}deg`);
    piano.append(key);
    keys.set(note, key);
    centers.set(note, (whiteIndex + (black ? blackOffsets[note % 12] : .5)) / whiteCount);
    if (!black) whiteIndex++;
  }

  // The spectrum spans the keyboard: each peak stands over its own key.
  spectrum.setAxis((midi) => {
    const [low, high] = keyboardRange;
    const slope = 7 / 12 / whiteCount;
    if (midi <= low) return centers.get(low) + (midi - low) * slope;
    if (midi >= high) return centers.get(high) + (midi - high) * slope;
    const base = Math.floor(midi);
    return centers.get(base) + (centers.get(base + 1) - centers.get(base)) * (midi - base);
  });

  function lightKeys(notes = new Set(), secondNote) {
    keys.forEach((key, note) => {
      key.classList.toggle('is-active', notes.has(note));
      key.classList.toggle('is-second', notes.has(note) && note === secondNote);
    });
  }


  function updateSpectrumFocus() {
    // While the ball goes on, the graph stays over the keys: the octave's shared
    // frequency is only visible together with the overtones.
    if (!heard.mistake || active?.playing) { spectrum.setFocus(false, 0); return; }
    const rect = tonesCopy.getBoundingClientRect();
    const readingArea = Math.max(1, Math.min(innerHeight, instrument.getBoundingClientRect().top));
    const showAnnotations = rect.top <= readingArea * .8;
    const progress = (readingArea * .64 - rect.top) / Math.max(rect.height, readingArea * .5);
    spectrum.setFocus(showAnnotations, Math.max(0, Math.min(1, progress)));
  }

  function audible() {
    return Boolean(context && context.state === 'running');
  }

  function silence() {
    if (!context) return;
    const now = context.currentTime;
    voices.forEach(({ oscillator, gain, at }) => {
      gain.gain.cancelScheduledValues(now);
      if (at > now) gain.gain.setValueAtTime(0, now);
      else gain.gain.setTargetAtTime(0, now, .012);
      oscillator.stop(now + .05);
    });
    voices.clear();
  }

  function createPerformance(version) {
    const melody = createMelody(version);
    const performance = { ...melody, playhead: 0, queued: 0, finalSeen: false, cues: melody.events, playing: false, done: false };
    if (version === 'correct') {
      const schedule = createTritonSchedule(melody.duration, reducedMotion.matches);
      performance.finaleStart = schedule.start;
      performance.reduced = reducedMotion.matches;
      performance.duration = schedule.duration;
      performance.cues = [...melody.events, { at: schedule.impact, duration: tritonTiming.sustain, notes: tritonNotes, velocity: .74, triton: true }];
      finale.prepare().catch(() => {});
    }
    return performance;
  }

  function enter(version) {
    if (active?.version === version) return;
    leave();
    releaseAll();
    active = createPerformance(version);
    spectrum.begin();
    ball.begin();
    finale.reset();
    status.textContent = version === 'mistake' ? 'Звучит мелодия, точка и квадрат танцуют.' : 'Та же мелодия с другим финалом. Точка и квадрат снова танцуют.';
  }

  // The reader scrolled out of a track: the sound stops, the last frame stays.
  function leave() {
    if (!active) return;
    silence();
    if (!active.done) {
      ball.hide();
      if (active.finaleStart !== undefined) finale.reset();
      spectrum.restore();
    }
    active = null;
    lightKeys(new Set());
  }

  function complete(performance) {
    performance.done = true;
    heard[performance.version] = true;
    if (performance.version === 'mistake') {
      spectrum.finish(performance.snapshot, 'mistake');
      status.textContent = 'В финале прозвучали до и ре-бемоль. Точка и квадрат сбились и разбежались. Дальше — объяснение и другой финал.';
    } else {
      finale.finish();
      status.textContent = 'На двух до в октаву точка и квадрат сошлись в одну фигуру. Затем тритон проломил клавиатуру, и фигуры упали вместе с ней. При ударе прозвучали до и фа-диез.';
    }
  }

  // Each frame: the playhead moves on at real tempo and queues the next notes.
  function tick(now) {
    frame = undefined;
    const performance = active;
    if (!performance) return;
    const dt = Math.min(.1, (now - lastNow) / 1000);
    lastNow = now;
    // One scroll into the track starts the melody; it plays to the end by itself.
    const target = performance.duration;
    const step = advance(performance.playhead, target, dt);
    if (step.jumped) {
      // Back up the page: the music stops and the scene rewinds without sound.
      silence();
      performance.queued = step.playhead;
      performance.done = false;
      performance.finalSeen = false;
      performance.snapshot = undefined;
      spectrum.begin();
      if (performance.finaleStart !== undefined && step.playhead < performance.finaleStart) { performance.finaleStarted = false; finale.reset(); }
    }
    performance.playhead = step.playhead;
    performance.playing = step.playhead < target || (context && voices.size > 0);
    if (audible()) {
      const horizon = Math.min(target, step.playhead + LOOKAHEAD);
      const start = context.currentTime - step.playhead;
      dueEvents(performance.cues, performance.queued, horizon).forEach((event) => {
        const at = Math.max(context.currentTime, start + event.at);
        event.notes.forEach((note, index) => pianoTone(note, at, event.duration, event.velocity, event.final ? finalOutputs[index] : output));
      });
      performance.queued = Math.max(performance.queued, horizon);
    } else performance.queued = Math.max(performance.queued, step.playhead);
    unlock.hidden = audible();
    render(performance);
    if (!performance.done && performance.playhead >= performance.duration) complete(performance);
    queueTick();
  }

  function queueTick() {
    if (!frame && active) {
      lastNow ||= performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function render(performance) {
    const elapsed = performance.playhead;
    if (performance.finaleStart !== undefined && elapsed >= performance.finaleStart) {
      if (!performance.finaleStarted) { performance.finaleStarted = true; finale.begin(); }
      const wreck = finale.render(elapsed - performance.finaleStart, performance.reduced || reducedMotion.matches);
      ball.render(elapsed, performance, wreck);
      lightKeys(new Set());
      return;
    }
    const notes = new Set();
    for (const event of performance.events) {
      if (elapsed >= event.at && elapsed < event.at + event.duration) event.notes.forEach((note) => notes.add(note));
      if (event.final && elapsed >= event.at) performance.finalSeen = true;
    }
    const finalAt = performance.events.find((event) => event.final).at;
    if (audible()) {
      const snapshot = spectrum.update(elapsed, performance.version, finalAt, !performance.snapshot);
      if (!performance.snapshot && snapshot) performance.snapshot = snapshot;
    }
    ball.render(elapsed, performance);
    // The final pair stays pressed while it fades, so the keys never blink before the held frame.
    if (performance.finalSeen) finalNotes(performance.version).forEach((note) => notes.add(note));
    lightKeys(notes, performance.finalSeen ? finalNotes(performance.version)[1] : undefined);
  }

  function pianoTone(note, at, duration, velocity, destination = output) {
    // Fast hammer attack; the upper partials decay faster than the fundamental.
    // This is a lightweight piano-like synthesis, with no downloaded samples.
    const frequency = noteFrequency(note);
    const tone = [];
    [1, .36, .16, .08, .035, .016].forEach((weight, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const partialDuration = duration / (1 + index * .19);
      oscillator.frequency.value = frequency * (index + 1);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.06 * weight * velocity, at + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, at + partialDuration);
      oscillator.connect(gain);
      gain.connect(destination);
      const voice = { oscillator, gain, at };
      voices.add(voice);
      tone.push(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        voices.delete(voice);
      };
      oscillator.start(at);
      oscillator.stop(at + partialDuration + .02);
    });
    return tone;
  }

  // The conch: the same C4 and F-sharp4 as the impact, but blown — a slow swell, a soft vibrato, a long fade.
  function conch() {
    if (!audible()) return;
    const at = context.currentTime + .03;
    tritonNotes.forEach((note, index) => {
      const oscillator = context.createOscillator();
      const vibrato = context.createOscillator();
      const depth = context.createGain();
      const tone = context.createBiquadFilter();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = noteFrequency(note);
      vibrato.frequency.value = 5.2 + index * .4;
      depth.gain.value = 3;
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(500, at);
      tone.frequency.linearRampToValueAtTime(1400, at + .45);
      tone.frequency.linearRampToValueAtTime(700, at + 2.2);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.05, at + .35);
      gain.gain.setValueAtTime(.05, at + 1.5);
      gain.gain.exponentialRampToValueAtTime(.0001, at + 2.4);
      vibrato.connect(depth);
      depth.connect(oscillator.frequency);
      oscillator.connect(tone);
      tone.connect(gain);
      gain.connect(output);
      [oscillator, vibrato].forEach((node) => { node.start(at); node.stop(at + 2.5); });
      oscillator.onended = () => [oscillator, vibrato, depth, tone, gain].forEach((node) => node.disconnect());
    });
  }

  function heldNotes() {
    return [...new Set([...sources.values()].map(({ note }) => note))];
  }

  function release(id) {
    const source = sources.get(id);
    if (!source) return;
    sources.delete(id);
    if (context && source.tone) {
      const now = context.currentTime;
      source.tone.forEach(({ oscillator, gain }) => {
        if (gain.gain.cancelAndHoldAtTime) gain.gain.cancelAndHoldAtTime(now);
        else gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, .09);
        try { oscillator.stop(now + .6); } catch {}
      });
      ringingUntil = Math.max(ringingUntil, now + .6);
    }
    queueFreeFrame();
  }

  function releaseAll() {
    [...sources.keys()].forEach(release);
  }

  async function press(id, note) {
    if (active?.playing || finale.completed || lab.dataset.finale !== 'idle' || !keys.has(note)) return;
    release(id);
    const source = { note };
    sources.set(id, source);
    lastChord = heldNotes();
    queueFreeFrame();
    try {
      await ensureAudio();
    } catch {
      error.textContent = 'Не удалось включить звук. Попробуйте ещё раз или читайте дальше.';
      return;
    }
    // The key may already be up, or a melody may have started meanwhile.
    if (sources.get(id) !== source || active?.playing) return;
    error.textContent = '';
    source.tone = pianoTone(note, context.currentTime + .005, 3.2, .7);
    ringingUntil = Math.max(ringingUntil, context.currentTime + 3.3);
  }

  function queueFreeFrame() {
    if (!freeFrame) freeFrame = requestAnimationFrame(drawFreePlay);
  }

  function drawFreePlay() {
    freeFrame = undefined;
    if (active?.playing) return;
    const notes = heldNotes();
    if (notes.length) lastChord = notes;
    const ringing = context && context.currentTime < ringingUntil;
    if (notes.length || ringing) {
      const sorted = [...notes].sort((a, b) => a - b);
      lightKeys(new Set(notes), sorted.length === 2 ? sorted[1] : undefined);
      spectrum.live(describeChord(lastChord));
      queueFreeFrame();
    } else {
      lastChord = [];
      lightKeys(new Set());
      spectrum.restore();
    }
  }

  function noteAt(x, y) {
    const key = document.elementFromPoint(x, y)?.closest('.piano-key');
    return key && piano.contains(key) ? Number(key.dataset.note) : null;
  }


  async function ensureAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    if (!context) {
      context = new Audio();
      output = context.createBiquadFilter();
      output.type = 'lowpass';
      output.frequency.value = 5200;
      output.Q.value = .5;
      finalOutputs = spectrum.connect(context, output);
    }
    await context.resume();
  }


  piano.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const note = noteAt(event.clientX, event.clientY);
    if (note === null) return;
    event.preventDefault();
    piano.setPointerCapture?.(event.pointerId);
    press(`pointer-${event.pointerId}`, note);
  });
  piano.addEventListener('pointermove', (event) => {
    const id = `pointer-${event.pointerId}`;
    if (!sources.has(id)) return;
    const note = noteAt(event.clientX, event.clientY);
    if (note !== null && note !== sources.get(id).note) press(id, note);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
    piano.addEventListener(type, (event) => release(`pointer-${event.pointerId}`));
  });
  piano.addEventListener('contextmenu', (event) => event.preventDefault());

  const instrumentInView = () => {
    const rect = instrument.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight && lab.getBoundingClientRect().top < innerHeight;
  };
  document.addEventListener('keydown', (event) => {
    const note = computerKeys[event.code];
    if (note === undefined || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || !instrumentInView()) return;
    event.preventDefault();
    press(event.code, note);
  });
  document.addEventListener('keyup', (event) => release(event.code));
  window.addEventListener('blur', releaseAll);


  // A click, a tap or a key anywhere lets the browser play sound; scrolling alone does not.
  const unlockAudio = () => ensureAudio().then(() => { error.textContent = ''; unlock.hidden = true; }).catch(() => {
    error.textContent = 'Не удалось включить звук. Всё остальное работает и без него.';
  });
  ['pointerdown', 'keydown', 'touchend'].forEach((type) => document.addEventListener(type, unlockAudio, { once: true, capture: true }));
  unlock.addEventListener('click', unlockAudio);
  finale.reset();

  return {
    unlockAudio,
    conch,
    // Кадры падения тритона на пианино — заранее, в фоне.
    preload: () => finale.prepare().catch(() => {}),
    updateScroll() {
      const inside = tracks.find((track) => {
        const rect = track.getBoundingClientRect();
        return rect.top <= 0 && rect.bottom > 0;
      });
      if (inside) {
        enter(inside.dataset.track);
        queueTick();
      } else if (active) {
        // Below the track the melody plays out; back above it, it stops.
        if (tracks.find((track) => track.dataset.track === active.version).getBoundingClientRect().top > 0) leave();
        else if (lab.getBoundingClientRect().bottom <= 0) leave();
        else queueTick();
      }
      // Below the second ending the piano stays broken; above the first, it is whole again.
      if (!active) {
        const correct = tracks.find((track) => track.dataset.track === 'correct').getBoundingClientRect();
        if (correct.bottom <= 0 && !finale.completed) { finale.begin(); finale.finish(); }
        if (correct.top > 0 && finale.completed) finale.reset();
      }
      unlock.hidden = !active || audible();
      updateSpectrumFocus();
    },
    stop: leave,
    motionChanged() {
      if (active?.finaleStarted && reducedMotion.matches) finale.render(active.playhead - active.finaleStart, true);
    },
    reset() {
      leave();
      heard = { mistake: false, correct: false };
      finale.reset();
      spectrum.reset();
      error.textContent = '';
      status.textContent = '';
    }
  };
}
