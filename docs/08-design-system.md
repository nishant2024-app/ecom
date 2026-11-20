# 08 · Design system: "Pasture & Pantry"

## Direction

Fresh, warm and animated, in the spirit of the reference sites the owner shared (green farm palettes, product-led heroes, rounded organic surfaces). The aim is to make it this brand's own rather than a template:

- **Forest green, cream and ghee gold.** Gold comes from the hero product.
- **Drawn packaging (`PackShot`)** stands in for photography until the product shoot: jars, tins, cartons, cans, boxes and pouches drawn in SVG with the product's real name and size. It's one consistent visual language across site, admin and video, with no stock photos and no AI-generated food or animals.
- **Motion with a purpose:** things move to show where they come from or go (packs fly into the basket, a parcel closes when the order is confirmed, process steps advance as you scroll).
- **Honest content:** no fake testimonials, no invented customer counts, no "2K happy customers" avatars. Facts are product facts: shelf life, process, fat %, delivery days.

## Tokens

`packages/ui/tokens.css`, exposed through Tailwind v4 in `packages/ui/theme.css`. The default Tailwind palette, radii and shadows are removed, so only these names exist.

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` / `paper-2` / `paper-3` | `#FBF7EE` / `#F3ECDC` / `#E9DFC8` | `#0D1A14` / `#13241C` / `#1A3026` | Page, cards, pressed |
| `ink` / `ink-2` / `ink-3` | `#14271F` / `#4B5C53` / `#7E8B83` | `#EFE9DA` / `#B2BDB5` / `#7F8D85` | Text (ink-3 never for essential text) |
| `forest` / `forest-2` / `on-forest` | `#14432F` / `#1D5A40` / `#F6F1E4` | `#1A4B35` / `#22603F` / `#F6F1E4` | Brand panels, primary buttons |
| `meadow` | `#D8E8C2` | `#2A4A33` | Soft highlight bands |
| `signal` (ghee gold) / `on-signal` | `#E9B44C` / `#14271F` | `#F0C062` / `#0D1A14` | The one main call to action, prices on dark, progress |
| `tick`, `alert`, `veg` | greens / brick | tuned | Success, errors, veg mark |
| radius | `1` 2px · `2` 6px · `3` 14px · `4` 24px · `5` 36px · `pill` | | Cards 24px, hero/footer panels 36px, buttons pill |
| motion | 140 / 240 / 420 ms, `cubic-bezier(.2,.7,.1,1)` | | Springs for physical things (packs, drawers) |

`pnpm --filter @dairy/ui contrast` checks every text pair against WCAG AA in both themes (all pass).

**Type:** Tiro Devanagari Hindi (display, bilingual), Mukta (text, Latin + Devanagari), JetBrains Mono (prices, SKUs, order numbers, tabular). Self-hosted via `@fontsource`.

## Components

| Component | Where | Notes |
|---|---|---|
| `PackShot` | Everywhere | `kind`, `color`, `accent`, `label`, `size`; stored per product in `products.pack`, editable with live preview in admin |
| Hero | Home | Word-by-word headline reveal; five packs float on their own rhythm, follow the pointer slightly and spread apart on scroll; parallax sun and hills |
| Marquee | Home | Endless facts strip; pauses on hover; static with reduced motion |
| Category tiles | Home | Three packs fan out on hover |
| Product card | Shop, home | Lifts and tilts its pack on hover; badges for discount, low stock, sold out, shelf life; Add triggers the fly-to-basket arc |
| Process | Home | Sticky section: five steps advance with scroll, progress line fills, illustration swaps |
| Stats | Home | Counters animate once in view |
| Reel | Home | Remotion-rendered video, plays muted only while visible |
| Cart drawer | Global | Spring slide-in, live server quote, free-shipping progress bar, pincode ETA |
| Order hero | Order page | Parcel flaps close and a tick draws when payment confirms; animated progress timeline |
| Admin | Admin | Dense, calm: forest sidebar, rounded cards, status badges, drawers for editing, keyboard shortcuts |

## Motion rules

- Every animation explains something (arrival, departure, progress, state change) or is ambient and slow (floating packs, sun).
- `prefers-reduced-motion`: no floating, no parallax, no marquee, no counters running; content appears instantly. The reel shows its poster with a Play button.
- Scroll reveals use `whileInView` once; content is in the server-rendered HTML, so search engines and no-JS readers still get it.
- Keep it light: the storefront's first-load JS is ~155–170 KB (Motion included). The budget is **180 KB**; anything heavier needs lazy loading.

## Voice

Plain, warm, specific. "Bilona ghee cooked over a wood fire" rather than "Elevate your cooking". Numbers over adjectives. Errors say what happened and what to do: "Only 3 of Milk Cake 250 g left".

**Copy to confirm with the owner before launch:** process claims (wood-fire cooking, spray-drying within hours, moisture levels), shelf lives, the "how it's made" steps, delivery days per zone.

## Checklist for UI changes

- [ ] Only token colours; gold is for the main action and highlights, never small text on cream
- [ ] Real facts only: no fabricated reviews, counts, badges or avatars
- [ ] PackShot or real photography; no stock/AI imagery
- [ ] Every animation has a reason, and reduced motion is verified
- [ ] Works at 360px; tap targets ≥ 44px
- [ ] Prices in ₹ with Indian grouping and tabular figures
- [ ] Keyboard and screen reader path works; dialogs trap and restore focus; contrast passes
- [ ] Light and dark both look deliberate
