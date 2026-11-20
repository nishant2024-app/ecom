import { useId } from 'react';

export type PackKind = 'jar' | 'tin' | 'tetra' | 'can' | 'box' | 'pouch';

export interface PackShotProps {
  kind: PackKind | string;
  /** Main pack colour (e.g. ghee gold for a jar). */
  color: string;
  /** Label / lid colour. */
  accent: string;
  /** Product name printed on the label. */
  label: string;
  /** Pack size printed under the name, e.g. "500 ml". */
  size?: string;
  brand?: string;
  className?: string;
  title?: string;
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.round(Math.max(0, Math.min(255, v)));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Split a name into at most two short lines for the label. */
function lines(label: string, max = 13): string[] {
  const words = label.split(' ');
  const out: string[] = [''];
  for (const w of words) {
    const cur = out[out.length - 1]!;
    if (cur && (cur + ' ' + w).length > max && out.length < 2) out.push(w);
    else out[out.length - 1] = cur ? `${cur} ${w}` : w;
  }
  return out;
}

/**
 * Drawn product packaging. Stands in for photography until the product shoot is done,
 * and gives the brand one consistent visual language across site, admin and video.
 */
export function PackShot({ kind, color, accent, label, size, brand = 'Mulshi', className, title }: PackShotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = (n: string) => `${n}${uid}`;
  const name = lines(label);
  const labelInk = luminance(color) > 0.55 ? accent : '#FBF7EE';
  const display = { fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' };
  const text = { fontFamily: 'var(--font-text)' };

  const Label = ({ x, y, w, ink, compact = false }: { x: number; y: number; w: number; ink: string; compact?: boolean }) => (
    <g fill={ink} textAnchor="middle">
      <text x={x + w / 2} y={y} fontSize={compact ? 8 : 9} style={{ ...text, letterSpacing: '0.18em' }} opacity={0.85}>
        {brand.toUpperCase()}
      </text>
      {name.map((l, i) => (
        <text key={i} x={x + w / 2} y={y + (compact ? 16 : 19) + i * (compact ? 14 : 17)} fontSize={compact ? 13 : 16} style={display}>
          {l}
        </text>
      ))}
      {size && (
        <text x={x + w / 2} y={y + (compact ? 18 : 22) + name.length * (compact ? 14 : 17) + 4} fontSize={compact ? 8.5 : 10} style={{ fontFamily: 'var(--font-mono)' }} opacity={0.85}>
          {size}
        </text>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 200 260" role="img" aria-label={title ?? `${label}${size ? `, ${size}` : ''}`} className={className}>
      <defs>
        <linearGradient id={g('body')} x1="0" x2="1">
          <stop offset="0" stopColor={shade(color, -0.12)} />
          <stop offset="0.35" stopColor={shade(color, 0.12)} />
          <stop offset="0.7" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.2)} />
        </linearGradient>
        <linearGradient id={g('metal')} x1="0" x2="1">
          <stop offset="0" stopColor="#9a968d" />
          <stop offset="0.4" stopColor="#efece5" />
          <stop offset="1" stopColor="#8e8a81" />
        </linearGradient>
        <linearGradient id={g('accent')} x1="0" x2="1">
          <stop offset="0" stopColor={shade(accent, -0.25)} />
          <stop offset="0.45" stopColor={shade(accent, 0.18)} />
          <stop offset="1" stopColor={shade(accent, -0.3)} />
        </linearGradient>
        <radialGradient id={g('shadow')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#14271f" stopOpacity="0.28" />
          <stop offset="1" stopColor="#14271f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="248" rx="78" ry="9" fill={`url(#${g('shadow')})`} />

      {kind === 'jar' && (
        <g>
          <rect x="44" y="14" width="112" height="34" rx="8" fill={`url(#${g('accent')})`} />
          {[22, 30, 38].map((y) => (
            <line key={y} x1="48" x2="152" y1={y} y2={y} stroke={shade(accent, -0.35)} strokeOpacity="0.5" />
          ))}
          <rect x="52" y="46" width="96" height="10" fill={shade(color, 0.35)} opacity="0.9" />
          <rect x="30" y="54" width="140" height="190" rx="30" fill={`url(#${g('body')})`} />
          <rect x="30" y="54" width="140" height="190" rx="30" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
          <rect x="30" y="112" width="140" height="92" fill="#FBF7EE" />
          <rect x="30" y="112" width="140" height="6" fill={accent} />
          <rect x="30" y="198" width="140" height="6" fill={accent} />
          <Label x={30} y={136} w={140} ink={accent} />
          <path d="M44 72 Q40 150 46 226" stroke="#fff" strokeOpacity="0.45" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
      )}

      {kind === 'tin' && (
        <g>
          <rect x="34" y="40" width="132" height="200" fill={`url(#${g('body')})`} />
          <ellipse cx="100" cy="240" rx="66" ry="10" fill={shade(color, -0.3)} />
          <rect x="34" y="96" width="132" height="104" fill={`url(#${g('accent')})`} opacity={luminance(color) > 0.55 ? 0.12 : 0} />
          <rect x="34" y="40" width="132" height="14" fill={`url(#${g('metal')})`} />
          <rect x="34" y="226" width="132" height="14" fill={`url(#${g('metal')})`} />
          <ellipse cx="100" cy="40" rx="66" ry="12" fill={`url(#${g('metal')})`} />
          <ellipse cx="100" cy="40" rx="54" ry="8" fill="#d8d4cb" />
          <rect x="34" y="104" width="132" height="4" fill={accent} />
          <rect x="34" y="196" width="132" height="4" fill={accent} />
          <Label x={34} y={128} w={132} ink={labelInk === '#FBF7EE' ? '#FBF7EE' : accent} />
          <path d="M48 58 V222" stroke="#fff" strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" />
        </g>
      )}

      {kind === 'tetra' && (
        <g>
          <path d="M52 44 L148 44 L132 30 L68 30 Z" fill={shade(color, -0.08)} />
          <rect x="52" y="44" width="96" height="198" fill={`url(#${g('body')})`} />
          <path d="M148 44 L168 58 L168 236 L148 242 Z" fill={shade(color, -0.22)} />
          <path d="M148 44 L168 58 L152 44 L132 30 Z" fill={shade(color, -0.15)} />
          <circle cx="118" cy="37" r="6" fill={accent} />
          <rect x="52" y="160" width="96" height="82" fill={accent} />
          <path d="M52 160 Q100 140 148 160" fill={accent} />
          <path d="M148 154 L168 162 L168 236 L148 242 Z" fill={shade(accent, -0.25)} />
          <Label x={52} y={78} w={96} ink={luminance(color) > 0.55 ? accent : '#FBF7EE'} compact />
          <g fill="#FBF7EE" opacity="0.9">
            <circle cx="72" cy="208" r="10" fill="none" stroke="#FBF7EE" strokeWidth="2" />
            <path d="M68 208 l3 3 l6 -7" stroke="#FBF7EE" strokeWidth="2" fill="none" />
            <text x="88" y="212" fontSize="9" style={text}>
              No fridge till open
            </text>
          </g>
        </g>
      )}

      {kind === 'can' && (
        <g>
          <rect x="30" y="88" width="140" height="150" fill={`url(#${g('body')})`} />
          <ellipse cx="100" cy="238" rx="70" ry="10" fill={shade(color, -0.3)} />
          <rect x="30" y="88" width="140" height="10" fill={`url(#${g('metal')})`} />
          <rect x="30" y="228" width="140" height="10" fill={`url(#${g('metal')})`} />
          <ellipse cx="100" cy="88" rx="70" ry="13" fill={`url(#${g('metal')})`} />
          <ellipse cx="100" cy="88" rx="58" ry="9" fill="#dcd8cf" />
          <ellipse cx="100" cy="88" rx="12" ry="4" fill="none" stroke="#9a968d" strokeWidth="2" />
          <path d="M30 120 Q100 108 170 120 L170 132 Q100 120 30 132 Z" fill={accent} />
          <Label x={30} y={154} w={140} ink={accent} compact />
          <path d="M44 102 V224" stroke="#fff" strokeOpacity="0.4" strokeWidth="7" strokeLinecap="round" />
        </g>
      )}

      {kind === 'box' && (
        <g>
          <path d="M24 108 L148 108 L178 86 L54 86 Z" fill={shade(color, 0.14)} />
          <rect x="24" y="108" width="124" height="132" fill={`url(#${g('body')})`} />
          <path d="M148 108 L178 86 L178 214 L148 240 Z" fill={shade(color, -0.25)} />
          <rect x="78" y="108" width="16" height="132" fill={accent} />
          <path d="M78 108 L94 108 L124 86 L108 86 Z" fill={shade(accent, 0.1)} />
          <path d="M100 86 C86 70 70 70 76 84 M100 86 C114 70 130 70 124 84" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="34" y="142" width="104" height="66" rx="6" fill="#FBF7EE" />
          <Label x={34} y={158} w={104} ink={shade(color, -0.35)} compact />
        </g>
      )}

      {kind === 'pouch' && (
        <g>
          <path d="M46 34 L154 34 L160 210 Q160 240 132 242 L68 242 Q40 240 40 210 Z" fill={`url(#${g('body')})`} />
          <rect x="46" y="34" width="108" height="14" fill={shade(color, -0.1)} />
          <line x1="48" x2="152" y1="56" y2="56" stroke={shade(color, -0.3)} strokeDasharray="4 3" />
          <circle cx="58" cy="41" r="3" fill={shade(color, -0.4)} />
          <path d="M40 200 Q100 222 160 200" stroke={shade(color, -0.25)} fill="none" />
          <rect x="54" y="88" width="92" height="86" rx="10" fill="#FBF7EE" />
          <rect x="54" y="88" width="92" height="8" rx="4" fill={accent} />
          <Label x={54} y={114} w={92} ink={accent} compact />
          <path d="M58 70 Q54 150 58 222" stroke="#fff" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" fill="none" />
        </g>
      )}
    </svg>
  );
}
