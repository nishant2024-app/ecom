# E-commerce Platform: Build Plan

A storefront and a full admin panel, with a design system meant to look like it came from a specific brand, not a template. Remotion handles the video layer: product reels, campaign clips and animated moments, all generated from store data.

---

## 0. Decisions to make before Phase 1

The plan uses sensible defaults. These questions change real work, so answer them early:

| # | Question | Default if unanswered | Why it matters |
|---|----------|-----------------------|----------------|
| 1 | What does the store sell, and who buys it? | A single-brand, design-led goods store (apparel, homeware, objects) | Sets the art direction, the product model (variants, bundles, digital goods) and the copy voice |
| 2 | Which market and currency? | One region, one currency to start, with multi-currency ready in the schema | Picks the payment provider (Stripe or Razorpay), tax engine and shipping carriers |
| 3 | Single brand or multi-vendor marketplace? | Single brand | A marketplace adds vendor onboarding, payouts and split orders, roughly +40% scope |
| 4 | Hosting and database | Vercel + Supabase Postgres (both connectors are already attached) | Changes deploy pipeline, storage and auth wiring |
| 5 | Remotion license | Company license if the business has more than 3 people | Remotion is free for individuals and small teams only. Budget for it. |

---

## 1. What "anti-AI-slop" means here

"Slop" is the default output you get when nobody makes a decision. We ban it by name and replace each item with a deliberate choice.

### 1.1 Banned patterns

| Slop pattern | What we do instead |
|---|---|
| Purple-to-blue gradients, gradient blobs, glowing orbs | Flat color fields. One accent color used in under 5% of any screen. |
| Glassmorphism, frosted cards, soft drop shadows on everything | 1px hairline rules, borders and whitespace create the structure. Shadows only for things that float (menus, drawers). |
| `rounded-2xl` on every element | A radius scale of 0 / 2 / 4px. Pills only for tags and chips. |
| Inter or Geist for everything | A real type pairing (see 2.2) with a hierarchy you can see from across the room. |
| Centered hero + headline + two buttons + 3-column icon grid | Asymmetric editorial layouts on a 12-column grid. Product photography leads, not icons. |
| Emoji or generic line icons as decoration | Icons only where they carry meaning (cart, search, close). Numbers, type and photos do the decorating. |
| "Elevate your style", "Unlock", "Seamless", "Curated just for you" | Plain, specific copy with a voice. Product facts: material, weight, origin, fit. |
| Fade-up-on-scroll on every block | Motion with a purpose: state changes, spatial continuity, feedback. Everything else is still. |
| Skeleton shimmer as decoration | Real loading states sized to the content, kept short with streaming and caching. |
| Stock-photo people smiling at laptops | A photography brief: consistent light, one backdrop, real texture, with no AI-generated product imagery. |
| Dark mode as an inverted afterthought | Two themes designed together from the same token set. |

### 1.2 Principles

1. **Have a point of view.** Every screen should be recognizable as this brand with the logo removed.
2. **Typography does the work.** Size contrast, weight contrast and tabular numerals carry hierarchy before color does.
3. **Content first.** Photos and product facts are the interface. Chrome stays quiet.
4. **Density where it helps.** The storefront breathes. The admin is dense, fast and keyboard-first.
5. **Motion explains.** If an animation doesn't show where something came from or went, cut it.
6. **Prefer the boring solution.** Accessible, native, fast. Novelty goes in content, not in reinventing a select box.

### 1.3 Review gate

Every UI pull request is checked against the "Slop checklist" in Appendix A. A failed item blocks the merge.

---

## 2. Design direction: "Catalog & Receipt"

This is a proposal, to be adjusted once question 1 is answered. The concept borrows from printed mail-order catalogs and shop receipts: editorial photography, strict grids, monospaced prices and SKUs, and a receipt motif that runs through cart, checkout, order confirmation and the Remotion videos.

### 2.1 Color tokens

