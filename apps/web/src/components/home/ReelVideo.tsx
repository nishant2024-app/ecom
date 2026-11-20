'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * The Remotion-rendered pantry reel (apps/video). Muted, loops only while visible, loads nothing
 * until near the viewport; reduced-motion users get the poster and a play button.
 */
export function ReelVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().then(() => setPlaying(true)).catch(() => undefined);
        else {
          v.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduce]);
  return (
    <div className="relative overflow-hidden rounded-5 bg-forest">
      <video ref={ref} className="aspect-square w-full" src="/video/pantry-reel.mp4" poster="/video/pantry-reel.jpg" muted loop playsInline preload="none" aria-label="Animated reel: ghee, milk powder, flavoured milk and peda arranged on a farm hill" />
      {!playing && reduce && (
        <button
          type="button"
          onClick={() => {
            void ref.current?.play();
            setPlaying(true);
          }}
          className="absolute bottom-5 left-5 rounded-pill bg-paper px-5 py-2.5"
        >
          ▶ Play
        </button>
      )}
    </div>
  );
}
