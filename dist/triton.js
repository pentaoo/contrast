export const tritonNotes = [60, 66]; // C4 + F-sharp4: six semitones.
export const tritonTiming = { pause: .28, impact: .72, exit: 1.0, gone: 1.95, duration: 2.6, sustain: 1.7 };

export function createTritonSchedule(melodyDuration, reduced = false) {
  const start = melodyDuration + tritonTiming.pause;
  return {
    start,
    impact: start + (reduced ? 0 : tritonTiming.impact),
    duration: start + (reduced ? tritonTiming.sustain + .12 : tritonTiming.duration)
  };
}

// All visual changes and the scheduled dyad share the AudioContext clock.
export function tritonFrameAt(elapsed, reduced = false) {
  if (reduced) return { pose: 'rest', frame: 0, lift: 0, debris: 0, broken: true, gone: elapsed >= .7 };
  if (elapsed < tritonTiming.impact) {
    const step = Math.max(0, Math.floor(elapsed / .12));
    return { pose: 'fall', frame: step % 2, lift: 1 - (step / 6) ** 2, debris: 0, broken: false, gone: false };
  }
  const debris = (Math.max(0, Math.floor((elapsed - tritonTiming.impact - .08) / .1)) / 9) ** 2;
  if (elapsed < tritonTiming.exit) {
    return { pose: 'impact', frame: Number(elapsed >= .86), lift: 0, debris, broken: true, gone: false };
  }
  const step = Math.floor((elapsed - tritonTiming.exit) / .12);
  return { pose: 'rest', frame: step % 2, lift: -((step / 7) ** 2) * 1.8, debris, broken: true, gone: elapsed >= tritonTiming.gone };
}

export function mountTritonFinale({ lab, stage, piano, reducedMotion }) {
  const caption = document.querySelector('#triton-caption');
  const sprite = document.createElement('div');
  sprite.className = 'triton-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  stage.append(sprite);
  const frames = new Map();
  const anchors = {
    'fall-a': [.60, .91, 1], 'fall-b': [.66, .92, 1],
    'impact-a': [.59, .94, 1], 'impact-b': [.59, .94, 1],
    'rest-a': [.51, .45, .85], 'rest-b': [.51, .45, .85]
  };
  let prepared;
  let completed = false;
  let visibleKey;
  let dropDistance = 600;
  const intactLabel = piano.getAttribute('aria-label');

  function prepare() {
    if (prepared) return prepared;
    prepared = Promise.all(Object.entries(anchors).map(async ([key, [x, y, scale]]) => {
      let image = frames.get(key);
      if (!image) {
        image = new Image();
        image.alt = '';
        image.width = image.height = 1254;
        image.hidden = true;
        image.style.width = `${scale * 100}%`;
        image.style.transform = `translate(${-x * 100}%, ${-y * 100}%)`;
        image.src = new URL(`./assets/triton/triton-${key}.png`, import.meta.url).href;
        sprite.append(image);
        frames.set(key, image);
      }
      await image.decode();
    })).catch((error) => { prepared = undefined; throw error; });
    return prepared;
  }

  function render(elapsed, reduced = reducedMotion.matches) {
    const sample = tritonFrameAt(elapsed, reduced);
    const key = `${sample.pose}-${sample.frame ? 'b' : 'a'}`;
    if (key !== visibleKey) {
      frames.forEach((image, name) => { image.hidden = name !== key; });
      visibleKey = key;
    }
    lab.dataset.finale = completed ? 'done' : 'playing';
    lab.dataset.broken = String(sample.broken);
    stage.dataset.broken = String(sample.broken);
    stage.dataset.gone = String(sample.gone);
    stage.dataset.pose = sample.pose;
    sprite.style.transform = `translateY(${-sample.lift * dropDistance}px)`;
    stage.style.setProperty('--wreck-drop', `${sample.debris * dropDistance}px`);
    stage.style.setProperty('--wreck-spin', `${sample.debris * 24}deg`);
    caption.hidden = !sample.broken;
    piano.setAttribute('aria-label', sample.gone ? 'Клавиатура рассыпалась и исчезла вниз вслед за тритоном.' : sample.broken ? 'Тритон проломил клавиатуру.' : intactLabel);
    return { ...sample, drop: sample.debris * dropDistance, spin: sample.debris * 24 };
  }

  return {
    prepare,
    get completed() { return completed; },
    begin() {
      completed = false;
      visibleKey = undefined;
      dropDistance = Math.max(400, Math.min(800, innerHeight));
      render(0);
    },
    render,
    finish() { completed = true; render(tritonTiming.duration); },
    reset() {
      completed = false;
      visibleKey = undefined;
      lab.dataset.finale = 'idle';
      lab.dataset.broken = 'false';
      stage.dataset.broken = 'false';
      stage.dataset.gone = 'false';
      delete stage.dataset.pose;
      stage.style.removeProperty('--wreck-drop');
      stage.style.removeProperty('--wreck-spin');
      caption.hidden = true;
      frames.forEach((image) => { image.hidden = true; });
      piano.setAttribute('aria-label', intactLabel);
    }
  };
}