Defined as CSS variables in `packages/ui/tokens.css`, consumed through Tailwind v4 `@theme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F3F0E8` | `#121211` | Page background, warm off-white, not `#FFF` |
| `--paper-2` | `#E9E5DA` | `#1B1B19` | Raised surfaces, table stripes |
| `--ink` | `#151514` | `#EDEAE2` | Body text, primary buttons |
| `--ink-2` | `#5C5A55` | `#A19E96` | Secondary text |
| `--rule` | `#CFCABD` | `#2E2D2A` | Hairlines, borders |
| `--signal` | `#D9432B` | `#F0603F` | One accent: sale, primary call to action, focus ring |
| `--ok` / `--warn` / `--bad` | muted green / ochre / brick | tuned for dark | Admin status only |

Contrast: all text pairs meet WCAG AA (4.5:1). We check this in CI with a token-contrast script.

### 2.2 Typography

- **Display:** a high-contrast serif with optical sizes, such as *Newsreader* or *Gloock* (free), or a licensed face like *GT Super* if budget allows. Used large (56 to 120px) and tight.
- **Text / UI:** a neutral grotesk with character, such as *IBM Plex Sans* or *Public Sans*. Not Inter.
- **Mono:** *JetBrains Mono* or *IBM Plex Mono* for prices, SKUs, order numbers, quantities and admin tables. Always `font-variant-numeric: tabular-nums`.
- **Scale:** a fixed modular scale (1.25) with 6 steps and fluid `clamp()` for display sizes only.
- Load fonts self-hosted through `next/font`, subset, with `font-display: swap` and size-adjusted fallbacks to avoid layout shift.

### 2.3 Layout and components

- 12-column grid, 24px gutters, visible structure: section rules, numbered sections ("01 / New in"), captions under images.
- Product cards: image, then name in text face, then price in mono. No card box, no shadow. Hover swaps to a second image and shows a quick-add row.
- Buttons: rectangular, 2px radius, solid ink or outlined. One primary action per view.
- The cart drawer looks like a receipt: dotted leaders between item and price, running total, perforated edge.

### 2.4 Motion language

- **Library:** Motion (`motion/react`) for UI transitions, Remotion for video.
- **Tokens:** durations of 120 / 200 / 320ms with one standard easing `cubic-bezier(.2,.7,.1,1)` and one emphasized easing.
- **Allowed:** shared-element transitions from product card to product page (View Transitions API with a Motion fallback), add-to-cart "fly to receipt", drawer and sheet slides, number tickers on totals, image crossfades.
- **Banned:** scroll-jacking, parallax on text, looping decorative animation, staggered fade-ups on static content.
- `prefers-reduced-motion` turns transitions into instant state changes. This is tested.

### 2.5 Deliverables before building pages

1. Token file and Tailwind theme.
2. A type specimen page and component inventory (Storybook or a `/design` route).
3. Three key screens designed at high fidelity first: home, product page and admin orders list. Everything else follows their patterns.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm + Turborepo | Shared packages, cached builds |
| Framework | Next.js (App Router), React 19, TypeScript strict | Server Components, Server Actions, streaming, PPR where stable |
| Styling | Tailwind CSS v4 with our tokens | No default palette. Only our tokens are exposed. |
| Primitives | Radix UI / shadcn/ui as an unstyled base | We copy components in and restyle them fully. The shadcn defaults are the slop we're avoiding. |
| Motion | Motion (`motion/react`), View Transitions API | |
| Video | Remotion, `@remotion/player`, Remotion Lambda | See section 6 |
| Database | PostgreSQL (Supabase) + Drizzle ORM | Typed schema, SQL migrations |
| Auth | Better Auth (or Supabase Auth) | Customer accounts plus staff accounts with RBAC, 2FA for staff |
| Payments | Stripe (Payment Element, webhooks) or Razorpay, depending on market | Behind a `PaymentProvider` interface |
| Search | Postgres full-text + `pg_trgm` to start, Meilisearch or Typesense when the catalog grows past about 5k SKUs | Faceted filters |
| Storage / images | Supabase Storage or S3, `next/image` with AVIF/WebP | Signed uploads from admin |
| Email | React Email + Resend | Order, shipping, password and abandoned-cart emails in the same visual language |
| Background jobs | Inngest (or Trigger.dev) | Webhooks, Remotion renders, emails, inventory sync |
| Forms / validation | React Hook Form + Zod, shared schemas between client and server | |
| Admin data | TanStack Table, TanStack Query (client islands), `cmdk` command palette | |
| Charts | visx or Recharts, styled with our tokens | |
| Rich text | Tiptap | Product descriptions, CMS pages |
| Testing | Vitest, Playwright, axe-core, Chromatic or Playwright screenshots | |
| Observability | Sentry, Vercel Analytics / Speed Insights, structured logs | |
| CI/CD | GitHub Actions + Vercel previews | |

