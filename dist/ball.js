import { noteFrequency, secondsPerBeat } from './melody.js?v=dance-15';

// Бал: круг и маленький квадрат из первой истории танцуют на графике частот.
// Круг стоит на ноте мелодии, квадрат — на верхней ноте аккомпанемента.
// Мелодия всё время выше аккомпанемента, поэтому круг всегда правее квадрата
// и до финала они не наступают друг на друга.
// В финале с ре-бемолем круг берёт ре-бемоль, квадрат — до: они оказываются
// вплотную, дрожат и разбегаются;
// в финале с октавой квадрат стоит на верхнем до, а круг приходит к нему:
// основной тон верхнего до совпадает с первым обертоном нижнего.
export const danceTiming = { enter: .8, crowd: 1.3, flee: .7, merge: .6, confetti: .5 };

export function danceAt(elapsed, melody) {
  const final = melody.events.find((event) => event.final);
  if (elapsed >= final.at) {
    const [low, high] = final.notes;
    const time = elapsed - final.at;
    if (melody.version === 'mistake') {
      return time < danceTiming.crowd
        ? { mode: 'crowd', circle: high, square: low, progress: time / danceTiming.crowd }
        : { mode: 'flee', circle: high, square: low, progress: Math.min(1, (time - danceTiming.crowd) / danceTiming.flee) };
    }
    // The meeting point is the shared frequency: C5, the second harmonic of C4.
    return { mode: 'merge', circle: high, square: high, progress: Math.min(1, time / danceTiming.merge) };
  }
  let circle = null;
  let square = null;
  for (const event of melody.events) {
    if (event.at > elapsed) break;
    if (event.notes.length === 1) circle = event.notes[0];
    else square = Math.max(...event.notes);
  }
  return { mode: elapsed < danceTiming.enter ? 'enter' : 'dance', circle, square, progress: Math.min(1, elapsed / danceTiming.enter) };
}

// The circle stays to the right of the square, at least `gap` apart.
export function keepApart(circleX, squareX, gap) {
  if (circleX - squareX >= gap) return [circleX, squareX];
  const middle = (circleX + squareX) / 2;
  return [middle + gap / 2, middle - gap / 2];
}

