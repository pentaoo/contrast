import { createListeningState, finishSample, respondToSample, skipListening, impressions } from './listening.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.add('js-enabled');
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('intro-ready')));

// Each scene enters as a unit; changes inside it follow its own sequence.
if ('IntersectionObserver' in window) {
  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add('is-entered');
      sceneObserver.unobserve(target);
    });
  }, { threshold: .02, rootMargin: '0px 0px -12% 0px' });
  $$('.scene').forEach((scene) => sceneObserver.observe(scene));
} else {
  $$('.scene').forEach((scene) => scene.classList.add('is-entered'));
}

for (let index = 0; index < 72; index++) $('#dot-field').append(document.createElement('i'));
$('#hierarchy-toggle').addEventListener('click', () => {
  const ordered = $('#poster').classList.toggle('is-ordered');
  $('#hierarchy-toggle').setAttribute('aria-pressed', String(ordered));
  $('#hierarchy-toggle').innerHTML = ordered ? 'Убрать иерархию <span aria-hidden="true">↙</span>' : 'Добавить иерархию <span aria-hidden="true">↗</span>';
  $('#hierarchy-description').textContent = ordered ? 'Контраст подсказывает, что читать первым. Через масштаб, вес и пространство.' : 'Теперь всё одного веса. Глазу снова приходится искать начало.';
});

// Listening is sequential, without grading the visitor's subjective impression.
let listening = createListeningState();
let selectedInterval = 'third';
let playing = false;
let audioBusy = false;
let audioContext;
let voices = [];
let stopTimer;
let audioGeneration = 0;
let spectrumFrame = 0;
let spectrumPhase = 0;
let animationStart = 0;
const intervals = { third: 329.6276, second: 277.1826 };
const canvas = $('#spectrum-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth = 0;
let canvasHeight = 0;

function updateListeningUI() {
  const done = listening.revealed;
  const second = listening.step === 1;
  const compared = listening.responses.every(Boolean);
  $('#listening-prompt').textContent = done ? compared ? 'Две пары. Два ощущения.' : 'Сравните две пары.' : second ? 'Теперь послушайте вторую.' : 'Послушайте первую пару.';
  $('#listening-instruction').textContent = done ? compared ? 'Важна разница, которую услышали вы.' : 'Или прочитайте, чем отличаются эти созвучия.' : second ? 'Сравните её с первой. Что изменилось?' : 'Две ноты одновременно. Как они звучат для вас?';
  $('#play-sound').hidden = done;
  $('#play-sound').disabled = audioBusy;
  $('#play-sound').setAttribute('aria-pressed', String(playing && !done));
  $('.play-icon').textContent = playing ? '■' : '▶';
  $('.play-label').textContent = playing ? 'Остановить' : listening.heard[listening.step] ? 'Послушать ещё раз' : second ? 'Послушать вторую пару' : 'Послушать первую пару';
  $('#response-panel').hidden = done || !listening.heard[listening.step] || playing || audioBusy;
  $('#skip-audio').hidden = done;
  $('#sound-explanation').hidden = !done;
  if (done) {
    $('#listening-result').textContent = listening.responses.every(Boolean)
      ? `Вы отметили: первая пара — ${impressions[listening.responses[0]]}, вторая — ${impressions[listening.responses[1]]}.`
      : 'Можно сравнить пары ниже — в любом порядке.';
  }
  $$('[data-replay]').forEach((button) => button.setAttribute('aria-pressed', String(playing && selectedInterval === button.dataset.replay)));
  $('#sound-lab').dataset.step = done ? 'complete' : second ? 'second' : 'first';
}

// Two enlarged fundamental peaks; widths are illustrative, not measured spectra.
function drawSpectrum(phase = 0) {
  if (!ctx || !canvasWidth || !canvasHeight) return;
  const width = canvasWidth;
  const height = canvasHeight;
  const baseline = height - 4;
  ctx.clearRect(0, 0, width, height);
  const bands = Math.max(65, Math.round(width / 6));
  const bandWidth = width / bands;
  const levels = [261.6256, intervals[selectedInterval]].map((center, noteIndex) => {
    return Array.from({ length: bands }, (_, index) => {
      const frequency = 200 + (index + .5) / bands * 200;
      const distance = (frequency - center) / 11;
      const motion = playing ? .97 + Math.sin(phase * 2 + index * .15 + noteIndex) * .03 : 1;
      return Math.exp(-.5 * distance * distance) * motion * height * .87;
    });
  });
  levels.forEach((spectrum, noteIndex) => {
    ctx.fillStyle = noteIndex ? '#d1d6be' : '#ee492c';
    ctx.globalAlpha = noteIndex ? .7 : .9;
    spectrum.forEach((barHeight, index) => {
      if (barHeight < .6) return;
      ctx.fillRect(index * bandWidth + 1, baseline - barHeight, Math.max(1, bandWidth - 2), barHeight);
    });
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f4e0b1';
  levels[0].forEach((first, index) => {
    const overlap = Math.min(first, levels[1][index]);
    if (overlap > 2) ctx.fillRect(index * bandWidth + 1, baseline - overlap, Math.max(1, bandWidth - 2), overlap);
  });
}

function resizeCanvas() {
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSpectrum(spectrumPhase);
}

function animateSpectrum(timestamp) {
  if (!playing || reducedMotion.matches || document.hidden) return;
  if (!animationStart) animationStart = timestamp;
  spectrumPhase = (timestamp - animationStart) * .0012;
  drawSpectrum(spectrumPhase);
  spectrumFrame = requestAnimationFrame(animateSpectrum);
}

function stopVoices() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  voices.forEach(({ oscillator, gain }) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, .025);
    oscillator.stop(now + .15);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
  voices = [];
}

function startVoices() {
  stopVoices();
  const now = audioContext.currentTime;
  const real = new Float32Array(9);
  const imaginary = new Float32Array([0, 1, .3, .17, .1, .06, .04, .025, .015]);
  const wave = audioContext.createPeriodicWave(real, imaginary);
  [261.6256, intervals[selectedInterval]].forEach((frequency) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.setPeriodicWave(wave);
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.065, now + .12);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    voices.push({ oscillator, gain });
  });
}

