import { PackShot } from '@dairy/ui';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FOREST = '#14432F';
const CREAM = '#F6F1E4';
const GOLD = '#E9B44C';

const PACKS = [
  { kind: 'tin', color: '#F2EBDD', accent: FOREST, label: 'Whole Milk Powder', size: '500 g', x: 200, y: 600, w: 230, r: -8 },
  { kind: 'tetra', color: '#F1A43C', accent: '#7A2E12', label: 'Kesar Badam Milk', size: '6 × 180 ml', x: 880, y: 610, w: 210, r: 8 },
  { kind: 'jar', color: GOLD, accent: FOREST, label: 'A2 Gir Cow Ghee', size: '500 ml', x: 540, y: 560, w: 300, r: 0 },
  { kind: 'box', color: '#8E4B2E', accent: '#F1D9A7', label: 'Kandi Peda', size: '250 g box', x: 330, y: 820, w: 220, r: -4 },
  { kind: 'tetra', color: '#F7F4EC', accent: FOREST, label: 'UHT Toned Milk', size: '1 L carton', x: 760, y: 830, w: 200, r: 5 },
];

const FACTS = ['Ghee keeps 9 months', 'UHT milk: 6 months, no fridge', 'Ships across India'];

/** 10-second square loop for the storefront and social: the pantry assembles itself. */
export function PantryReel() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sun = spring({ frame, fps, config: { damping: 18 } });
  const outro = interpolate(frame, [durationInFrames - 50, durationInFrames - 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headline = (i: number) => spring({ frame: frame - 8 - i * 6, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: FOREST, fontFamily: 'Mukta, sans-serif', overflow: 'hidden' }}>
      {/* sun and hills */}
      <div style={{ position: 'absolute', left: 540 - 260, top: interpolate(sun, [0, 1], [700, 230]), width: 520, height: 520, borderRadius: 999, background: GOLD, opacity: 0.32 }} />
      <svg viewBox="0 0 1080 300" style={{ position: 'absolute', bottom: 0, width: 1080, height: 300 }}>
        <path d={`M0 ${170 - 20 * Math.sin(frame / 40)} C 260 70, 520 90, 700 150 S 960 220, 1080 110 V300 H0 Z`} fill="#1D5A40" />
        <path d="M0 230 C 260 170, 520 200, 760 220 S 1000 250, 1080 200 V300 H0 Z" fill="#0F3725" />
      </svg>

      {/* headline */}
      <div style={{ position: 'absolute', top: 90, width: '100%', textAlign: 'center', color: CREAM, fontFamily: '"Tiro Devanagari Hindi", serif', fontSize: 96, lineHeight: 1 }}>
        {['Farm dairy,', 'made to keep.'].map((line, i) => (
          <div key={line} style={{ overflow: 'hidden', height: 108 }}>
            <div style={{ transform: `translateY(${interpolate(headline(i), [0, 1], [110, 0])}px)`, color: i === 1 ? GOLD : CREAM }}>{line}</div>
          </div>
        ))}
      </div>

      {/* packs */}
      {PACKS.map((p, i) => {
        const s = spring({ frame: frame - 30 - i * 14, fps, config: { damping: 12, mass: 0.8 } });
        const bob = Math.sin((frame + i * 20) / 18) * 8;
        const exit = interpolate(outro, [0, 1], [0, 1]);
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: p.x - p.w / 2,
              top: p.y - (p.w * 1.3) / 2 + interpolate(s, [0, 1], [500, 0]) + bob - exit * 40,
              width: p.w,
              transform: `rotate(${p.r * s}deg) scale(${1 - exit * 0.15})`,
              opacity: 1 - exit,
              filter: 'drop-shadow(0 28px 30px rgba(5,25,15,0.5))',
              zIndex: p.y,
            }}
          >
            <PackShot kind={p.kind} color={p.color} accent={p.accent} label={p.label} size={p.size} />
          </div>
        );
      })}

      {/* facts */}
      <div style={{ position: 'absolute', bottom: 70, width: '100%', display: 'flex', justifyContent: 'center', gap: 18 }}>
        {FACTS.map((f, i) => {
          const s = spring({ frame: frame - 150 - i * 12, fps, config: { damping: 14 } });
          return (
            <div key={f} style={{ background: CREAM, color: FOREST, borderRadius: 999, padding: '14px 26px', fontSize: 30, transform: `translateY(${interpolate(s, [0, 1], [80, 0])}px)`, opacity: s * (1 - outro) }}>
              {f}
            </div>
          );
        })}
      </div>

      {/* outro */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: outro }}>
        <div style={{ textAlign: 'center', color: CREAM, transform: `scale(${interpolate(outro, [0, 1], [0.92, 1], { easing: Easing.out(Easing.cubic) })})` }}>
          <svg width="150" height="150" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="20" fill={CREAM} />
            <path d="M11 27V14l9 9 9-9v13" fill="none" stroke={FOREST} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontFamily: '"Tiro Devanagari Hindi", serif', fontSize: 84, marginTop: 24 }}>Mulshi Dairy</div>
          <div style={{ fontSize: 34, opacity: 0.8 }}>Pasture to pantry</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
