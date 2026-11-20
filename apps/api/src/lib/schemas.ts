import { Type, type Static, type TSchema, type TString } from '@sinclair/typebox';

/** Shared TypeBox schemas. They mirror components/schemas in docs/api/openapi.yaml. */

export const MoneySchema = Type.Object(
  { amount: Type.Integer({ description: 'Paise' }), currency: Type.Literal('INR') },
  { $id: 'Money' },
);
export type MoneyT = Static<typeof MoneySchema>;
export const Money = Type.Ref(MoneySchema);

export const money = (paise: number): MoneyT => ({ amount: paise, currency: 'INR' });

export const Problem = Type.Object(
  {
    type: Type.String(),
    title: Type.String(),
    status: Type.Integer(),
    code: Type.String(),
    detail: Type.Optional(Type.String()),
    requestId: Type.String(),
    errors: Type.Array(Type.Object({ field: Type.String(), code: Type.String(), message: Type.String() })),
  },
  { $id: 'Problem' },
);

export const PageInfo = Type.Object({ nextCursor: Type.Union([Type.String(), Type.Null()]), hasMore: Type.Boolean() });

export const BusinessDate = Type.String({ format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
export const Month = Type.String({ pattern: '^\\d{4}-(0[1-9]|1[0-2])$' });
export const Nullable = <T extends TSchema>(t: T) => Type.Union([t, Type.Null()]);

export const IdParam = <K extends string>(name: K) =>
  Type.Object({ [name]: Type.String({ minLength: 4, maxLength: 40 }) } as { [P in K]: TString });

export const ErrorResponses = {
  400: Type.Ref(Problem),
  401: Type.Ref(Problem),
  403: Type.Ref(Problem),
  404: Type.Ref(Problem),
  409: Type.Ref(Problem),
  422: Type.Ref(Problem),
};

export const CursorQuery = Type.Object({
  cursor: Type.Optional(Type.String({ maxLength: 200 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
export function decodeCursor<T>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
