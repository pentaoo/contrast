// Родилась она. Пролог идёт от прокрутки: каждая надпись выезжает снизу
// и уходит вверх. За словами про «хорошо» и «плохо» поднимается чёрный квадрат,
// он мягко распадается на формы, формы разлетаются, их место занимает узор
// из мелких форм, и узор становится полем одинаковых точек — тем самым,
// с которого начинается мультфильм. Одна из них — она.

const SVG = 'http://www.w3.org/2000/svg';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (t) => t * t * (3 - 2 * t);
const span = (p, from, to) => ease(clamp((p - from) / (to - from)));
const mix = (a, b, t) => a + (b - a) * t;

// Окна надписей: [появление, стоит, уходит]. После пустого экрана — «Родилась она».
export const ORIGIN_TEXTS = [
  [.03, .1, .17],
  [.19, .26, .36],
  [.4, .47, .56],
  [.6, .67, .76],
  [.84, .92, 2],
];
export const ORIGIN_PHASES = {
  square: [.25, .35], // квадрат поднимается снизу
  split: [.37, .5], // квадрат распадается на три формы
  fly: [.56, .66], // формы разлетаются вверх
  pattern: [.6, .72], // узор из мелких форм поднимается снизу
  dots: [.76, .9], // узор становится полем точек
};

export function originFrame(progress) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const texts = ORIGIN_TEXTS.map(([enter, hold, leave], index) => {
    const rise = span(p, enter, hold);
    const gone = index === ORIGIN_TEXTS.length - 1 ? 0 : span(p, leave - .02, leave + .04);
    return { y: (1 - rise) * .35 - gone * .35, opacity: rise * (1 - gone) };
  });
  return {
    progress: p,
    texts,
    square: span(p, ...ORIGIN_PHASES.square),
    split: span(p, ...ORIGIN_PHASES.split),
    fly: span(p, ...ORIGIN_PHASES.fly),
    pattern: span(p, ...ORIGIN_PHASES.pattern),
    dots: span(p, ...ORIGIN_PHASES.dots),
  };
}

// Контуры фигур одной длины: квадрат, круг и треугольник из одинакового числа
// точек, начиная с левого верхнего угла, — так одна фигура плавно перетекает в другую.
const POINTS = 48;
function outline(kind, n = POINTS) {
  const points = [];
  for (let index = 0; index < n; index += 1) {
    const t = index / n;
    if (kind === 'circle') {
      const angle = -Math.PI * .75 + t * Math.PI * 2;
      points.push([Math.cos(angle) * .5, Math.sin(angle) * .5]);
    } else {
      const corners = kind === 'square'
        ? [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]
        : [[0, -.5], [.5, .43], [-.5, .43]];
      const side = t * corners.length;
      const from = corners[Math.floor(side)];
      const to = corners[(Math.floor(side) + 1) % corners.length];
      const local = side - Math.floor(side);
      points.push([mix(from[0], to[0], local), mix(from[1], to[1], local)]);
    }
  }
  return points;
}
export const OUTLINES = { square: outline('square'), circle: outline('circle'), triangle: outline('triangle') };

export function morphPath(fromKind, toKind, t, cx, cy, size, angle = 0) {
  const from = OUTLINES[fromKind];
  const to = OUTLINES[toKind];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return from.map(([x0, y0], index) => {
    const x = mix(x0, to[index][0], t) * size;
    const y = mix(y0, to[index][1], t) * size;
    return `${index ? 'L' : 'M'}${(cx + x * cos - y * sin).toFixed(2)} ${(cy + x * sin + y * cos).toFixed(2)}`;
  }).join('') + 'Z';
}

function parseColor(value) {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) || 0);
}
const rgb = (a, b, t) => `rgb(${a.map((value, index) => Math.round(mix(value, b[index], t))).join(' ')})`;

