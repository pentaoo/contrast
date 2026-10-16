(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (number, min = 0, max = 1) => Math.min(max, Math.max(min, number));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.add('js-enabled');

  // Reveals follow the reading order and never hide the document without JS.
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
    reveals.forEach((element) => revealObserver.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add('is-visible'));
  }

  const field = $('#dot-field');
  for (let index = 0; index < 72; index++) field.append(document.createElement('i'));

  $('#illusion-toggle').addEventListener('click', () => {
    const revealed = $('#illusion').classList.toggle('is-revealed');
    $('#illusion-toggle').setAttribute('aria-pressed', String(revealed));
    $('#illusion-toggle').innerHTML = revealed ? 'Да, одинаковые <span>↙</span>' : 'Они одного цвета? <span>↗</span>';
    $('#illusion-caption').textContent = revealed ? 'Оба круга — #858580. Отличается только фон.' : '';
  });

  $('#hierarchy-toggle').addEventListener('change', (event) => {
    const enabled = event.target.checked;
    $('#poster').classList.toggle('no-hierarchy', !enabled);
    $('#hierarchy-description').textContent = enabled ? 'Разница в масштабе, весе и цвете подсказывает, что читать первым.' : 'Теперь всё одного веса. Глазу приходится самому искать, за что зацепиться.';
  });

  let rhythmTimer;
  const rhythm = $('#rhythm-track');
  function playRhythm() {
    clearTimeout(rhythmTimer);
    rhythm.classList.remove('has-surprise');
    rhythmTimer = setTimeout(() => rhythm.classList.add('has-surprise'), reducedMotion.matches ? 0 : 650);
  }
  $('#rhythm-replay').addEventListener('click', playRhythm);
  if ('IntersectionObserver' in window) {
    const artObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('in-view', entry.isIntersecting);
        if (entry.isIntersecting && entry.target === rhythm && !rhythm.dataset.played) {
          rhythm.dataset.played = 'true';
          playRhythm();
        }
      });
    }, { threshold: 0.3 });
    artObserver.observe($('#feeling-art'));
    artObserver.observe(rhythm);
  } else {
    rhythm.classList.add('has-surprise');
  }

  // Frequency centers match playback. Peak width/height are schematic,
  // not an FFT measurement or a quantitative model of dissonance.
  const canvas = $('#spectrum-canvas');
  const ctx = canvas.getContext('2d');
  const intervals = {
    third: { frequency: 329.6276, label: 'Ми · E₄', description: 'Большая терция: некоторые обертоны почти совпадают. Сравните со звучанием малой секунды.' },
    second: { frequency: 277.1826, label: 'Ре♭ · D♭₄', description: 'Малая секунда: пики основных тонов стоят тесно, как и многие пары обертонов.' }
  };
  let selectedInterval = 'third';
  let canvasWidth = 0;
  let canvasHeight = 0;
  let spectrumPhase = 0;
  let spectrumFrame = 0;
  let playing = false;
  let audioContext;
  let voices = [];
  let stopTimer;
  let audioBusy = false;
  let animationStart = 0;

  const harmonicAmplitudes = [1, 0.3, 0.17, 0.1, 0.06, 0.04, 0.025, 0.015];
  function drawSpectrum(phase = 0) {
    if (!ctx || !canvasWidth || !canvasHeight) return;
    const width = canvasWidth;
    const height = canvasHeight;
    ctx.clearRect(0, 0, width, height);
    const low = 125;
    const high = 4000;
    const logRange = Math.log(high / low);
    const baseline = height - 8;
    const xForFrequency = (frequency) => Math.log(frequency / low) / logRange * width;

    ctx.strokeStyle = '#d1d6be12';
    ctx.lineWidth = 1;
    [125, 250, 500, 1000, 2000, 4000].forEach((frequency) => {
      const x = xForFrequency(frequency);
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, baseline);
      ctx.stroke();
    });
    for (let row = 1; row < 5; row++) {
      const y = baseline - row * height * 0.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const bands = Math.max(72, Math.round(width / 6));
    const bandWidth = width / bands;
    const frequencies = [261.6256, intervals[selectedInterval].frequency];
    const levels = frequencies.map((fundamental, noteIndex) => {
      return Array.from({ length: bands }, (_, index) => {
        const frequency = low * Math.exp((index + 0.5) / bands * logRange);
        let energy = 0;
        harmonicAmplitudes.forEach((amplitude, harmonicIndex) => {
          const center = fundamental * (harmonicIndex + 1);
          const spread = 14 + center * 0.021;
          const distance = (frequency - center) / spread;
          energy += Math.exp(-0.5 * distance * distance) * Math.pow(amplitude, 0.48);
        });
        const motion = playing ? 0.96 + Math.sin(phase * 2 + index * 0.24 + noteIndex) * 0.04 : 1;
        return clamp(energy) * motion * height * 0.84;
      });
    });

    // Overlay two bar spectra; their shared areas become a third, lighter color.
    levels.forEach((spectrum, noteIndex) => {
      ctx.fillStyle = noteIndex === 0 ? '#ee492c' : '#d1d6be';
      ctx.globalAlpha = noteIndex === 0 ? 0.88 : 0.70;
      for (let index = 0; index < bands; index++) {
        const barHeight = Math.max(1, spectrum[index]);
        ctx.fillRect(index * bandWidth + 1, baseline - barHeight, Math.max(1, bandWidth - 2), barHeight);
      }
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4e0b1';
    for (let index = 0; index < bands; index++) {
      const overlap = Math.min(levels[0][index], levels[1][index]);
      if (overlap > 3) ctx.fillRect(index * bandWidth + 1, baseline - overlap, Math.max(1, bandWidth - 2), overlap);
    }
    ctx.strokeStyle = '#d1d6be40';
    ctx.beginPath();ctx.moveTo(0,baseline + 1);ctx.lineTo(width,baseline + 1);ctx.stroke();
  }

  function resizeCanvas() {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    spectrumPhase = (timestamp - animationStart) * 0.0012;
    drawSpectrum(spectrumPhase);
    spectrumFrame = requestAnimationFrame(animateSpectrum);
  }

  function stopVoices() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    voices.forEach(({ oscillator, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.025);
      oscillator.stop(now + 0.15);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
    voices = [];
  }

  function startVoices() {
    stopVoices();
    const now = audioContext.currentTime;
    // Gentle harmonic tones make the comparison audible without a loud attack.
    const real = new Float32Array(9);
    const imaginary = new Float32Array([0, 1, 0.3, 0.17, 0.1, 0.06, 0.04, 0.025, 0.015]);
    const wave = audioContext.createPeriodicWave(real, imaginary);
    [261.6256, intervals[selectedInterval].frequency].forEach((frequency) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.setPeriodicWave(wave);
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.12);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      voices.push({ oscillator, gain });
    });
  }

  function stopAudio() {
    clearTimeout(stopTimer);
    stopVoices();
    playing = false;
    cancelAnimationFrame(spectrumFrame);
    $('.sound-lab').classList.remove('is-playing');
    $('#play-sound').setAttribute('aria-pressed', 'false');
    $('.play-label').textContent = 'Послушать';
    $('.play-icon').textContent = '▶';
    $('#sound-status').textContent = 'Воспроизведение остановлено.';
  }

  $('#play-sound').addEventListener('click', async () => {
    if (audioBusy) return;
    if (playing) { stopAudio(); return; }
    audioBusy = true;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      audioContext ||= new Audio();
      await audioContext.resume();
      playing = true;
      animationStart = 0;
      startVoices();
      $('.sound-lab').classList.add('is-playing');
      $('#play-sound').setAttribute('aria-pressed', 'true');
      $('.play-label').textContent = 'Остановить';
      $('.play-icon').textContent = '■';
      $('#sound-status').textContent = `Звучит ${selectedInterval === 'third' ? 'большая терция' : 'малая секунда'}. Воспроизведение остановится через 4 секунды.`;
      if (!reducedMotion.matches) spectrumFrame = requestAnimationFrame(animateSpectrum);
      stopTimer = setTimeout(stopAudio, 4000);
    } catch (error) {
      stopAudio();
      $('.play-label').textContent = 'Повторить';
      $('#sound-status').textContent = 'Не удалось включить звук. Попробуйте ещё раз в браузере с поддержкой Web Audio.';
    } finally {
      audioBusy = false;
    }
  });

  $$('[data-interval]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedInterval = button.dataset.interval;
      $$('[data-interval]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      const interval = intervals[selectedInterval];
      $('#second-note').innerHTML = `${interval.label} <span class="spectrum-frequency">${interval.frequency.toFixed(2).replace('.', ',')} Гц</span>`;
      $('#interval-description').textContent = interval.description;
      drawSpectrum(spectrumPhase);
      if (playing) {
        startVoices();
        clearTimeout(stopTimer);
        stopTimer = setTimeout(stopAudio, 4000);
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAudio();
      cancelRestart();
    } else {
      updateScroll();
    }
  });
  window.addEventListener('pagehide', stopAudio);
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
  else window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Scroll erases shape differences, then luminance differences, then the page.
  const ending = $('#disappearance');
  const veil = $('.restart-veil');
  const progress = $('.reading-progress span');
  let restartTimer;
  let restarting = false;
  let scrollTicking = false;
  let lastEndingProgress = 0;

  function cancelRestart() {
    clearTimeout(restartTimer);
    restartTimer = undefined;
  }

  function restartEssay() {
    if (restarting) return;
    restarting = true;
    cancelRestart();
    stopAudio();
    veil.classList.add('active');
    setTimeout(() => {
      const previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      document.documentElement.style.scrollBehavior = previousBehavior;
      $('#hero-title').setAttribute('tabindex', '-1');
      $('#hero-title').focus({ preventScroll: true });
      $('#sound-status').textContent = 'Всё начинается заново. Начало эссе.';
      requestAnimationFrame(() => {
        updateScroll();
        setTimeout(() => {
          veil.classList.remove('active');
          restarting = false;
        }, reducedMotion.matches ? 0 : 250);
      });
    }, reducedMotion.matches ? 0 : 350);
  }

  function updateScroll() {
    scrollTicking = false;
    const y = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${clamp(y / Math.max(1, total))})`;
    const local = clamp((y - ending.offsetTop) / Math.max(1, ending.offsetHeight - window.innerHeight));
    lastEndingProgress = local;
    const dissolve = clamp(local / 0.48);
    const whiten = clamp((local - 0.57) / 0.36);
    const contentOpacity = 1 - clamp((local - 0.17) / 0.30);
    ending.style.setProperty('--end-p', dissolve.toFixed(4));
    ending.style.setProperty('--end-w', whiten.toFixed(4));
    ending.style.setProperty('--end-opacity', contentOpacity.toFixed(4));
    // Even the progress line disappears from the final white frame.
    $('.reading-progress').style.opacity = String(1 - clamp((local - 0.35) / 0.15));
    document.documentElement.classList.toggle('ending-blank', local > 0.48 && !reducedMotion.matches);
    if (local > 0.97 && !reducedMotion.matches && !document.hidden && !restarting) {
      if (!restartTimer) restartTimer = setTimeout(() => {
        if (lastEndingProgress > 0.97 && !document.hidden) restartEssay();
      }, 1400);
    } else if (local <= 0.97 || reducedMotion.matches) {
      cancelRestart();
    }
  }

  $('#restart').addEventListener('click', restartEssay);
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateScroll);
  }, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(spectrumFrame);
    if (playing && !reducedMotion.matches) spectrumFrame = requestAnimationFrame(animateSpectrum);
    updateScroll();
  });
  window.addEventListener('load', updateScroll);
  updateScroll();
})();