---

## 4. Architecture

```
ecom/
├─ apps/
│  ├─ storefront/      Next.js: public shop, account, checkout
│  ├─ admin/           Next.js: staff panel at admin.<domain>
│  └─ video/           Remotion project: compositions, studio, Lambda entry
├─ packages/
│  ├─ db/              Drizzle schema, migrations, seed
│  ├─ core/            Domain logic: pricing, cart, tax, inventory, order state machine
│  ├─ ui/              Design tokens, primitives, shared components
│  ├─ emails/          React Email templates
│  ├─ auth/            Auth config, RBAC permission map
│  ├─ payments/        Provider adapters (Stripe / Razorpay)
│  └─ config/          tsconfig, eslint, tailwind presets
└─ .github/workflows/
```

**Why separate storefront and admin apps:** separate bundles keep admin code out of the shop, separate domains and cookies reduce attack surface, and each can deploy on its own schedule. Both import the same `core` and `db` packages, so business rules live in one place.

**Domain rules live in `packages/core`**, not in route handlers. Pricing, discount stacking, tax and the order state machine are pure functions with unit tests. Server Actions and API routes are thin wrappers.

**Order state machine:**
`pending_payment → paid → fulfilling → partially_shipped → shipped → delivered`, with branches to `cancelled`, `refunded` and `partially_refunded`. Every transition writes to `order_events`, which powers the admin timeline and the audit log.

---

## 5. Data model (core tables)

- **Catalog:** `products`, `product_variants` (SKU, price, compare-at price, weight, barcode), `product_options` / `option_values`, `product_media` (image or video, sort order, alt text), `categories` (tree), `collections` (manual or rule-based), `tags`
- **Inventory:** `locations`, `inventory_levels` (variant × location: on hand, reserved), `stock_movements` (append-only ledger)
- **Customers:** `customers`, `addresses`, `customer_segments` (rule JSON), `wishlists`
- **Commerce:** `carts`, `cart_items`, `orders`, `order_items` (price snapshot), `payments`, `refunds`, `fulfillments`, `shipments`, `returns`
- **Promotions:** `discounts` (code or automatic, percent / fixed / free shipping / BxGy, conditions JSON, usage limits), `gift_cards`
- **Content:** `pages`, `blocks` (homepage sections), `banners`, `navigation`, `reviews`
- **Video:** `video_templates`, `video_renders` (composition, input props, status, output URL, product or campaign link)
- **Admin:** `staff`, `roles`, `permissions`, `audit_log`, `api_keys`, `webhooks`, `settings`
- **Ops:** `shipping_zones`, `shipping_rates`, `tax_rates`, `currencies`

Money is stored as integer minor units plus a currency code, never floats. Order items snapshot name, SKU and price at purchase time.

---

## 6. Remotion: where video earns its place

Remotion renders React components to video. We use it where generated video adds something a static image can't. It is not decoration.

### 6.1 Use cases

