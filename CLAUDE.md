# Working rules for this repository

## Before building anything: research first (owner's standing instruction)

When the owner asks to build or redesign something (a site, an app, a feature, a page), do **not** start coding straight away. Follow this process and show the owner the findings before or alongside the build:

1. **Understand what we are building.** Restate the goal, who the customers are, and what the owner has already decided (see "Business decisions" below). Ask only about things that change the plan.
2. **Identify the competitors.** For this business the main competitor is **Amul** (shop.amul.com, the Amul app), followed by other Indian dairy brands that sell online, for example Mother Dairy, Gowardhan/Parag (Pune), Chitale (Pune), Nandini, Akshayakalpa, Country Delight, Milky Mist and Sid's Farm, plus quick-commerce apps where these products sell (Blinkit, Zepto, Swiggy Instamart, BigBasket).
3. **Study their websites, apps and products.** Look at catalogue and pack sizes, prices, shipping and delivery promises, payment options, sign-in, product pages, trust signals, offers and subscriptions, mobile experience, reviews and complaints. Use screenshots where the network allows; otherwise web search.
4. **Write down what to copy, what to avoid and how we beat them.** List the features we need (must-have / later), the gaps in competitors we can win on, and the UX decisions. Save it in `docs/` (for example `docs/15-competitor-research.md`) so it stays with the project.
5. **Then build**, referring back to that list, and verify in the browser (desktop, mobile, dark mode) before reporting.

Never copy a competitor's brand, logo, text, photos or exact layout. Learn the patterns, then make our own.

## Business decisions already made

- Single brand now (placeholder name "Mulshi Dairy"), designed to become multi-vendor later.
- Sells **shelf-stable processed dairy** (ghee, milk powder, UHT/flavoured milk, condensed milk, mithai), shipped by courier across India. Not daily fresh-milk delivery.
- Payments: **Cashfree**, INR, prepaid only (no COD for now).
- Sign-in: **Google only** (no SMS/OTP). Android app later, using the same API.
- Backend: Fastify API (also serves the future Android app). Hosting must be zero cost and scale to 50k–100k users: Oracle Always Free + Cloudflare. Not Vercel, not Supabase, not Hostinger shared hosting.
- Design (Nov 2026): white and dairy green, clean app-like shop (owner's reference: milko.in). Owner rejected cream/serif "editorial" styles and anything that looks AI-generated.
- Images: only the owner's own photos uploaded in the admin (no Google Images, no stock or AI images). Drawn packs (`PackShot`) until photos exist.
- The owner provides only keys and accounts (database, domain, Cashfree, Google, R2). Everything else must be manageable in the admin panel without code.
- Full documentation is required (`docs/`, `docs/api/`).

## Repository conventions

- pnpm + Turborepo monorepo: `apps/api` (Fastify), `apps/web` (Next.js storefront), `apps/admin` (Vite React), `apps/video` (Remotion), `packages/core`, `packages/db`, `packages/ui`.
- Money in integer paise; dates in IST via `packages/core/time.ts`.
- Run `pnpm --filter @dairy/api test` (needs local Postgres) and typecheck web/admin before committing. Regenerate `docs/api/openapi.json` when routes change.
- Design tokens live in `packages/ui/tokens.css` and `theme.css`; Tailwind's default colours are removed, so use token names (or explicit hex values for photo overlays).
