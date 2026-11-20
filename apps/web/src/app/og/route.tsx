import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

export const revalidate = 86400;

/** Default social-share card (1200×630). Product pages use their own photo when there is one. */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fbf7ee', color: '#14271f', padding: 72, fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 64, background: '#14432f', border: '6px solid #fbf7ee', boxShadow: '0 0 0 3px #14432f' }} />
          {SITE_NAME}
        </div>
        <div style={{ display: 'flex', fontSize: 84, lineHeight: 1.02, maxWidth: 980 }}>Ghee, milk powder and mithai, made the slow way.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '3px solid #14271f', paddingTop: 24, fontSize: 28, color: '#4b5c53' }}>
          <span>From our farm in Mulshi, Pune</span>
          <span>Shipped across India</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