export function mountBall({ floor, spectrum, reducedMotion }) {
  const make = (name) => {
    const element = document.createElement('i');
    element.className = `dancer dancer--${name}`;
    floor.append(element);
    return { element, x: 0, y: 0, angle: 0 };
  };
  const circle = make('circle');
  const square = make('square');
  const effects = new Set();
  let lastTime = 0;
  let celebrated = false;

  function size(dancer) {
    return dancer.element.getBoundingClientRect().width || 20;
  }

  function place(dancer, x, y, angle = 0) {
    dancer.x = x;
    dancer.y = y;
    dancer.angle = angle;
    dancer.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) rotate(${angle}deg)`;
  }

  function hide() {
    floor.dataset.state = 'hidden';
    floor.dataset.merged = 'false';
    effects.forEach((effect) => effect.cancel());
    effects.clear();
    document.querySelector('.confetti-layer')?.remove();
  }

  function celebrate() {
    const rect = square.element.getBoundingClientRect();
    if (reducedMotion.matches || document.hidden || rect.bottom <= 0 || rect.top >= innerHeight) return;
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    const colors = ['#ee492c', '#f1f0eb', '#a8af99'];
    const animations = [];
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    for (let index = 0; index < 44; index++) {
      const piece = document.createElement('i');
      piece.style.background = colors[index % colors.length];
      piece.style.left = `${originX}px`;
      piece.style.top = `${originY}px`;
      layer.append(piece);
      const angle = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.3;
      const distance = Math.min(innerWidth * .3, 260) * (.4 + Math.random() * .6);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rotation = (Math.random() - .5) * 900;
      const animation = piece.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
        { transform: `translate(${dx * .75}px, ${dy * .75}px) rotate(${rotation * .4}deg)`, opacity: 1, offset: .3 },
        { transform: `translate(${dx}px, ${dy + 220 + Math.random() * 160}px) rotate(${rotation}deg)`, opacity: 0 }
      ], { duration: 1700 + Math.random() * 600, delay: Math.random() * 120, easing: 'cubic-bezier(.2, .7, .4, 1)' });
      effects.add(animation);
      animations.push(animation.finished.catch(() => {}).then(() => effects.delete(animation)));
    }
    Promise.all(animations).then(() => layer.remove());
  }

  return {
    begin() {
      hide();
      celebrated = false;
      lastTime = 0;
      const width = floor.getBoundingClientRect().width;
      const floorY = spectrum.point(440)?.floor ?? floor.getBoundingClientRect().height;
      place(circle, width + 40, floorY);
      place(square, -40, floorY);
      floor.dataset.state = 'dancing';
    },
    // `wreck` comes from the Triton finale: the dancers fall with the keys.
    render(elapsed, melody, wreck) {
      const reduced = reducedMotion.matches;
      const pose = danceAt(elapsed, melody);
      const dt = Math.max(0, Math.min(.1, elapsed - lastTime));
      lastTime = elapsed;
      floor.dataset.merged = String(pose.mode === 'merge' && pose.progress >= 1);
      floor.dataset.state = pose.mode === 'flee' && (reduced || pose.progress >= 1) ? 'hidden' : 'dancing';
      const ease = (dancer, target, rate) => reduced ? target : dancer + (target - dancer) * Math.min(1, dt * rate);
      const hop = reduced || pose.mode === 'crowd' || pose.mode === 'merge' ? 0 : Math.abs(Math.sin(Math.PI * elapsed / secondsPerBeat));
      const moves = [[circle, pose.circle, 1, 0], [square, pose.square, -1, .5]].map(([dancer, note, side, offbeat]) => {
        if (note === null) return null;
        const point = spectrum.point(noteFrequency(note));
        if (!point) return null;
        const lift = size(dancer) * .1;
        let x = point.x;
        let y = Math.min(point.floor, point.y) - lift;
        let angle = 0;
        let rate = 10;
        if (pose.mode === 'enter') rate = 7;
        if (pose.mode === 'dance' || pose.mode === 'enter') {
          y -= hop * size(dancer) * .5;
          angle = reduced ? 0 : Math.sin(Math.PI * (elapsed / secondsPerBeat + offbeat)) * 8 * side;
        }
        if (pose.mode === 'crowd' && !reduced) {
          // Close peaks beat; the dancers shake and push each other.
          x += (Math.random() - .5) * 6 + side * pose.progress * 3;
          y += (Math.random() - .5) * 5;
          angle = (Math.random() - .5) * 16;
          rate = 30;
        }
        if (pose.mode === 'flee') {
          x = side < 0 ? -80 : point.width + 80;
          y = point.floor - lift;
          angle = side * 25;
          rate = 2 + pose.progress * 10;
        }
        if (pose.mode === 'merge') {
          rate = 6;
          angle = reduced ? 0 : Math.sin(elapsed * 2.2) * 3;
          if (dancer === circle) y -= (size(square) - size(circle)) / 2;
        }
        if (wreck?.broken) {
          return { dancer, x: dancer.x, y: Math.max(dancer.y, point.floor - lift + 30 + wreck.drop), angle: side * wreck.spin * 2 };
        }
        return { dancer, x: ease(dancer.x, x, rate), y: ease(dancer.y, y, rate * 1.6), angle };
      });
      const [circleMove, squareMove] = moves;
      if (circleMove && squareMove && pose.mode !== 'merge' && !wreck?.broken) {
        // Only the right ending lets them meet; until then they never overlap.
        const touch = (size(circle) + size(square)) / 2;
        const gap = pose.mode === 'crowd' ? touch : touch + size(circle) * .4;
        [circleMove.x, squareMove.x] = keepApart(circleMove.x, squareMove.x, gap);
      }
      moves.forEach((move) => move && place(move.dancer, move.x, move.y, move.angle));
      if (pose.mode === 'merge' && pose.progress >= danceTiming.confetti / danceTiming.merge && !celebrated) {
        celebrated = true;
        celebrate();
      }
    },
    hide
  };
}