function stopAudio(completed = false) {
  audioGeneration++;
  clearTimeout(stopTimer);
  stopVoices();
  cancelAnimationFrame(spectrumFrame);
  const wasPlaying = playing;
  playing = false;
  audioBusy = false;
  if (completed && wasPlaying && !listening.revealed) listening = finishSample(listening);
  updateListeningUI();
  drawSpectrum();
  if (completed && !listening.revealed) $('#sound-status').textContent = 'Какое ощущение осталось? Можно выбрать ответ.';
}

async function playSample(interval) {
  if (audioBusy) return;
  if (playing && selectedInterval === interval) { stopAudio(); return; }
  stopAudio();
  const generation = ++audioGeneration;
  selectedInterval = interval;
  audioBusy = true;
  $('#audio-error').textContent = '';
  updateListeningUI();
  drawSpectrum();
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    audioContext ||= new Audio();
    await audioContext.resume();
    // A skip, hidden tab or reset may have cancelled the pending resume.
    if (generation !== audioGeneration) return;
    playing = true;
    audioBusy = false;
    animationStart = 0;
    startVoices();
    updateListeningUI();
    $('#sound-status').textContent = `Звучит ${interval === 'third' ? 'первая' : 'вторая'} пара. Четыре секунды.`;
    if (!reducedMotion.matches) spectrumFrame = requestAnimationFrame(animateSpectrum);
    stopTimer = setTimeout(() => stopAudio(true), 4000);
  } catch {
    if (generation !== audioGeneration) return;
    stopAudio();
    $('#audio-error').textContent = 'Не удалось включить звук. Попробуйте ещё раз или перейдите к объяснению.';
  }
}

function showExplanation() {
  updateListeningUI();
  $('#explanation-title').focus({ preventScroll: true });
  $('#sound-explanation').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  queueScrollUpdate();
}

$('#play-sound').addEventListener('click', () => playSample(listening.step === 1 ? 'second' : 'third'));
$$('[data-impression]').forEach((button) => button.addEventListener('click', () => {
  const next = respondToSample(listening, button.dataset.impression);
  if (next === listening) return;
  stopAudio();
  listening = next;
  if (listening.revealed) {
    showExplanation();
  } else {
    // Keep the second example unknown until its play action.
    updateListeningUI();
    $('#play-sound').focus({ preventScroll: true });
    $('#sound-status').textContent = 'Теперь послушайте вторую пару и сравните ощущения.';
  }
}));
$('#skip-audio').addEventListener('click', () => {
  stopAudio();
  $('#audio-error').textContent = '';
  listening = skipListening(listening);
  showExplanation();
});
$$('[data-replay]').forEach((button) => button.addEventListener('click', () => playSample(button.dataset.replay)));

