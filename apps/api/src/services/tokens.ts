import { createHash, randomBytes } from 'node:crypto';
import {
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  importPKCS8,
  jwtVerify,
  SignJWT,
  createLocalJWKSet,
  type JWK,
  type JWTPayload,
  errors as joseErrors,
} from 'jose';
import { AppError } from '../lib/errors';

export type Audience = 'store' | 'admin' | 'agent';
export type UserType = 'customer' | 'staff' | 'agent';
export type Client = 'web' | 'admin' | 'agent' | 'android';

export interface AccessClaims {
  sub: string;
  sid: string;
  aud: Audience;
  typ: UserType;
  role?: string;
  client: Client;
}

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS: Record<UserType, number> = {
  customer: 30 * 24 * 3600,
  staff: 12 * 3600,
  agent: 7 * 24 * 3600,
};

type PrivateKey = Awaited<ReturnType<typeof importPKCS8>>;

interface SigningKey {
  kid: string;
  privateKey: PrivateKey;
  publicJwk: JWK;
}

/** Ed25519 JWT signer. The first key signs; all keys verify (for rotation). */
export class TokenService {
  private constructor(
    private readonly keys: SigningKey[],
    private readonly issuer: string,
  ) {}

  static async fromConfig(raw: string, issuer: string, allowEphemeral: boolean): Promise<TokenService> {
    if (!raw) {
      if (!allowEphemeral) throw new Error('JWT_PRIVATE_KEYS is required');
      const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
      const publicJwk = { ...(await exportJWK(publicKey)), kid: 'ephemeral', alg: 'EdDSA', use: 'sig' };
      return new TokenService([{ kid: 'ephemeral', privateKey, publicJwk }], issuer);
    }
    const parsed = JSON.parse(raw) as { kid: string; privateKeyPem: string }[];
    const keys: SigningKey[] = [];
    for (const k of parsed) {
      const privateKey = await importPKCS8(k.privateKeyPem, 'EdDSA', { extractable: true });
      const jwk = await exportJWK(privateKey);
      const publicJwk: JWK = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, kid: k.kid, alg: 'EdDSA', use: 'sig' };
      keys.push({ kid: k.kid, privateKey, publicJwk });
    }
    if (keys.length === 0) throw new Error('JWT_PRIVATE_KEYS must contain at least one key');
    return new TokenService(keys, issuer);
  }

  static async generateKeyPem(): Promise<string> {
    const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
    return exportPKCS8(privateKey);
  }

  jwks(): { keys: JWK[] } {
    return { keys: this.keys.map((k) => k.publicJwk) };
  }

  async signAccess(claims: AccessClaims): Promise<string> {
    const key = this.keys[0]!;
    const { sub, aud, ...rest } = claims;
    return new SignJWT({ ...rest } as JWTPayload)
      .setProtectedHeader({ alg: 'EdDSA', kid: key.kid, typ: 'JWT' })
      .setSubject(sub)
      .setAudience(aud)
      .setIssuer(this.issuer)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(key.privateKey);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, createLocalJWKSet(this.jwks()), {
        issuer: this.issuer,
        algorithms: ['EdDSA'],
      });
      return {
        sub: payload.sub!,
        sid: payload.sid as string,
        aud: (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) as Audience,
        typ: payload.typ as UserType,
        role: payload.role as string | undefined,
        client: payload.client as Client,
      };
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) throw new AppError('AUTH_TOKEN_EXPIRED', 401, 'Access token expired; refresh it');
      throw new AppError('AUTH_TOKEN_INVALID', 401, 'Access token invalid');
    }
  }
}

export function newRefreshToken(): string {
  return `rt_${randomBytes(32).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function newOpaque(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}