export function mountOrigin(section, { reducedMotion, isStatic }) {
  const scroll = section.querySelector('.origin-scroll');
  const stage = section.querySelector('.origin-stage');
  const texts = [...section.querySelectorAll('.origin-text')];
  const svg = section.querySelector('.origin-canvas');
  const create = (name, attributes = {}) => {
    const node = document.createElementNS(SVG, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  // Узор: плитка 2×2 — чёрный круг, квадрат, треугольник, маленький круг.
  const pattern = create('pattern', { id: 'origin-pattern', patternUnits: 'userSpaceOnUse' });
  const cells = [
    { kind: 'circle', color: '#191a17', size: .62 },
    { kind: 'square', color: '#a8af99', size: .44 },
    { kind: 'triangle', color: '#c0c2b6', size: .5 },
    { kind: 'circle', color: '#a8af99', size: .3 },
  ].map((cell) => ({ ...cell, rgb: parseColor(cell.color), node: create('path') }));
  pattern.append(...cells.map((cell) => cell.node));
  const defs = create('defs');
  defs.append(pattern);
  const field = create('rect', { fill: 'url(#origin-pattern)', x: 0, width: '100%' });
  const shapes = ['circle', 'square', 'triangle'].map((kind) => ({ kind, node: create('path', { class: 'origin-form' }) }));
  svg.append(defs, field, ...shapes.map((shape) => shape.node));

  let fieldSpec = null;
  let lastKey = '';

  function draw(frame) {
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    if (!width || !height) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    // Квадрат поднимается в нижнюю половину экрана, распадается на три формы, они разлетаются вверх.
    const big = Math.min(width * .34, height * .34);
    const small = clamp(width * .12, 56, 180);
    const centerY = height * .7;
    const offsets = [-1, 0, 1];
    const flyTo = [[-.9, -1.3], [.1, -1.5], [1, -1.25]];
    shapes.forEach((shape, index) => {
      const spread = offsets[index] * Math.min(width * .26, 340);
      const x = mix(width / 2, width / 2 + spread, frame.split) + flyTo[index][0] * width * .6 * frame.fly;
      const y = mix(height + big, centerY, frame.square) + flyTo[index][1] * height * frame.fly;
      const size = mix(big, small, frame.split);
      const angle = offsets[index] * frame.fly * 1.2;
      shape.node.setAttribute('d', morphPath('square', shape.kind, frame.split, x, y, size, angle));
      shape.node.setAttribute('visibility', frame.square > 0 && frame.fly < 1 ? 'visible' : 'hidden');
    });
    // Узор поднимается снизу; потом каждая ячейка плавно становится серой точкой поля мультфильма.
    const finalCell = fieldSpec?.period ?? 11;
    const cell = mix(clamp(width / 22, 30, 72), finalCell, frame.dots);
    const dotSize = (fieldSpec?.r ?? 1.4) * 2;
    const grey = parseColor(getComputedStyle(section).getPropertyValue('--dot') || '#c0c2b6');
    const originX = fieldSpec ? fieldSpec.x - finalCell / 2 : 0;
    const originY = fieldSpec ? fieldSpec.y + height - finalCell / 2 : 0;
    Object.entries({ x: originX, y: originY, width: cell * 2, height: cell * 2 }).forEach(([name, value]) => pattern.setAttribute(name, value.toFixed(3)));
    cells.forEach((item, index) => {
      const cx = (index % 2 + .5) * cell;
      const cy = (Math.floor(index / 2) + .5) * cell;
      const size = mix(item.size * cell, dotSize, frame.dots);
      item.node.setAttribute('d', morphPath(item.kind, 'circle', frame.dots, cx, cy, size));
      item.node.setAttribute('fill', rgb(item.rgb, grey, frame.dots));
    });
    // Пока идёт текст, узор занимает нижнюю половину экрана; точками он заливает весь экран.
    field.setAttribute('y', (height * (1 - .55 * frame.pattern) * (1 - frame.dots)).toFixed(2));
    field.setAttribute('height', height.toFixed(2));
    field.setAttribute('visibility', frame.pattern > 0 ? 'visible' : 'hidden');
  }

  function update() {
    const still = reducedMotion.matches || isStatic();
    section.classList.toggle('is-still', still);
    if (still) { lastKey = ''; return; }
    const rect = scroll.getBoundingClientRect();
    const frame = originFrame(-rect.top / Math.max(1, rect.height - innerHeight));
    const key = `${frame.progress.toFixed(4)}:${svg.clientWidth}x${svg.clientHeight}`;
    if (key === lastKey) return;
    lastKey = key;
    texts.forEach((text, index) => {
      const { y, opacity } = frame.texts[index];
      text.style.transform = `translateY(${(y * 100).toFixed(2)}svh)`;
      text.style.opacity = opacity.toFixed(3);
      text.style.visibility = opacity > 0 ? 'visible' : 'hidden';
    });
    draw(frame);
  }

  // Мультфильм сообщает, каким он видит поле в первом кадре: последний кадр пролога — то же поле.
  function setField(spec) {
    fieldSpec = spec;
    lastKey = '';
    update();
  }

  // Где пролог стоит на «Родилась она»: туда ведёт кнопка «читать».
  function titleScroll() {
    const top = scroll.getBoundingClientRect().top + scrollY;
    return top + ORIGIN_TEXTS[0][1] * (scroll.offsetHeight - innerHeight);
  }

  return { update, setField, titleScroll };
}