const attention = $('#principle');
const feeling = $('#feeling');
const ending = $('#disappearance');
const veil = $('.restart-veil');
let scrollTicking = false;
let restartTimer;
let restarting = false;
let lastEndingProgress = 0;

function localProgress(element) {
  return clamp(-element.getBoundingClientRect().top / Math.max(1, element.offsetHeight - innerHeight));
}
function cancelRestart() {
  clearTimeout(restartTimer);
  restartTimer = undefined;
}
function updateScroll() {
  scrollTicking = false;
  const reduced = reducedMotion.matches;
  const staticScenes = reduced || matchMedia('(max-height: 600px)').matches;
  const attentionProgress = localProgress(attention);
  attention.classList.toggle('has-difference', staticScenes || attentionProgress > .10);
  attention.classList.toggle('has-insight', staticScenes || attentionProgress > .32);
  attention.classList.toggle('has-next', staticScenes || attentionProgress > .70);
  const feelingProgress = localProgress(feeling);
  const soft = staticScenes || feelingProgress > .23;
  feeling.classList.toggle('has-softness', soft);
  feeling.classList.toggle('has-story', staticScenes || feelingProgress > .45);
  $('.feeling-first').setAttribute('aria-hidden', String(soft));
  $('.feeling-second').setAttribute('aria-hidden', String(!soft));
  const total = root.scrollHeight - innerHeight;
  $('.reading-progress span').style.transform = `scaleX(${clamp(scrollY / Math.max(1, total))})`;
  const progress = localProgress(ending);
  lastEndingProgress = progress;
  ending.style.setProperty('--end-p', clamp(progress / .48).toFixed(4));
  ending.style.setProperty('--end-w', clamp((progress - .57) / .36).toFixed(4));
  ending.style.setProperty('--end-opacity', (1 - clamp((progress - .17) / .3)).toFixed(4));
  $('.reading-progress').style.opacity = String(1 - clamp((progress - .35) / .15));
  root.classList.toggle('ending-blank', progress > .48 && !reduced);
  if (progress > .97 && !reduced && !document.hidden && !restarting) {
    if (!restartTimer) restartTimer = setTimeout(() => {
      if (lastEndingProgress > .97 && !document.hidden) restartEssay();
    }, 1400);
  } else if (progress <= .97 || reduced) cancelRestart();
}
function queueScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScroll);
}
function resetExperiments() {
  $('#poster').classList.remove('is-ordered');
  $('#hierarchy-toggle').setAttribute('aria-pressed', 'false');
  $('#hierarchy-toggle').innerHTML = 'Добавить иерархию <span aria-hidden="true">↗</span>';
  $('#hierarchy-description').textContent = '';
  listening = createListeningState();
  selectedInterval = 'third';
  $('#audio-error').textContent = '';
  $('#sources').open = false;
  updateListeningUI();
  drawSpectrum();
}
function restartEssay() {
  if (restarting) return;
  restarting = true;
  cancelRestart();
  stopAudio();
  veil.classList.add('active');
  root.classList.remove('intro-ready');
  setTimeout(() => {
    resetExperiments();
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    scrollTo({ top: 0, behavior: 'instant' });
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    root.style.scrollBehavior = previous;
    $('#hero-title').setAttribute('tabindex', '-1');
    $('#hero-title').focus({ preventScroll: true });
    updateScroll();
    setTimeout(() => {
      veil.classList.remove('active');
      requestAnimationFrame(() => root.classList.add('intro-ready'));
      restarting = false;
    }, reducedMotion.matches ? 0 : 150);
  }, reducedMotion.matches ? 0 : 300);
}
$('#restart').addEventListener('click', restartEssay);
addEventListener('scroll', queueScrollUpdate, { passive: true });
addEventListener('resize', () => { resizeCanvas(); queueScrollUpdate(); }, { passive: true });
addEventListener('load', queueScrollUpdate);
addEventListener('pagehide', () => stopAudio());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopAudio(); cancelRestart(); }
  else queueScrollUpdate();
});
reducedMotion.addEventListener('change', () => {
  cancelAnimationFrame(spectrumFrame);
  if (playing && !reducedMotion.matches) spectrumFrame = requestAnimationFrame(animateSpectrum);
  queueScrollUpdate();
});
if ('ResizeObserver' in window) {
  new ResizeObserver(resizeCanvas).observe(canvas);
  new ResizeObserver(queueScrollUpdate).observe($('main'));
}
updateListeningUI();
resizeCanvas();
updateScroll();
