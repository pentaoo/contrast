import { computerKeys, describeChord, noteName } from './notes.js?v=contrast-triton-14';
import { createListeningState, finishMelody, skipListening } from './listening.js?v=contrast-triton-14';
import { createMelody, finalNotes, keyboardRange, noteFrequency } from './melody.js?v=contrast-triton-14';
import { mountSpectrum } from './spectrum.js?v=contrast-triton-14';
import { mountTritonFinale, tritonNotes, tritonTiming, createTritonSchedule } from './triton.js?v=contrast-triton-14';

export function mountPianoExperience({ reducedMotion }) {
  const piano = document.querySelector('#piano');
  const lab = document.querySelector('#sound-lab');
  const button = document.querySelector('#play-sound');
  const explanation = document.querySelector('#sound-explanation');
  const opening = document.querySelector('#sound-opening');
  const finalStep = document.querySelector('#sound-final-step');
  const tonesCopy = document.querySelector('#sound-tones-copy');
  const instrument = document.querySelector('.sound-instrument');
  const replayFirst = document.querySelector('#replay-first');
  const outro = document.querySelector('#sound-outro');
  const title = document.querySelector('#sound-title');
  const prompt = document.querySelector('#listening-prompt');
  const status = document.querySelector('#sound-status');
  const error = document.querySelector('#audio-error');
  const spectrum = mountSpectrum(document.querySelector('#spectrum-canvas'), document.querySelector('#spectrum-caption'), reducedMotion);
  const finale = mountTritonFinale({ lab, piano, stage: document.querySelector('#piano-stage'), reducedMotion });
  const keys = new Map();
  const voices = new Set();
  const sources = new Map();
  let freeFrame;
  let ringingUntil = 0;
  let lastChord = [];
  let state = createListeningState();
  let context;
  let output;
  let finalOutputs;
  let lastCompletedVersion;
  let active = null;
  let busy = false;
  let generation = 0;
  let frame;
  let finalStepVisible = false;

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
    if (!black) whiteIndex++;
  }

  function lightKeys(notes = new Set(), secondNote) {
    keys.forEach((key, note) => {
      key.classList.toggle('is-active', notes.has(note));
      key.classList.toggle('is-second', notes.has(note) && note === secondNote);
    });
  }

  function updateUI() {
    const explaining = state.phase === 'explanation';
    const openingExplanation = explanation.hidden && explaining;
    const readingPosition = openingExplanation ? { top: window.scrollY, left: window.scrollX } : null;
    const focusExplanation = openingExplanation && document.activeElement === button;
    if (focusExplanation) document.activeElement.blur();
    lab.dataset.phase = state.phase;
    lab.dataset.playing = active ? active.version : busy ? 'loading' : 'none';
    opening.hidden = explaining;
    explanation.hidden = !explaining;
    title.innerHTML = 'Чего вы ждёте<br>от последней ноты?';
    prompt.textContent = 'Послушайте короткую мелодию до конца.';
    if (readingPosition) {
      // Expanding the sticky grid can move the browser's scroll anchor to its
      // end. Flush that layout, then keep the reader at the first paragraph.
      explanation.getBoundingClientRect();
      window.scrollTo({ ...readingPosition, behavior: 'instant' });
      if (focusExplanation) document.querySelector('#listening-lead').focus({ preventScroll: true });
    }
    finalStepVisible = explaining && finalStep.getBoundingClientRect().top <= innerHeight * .15;
    lab.dataset.step = !explaining ? 'intro' : finalStepVisible ? 'final' : 'reading';
    replayFirst.hidden = !finalStepVisible || Boolean(active) || busy || finale.completed;
    button.hidden = finale.completed || (explaining && !finalStepVisible && !active && !busy);
    outro.hidden = !finale.completed;
    button.disabled = busy;
    button.setAttribute('aria-pressed', String(Boolean(active)));
    button.querySelector('.play-icon').textContent = active ? '■' : '▶';
    button.querySelector('.play-label').textContent = active ? 'Остановить' : busy ? 'Включаем звук…'
      : state.phase === 'intro' ? 'Послушать мелодию' : 'Послушать ещё раз';
    if (!active && !sources.size) {
      const notes = lastCompletedVersion && !finale.completed ? finalNotes(lastCompletedVersion) : [];
      lightKeys(new Set(notes), notes[1]);
    }
    updateSpectrumFocus();
    if (explaining) finale.prepare().catch(() => {});
  }

  function updateSpectrumFocus() {
    if (state.phase !== 'explanation') { spectrum.setFocus(false, 0); return; }
    const rect = tonesCopy.getBoundingClientRect();
    const readingArea = Math.max(1, Math.min(innerHeight, instrument.getBoundingClientRect().top));
    const showAnnotations = rect.top <= readingArea * .8;
    const progress = (readingArea * .64 - rect.top) / Math.max(rect.height, readingArea * .5);
    spectrum.setFocus(showAnnotations, Math.max(0, Math.min(1, progress)));
  }

  function stop(completed = false) {
    releaseAll();
    cancelAnimationFrame(freeFrame);
    freeFrame = undefined;
    ringingUntil = 0;
    lastChord = [];
    generation++;
    cancelAnimationFrame(frame);
    const performance = active;
    const focusOutro = completed && performance?.finaleStarted && document.activeElement === button;
    active = null;
    busy = false;
    if (performance?.finaleStart !== undefined && !completed) finale.reset();
    if (context) {
      const now = context.currentTime;
      voices.forEach(({ oscillator, gain, at }) => {
        gain.gain.cancelScheduledValues(now);
        if (at > now) gain.gain.setValueAtTime(0, now);
        else gain.gain.setTargetAtTime(0, now, .012);
        oscillator.stop(now + .05);
      });
      voices.clear();
    }
    if (completed && performance) {
      state = finishMelody(state, performance.version);
      lastCompletedVersion = performance.version;
      spectrum.finish(performance.snapshot, performance.version);
      if (performance.finaleStarted) finale.finish();
    } else spectrum.restore();
    updateUI();
    if (focusOutro) outro.querySelector('a').focus({ preventScroll: true });
    if (!completed && performance) status.textContent = 'Воспроизведение остановлено. Можно послушать вариант заново.';
    if (completed && performance?.version === 'mistake') {
      status.textContent = 'Мелодия завершилась двумя соседними нотами. Можно прочитать объяснение и затем послушать другой финал.';
    } else if (completed && performance?.version === 'correct') {
      status.textContent = 'После двух до в октаву тритон проломил клавиатуру. В момент удара прозвучали до и фа-диез. Тритон и обломки исчезли вниз; дальше — следующая история.';
    }
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
    if (active || busy || finale.completed || lab.dataset.finale !== 'idle' || !keys.has(note)) return;
    release(id);
    const source = { note };
    sources.set(id, source);
    lastChord = heldNotes();
    queueFreeFrame();
    try {
      await ensureAudio();
    } catch {
      error.textContent = 'Не удалось включить звук. Попробуйте ещё раз или продолжайте чтение.';
      return;
    }
    // The key may already be up, or a melody may have started meanwhile.
    if (sources.get(id) !== source || active || busy) return;
    error.textContent = '';
    source.tone = pianoTone(note, context.currentTime + .005, 3.2, .7);
    ringingUntil = Math.max(ringingUntil, context.currentTime + 3.3);
  }

  function queueFreeFrame() {
    if (!freeFrame) freeFrame = requestAnimationFrame(drawFreePlay);
  }

  function drawFreePlay() {
    freeFrame = undefined;
    if (active) return;
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
      updateUI();
      spectrum.restore();
    }
  }

  function noteAt(x, y) {
    const key = document.elementFromPoint(x, y)?.closest('.piano-key');
    return key && piano.contains(key) ? Number(key.dataset.note) : null;
  }

  function animateKeys() {
    if (!active) return;
    if (context.state !== 'running') { stop(); return; }
    const elapsed = context.currentTime - active.start;
    if (active.finaleStart !== undefined && elapsed >= active.finaleStart) {
      if (!active.finaleStarted) { active.finaleStarted = true; finale.begin(); }
      finale.render(elapsed - active.finaleStart, active.reduced || reducedMotion.matches);
      lightKeys(new Set());
      if (elapsed >= active.duration) { stop(true); return; }
      frame = requestAnimationFrame(animateKeys);
      return;
    }
    const notes = new Set();
    for (const event of active.events) {
      if (elapsed >= event.at && elapsed < event.at + event.duration) {
        event.notes.forEach((note) => notes.add(note));
      }
      if (event.final && elapsed >= event.at && !active.finalSeen) {
        active.finalSeen = true;
      }
    }
    const finalAt = active.events.find((event) => event.final).at;
    const snapshot = spectrum.update(elapsed, active.version, finalAt, !active.snapshot);
    if (!active.snapshot && snapshot) active.snapshot = snapshot;
    lightKeys(notes, active.finalSeen ? finalNotes(active.version)[1] : undefined);
    if (elapsed >= active.duration) { stop(true); return; }
    frame = requestAnimationFrame(animateKeys);
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

  async function play(requestedVersion) {
    if (busy) return;
    if (active) { stop(); return; }
    if (state.phase === 'explanation' && !finalStepVisible) return;
    releaseAll();
    const token = ++generation;
    finale.reset();
    busy = true;
    error.textContent = '';
    updateUI();
    try {
      const version = requestedVersion || (state.phase === 'intro' ? 'mistake' : 'correct');
      await Promise.all([ensureAudio(), version === 'correct' ? finale.prepare() : Promise.resolve()]);
      if (token !== generation) return;
      const melody = createMelody(version);
      active = { ...melody, start: context.currentTime + .04, finalSeen: false };
      if (version === 'correct') {
        const schedule = createTritonSchedule(melody.duration, reducedMotion.matches);
        active.finaleStart = schedule.start;
        active.reduced = reducedMotion.matches;
        active.duration = schedule.duration;
        tritonNotes.forEach((note) => pianoTone(note, active.start + schedule.impact, tritonTiming.sustain, .74));
      }
      spectrum.begin();
      for (const event of melody.events) {
        event.notes.forEach((note, index) => pianoTone(note, active.start + event.at, event.duration, event.velocity, event.final ? finalOutputs[index] : output));
      }
      busy = false;
      updateUI();
      status.textContent = active.version === 'mistake' ? 'Звучит небольшая мелодия.' : 'Та же мелодия с другим финалом.';
      frame = requestAnimationFrame(animateKeys);
    } catch {
      if (token !== generation) return;
      stop();
      // Without sound the reader still gets the explanation instead of a closed screen.
      state = skipListening(state);
      updateUI();
      error.textContent = 'Не удалось включить звук. Объяснение можно прочитать и без него.';
    }
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

  button.addEventListener('click', () => play());
  replayFirst.addEventListener('click', () => play('mistake'));
  finale.reset();
  updateUI();

  return {
    // The piano screen keeps the page until the block is done: before the
    // melody, while it sounds, and until the reader reaches the last step.
    holdsPage() {
      return !finale.completed && (state.phase !== 'explanation' || Boolean(active) || busy || !finalStepVisible);
    },
    updateScroll() {
      if (active?.finaleStart !== undefined && (lab.getBoundingClientRect().bottom <= 0 || finalStep.getBoundingClientRect().top > innerHeight * .8)) { stop(); return; }
      const visible = state.phase === 'explanation' && finalStep.getBoundingClientRect().top <= innerHeight * .15;
      if (finale.completed && !visible) { finale.reset(); updateUI(); return; }
      if (visible !== finalStepVisible) updateUI();
      else updateSpectrumFocus();
    },
    stop,
    motionChanged() {
      if (active?.finaleStarted && reducedMotion.matches) finale.render(context.currentTime - active.start - active.finaleStart, true);
    },
    reset() {
      stop();
      state = createListeningState();
      finale.reset();
      lastCompletedVersion = undefined;
      spectrum.reset();
      error.textContent = '';
      status.textContent = '';
      updateUI();
    }
  };
}
