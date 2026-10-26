import { finalNotes, noteFrequency } from './melody.js?v=type-2';

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
  let lastLive = 0;
  let keyFraction = null;
  let layout = null;
  let peaks = null;
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

  // Horizontal axis. With the piano's key layout each peak stands over its own
  // key, also while the fundamentals are singled out.
  function axis() {
    const midi = (frequency) => 69 + 12 * Math.log2(frequency / 440);
    const toFrac = keyFraction ? (frequency) => keyFraction(midi(frequency)) : (frequency) => Math.log(frequency / 200) / Math.log(20);
    const toFreq = (fraction) => {
      let low = Math.log(30);
      let high = Math.log(16000);
      for (let step = 0; step < 30; step++) {
        const middle = (low + high) / 2;
        if (toFrac(Math.exp(middle)) < fraction) low = middle;
        else high = middle;
      }
      return Math.exp((low + high) / 2);
    };
    return { toFrac, toFreq };
  }

  function draw() {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const focused = shown?.length === 2 ? focus : 0;
    const { toFrac, toFreq } = axis();
    const minimum = toFreq(0);
    const maximum = toFreq(1);
    const xAt = (frequency) => toFrac(frequency) * width;
    const baseline = height - 28;
    const plotTop = annotations ? Math.min(30, baseline * .35) : 8;
    const plotHeight = Math.max(0, baseline - plotTop);
    const count = Math.max(90, Math.round(width / 4));
    layout = { toFrac, baseline, plotHeight, count, levels: new Float32Array(count) };
    ctx.strokeStyle = '#a8af992b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseline + .5);
    ctx.lineTo(width, baseline + .5);
    ctx.stroke();
    ctx.fillStyle = '#c8cdbf';
    ctx.font = '14px Manrope, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(minimum)} Гц`, 0, height);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(maximum)} Гц`, width, height);
    if (!shown || !audio) return;
    const barWidth = width / count;
    const hzPerBin = audio.sampleRate / master.fftSize;
    const fundamentals = version ? finalNotes(version).map(noteFrequency) : [];
    const edges = Array.from({ length: count + 1 }, (_, bar) => toFreq(bar / count));
    shown.forEach((data, channel) => {
      const color = shown.length === 1 ? '#f1f0eb' : colors[channel];
      // The bars fade towards the floor; a bright cap marks each level.
      const fill = ctx.createLinearGradient(0, plotTop, 0, baseline);
      fill.addColorStop(0, color);
      fill.addColorStop(1, `${color}22`);
      for (let bar = 0; bar < count; bar++) {
        let db = -Infinity;
        let peakFrequency = 0;
        for (let bin = Math.floor(edges[bar] / hzPerBin); bin <= Math.ceil(edges[bar + 1] / hzPerBin); bin++) {
          if (data[bin] > db) { db = data[bin]; peakFrequency = bin * hzPerBin; }
        }
        const fundamental = shown.length === 2 && Math.abs(peakFrequency - fundamentals[channel]) <= Math.max(8, hzPerBin * 3);
        // Singling out the fundamentals: they grow in place, the rest shrinks in place.
        const level = Math.max(0, Math.min(1, (db + 100) / 40 * .85 * (fundamental ? 1 + focused * .5 : 1 - focused * .8)));
        layout.levels[bar] = Math.max(layout.levels[bar], level);
        if (level <= .015) continue;
        const x = bar * barWidth;
        const top = baseline - level * plotHeight;
        const barSize = Math.max(1, barWidth - 1);
        ctx.globalAlpha = shown.length === 1 ? .78 : .85 * (fundamental ? 1 : 1 - focused * .5);
        ctx.fillStyle = fill;
        ctx.fillRect(x, top, barSize, level * plotHeight);
        ctx.fillStyle = color;
        ctx.fillRect(x, top, barSize, 2);
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
      callout('Обертоны', xAt(1000), 1 - focused * .5);
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
      ? `Выделены основные тона двух нот: ${version === 'mistake' ? 'до и ре-бемоль' : 'два до в октаву'}. Обертоны уменьшены и остались на своих местах.`
      : version === 'mistake'
      ? 'Спектры двух нот: до и ре-бемоль. Пики основных тонов и обертонов стоят рядом.'
      : version === 'correct' ? 'Спектры двух до в октаву. Некоторые обертоны совпадают по частоте.'
      : 'Измеренный спектр звучащей мелодии. Пики стоят над своими клавишами.');
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
    // The piano passes its key layout: a MIDI note (fractional too) → 0…1 of the width.
    setAxis(fraction) { keyFraction = fraction; draw(); },
    // Where a frequency stands on the drawn graph: x and the top of its bar, in px.
    point(frequency) {
      if (!layout || !width) return null;
      const fraction = layout.toFrac(frequency);
      const bar = Math.max(0, Math.min(layout.count - 1, Math.floor(fraction * layout.count)));
      const level = Math.max(layout.levels[bar - 1] || 0, layout.levels[bar], layout.levels[bar + 1] || 0);
      return { x: fraction * width, y: layout.baseline - level * layout.plotHeight, floor: layout.baseline, width };
    },
    setFocus(showAnnotations, amount) {
      const next = reducedMotion.matches ? Number(amount >= .5) : Math.max(0, Math.min(1, amount));
      if (annotations === showAnnotations && Math.abs(next - focus) < .002) return;
      annotations = showAnnotations;
      focus = next;
      label(version);
      draw();
    },
    // Free play: the whole measured output, named by the keys being held.
    live(description) {
      if (!master) return;
      caption.textContent = description || 'Частоты звучащих нот';
      canvas.dataset.version = 'free';
      canvas.setAttribute('aria-label', description ? `Измеренный спектр сыгранных нот: ${description.toLowerCase()}.` : 'Измеренный спектр сыгранных нот.');
      if (reducedMotion.matches) return;
      const now = performance.now();
      if (now - lastLive < 1000 / 30) return;
      lastLive = now;
      master.getFloatFrequencyData(buffers[0]);
      shown = [buffers[0]];
      version = null;
      draw();
    },
    begin() { shown = null; peaks = null; lastFrame = -Infinity; label(null); draw(); },
    update(elapsed, version, finalAt, capture = true) {
      if (!master || elapsed < 0) return null;
      const final = elapsed >= finalAt;
      // With reduced motion, show one static measured frame of the final pair.
      if (reducedMotion.matches && (!final || elapsed < finalAt + .45 || lastFrame >= finalAt)) return null;
      if (!reducedMotion.matches && elapsed - lastFrame < 1 / 30) return null;
      let settled = false;
      if (final) {
        // Once the analysis window holds only the final pair, its bars stop
        // following the fade: the sound dies away, the measured peaks stay.
        pair.forEach((node, index) => node.getFloatFrequencyData(buffers[index + 1]));
        settled = elapsed >= finalAt + .4;
        if (settled) {
          peaks ||= pair.map((node) => new Float32Array(node.frequencyBinCount).fill(-Infinity));
          peaks.forEach((peak, index) => buffers[index + 1].forEach((db, bin) => { if (db > peak[bin]) peak[bin] = db; }));
        }
      } else master.getFloatFrequencyData(buffers[0]);
      shown = !final ? [buffers[0]] : settled ? peaks : buffers.slice(1);
      label(final ? version : null);
      draw();
      lastFrame = elapsed;
      return capture && final && elapsed >= finalAt + .45 ? shown.map((data) => data.slice()) : null;
    },
    finish(snapshot, version) {
      if (peaks) held = { data: peaks.map((data) => data.slice()), version };
      else if (snapshot) held = { data: snapshot, version };
      this.restore();
    },
    restore() { shown = held?.data || null; label(held?.version); draw(); },
    reset() { held = null; shown = null; annotations = false; focus = 0; label(null); draw(); }
  };
}

