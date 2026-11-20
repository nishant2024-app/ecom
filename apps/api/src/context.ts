import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DbHandle } from '@dairy/db';
import type { Config } from './config';
import type { Permission } from './lib/permissions';
import type { GoogleVerifier } from './services/google';
import type { Kv } from './services/kv';
import type { PaymentProvider } from './services/payments';
import type { Storage } from './services/storage';
import type { AccessClaims, TokenService } from './services/tokens';

export interface AppDeps {
  config: Config;
  db: DbHandle;
  kv: Kv;
  tokens: TokenService;
  google: GoogleVerifier;
  payments: PaymentProvider;
  /** Image storage; defaults to R2 or local disk from config. */
  storage?: Storage;
  /** Injectable clock for tests. */
  now: () => Date;
  /** Set by the auth routes; reused by the dev sign-in route. */
  issueSession?: (
    req: FastifyRequest,
    reply: FastifyReply,
    user: { type: 'customer' | 'staff'; id: string; role?: string },
    client: 'web' | 'admin' | 'android',
    deviceName: string | undefined,
  ) => Promise<{ expiresIn: number; accessToken?: string; refreshToken?: string }>;
}

export type AuthMode = 'public' | 'customer' | 'staff' | 'any';

export interface AuthContext extends AccessClaims {
  via: 'bearer' | 'cookie';
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyContextConfig {
    auth?: AuthMode;
    permission?: Permission;
    idempotent?: boolean;
    csrf?: boolean;
  }
}
