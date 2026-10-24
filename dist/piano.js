import { createListeningState, finishMelody, skipListening } from './listening.js?v=story-1';
import { createMelody, finalNotes, keyboardRange, noteFrequency } from './melody.js?v=story-1';
import { mountSpectrum } from './spectrum.js?v=story-1';
import { computerKeys, describeChord, noteName } from './notes.js?v=story-1';

export function mountPianoExperience({ reducedMotion }) {
  const piano = document.querySelector('#piano');
  const stage = document.querySelector('#piano-stage');
  const lab = document.querySelector('#sound-lab');
  const button = document.querySelector('#play-sound');
  const explanation = document.querySelector('#sound-explanation');
  const opening = document.querySelector('#sound-opening');
  const finalStep = document.querySelector('#sound-final-step');
  const tonesCopy = document.querySelector('#sound-tones-copy');
  const instrument = document.querySelector('.sound-instrument');
  const skip = document.querySelector('#skip-audio');
  const status = document.querySelector('#sound-status');
  const error = document.querySelector('#audio-error');
  const spectrum = mountSpectrum(document.querySelector('#spectrum-canvas'), document.querySelector('#spectrum-caption'), reducedMotion);
  const keys = new Map();
  const voices = new Set();
  const effects = new Set();
  let state = createListeningState();
  let context;
  let output;
  let finalOutputs;
  let lastCompletedVersion;
  let active = null;
  let busy = false;
  let generation = 0;
  let frame;
  let shake;
  let finalStepVisible = false;
  // Free play: each finger, mouse or computer key is one source holding one note.
  const sources = new Map();
  let freeFrame;
  let ringingUntil = 0;
  let lastChord = [];

  const isBlack = (note) => [1, 3, 6, 8, 10].includes(note % 12);
  const whiteCount = Array.from({ length: keyboardRange[1] - keyboardRange[0] + 1 }, (_, index) => keyboardRange[0] + index).filter((note) => !isBlack(note)).length;
  let whiteIndex = 0;
  for (let note = keyboardRange[0]; note <= keyboardRange[1]; note++) {
    const key = document.createElement('span');
    const black = isBlack(note);
    key.className = `piano-key ${black ? 'is-black' : 'is-white'}`;
    key.dataset.note = String(note);
    if (note % 12 === 0) key.dataset.label = noteName(note);
    key.setAttribute('aria-hidden', 'true');
    key.style.left = `${(whiteIndex - (black ? .3 : 0)) / whiteCount * 100}%`;
    key.style.width = `${(black ? .6 : 1) / whiteCount * 100}%`;
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
    const openingExplanation = explanation.hidden && state.phase !== 'intro';
    const readingPosition = openingExplanation ? { top: window.scrollY, left: window.scrollX } : null;
    const focusExplanation = openingExplanation && [button, skip].includes(document.activeElement);
    if (focusExplanation) document.activeElement.blur();
    lab.dataset.phase = state.phase;
    lab.dataset.playing = active ? active.version : busy ? 'loading' : 'none';
    opening.hidden = state.phase !== 'intro';
    explanation.hidden = state.phase === 'intro';
    if (readingPosition) {
      // Expanding the sticky grid can move the browser's scroll anchor to its
      // end. Flush that layout, then keep the reader at the first paragraph.
      explanation.getBoundingClientRect();
      window.scrollTo({ ...readingPosition, behavior: 'instant' });
      if (focusExplanation) document.querySelector('#listening-lead').focus({ preventScroll: true });
    }
    finalStepVisible = state.phase !== 'intro' && finalStep.getBoundingClientRect().top <= innerHeight * .15;
    lab.dataset.step = state.phase === 'intro' ? 'intro' : finalStepVisible ? 'final' : 'reading';
    skip.hidden = state.phase !== 'intro';
    document.querySelector('#listening-lead').textContent = state.heardMistake
      ? 'Кажется, музыкант сбился. В финале остались две соседние ноты — до и ре-бемоль.'
      : 'В финале мы намеренно оставили две соседние ноты — до и ре-бемоль.';
    button.hidden = state.phase !== 'intro' && !finalStepVisible && !active && !busy;
    button.disabled = busy;
    button.setAttribute('aria-pressed', String(Boolean(active)));
    button.querySelector('.play-icon').textContent = active ? '■' : '▶';
    button.querySelector('.play-label').textContent = active ? 'Остановить' : busy ? 'Включаем звук…'
      : state.phase === 'intro' ? 'Послушать'
      : state.phase === 'explanation' ? 'Послушать без ошибки' : 'Послушать ещё раз';
    if (!active && !sources.size) {
      const notes = lastCompletedVersion ? finalNotes(lastCompletedVersion) : [];
      lightKeys(new Set(notes), notes[1]);
    }
    updateSpectrumFocus();
  }

  function updateSpectrumFocus() {
    if (state.phase === 'intro') { spectrum.setFocus(false, 0); return; }
    const rect = tonesCopy.getBoundingClientRect();
    const readingArea = Math.max(1, Math.min(innerHeight, instrument.getBoundingClientRect().top));
    const showAnnotations = rect.top <= readingArea * .8;
    const progress = (readingArea * .64 - rect.top) / Math.max(rect.height, readingArea * .5);
    spectrum.setFocus(showAnnotations, Math.max(0, Math.min(1, progress)));
  }

  function clearEffects() {
    shake?.cancel();
    shake = undefined;
    effects.forEach((effect) => effect.cancel());
    effects.clear();
    document.querySelector('.confetti-layer')?.remove();
  }

  function celebrate() {
    const rect = stage.getBoundingClientRect();
    const sceneRect = lab.getBoundingClientRect();
    if (reducedMotion.matches || document.hidden || sceneRect.bottom <= 0 || sceneRect.top >= innerHeight) return;
    const origin = rect.bottom > 0 && rect.top < innerHeight ? rect.top + rect.height * .55 : innerHeight * .45;
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    const colors = ['#ee492c', '#f1f0eb', '#a8af99'];
    const animations = [];
    for (const side of [-1, 1]) {
      for (let index = 0; index < 18; index++) {
        const piece = document.createElement('i');
        piece.style.background = colors[index % colors.length];
        piece.style[side === 1 ? 'left' : 'right'] = '-8px';
        piece.style.top = `${Math.min(innerHeight - 80, Math.max(100, origin))}px`;
        layer.append(piece);
        const distance = Math.min(innerWidth * .36, 300) * (.35 + Math.random() * .65);
        const rise = 70 + Math.random() * 150;
        const rotation = (120 + Math.random() * 360) * side;
        const animation = piece.animate([
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
          { transform: `translate(${side * distance * .7}px, ${-rise}px) rotate(${rotation * .4}deg)`, opacity: 1, offset: .36 },
          { transform: `translate(${side * distance}px, ${180 + Math.random() * 170}px) rotate(${rotation}deg)`, opacity: 0 }
        ], { duration: 1600 + Math.random() * 500, delay: Math.random() * 100, easing: 'linear' });
        effects.add(animation);
        animations.push(animation.finished.catch(() => {}).then(() => effects.delete(animation)));
      }
    }
    Promise.all(animations).then(() => layer.remove());
  }

  function stop(completed = false) {
    generation++;
    cancelAnimationFrame(frame);
    const performance = active;
    active = null;
    busy = false;
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
    const hadCorrectEnding = state.heardCorrect;
    if (completed && performance) {
      state = finishMelody(state, performance.version);
      lastCompletedVersion = performance.version;
      spectrum.finish(performance.snapshot, performance.version);
    } else spectrum.restore();
    updateUI();
    if (completed && performance?.version === 'mistake') {
      status.textContent = 'Мелодия завершилась неожиданным аккордом. Можно прочитать объяснение и затем послушать мелодию без ошибки.';
    } else if (completed && performance?.version === 'correct') {
      status.textContent = 'Мелодия завершилась. Можно продолжать чтение.';
      if (!hadCorrectEnding && state.heardCorrect) celebrate();
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
    if (active || busy || !keys.has(note)) return;
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
    const notes = new Set();
    for (const event of active.events) {
      if (elapsed >= event.at && elapsed < event.at + event.duration) {
        event.notes.forEach((note) => notes.add(note));
      }
      if (event.final && elapsed >= event.at && !active.finalSeen) {
        active.finalSeen = true;
        if (active.version === 'mistake' && !reducedMotion.matches) {
          shake = stage.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-3px)' },
            { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }
          ], { duration: 160, easing: 'ease-out' });
        }
      }
    }
    const finalAt = active.events.find((event) => event.final).at;
    const snapshot = spectrum.update(elapsed, active.version, finalAt, !active.snapshot);
    if (!active.snapshot && snapshot) active.snapshot = snapshot;
    lightKeys(notes, active.finalSeen ? finalNotes(active.version)[1] : undefined);
    if (elapsed >= active.duration) { stop(true); return; }
    frame = requestAnimationFrame(animateKeys);
  }

  async function play() {
    if (busy) return;
    if (active) { stop(); return; }
    if (state.phase !== 'intro' && !finalStepVisible) return;
    clearEffects();
    releaseAll();
    const token = ++generation;
    busy = true;
    error.textContent = '';
    updateUI();
    try {
      await ensureAudio();
      if (token !== generation) return;
      const melody = createMelody(state.phase === 'intro' ? 'mistake' : 'correct');
      active = { ...melody, start: context.currentTime + .04, finalSeen: false };
      spectrum.begin();
      for (const event of melody.events) {
        event.notes.forEach((note, index) => pianoTone(note, active.start + event.at, event.duration, event.velocity, event.final ? finalOutputs[index] : output));
      }
      busy = false;
      updateUI();
      status.textContent = state.phase === 'intro' ? 'Звучит небольшая мелодия.' : 'Звучит мелодия без ошибки.';
      frame = requestAnimationFrame(animateKeys);
    } catch {
      if (token !== generation) return;
      stop();
      error.textContent = 'Не удалось включить звук. Попробуйте ещё раз или продолжайте чтение.';
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

  button.addEventListener('click', play);
  skip.addEventListener('click', () => {
    stop();
    clearEffects();
    error.textContent = '';
    state = skipListening(state);
    updateUI();
    document.querySelector('#listening-lead').focus({ preventScroll: true });
  });
  updateUI();

  return {
    updateScroll() {
      const visible = state.phase !== 'intro' && finalStep.getBoundingClientRect().top <= innerHeight * .15;
      if (visible !== finalStepVisible) updateUI();
      else updateSpectrumFocus();
    },
    stop() { releaseAll(); stop(); clearEffects(); },
    reset() {
      releaseAll();
      stop();
      clearEffects();
      state = createListeningState();
      lastCompletedVersion = undefined;
      spectrum.reset();
      error.textContent = '';
      status.textContent = '';
      updateUI();
    },
    motionChanged() { if (reducedMotion.matches) clearEffects(); }
  };
}
