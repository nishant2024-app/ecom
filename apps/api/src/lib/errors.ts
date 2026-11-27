import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Application error rendered as RFC 9457 problem+json.
 * Codes are documented in docs/api/README.md#error-codes; add new ones there.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly detail?: string,
    public readonly fieldErrors: { field: string; code: string; message: string }[] = [],
  ) {
    super(detail ?? code);
  }
}

const TITLES: Record<string, string> = {
  VALIDATION_FAILED: 'Validation failed',
  AUTH_REQUIRED: 'Sign-in required',
  AUTH_TOKEN_EXPIRED: 'Access token expired',
  AUTH_TOKEN_INVALID: 'Access token invalid',
  AUTH_INVALID_GOOGLE_TOKEN: 'Google sign-in could not be verified',
  AUTH_NONCE_INVALID: 'Sign-in nonce invalid or expired',
  AUTH_REFRESH_INVALID: 'Session expired',
  AUTH_REFRESH_REUSED: 'Session revoked',
  FORBIDDEN: 'Not allowed',
  STAFF_NOT_ALLOWED: 'Account not authorised',
  CSRF_FAILED: 'CSRF check failed',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency key reused with a different request',
  IDEMPOTENCY_IN_PROGRESS: 'Request already in progress',
  NOT_SERVICEABLE: 'We do not deliver here yet',
  PRODUCT_UNAVAILABLE: 'Product unavailable',
  CUTOFF_PASSED: 'Cutoff has passed',
  INVALID_DELIVERY_DATE: 'Invalid delivery date',
  INSUFFICIENT_WALLET_BALANCE: 'Insufficient wallet balance',
  WALLET_LIMIT_EXCEEDED: 'Wallet limit exceeded',
  PROFILE_INCOMPLETE: 'Profile incomplete',
  RATE_LIMITED: 'Too many requests',
  INTERNAL: 'Something went wrong',
  SERVICE_UNAVAILABLE: 'Service unavailable',
};

export const badRequest = (detail: string) => new AppError('VALIDATION_FAILED', 400, detail);
export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', 404, `${what} not found`);
export const forbidden = (detail = 'You do not have permission for this action') => new AppError('FORBIDDEN', 403, detail);
export const unprocessable = (code: string, detail: string) => new AppError(code, 422, detail);

function slug(code: string): string {
  return code.toLowerCase().replaceAll('_', '-');
}

export function problemBody(req: FastifyRequest, code: string, status: number, detail?: string, errors: AppError['fieldErrors'] = []) {
  return {
    type: `https://api.example.in/problems/${slug(code)}`,
    title: TITLES[code] ?? code,
    status,
    code,
    ...(detail ? { detail } : {}),
    requestId: req.id,
    errors,
  };
}

export function sendProblem(req: FastifyRequest, reply: FastifyReply, code: string, status: number, detail?: string, errors: AppError['fieldErrors'] = []) {
  return reply
    .status(status)
    .type('application/problem+json')
    .send(problemBody(req, code, status, detail, errors));
}

export function errorHandler(error: FastifyError | AppError, req: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return sendProblem(req, reply, error.code, error.status, error.detail, error.fieldErrors);
  }
  const fe = error as FastifyError;
  if (fe.validation) {
    const errors = fe.validation.map((v) => {
      const missing = (v.params as { missingProperty?: string } | undefined)?.missingProperty;
      return {
        field: v.instancePath || (missing ? `/${missing}` : '/'),
        code: v.keyword,
        message: v.message ?? 'invalid',
      };
    });
    return sendProblem(req, reply, 'VALIDATION_FAILED', 400, `Invalid ${fe.validationContext ?? 'request'}`, errors);
  }
  if (fe.statusCode === 429) return sendProblem(req, reply, 'RATE_LIMITED', 429, 'Please slow down and try again shortly');
  if (fe.statusCode === 415 || fe.statusCode === 400 || fe.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return sendProblem(req, reply, 'VALIDATION_FAILED', 400, fe.message);
  }
  if (fe.statusCode === 503) return sendProblem(req, reply, 'SERVICE_UNAVAILABLE', 503);
  req.log.error({ err: error }, 'unhandled error');
  return sendProblem(req, reply, 'INTERNAL', 500, 'Please try again. If it keeps happening, contact support with the request ID.');
}
