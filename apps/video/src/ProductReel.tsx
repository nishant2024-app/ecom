import { PackShot } from '@dairy/ui';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type ProductReelProps = {
  name: string;
  size: string;
  tagline: string;
  price: string;
  pack: { kind: string; color: string; accent: string };
  facts: string[];
};

/** 8-second 4:5 reel for one product, rendered from catalog data (admin → product → reel). */
export function ProductReel({ name, size, tagline, price, pack, facts }: ProductReelProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const turn = interpolate(frame, [0, 240], [-6, 6]);
  const text = (d: number) => spring({ frame: frame - d, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 60% at 50% 45%, ${pack.color}aa, #FBF7EE 70%)`, fontFamily: 'Mukta, sans-serif', color: '#14271F' }}>
      <div style={{ position: 'absolute', left: 540 - 300, top: 120, width: 600, height: 600, borderRadius: 999, border: '2px solid rgba(20,39,31,0.12)', transform: `rotate(${frame}deg)` }} />
      <div style={{ position: 'absolute', left: 540 - 210, top: interpolate(enter, [0, 1], [900, 150]), width: 420, transform: `rotate(${turn}deg)`, filter: 'drop-shadow(0 40px 40px rgba(20,39,31,0.35))' }}>
        <PackShot kind={pack.kind} color={pack.color} accent={pack.accent} label={name} size={size} />
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 800 }}>
        <div style={{ fontFamily: '"Tiro Devanagari Hindi", serif', fontSize: 88, lineHeight: 1, opacity: text(25), transform: `translateY(${interpolate(text(25), [0, 1], [40, 0])}px)` }}>{name}</div>
        <div style={{ fontSize: 40, opacity: text(35) * 0.8, marginTop: 14 }}>{tagline}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 34, flexWrap: 'wrap' }}>
          {facts.map((f, i) => (
            <div key={f} style={{ background: '#14432F', color: '#F6F1E4', borderRadius: 999, padding: '12px 24px', fontSize: 30, opacity: text(60 + i * 12), transform: `scale(${interpolate(text(60 + i * 12), [0, 1], [0.6, 1])})` }}>
              {f}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, display: 'inline-block', background: '#E9B44C', borderRadius: 999, padding: '14px 34px', fontFamily: '"JetBrains Mono", monospace', fontSize: 52, transform: `rotate(${interpolate(text(120), [0, 1], [-20, -3])}deg) scale(${text(120)})` }}>
          {price}
        </div>
      </div>
    </AbsoluteFill>
  );
}
