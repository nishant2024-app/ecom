import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

export const revalidate = 86400;

/** Default social-share card (1200×630). Product pages use their own photo when there is one. */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(120deg,#e9f6ec,#ffffff)',
        color: '#101a14',
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 40 }}>
        <div style={{ width: 64, height: 64, background: '#146f36', borderRadius: 18 }} />
        {SITE_NAME}
      </div>
      <div style={{ display: 'flex', fontSize: 80, fontWeight: 800, lineHeight: 1.04, maxWidth: 980 }}>Ghee, milk powder and mithai, made the slow way.</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '3px solid #146f36', paddingTop: 24, fontSize: 28, color: '#56635b' }}>
        <span>From our farm in Mulshi, Pune</span>
        <span>Shipped across India</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
