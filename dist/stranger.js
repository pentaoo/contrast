// Тритон лежит на белом экране рядом с кругом и квадратом. При прокрутке
// волны его мира заливают экран: теперь чужие — круг и квадрат.
// Контекст влияет на контраст.

export const seaTiming = { rise: [.2, .62], textA: [.14, .28], textB: [.6, .72] };

const ramp = (value, [from, to]) => Math.min(1, Math.max(0, (value - from) / (to - from)));

export function seaAt(progress) {
  return {
    level: ramp(progress, seaTiming.rise),
    first: 1 - ramp(progress, seaTiming.textA),
    second: ramp(progress, seaTiming.textB)
  };
}

// A trochoid gives sharp crests and round troughs, like engraved sea waves.
export function crestPath(width, wavelength, radius, baseline, height) {
  const k = 2 * Math.PI / wavelength;
  const points = [];
  for (let t = -wavelength; ; t += 3) {
    const x = t - radius * .9 * Math.sin(k * t);
    points.push([x, baseline + radius * Math.cos(k * t)]);
    if (x > width + wavelength) break;
  }
  const line = (dy) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${(y + dy).toFixed(1)}`).join('');
  return { body: `${line(0)}L${width + wavelength} ${height}L${-wavelength} ${height}Z`, foam: line(-3), line: line(9) };
}

export function mountStranger(section, { reducedMotion, isStatic }) {
  const scroll = section.querySelector('.stranger-scroll');
  const sea = section.querySelector('.sea');
  const frames = [...section.querySelectorAll('.stranger-triton img')];
  const ns = 'http://www.w3.org/2000/svg';
  // Three layers of water, each with its own crest and drift speed. The crest is
  // drawn twice as wide as the screen and every wavelength divides 1440, so a
  // drift by half its width loops without a seam.
  [[180, 15, 'far'], [240, 20, 'mid'], [160, 12, 'near']].forEach(([wavelength, radius, depth]) => {
    const layer = document.createElement('div');
    layer.className = `sea-layer sea-layer--${depth}`;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'sea-crest');
    svg.setAttribute('viewBox', '0 0 2880 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const shape = crestPath(2880, wavelength, radius, 40, 100);
    [['sea-body', shape.body], ['sea-foam', shape.foam], ['sea-line', shape.line]].forEach(([name, d]) => {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('class', name);
      path.setAttribute('d', d);
      svg.append(path);
    });
    layer.append(svg);
    sea.append(layer);
  });

  // Two drawings swap with a hard cut, like the paper cut-out in the fall.
  let frame = 0;
  let timer;
  function animate(on) {
    if (on && !timer && frames.length > 1) {
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length;
        frames.forEach((image, index) => { image.hidden = index !== frame; });
      }, 420);
    } else if (!on && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function update() {
    const rect = scroll.getBoundingClientRect();
    const still = reducedMotion.matches || isStatic();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - innerHeight)));
    // Without motion both texts stand in a column and the sea fills only the scene.
    const state = still ? { level: 1, first: 1, second: 1 } : seaAt(progress);
    section.classList.toggle('is-still', still);
    section.style.setProperty('--sea', state.level.toFixed(4));
    section.style.setProperty('--text-a', state.first.toFixed(3));
    section.style.setProperty('--text-b', state.second.toFixed(3));
    section.classList.toggle('is-sea', !still && state.level > .5);
    animate(!still && rect.bottom > 0 && rect.top < innerHeight);
  }

  return { update };
}
