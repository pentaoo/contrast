// Экран с пианино: пока музыкальный блок не завершён, страница стоит,
// а колёсико, касание и клавиши прокручивают только тексты внутри экрана.

const DOWN_KEYS = new Set(['ArrowDown', 'PageDown', ' ', 'Spacebar', 'End']);
const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home']);

export function mountSoundScreen({ lab, holdsPage, isStatic, onScroll }) {
  const root = document.documentElement;
  let pinned = false;
  let touchY = null;

  const canScroll = (direction) => direction > 0
    ? lab.scrollTop + lab.clientHeight < lab.scrollHeight - 1
    : lab.scrollTop > 0;
  const holding = () => pinned && holdsPage();

  function onWheel(event) {
    if (!holding() || event.deltaY <= 0) return;
    if (lab.contains(event.target) && canScroll(1)) return;
    event.preventDefault();
    if (canScroll(1)) lab.scrollBy({ top: event.deltaY });
  }
  function onTouchStart(event) { touchY = event.touches[0]?.clientY ?? null; }
  function onTouchMove(event) {
    if (!holding() || touchY === null) return;
    const deltaY = touchY - event.touches[0].clientY;
    if (deltaY <= 0) return;
    if (lab.contains(event.target) && canScroll(1)) return;
    event.preventDefault();
  }
  function onKey(event) {
    if (!holding() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest?.('input, textarea, select, button, [contenteditable]') && event.key === ' ') return;
    const down = DOWN_KEYS.has(event.key);
    if (!down && !UP_KEYS.has(event.key)) return;
    const page = lab.clientHeight * .8;
    const step = { ArrowDown: 80, ArrowUp: -80, PageDown: page, PageUp: -page, ' ': event.shiftKey ? -page : page, Spacebar: page, End: lab.scrollHeight, Home: -lab.scrollHeight }[event.key];
    // Наверх страница уходит обычно, когда тексты уже в начале.
    if (!down && !canScroll(-1)) return;
    event.preventDefault();
    lab.scrollBy({ top: step, behavior: 'smooth' });
  }

  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('touchstart', onTouchStart, { passive: true });
  addEventListener('touchmove', onTouchMove, { passive: false });
  addEventListener('keydown', onKey);
  lab.addEventListener('scroll', onScroll, { passive: true });

  // Вызывается при прокрутке страницы: закрепляет экран, когда он дошёл до верха окна.
  function check() {
    if (isStatic()) {
      pinned = false;
      lab.classList.remove('is-pinned');
      return;
    }
    const { top } = lab.getBoundingClientRect();
    if (holdsPage() && top < 0 && top > -innerHeight) {
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      scrollTo({ top: scrollY + top, behavior: 'instant' });
      root.style.scrollBehavior = previous;
    }
    pinned = Math.abs(lab.getBoundingClientRect().top) <= 1;
    lab.classList.toggle('is-pinned', pinned);
  }

  return {
    check,
    reset() { lab.scrollTop = 0; },
  };
}
