// Мелодия идёт от прокрутки. Прокрутка задаёт цель — до какого места дослушать,
// а «головка» догоняет её в обычном темпе: не быстрее времени и не дальше цели.
// Перестал крутить — головка остановилась, мелодия замолкла.
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const LOOKAHEAD = .12;

export function trackTarget(fraction, duration) {
  return clamp(Number.isFinite(fraction) ? fraction : 0) * duration;
}

// Назад по прокрутке головка перескакивает молча; вперёд идёт в реальном времени.
export function advance(playhead, target, dt) {
  if (target < playhead - .05) return { playhead: target, jumped: true };
  return { playhead: Math.min(target, playhead + Math.max(0, dt)), jumped: false };
}

// Ноты, которые пора поставить в очередь: начинаются в [from, to).
export function dueEvents(events, from, to) {
  return events.filter((event) => event.at >= from && event.at < to);
}