| # | Feature | Where it shows | How it works |
|---|---|---|---|
| 1 | **Product reel**: an auto-generated 6 to 10s clip per product (images, name, price in mono, key specs) | Product page gallery, social exports | On product publish, an Inngest job calls Remotion Lambda with product data as input props. The MP4/WebM goes to storage and is added to `product_media`. |
| 2 | **Campaign Studio**: staff pick a template, products and copy, then export vertical, square and landscape clips | Admin → Marketing → Campaign Studio | Live preview with `@remotion/player` in admin. Rendered through Lambda. Downloads and render history kept. |
| 3 | **Drop countdown / launch teaser** | Homepage hero block, emails (GIF fallback) | Composition takes the drop date and product set |
| 4 | **Animated order receipt**: the receipt "prints" line by line | Order confirmation page, shareable link | Pre-rendered per order, or `Player` for the live page, lazy-loaded |
| 5 | **Weekly store recap**: revenue, top products and orders as a short motion summary | Admin dashboard, emailed to owners every Monday | Scheduled job feeds metrics into a composition |
| 6 | **Lookbook / collection film** | Collection pages | Template composed from collection imagery and captions |

### 6.2 Rules for using Remotion

- **The storefront ships rendered video files, not the Player.** Pre-rendered, compressed MP4 and WebM with a poster image, `preload="none"`, played when in view. This keeps the storefront JS budget intact. The Player runs only in admin previews and on the receipt page, and is lazy-loaded.
- **Compositions share the design system.** `apps/video` imports tokens and fonts from `packages/ui`, so videos and site look like one brand.
- **Templates are typed.** Each composition has a Zod schema for its props. The admin form for Campaign Studio is generated from that schema.
- **Renders are idempotent and cached.** The key is a hash of composition, props and template version. Re-publishing an unchanged product does not re-render.
- **Cost control:** render quotas per day in settings, concurrency limits on Lambda, and a fallback to a static image if a render fails.
- **Accessibility:** every video has a text equivalent nearby, no auto-playing sound, and captions where there is speech.

### 6.3 Other motion and visual libraries (used on purpose)

- **Motion:** UI transitions, layout animations, gestures (drawer drag, swipe gallery).
- **View Transitions API:** card-to-product page continuity and route changes.
- **Embla Carousel:** product galleries (accessible, small).
- **Lenis:** not used. Native scroll is better for a shop.
- **Three.js / R3F:** only if the product benefits from 3D (e.g. a configurator). Not in the first version.
- **Rive or Lottie:** only for one or two brand moments (e.g. an empty cart illustration), if the brand has an illustrator.

---

## 7. Storefront scope

**Pages:** home (CMS-driven blocks), collection / category listing with faceted filters, search with instant results, product page, cart drawer + cart page, checkout, order confirmation, account (orders, addresses, wishlist, returns), CMS pages (about, shipping, returns, FAQ), 404 / 500 written in the brand voice.

**Product page:** gallery with zoom, swipe and the product reel; variant picker with unavailable states; stock and delivery estimate; size guide; specs table in mono; reviews with photos; "complete the look"; sticky add-to-cart on mobile.

**Checkout:** one page with three steps (contact, shipping, payment). Guest checkout first, account optional. Address autocomplete. Payment Element with wallets (Apple Pay, Google Pay). Discount codes. Totals recalculated server-side on every change. Inventory reserved for 15 minutes at payment start.

**Platform:** SEO (metadata, JSON-LD Product and Breadcrumb, sitemap, canonical URLs), Open Graph images generated with `next/og` in the same visual style, i18n-ready routing, analytics events (view_item, add_to_cart, begin_checkout, purchase).

**Performance budgets (enforced in CI with Lighthouse CI):**
- LCP under 2.0s and CLS under 0.05 on mid-range mobile over 4G
- INP under 200ms
- Under 120 KB of first-load JS on product and listing routes

---

## 8. Admin panel scope

