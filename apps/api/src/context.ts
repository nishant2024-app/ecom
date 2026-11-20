import type { DbHandle } from '@dairy/db';
import type { Config } from './config';
import type { Permission } from './lib/permissions';
import type { GoogleVerifier } from './services/google';
import type { Kv } from './services/kv';
import type { AccessClaims, TokenService } from './services/tokens';

export interface AppDeps {
  config: Config;
  db: DbHandle;
  kv: Kv;
  tokens: TokenService;
  google: GoogleVerifier;
  /** Injectable clock for tests. */
  now: () => Date;
}

export type AuthMode = 'public' | 'customer' | 'staff' | 'agent' | 'any';

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
