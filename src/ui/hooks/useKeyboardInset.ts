import { useEffect } from 'react';

/**
 * iOS does not resize the layout viewport when the software keyboard opens, so
 * bottom-anchored fixed elements (sheets) would end up behind the keyboard.
 * This publishes the keyboard height as --kb and the visible height as --vvh.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const zoomed = vv.scale > 1.01;
        const kb = zoomed ? 0 : Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty('--kb', `${Math.round(kb)}px`);
        root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
        root.dataset.kb = kb > 80 ? 'open' : 'closed';
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}