Design rules for admin: dense tables, mono numerals, a 13 to 14px base size, keyboard shortcuts everywhere, `⌘K` command palette, inline editing, optimistic updates with undo toasts, saved table views, and URL-encoded filters so any view can be shared.

| Module | Features |
|---|---|
| **Dashboard** | Revenue, orders, AOV and conversion with period comparison; live orders feed; low-stock alerts; top products; weekly Remotion recap |
| **Orders** | List with saved views and bulk actions (fulfill, print labels, export); detail page with timeline, payment, fulfillment, partial refunds, notes and tags; returns and exchanges; draft orders / manual orders |
| **Products** | List and grid; editor with variants matrix, options, pricing, media (drag to sort, alt text), SEO preview, inventory per location; bulk edit; CSV import and export; product reel status and re-render |
| **Collections & categories** | Tree editor, manual or rule-based collections, drag-to-reorder merchandising |
| **Inventory** | Levels per location, adjustments with reasons, transfers, stock movement ledger, reorder points |
| **Customers** | Profiles, order history, lifetime value, notes, segments built from rules, GDPR export and delete |
| **Discounts & gift cards** | Codes and automatic discounts, conditions builder, usage stats, schedules |
| **Marketing → Campaign Studio** | Remotion templates, live preview, multi-format export, render history |
| **Content** | Homepage block builder with live preview, pages (Tiptap), navigation menus, banners, media library |
| **Reviews** | Moderation queue, reply, feature on the product page |
| **Reports** | Sales, products, customers, discounts, taxes; date ranges; CSV export |
| **Settings** | Store details, currencies, taxes, shipping zones and rates, payments, email templates, domains, staff and roles, API keys, webhooks, render quotas |
| **Audit log** | Who changed what and when, with before/after diff, filterable |

**Roles (RBAC):** Owner, Admin, Manager, Fulfillment, Support, Content editor, Read-only. Permissions are checked in `packages/auth` on the server for every action. The UI hides what a role can't do, but the server is the source of truth.

**Security:** staff 2FA required, admin on a separate subdomain, CSRF protection on Server Actions, rate limits on auth and checkout, signed and verified payment webhooks, Postgres row-level security as defense in depth, file upload type and size checks, secrets only in environment variables.

---

## 9. Phased delivery

Estimates assume one experienced full-stack developer working with AI assistance. Each phase ends with a deployed preview and a demo.

### Phase 0: Foundations (week 1)
- Monorepo, tooling, CI (lint, typecheck, test, build), Vercel previews
- Drizzle schema v1, migrations, realistic seed data (about 60 products, with real-looking photography placeholders, not AI images)
- Auth for customers and staff, RBAC skeleton
- **Done when:** both apps deploy, a staff member can log in to admin, the seed loads.

### Phase 1: Design system (weeks 1–2)
- Tokens, fonts, Tailwind theme, light and dark
- Primitives: button, input, select, checkbox, radio, dialog, drawer, sheet, toast, tabs, tooltip, table, badge, skeleton
- Motion tokens and a reduced-motion hook
- `/design` specimen route and Storybook, with visual regression baselines
- High-fidelity home, product page and admin orders list
- **Done when:** every component passes axe, the slop checklist and visual snapshots in both themes.

### Phase 2: Catalog (weeks 2–4)
- Admin: products, variants, media upload, categories, collections, inventory
- Storefront: home (static blocks first), listing with filters, search, product page
- **Done when:** a product created in admin appears on the storefront with correct variants and stock.

### Phase 3: Cart & checkout (weeks 4–6)
- Cart (guest + merge on login), receipt-style drawer
- Pricing engine, discounts, tax, shipping rates in `packages/core` with unit tests
- Payment integration, webhooks, order creation, inventory reservation
- Transactional emails
- **Done when:** an end-to-end Playwright test buys a product with a test card, the order appears in admin, and stock decrements.

### Phase 4: Order operations (weeks 6–7)
- Admin orders: timeline, fulfillment, shipping labels (carrier API), refunds, returns
- Customer account: order history, tracking, returns requests
- **Done when:** the full order lifecycle including a partial refund works and is fully audited.

