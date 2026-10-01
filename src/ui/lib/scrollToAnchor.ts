/**
 * Scrolls a section into view and keeps it there while lazy-loaded content above it
 * (charts) settles and changes the page height. Stops as soon as the user scrolls.
 */
export function scrollToAnchor(id: string, settleMs = 2000): void {
  const go = () => document.getElementById(id)?.scrollIntoView({ block: 'start' });
  go();
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(go);
  observer.observe(document.body);
  let timer = 0;
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    window.removeEventListener('touchstart', stop);
    window.removeEventListener('wheel', stop);
  };
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('wheel', stop, { passive: true });
  timer = window.setTimeout(stop, settleMs);
}
