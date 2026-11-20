# 08 · Design system: "Pasture & Pantry"

## Direction

Version 2 (November 2026). The first version was rounded, glowing and floaty, and the owner said it looked AI-generated. We checked it against published lists of "AI look" tells (sources below) and found most of them: pill shapes everywhere, a rounded hero card with a blurred sun, floating products, a marquee, animated counters, three-step icon process, and a repeated small-caps eyebrow above every serif heading. Version 2 removes all of them.

The direction now is **a printed shop label, not a startup landing page**:

- **Square corners and printed rules.** Hairlines, 1–2 px black borders, and the back-of-pack label as a layout device (the product page's "On the label" panel). Corners are square except tiny UI controls.
- **Photography first.** Every image slot (hero, story, product cards, product gallery) shows the owner's real photos uploaded in the admin. Until a photo exists the slot falls back to drawn packaging (`PackShot`) on wooden shelves with kirana-style price tags, so the site never shows stock or AI-generated images.
- **Type with character.** Young Serif for headings, Newsreader (italic) for editorial text and captions, Mukta for UI text (Latin + Devanagari), JetBrains Mono for prices, dates, batch codes and labels.
- **Specific, checkable content.** The delivery timeline uses today's real dates ("Fri 20 Nov → packed Sat → arrives Sun–Mon in Pune"); the batch-label graphic shows the real batch-code format. No testimonials, counters or badges we can't back up.
- **Motion that explains.** Headline words rise once, products drop onto the shelf, the hero photo unwraps, packs fly into the basket. Nothing floats or loops forever.
- **Forest green, cream and ghee gold** stay as the palette. Cream areas carry a faint paper grain.

Sources used for the review: [21st.dev: why your website looks AI-generated](https://21st.dev/blog/website-not-look-ai-generated), [UX skill wiki: detecting AI slop in design](https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design), [Utsubo: trust signals for AI-built sites](https://www.utsubo.com/blog/built-with-ai-trust-signals-2026), [DEV: fixing the AI-generated look in your frontend](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh), [Creative Bloq: everything looks the same now](https://www.creativebloq.com/ai/everything-looks-the-same-now-what), [Search Engine Journal: common AI website mistakes](https://searchenginejournal.com/7-common-ai-website-mistakes-that-are-easy-to-avoid/574196/).

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

**Type:** Young Serif (headings; Tiro Devanagari Hindi covers Hindi), Newsreader (editorial text, captions), Mukta (UI text, Latin + Devanagari), JetBrains Mono (prices, SKUs, dates, `label` utility). Self-hosted via `@fontsource`; no font CDN.

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
| Admin | Admin | Dense, calm: forest sidebar, drawers for editing, photo manager with drag-to-reorder, storefront editor with character counters, bulk order actions, keyboard shortcuts |

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
