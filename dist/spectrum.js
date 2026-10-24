import { finalNotes, noteFrequency } from './melody.js?v=contrast-comparison-7';

// The display uses measured FFT data. Peak proximity/overlap is not a model of
// roughness, and no noise or artificial broadening is added to either version.
export function mountSpectrum(canvas, caption, reducedMotion) {
  const ctx = canvas.getContext('2d');
  let audio;
  let master;
  let pair = [];
  let buffers = [];
  let width = 0;
  let height = 0;
  let shown = null;
  let held = null;
  let lastFrame = -Infinity;
  let focus = 0;
  let annotations = false;
  let version = null;
  const colors = ['#ee492c', '#a8af99'];

  function connect(context, normalOutput) {
    audio = context;
    const analyser = () => {
      const node = context.createAnalyser();
      node.fftSize = 16384;
      node.smoothingTimeConstant = 0;
      return node;
    };
    master = analyser();
    normalOutput.connect(master);
    master.connect(context.destination);
    pair = [analyser(), analyser()];
    buffers = [master, ...pair].map((node) => new Float32Array(node.frequencyBinCount));
    return pair.map((node) => {
      const filter = context.createBiquadFilter();
      filter.type = normalOutput.type;
      filter.frequency.value = normalOutput.frequency.value;
      filter.Q.value = normalOutput.Q.value;
      filter.connect(node);
      node.connect(master);
      return filter;
    });
  }

  function draw() {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const focused = shown?.length === 2 ? focus : 0;
    const minimum = 200 * (240 / 200) ** focused;
    const maximum = 4000 * (560 / 4000) ** focused;
    const xAt = (frequency) => Math.log(frequency / minimum) / Math.log(maximum / minimum) * width;
    const baseline = height - 28;
    const plotTop = annotations ? Math.min(30, baseline * .35) : 8;
    const plotHeight = Math.max(0, baseline - plotTop);
    ctx.strokeStyle = '#a8af992b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseline + .5);
    ctx.lineTo(width, baseline + .5);
    ctx.stroke();
    ctx.fillStyle = '#c8cdbf';
    ctx.font = '15px Manrope, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(minimum)} Гц`, 0, height);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(maximum)} Гц`, width, height);
    if (!shown || !audio) return;
    const count = Math.max(90, Math.round(width / 4));
    const barWidth = width / count;
    const hzPerBin = audio.sampleRate / master.fftSize;
    const fundamentals = version ? finalNotes(version).map(noteFrequency) : [];
    shown.forEach((data, channel) => {
      ctx.fillStyle = shown.length === 1 ? '#c8cdbf' : colors[channel];
      for (let bar = 0; bar < count; bar++) {
        const low = minimum * (maximum / minimum) ** (bar / count);
        const high = minimum * (maximum / minimum) ** ((bar + 1) / count);
        let db = -Infinity;
        let peakFrequency = 0;
        for (let bin = Math.floor(low / hzPerBin); bin <= Math.ceil(high / hzPerBin); bin++) {
          if (data[bin] > db) { db = data[bin]; peakFrequency = bin * hzPerBin; }
        }
        const fundamental = shown.length === 2 && Math.abs(peakFrequency - fundamentals[channel]) <= Math.max(8, hzPerBin * 3);
        const level = Math.max(0, Math.min(1, (db + 85) / 58 * (fundamental ? 1 + focused * .8 : 1)));
        ctx.globalAlpha = shown.length === 1 ? .7 : .8 * (fundamental ? 1 : 1 - focused);
        if (level > .015) ctx.fillRect(bar * barWidth, baseline - level * plotHeight, Math.max(1, barWidth - 1), level * plotHeight);
      }
    });
    ctx.globalAlpha = 1;
    if (annotations && fundamentals.length === 2) {
      const callout = (text, target, opacity = 1) => {
        const textWidth = ctx.measureText(text).width;
        const center = Math.max(textWidth / 2 + 4, Math.min(width - textWidth / 2 - 4, target));
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#191a17';
        ctx.fillRect(center - textWidth / 2 - 4, 0, textWidth + 8, 23);
        ctx.fillStyle = '#c8cdbf';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, center, 3);
        ctx.globalAlpha = 1;
      };
      callout('Основные тона', (xAt(fundamentals[0]) + xAt(fundamentals[1])) / 2);
      if (focused < .9) callout('Обертоны', xAt(1000), 1 - focused);
    }
  }

  function label(nextVersion) {
    version = nextVersion || null;
    caption.textContent = version === 'mistake' ? 'Первый финал'
      : version === 'correct' ? 'Второй финал' : 'Частоты звучащих нот';
    canvas.dataset.version = version || 'melody';
    canvas.dataset.focus = focus >= .99 ? 'fundamentals' : focus > 0 ? 'zooming' : 'full';
    canvas.dataset.annotations = String(annotations);
    canvas.setAttribute('aria-label', version && focus >= .99
      ? `Увеличенные основные тона двух нот: ${version === 'mistake' ? 'до и ре-бемоль' : 'два до в октаву'}. Обертоны скрыты. Шкала от 240 до 560 герц.`
      : version === 'mistake'
      ? 'Спектры двух нот: до и ре-бемоль. Близкие пики основных тонов и обертонов.'
      : version === 'correct' ? 'Спектры двух до в октаву. Некоторые гармоники совпадают по частоте.'
      : 'Измеренный спектр звучащей мелодии, от 200 до 4000 герц.');
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx?.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize, { passive: true });
  resize();
  label(null);

  return {
    connect,
    setFocus(showAnnotations, amount) {
      const next = reducedMotion.matches ? Number(amount >= .5) : Math.max(0, Math.min(1, amount));
      if (annotations === showAnnotations && Math.abs(next - focus) < .002) return;
      annotations = showAnnotations;
      focus = next;
      label(version);
      draw();
    },
    begin() { shown = null; lastFrame = -Infinity; label(null); draw(); },
    update(elapsed, version, finalAt, capture = true) {
      if (!master || elapsed < 0) return null;
      const final = elapsed >= finalAt;
      // With reduced motion, show one static measured frame of the final pair.
      if (reducedMotion.matches && (!final || elapsed < finalAt + .45 || lastFrame >= finalAt)) return null;
      if (!reducedMotion.matches && elapsed - lastFrame < 1 / 30) return null;
      if (final) pair.forEach((node, index) => node.getFloatFrequencyData(buffers[index + 1]));
      else master.getFloatFrequencyData(buffers[0]);
      shown = final ? buffers.slice(1) : [buffers[0]];
      label(final ? version : null);
      draw();
      lastFrame = elapsed;
      return capture && final && elapsed >= finalAt + .45 ? shown.map((data) => data.slice()) : null;
    },
    finish(snapshot, version) {
      if (snapshot) held = { data: snapshot, version };
      this.restore();
    },
    restore() { shown = held?.data || null; label(held?.version); draw(); },
    reset() { held = null; shown = null; annotations = false; focus = 0; label(null); draw(); }
  };
}

