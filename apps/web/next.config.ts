import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Content-Security-Policy: scripts only from this site, Google sign-in and Cashfree checkout; the page can't be
 * framed by other sites; forms post only to ourselves or Cashfree. Images allow any https host because product
 * photos come from the media (R2) domain. 'unsafe-inline' is needed for Next's own inline bootstrap scripts.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://accounts.google.com https://sdk.cashfree.com`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://*.cashfree.com https://nominatim.openstreetmap.org",
  'frame-src https://accounts.google.com https://*.cashfree.com',
  "form-action 'self' https://*.cashfree.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Always put title, description and social tags in <head> (no streaming), for every crawler and tool.
  htmlLimitedBots: /.*/,
  // Lets the dev server work behind preview URLs (Cloud Shell, Codespaces).
  allowedDevOrigins: ['*.cloudshell.dev', '*.cloudworkstations.dev', '*.app.github.dev'],
  transpilePackages: ['@dairy/ui', '@dairy/core'],
  // Browser calls go to /api/* on the storefront's own origin, so auth cookies stay first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://*.cashfree.com")' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
    ];
  },
};

export default config;
