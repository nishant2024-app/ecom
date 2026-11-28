/**
 * Everything that shapes the generated API documentation (OpenAPI + the /docs page).
 * Nothing here changes how the API behaves: the transform below only decorates the document.
 */

export const API_DESCRIPTION = `
One REST API serves the shop, the admin panel and the future Android app.

## Quick start

1. **Public data needs no sign-in.** Try \`GET /v1/store/products\` or \`GET /v1/app-config\`.
2. **Signing in is Google only.** Ask for a nonce (\`POST /v1/auth/nonce\`), get a Google ID token in the app, then exchange it with \`POST /v1/auth/google\`. You receive a short-lived access token and a rotating refresh token.
3. **Send the access token** as \`Authorization: Bearer <token>\` (mobile and server clients), or let the browser keep it in the cookies the API sets (web: also send \`X-CSRF-Token\` on POST, PUT, PATCH and DELETE).
4. Access tokens last **15 minutes**. On \`401\` with code \`AUTH_TOKEN_EXPIRED\`, call \`POST /v1/auth/refresh\` once and retry.

## Conventions

- **Money** is an object with integer **paise**: \`{ "amount": 6400, "currency": "INR" }\` is ₹64.00. Never floats.
- **IDs** are prefixed strings such as \`ord_01J…\`. Treat them as opaque.
- **Dates:** timestamps are ISO 8601 UTC. Business dates are \`YYYY-MM-DD\` in India time (IST).
- **Names:** fields are \`camelCase\`, enum values are \`snake_case\`. Clients must ignore unknown fields.
- **Language:** \`Accept-Language: en\` or \`hi\` picks names and error text.
- **Idempotency:** endpoints marked *Idempotent* need an \`Idempotency-Key\` header (one UUID per attempt). Retrying with the same key returns the first result instead of repeating the action.
- **Rate limits** are per user or IP: 300 reads and 60 writes a minute, with tighter limits on sign-in and checkout. \`429\` carries \`Retry-After\`.
- **Tracing:** every response has an \`X-Request-Id\`. Quote it when reporting a problem; it is also in every error body.

## Errors

Errors are \`application/problem+json\` (RFC 9457) with a stable \`code\` you can branch on, a human \`detail\`, the \`requestId\`, and per-field \`errors\` for validation problems:

\`\`\`json
{
  "type": "https://api.example.in/problems/validation",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "pincode must be 6 digits",
  "requestId": "req_01J…",
  "errors": [{ "field": "pincode", "code": "pattern", "message": "must be 6 digits" }]
}
\`\`\`

## Versioning

The major version is in the path (\`/v1\`). New endpoints and new optional fields can appear in \`/v1\` at any time. Removing or changing a field ships as \`/v2\`.

Longer guides, including the Android integration notes, live in the repository under \`docs/api/\` and \`docs/13-android-integration.md\`.
`.trim();

export const API_TAGS = [
  { name: 'Meta', description: 'Health checks and the public app configuration (support contact, legal details, minimum app versions).' },
  { name: 'Auth', description: 'Google sign-in, token refresh and sign-out for customers and staff.' },
  { name: 'Catalog', description: 'Public catalogue: categories, products, search, reviews and batch-code verification.' },
  { name: 'Profile', description: 'The signed-in customer: profile, addresses (with map location) and reviews.' },
  { name: 'Checkout', description: 'Price a basket (coupon, GST, shipping) before placing an order.' },
  { name: 'Orders', description: "Place, pay, track and cancel the signed-in customer's orders." },
  { name: 'Webhooks', description: 'Server-to-server callbacks from Cashfree. Not for apps. Requests are verified by signature.' },
  { name: 'Admin · Dashboard', description: 'Sales, queues, low stock and expiring batches.' },
  { name: 'Admin · Orders', description: 'Fulfilment: pack, ship, deliver, cancel and refund; packing slips and CSV export.' },
  { name: 'Admin · Catalog', description: 'Categories, products with sizes, photos, show/hide/archive and delete.' },
  { name: 'Admin · Inventory', description: 'Stock by batch, batch intake and stock adjustments.' },
  { name: 'Admin · Coupons', description: 'Discount codes and how often each was used.' },
  { name: 'Admin · Reviews', description: 'Moderate customer reviews.' },
  { name: 'Admin · Storefront', description: 'Home page copy, banners and the storefront image library.' },
  { name: 'Admin · Customers', description: 'Customer list and detail.' },
  { name: 'Admin · Settings', description: 'Store details, shipping zones and staff accounts.' },
  { name: 'Admin · Account', description: 'The signed-in staff member and their permissions.' },
  { name: 'Dev', description: 'Development-only helpers (test sign-in, fake payments). Not available in production.' },
];

const ADMIN_GROUP: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  products: 'Catalog',
  categories: 'Catalog',
  media: 'Catalog',
  'site-media': 'Storefront',
  inventory: 'Inventory',
  batches: 'Inventory',
  stock: 'Inventory',
  coupons: 'Coupons',
  reviews: 'Reviews',
  storefront: 'Storefront',
  customers: 'Customers',
  staff: 'Settings',
  'shipping-zones': 'Settings',
  store: 'Settings',
  me: 'Account',
};