### Phase 5: Remotion video layer (weeks 7–9)
- `apps/video` with shared tokens and fonts; product reel and animated receipt compositions
- Remotion Lambda setup, Inngest render jobs, caching and quotas
- Campaign Studio in admin with live Player preview and multi-format export
- Weekly recap composition and email
- **Done when:** publishing a product generates its reel automatically within 2 minutes, and staff can export a campaign clip in three aspect ratios.

### Phase 6: Growth & content (weeks 9–10)
- CMS homepage block builder, pages, navigation
- Reviews, wishlist, customer segments, abandoned-cart emails
- Reports module and dashboard charts
- **Done when:** a non-technical editor can rebuild the homepage without a deploy.

### Phase 7: Hardening & launch (weeks 10–12)
- Performance pass against budgets, image and font audit
- Security review (OWASP top 10, dependency audit, webhook and auth tests)
- Accessibility audit (keyboard-only run, screen reader pass on checkout)
- SEO pass, analytics verification, error monitoring, backups, runbook
- **Done when:** all budgets are green in CI, there are no critical findings, and a staging dry-run of launch day has been completed.

**Rough total:** about 12 weeks for one developer. Two developers working in parallel (storefront and admin) bring it to about 7 to 8 weeks.

---

## 10. Quality and testing

- **Unit (Vitest):** everything in `packages/core`: pricing, discounts, tax, the order state machine, inventory reservation. Target 90%+ coverage on core.
- **Integration:** Server Actions against a test Postgres (Docker or a Supabase branch).
- **End-to-end (Playwright):** browse → add to cart → checkout → admin fulfill → refund. Admin CRUD for products and discounts. Run on every pull request.
- **Visual regression:** component and key-page screenshots in light, dark and reduced-motion modes.
- **Accessibility:** axe in Playwright on every page, plus a manual pass each phase.
- **Video:** Remotion compositions rendered as stills in CI to catch layout breaks. Props schemas validated.
- **Performance:** Lighthouse CI budgets on preview deployments.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Remotion render cost or latency | Cache by props hash, quotas, render on publish only, static fallback |
| Remotion license | Confirm team size and buy a company license before launch if required |
| Design drifts back to defaults over time | Locked tokens (no default Tailwind palette), the slop checklist in the PR template, visual regression |
| Scope creep in admin | Ship the module table in order. Anything else goes in a backlog reviewed per phase. |
| Payment edge cases (double charge, webhook retries) | Idempotency keys, webhook event store, reconciliation job |
| Overselling inventory | Reservations with expiry, row locks on decrement, a ledger to reconcile from |

---

## 12. Immediate next steps

1. Answer the questions in section 0, especially what the store sells.
2. Confirm or adjust the "Catalog & Receipt" direction and pick fonts.
3. Start Phase 0: scaffold the monorepo, CI and database schema on this branch.

---

## Appendix A: Slop checklist (for every UI pull request)

- [ ] No gradients, glows, blobs or glassmorphism
- [ ] Colors come only from tokens. The signal color covers under 5% of the screen.
- [ ] Radius is 0, 2 or 4px (pills only for chips and tags)
- [ ] No decorative shadows. Structure comes from rules and spacing.
- [ ] Display, text and mono faces used as specified. Numbers are tabular.
- [ ] Layout uses the grid. It is not a centered stack of identical cards.
- [ ] Icons carry meaning. No emoji or ornament.
- [ ] Copy is specific and plain. None of: elevate, unlock, seamless, curated, journey, effortless, game-changing.
- [ ] Every animation explains a change. Reduced-motion mode verified.
- [ ] Empty, loading, error and success states are designed, not default.
- [ ] Keyboard and screen reader path works. axe passes.
- [ ] Looks deliberate in both light and dark themes.
- [ ] Would someone recognize this brand with the logo removed?
