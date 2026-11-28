# 08 · Design system: "Fresh Dairy"

## Di## Direction

Version 3 (November 2026). The owner asked for **white and green, like a direct-to-consumer dairy store** (reference: milko.in), and found the cream/serif editorial look of version 2 too "designed". Version 3 is a clean shopping app:

- **White pages, dairy green (`#17803d`) for every action**, soft grey (`#f4f7f4`) panels, a pale green tint for highlights. Amber is used only in the admin, for orders that need action.
- **One typeface: Figtree** (bold, tight headings; Mukta covers Hindi). Tabular figures for prices.
- **Shop-first layout:** big search in the header, "Deliver to" pincode, cart button with item count and total; rounded banner; trust tiles; round category tiles; product grid; tabbed "Shop all"; why-us block; FAQ.
- **Product card:** square image on grey, shelf-life badge, bold name, size, "₹X OFF" in green, a grey price pill with a round green **+** that becomes a − 1 + stepper once the item is in the cart.
- **Mobile:** sticky header with search underneath, bottom tab bar (Home, Shop, Orders, Cart) and a floating "View cart" bar.
- **No pop-up on page load.** The pincode check is a header button and an inline strip; Google treats load-time interstitials on mobile as intrusive.
- Photos uploaded in the admin replace the drawn packs everywhere; nothing uses stock or AI-generated images.

kens

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

**Type:** Figtree for everything (Mukta for Devanagari), JetBrains Mono only for codes such as SKUs. Self-hosted via `@fontsource`; no font CDN.

## Components

| Component | Where | Notes |
|---|---|---|
| `Photo` / `ProductImage` | Everywhere | Owner's photo with `srcset` from the API's pre-resized WebP files (no image optimiser needed on the server); falls back to `PackShot` |
| `PackShot` | Fallback art | `kind`, `color`, `accent`, `label`, `size`; stored per product in `products.pack`, editable in admin |
| Announcement bar | Global | Text from Admin → Storefront; hidden when empty |
| Header | Global | Flat bar, text links, outlined Basket button with count; bottom rule appears on scroll; categories scroll horizontally on mobile |
| Hero | Home | Copy from Admin → Storefront. Photo version: clip-path reveal and slow settle. No photo: products drop onto two wooden shelves, tags swing in |
| Promises | Home | Four numbered facts between two rules, edited in admin |
| Product card | Shop, home, related | Square-cornered 4:5 image, mono category and shelf-life line, outlined Add button that triggers the fly-to-basket arc |
| Shelves | Home | Category index set like a contents page |
| Story | Home | Admin-edited text with drop cap; photo, or the batch-label graphic until a photo is uploaded |
| Delivery timeline | Home | Real dates from today in IST, skipping Sundays |
| Gallery | Product page | Main photo with thumbnails and counter; drawn pack that changes with size if no photos |
| "On the label" | Product page | Back-of-pack style: milk source, ingredients, process, shelf life, storage, nutrition, HSN, FSSAI |
| Cart drawer | Global | Live server quote, free-shipping progress, pincode ETA |
| Admin | Admin | Dense, calm: forest sidebar, drawers for editing, photo manager with drag-to-reorder, storefront editor with character counters, bulk order actions, icon sidebar with a profile and sign-out card, visible row actions with confirm dialogs, cards instead of tables on phones |

## Motion rules

- Every animation explains something (arrival, departure, progress, state change). Nothing floats or loops endlessly on the storefront.
- `prefers-reduced-motion`: everything appears in place instantly.
- Scroll reveals use `whileInView` once; content is in the server-rendered HTML, so search engines and no-JS readers still get it.
- Keep it light: the storefront's first-load JS is ~155–170 KB (Motion included). The budget is **180 KB**; anything heavier needs lazy loading.

## Voice

Plain, warm, specific. "Bilona ghee cooked over a wood fire" rather than "Elevate your cooking". Numbers over adjectives. Errors say what happened and what to do: "Only 3 of Milk Cake 250 g left".

**Copy to confirm with the owner before launch:** process claims (wood-fire cooking, spray-drying within hours, moisture levels), shelf lives, the "how it's made" steps, delivery days per zone.

## Checklist for UI changes

- [ ] Only token colours; gold is for the main action and highlights, never small text on cream
- [ ] Real facts only: no fabricated reviews, counts, badges or avatars
- [ ] Owner's photography, or PackShot until then; no stock or AI imagery
- [ ] None of the AI tells: pill-shaped everything, glowing blobs, floating objects, marquees, counters, icon-trio process rows, eyebrow-over-heading on every section
- [ ] Every animation has a reason, and reduced motion is verified
- [ ] Works at 360px; tap targets ≥ 44px
- [ ] Prices in ₹ with Indian grouping and tabular figures
- [ ] Keyboard and screen reader path works; dialogs trap and restore focus; contrast passes
- [ ] Light and dark both look deliberate
