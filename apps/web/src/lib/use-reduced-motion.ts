import { useEffect, useState } from 'react';

/**
 * Whether the visitor asked their device for less motion. It is always false on the server and on the very first
 * browser render, and only then switches. Reading the setting earlier makes the browser draw different HTML from the
 * server (React reports "hydration failed"), so components that change their markup for reduced motion must use this.
 *
 * It reads the browser setting itself instead of Motion's `useReducedMotion`, which prints a development-only
 * notice on every page for visitors who have the setting on.
 */
export function useReducedMotionAfterMount(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduce;
}
