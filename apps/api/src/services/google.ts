import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from '../lib/errors';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  nonce?: string;
}

export interface GoogleVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

/**
 * Verifies Google ID tokens: signature (Google's published keys), issuer, audience,
 * expiry (30 s skew) and email_verified. Nonce is returned for the caller to check.
 * Tests pass a local key set instead of Google's; the checks are identical.
 */
export function createGoogleVerifier(clientId: string, keySet: JWTVerifyGetKey = createRemoteJWKSet(GOOGLE_JWKS_URL)): GoogleVerifier {
  return {
    async verify(idToken) {
      if (!clientId) throw new AppError('AUTH_INVALID_GOOGLE_TOKEN', 401, 'Google sign-in is not configured');
      try {
        const { payload } = await jwtVerify(idToken, keySet, {
          issuer: GOOGLE_ISSUERS,
          audience: clientId,
          clockTolerance: 30,
          algorithms: ['RS256'],
        });
        if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) {
          throw new Error('email not verified');
        }
        return {
          sub: payload.sub,
          email: payload.email.toLowerCase(),
          name: typeof payload.name === 'string' && payload.name ? payload.name : payload.email.split('@')[0]!,
          picture: typeof payload.picture === 'string' ? payload.picture : undefined,
          nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('AUTH_INVALID_GOOGLE_TOKEN', 401, 'Google sign-in could not be verified');
      }
    },
  };
}