const ref = (description: string) => ({ description, content: { 'application/problem+json': { schema: { $ref: 'Problem#' } } } });

type RouteConfig = { auth?: string; permission?: string; idempotent?: boolean; rateLimit?: false | { max: number; timeWindow: string } };

/** @fastify/swagger `transform`: operation ids, grouping, security, access notes and the standard error responses. */
export function transformOperation({ schema, url, route }: { schema?: Record<string, unknown>; url: string; route: { method: string | string[]; config?: unknown } }) {
  if (!schema || schema.hide) return { schema, url };
  const cfg = (route.config ?? {}) as RouteConfig;
  const method = (Array.isArray(route.method) ? route.method[0]! : route.method).toLowerCase();
  const out: Record<string, unknown> = { ...schema };

  // operationId: getStoreProductsBySlug, postAdminProducts, ...
  const parts = url
    .replace(/^\/v1\//, '/')
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') ? `By${seg.slice(1)[0]!.toUpperCase()}${seg.slice(2)}` : seg.replace(/(^|[-_])(\w)/g, (_m, _s, c: string) => c.toUpperCase())));
  out.operationId = method + parts.map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');

  // Split the big Admin group into screens.
  const tags = (schema.tags as string[] | undefined) ?? [];
  if (tags.includes('Admin')) {
    const seg = url.replace(/^\/v1\/admin\//, '').split('/')[0] ?? '';
    out.tags = [`Admin · ${ADMIN_GROUP[seg] ?? 'Settings'}`];
  }

  const auth = cfg.auth ?? 'public';
  out.security = auth === 'public' ? [] : [{ bearerAuth: [] }, { cookieAuth: [] }];

  const notes: string[] = [];
  if (auth === 'public') notes.push(url.includes('/webhooks/') ? '**Server to server.** Verified by signature; no sign-in.' : '**Public.** No sign-in needed.');
  else if (auth === 'customer') notes.push('**Requires a signed-in customer.**');
  else if (auth === 'staff') notes.push(`**Requires staff sign-in**${cfg.permission ? ` with the \`${cfg.permission}\` permission` : ''}.`);
  else notes.push('**Requires any signed-in user.**');
  if (cfg.idempotent) notes.push('**Idempotent.** Send an `Idempotency-Key` header (a new UUID per attempt); a retry with the same key returns the first result.');
  if (cfg.rateLimit) notes.push(`Limited to ${cfg.rateLimit.max} requests per ${cfg.rateLimit.timeWindow.replace(/^1 /, '')}.`);
  out.description = [schema.description as string | undefined, notes.join(' ')].filter(Boolean).join('\n\n');

  // Standard errors (documentation only: runtime serialisation is unchanged).
  const responses = { ...((schema.response as Record<string, unknown> | undefined) ?? {}) } as Record<string, unknown>;
  const add = (code: number, description: string) => {
    if (!(code in responses)) responses[code] = ref(description);
  };
  if (schema.body || schema.querystring || schema.params) add(400, 'The request is not valid. `errors` lists each problem field.');
  if (auth !== 'public') add(401, 'Not signed in, or the access token expired (`AUTH_TOKEN_EXPIRED`).');
  if (auth === 'staff') add(403, 'Signed in but not allowed to do this.');
  if (schema.params && url.includes(':')) add(404, 'No such item.');
  if (cfg.rateLimit !== false) add(429, 'Too many requests. Wait for `Retry-After` seconds.');
  const success = Object.keys(responses).some((c) => c.startsWith('2'))
    ? responses
    : {
        '2XX': {
          description: 'Success. The body is JSON; the fields of this endpoint are listed in the guides under `docs/api/` (store.md, admin.md, auth.md).',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        ...responses,
      };
  out.response = success;

  return { schema: out, url };
}

/** Options for the Scalar page at /docs: our colours, none of the vendor promotion. */
export const SCALAR_CONFIGURATION = {
  metaData: { title: 'Mulshi Dairy API' },
  layout: 'modern',
  showDeveloperTools: 'never',
  hideDownloadButton: false,
  hideClientButton: false,
  telemetry: false,
  agent: { disabled: true },
  mcp: { disabled: true },
  defaultOpenAllTags: false,
  operationsSorter: 'method',
  defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
  authentication: { preferredSecurityScheme: 'bearerAuth' },
  customCss: `
    .light-mode, .dark-mode { --scalar-font: 'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .light-mode { --scalar-color-accent: #14532d; --scalar-background-accent: #e8f5ec; --scalar-sidebar-color-active: #14532d; --scalar-sidebar-item-active-background: #e8f5ec; }
    .dark-mode { --scalar-color-accent: #6dc58b; --scalar-background-accent: #123220; --scalar-sidebar-color-active: #6dc58b; --scalar-sidebar-item-active-background: #123220; }
  `,
} as const;
