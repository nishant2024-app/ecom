# 08 · Design system: "Milk Card"

## Concept

Many Indian households keep a **milk card**: a printed monthly calendar on which each day's delivery is ticked, settled at month end. Our interface is built from that object. The subscription is a month grid; the wallet is a receipt-like ledger; numbers are set like a printed bill. The identity comes from how the business works, not from a template.

Two moods from one system:

| Surface | Mood |
|---|---|
| Storefront, account | Calm, large print, generous space. Built for a low-end Android phone, slow 4G, Hindi or English, and older users. |
| Admin, dispatch, agent | Dense, fast, keyboard-first (admin) or one-thumb (agent). |

## Anti-slop rules

"AI slop" is what you get when nobody makes a decision. These are banned by name.

| Banned | Use instead |
|---|---|
| Purple/blue gradients, glowing blobs, mesh backgrounds | Flat `--paper` surfaces. Marigold appears on under 5% of any screen. |
| Glassmorphism, frosted panels | Opaque surfaces separated by 1px `--rule` lines |
| Soft drop shadows on cards | No shadows except on floating layers (menus, sheets, toasts) |
| `rounded-2xl` everywhere | Radius 0 (layout), 2px (inputs, buttons), 4px (sheets, images). Pills only for chips. |
| Inter / Geist for everything | Tiro Devanagari Hindi + Mukta + JetBrains Mono (below) |
| Centered hero + two buttons + 3-column icon grid | Asymmetric grid. Real photography leads. Numbered sections. |
| Emoji and decorative icons | Icons only where they carry meaning (cart, search, close, back, call) |
| "Elevate", "unlock", "seamless", "goodness delivered with love" | Facts: fat %, milking time, pack date, source farm, price per litre |
| Fade-up on scroll, staggered entrances | Motion only to explain a change of state |
| Skeleton shimmer used as decoration | Content-shaped placeholders, shown only after 300 ms |
| AI-generated cows, food or people; stock photos | Our own photography (brief below) |
| Dark mode as inverted colours | A dark theme designed from the same tokens ("night delivery") |

## Tokens

Defined once in `packages/ui/tokens.css` as CSS variables and exposed to Tailwind v4 via `@theme`. The default Tailwind colour palette is **removed**, so only tokens can be used.

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F6F2E7` | `#0F1424` | Page background |
| `--paper-2` | `#ECE6D6` | `#171D31` | Raised surface, calendar cells, table stripes |
| `--paper-3` | `#E2DAC6` | `#20273E` | Pressed / selected |
| `--ink` | `#1B2340` | `#ECE8DC` | Text, primary button background |
| `--ink-2` | `#5B6075` | `#A3A7B8` | Secondary text, captions |
| `--ink-3` | `#868A9A` | `#767B8F` | Disabled, placeholders (not for essential text) |
| `--rule` | `#D6CFBC` | `#2A3149` | Hairlines, borders, calendar grid |
| `--signal` | `#E3A21A` | `#F0B53A` | Marigold. **Fill only.** Today's cell, the one primary call-to-action, focus ring. Never text on cream. |
| `--on-signal` | `#1B2340` | `#0F1424` | Text on marigold |
| `--tick` | `#2F7A4B` | `#5DBB83` | Delivered tick, success |
| `--alert` | `#B93A2B` | `#E5634F` | Errors, low balance, missed delivery |
| `--veg` | `#1E8E3E` | `#3DBA5E` | Veg mark only |

All text/background pairs used for text meet WCAG AA (4.5:1 body, 3:1 large). `pnpm ui:contrast` checks every pair in CI.

### Typography

| Role | Face | Notes |
|---|---|---|
| Display | **Tiro Devanagari Hindi** (Google Fonts, OFL) | Includes matching Latin. Headings in both scripts. |
| Text / UI | **Mukta** (Google Fonts, OFL) | Latin and Devanagari designed together. Weights 400, 500, 700. |
| Numbers | **JetBrains Mono** (OFL) | Prices, quantities, litres, balances, order and batch numbers. Always `font-variant-numeric: tabular-nums`. |

Self-hosted via `next/font` / `@fontsource`, subset per script (`latin`, `devanagari`), `font-display: swap`, with size-adjusted fallbacks to avoid layout shift.

**Scale** (ratio 1.25, base 16px storefront / 14px admin):

| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Admin metadata only (never storefront body) |
| `text-sm` | 14 / 20 | Admin body, captions |
| `text-base` | 16 / 24 | Storefront body (minimum) |
| `text-lg` | 20 / 28 | Lead text, card titles |
| `text-xl` | 25 / 32 | Section headings |
| `text-2xl` | 31 / 38 | Page headings |
| `text-display` | `clamp(40px, 8vw, 88px)` / 1.0 | Home and campaign headlines only |

Devanagari needs more vertical room: line height is +10% for `lang="hi"` blocks, and containers never clip text vertically.

**Numbers and money:** always `Intl.NumberFormat('en-IN')`: ₹1,00,000.00, 2,140 L. Show ₹ with no space. Paise only where it matters (unit prices); totals can round to rupees in display when every line is whole rupees.

### Space, layout, radius

- Spacing scale (px): 0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Grid: 4 columns on mobile (16px gutter), 8 on tablet, 12 on desktop (24px gutter), max content width 1200px.
- Radius: `--r-0: 0`, `--r-1: 2px`, `--r-2: 4px`, `--r-pill: 999px` (chips only).
- Borders: 1px `--rule`. Emphasis border: 2px `--ink`.
- Tap targets: at least 48 × 48 px on storefront and agent apps.

### Motion

| Token | Value |
|---|---|
| `--dur-1` | 120 ms (hover, press) |
| `--dur-2` | 200 ms (toggles, cell flip) |
| `--dur-3` | 320 ms (sheets, page transitions) |
| `--ease` | `cubic-bezier(.2,.7,.1,1)` |
| `--ease-emph` | `cubic-bezier(.3,0,0,1)` |

Allowed: calendar cell flip on quantity change; tick drawn on delivered; balance number ticker; sheet and drawer slides; shared-element transition from product card to product page (View Transitions API, Motion fallback).

Banned: scroll-jacking, parallax on text, looping decorative animation, entrance animations on static content.

`prefers-reduced-motion: reduce` and the in-app **Lite mode** (for low-end phones; also disables video autoplay and large images) replace all transitions with instant changes.

## Signature components

### Milk card calendar

The core of the customer experience.

```
 December 2026                         ₹1,860 this month
 ─────────────────────────────────────────────────────────
  Mon    Tue    Wed    Thu    Fri    Sat    Sun
 ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
 │  1 ✓ │  2 ▣ │  3   │  4   │  5   │  6   │  7   │
 │ 2×   │ 2×   │ 2×   │ 2×   │ 2×   │ 3×   │ 3×   │
 ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
 │  8   │  9   │ 10   │ 11   │ 12   │ 13   │ 14   │
 ...
 │ 20 — │ 21 — │ 22 — │ 23 — │ 24 — │ 25 — │ 26 — │   paused (vacation)
 └──────┴──────┴──────┴──────┴──────┴──────┴──────┘
  ✓ delivered   ▣ tomorrow (editable until 10:00 PM)   — paused
```

- Cell: date (Mukta), quantity (mono), state mark. Today/tomorrow cell filled with `--signal`.
- Tap a future cell → bottom sheet: per-product quantity steppers, "Skip this day", "Same for every Saturday" (pattern change).
- Drag across cells (or "Pause dates" button) to create a pause.
- Past cells: tap opens the delivery detail (status, time, batch, invoice).
- Accessibility: ARIA `grid` with roving tabindex; arrow keys move; each cell's accessible name reads "Saturday 6 December, 3 Toned Milk 500 ml, planned, editable until 10 PM Friday".

### Receipt ledger ("hisaab")

```
 WALLET                                  ₹418.00
 ─────────────────────────────────────────────────
 1 Dec   Delivery · 2 × Toned 500 ml ........ −60.00
 30 Nov  Top-up · UPI ...................... +500.00
 30 Nov  Delivery · 2 × Toned 500 ml ........ −60.00
 ─────────────────────────────────────────────────
```

Dotted leaders, mono amounts right-aligned, credits in `--tick`, debits in `--ink`.

### Product card

Photo (4:5), name (Mukta 500), pack size and fat % (`--ink-2`), price (mono), veg mark. No box, no shadow. "Add" or "Subscribe" button on the card on mobile.

### Cutoff banner

"Change tomorrow's order until 10:00 PM". A live countdown appears only in the final hour. After cutoff: "Tomorrow is locked. Changes now apply from Thursday."

### Admin patterns

Dense tables (TanStack Table): mono numerals, sticky header, column visibility, saved views encoded in the URL, inline edit, bulk actions, keyboard shortcuts (`j/k` move, `x` select, `e` edit, `/` search, `⌘K` command palette). Optimistic updates with an undo toast.

### Agent app patterns

One stop per screen, huge primary action ("Delivered"), secondary actions in a sheet, offline banner with queued-event count, works one-handed.

## Iconography

[Lucide](https://lucide.dev) icons at 1.5px stroke, sized 20/24px, `currentColor`. A limited set of about 30 icons. No filled icon styles, no emoji.

## Photography brief

- Our farm, our animals, our packs, our delivery team. Real people with consent.
- Morning light, steel utensils, matte surfaces. One consistent backdrop for product shots (warm off-white paper) at a fixed angle and lens.
- Products shot at true size relationships so a 500 ml pouch and 1 L bottle read correctly next to each other.
- No AI-generated imagery of food, animals or people.
- Exports: 2000px masters → resized by the API to AVIF/WebP at 320/640/960/1280/1600px.

## Voice and copy

- Plain, specific, warm, short. Speak like a trusted local dairy.
- Lead with facts: "Toned milk, 3% fat, packed at 3 AM, delivered by 7."
- Numbers over adjectives: "Fresh for 2 days in the fridge" not "Long-lasting freshness".
- Errors say what happened and what to do: "Tomorrow's order closed at 10 PM. You can still change Thursday."
- Hindi is written natively, not machine-translated. Product names may stay in common usage (पनीर, दही).
- Banned words: elevate, unlock, seamless, curated, journey, goodness, effortless, world-class, revolutionary.

## Accessibility

- WCAG 2.2 AA target.
- Every interactive element reachable by keyboard; visible focus ring (2px `--signal` + 2px `--ink` offset).
- Labels on all inputs; errors announced with `aria-live`.
- `lang` attribute set per block for mixed Hindi/English content.
- Screen-reader pass with TalkBack (Android) in both languages before launch.
- axe-core in Playwright on every page; zero violations allowed.

## Performance (design constraints)

- Storefront first-load JS ≤ 120 KB on catalog and calendar routes.
- LCP ≤ 2.5 s, CLS ≤ 0.05, INP ≤ 200 ms on a low-end Android phone over 4G.
- Images: AVIF first, explicit width/height, lazy below the fold.
- Videos: never autoplay on cellular in Lite mode; poster image first.

## Anti-slop checklist (every UI pull request)

- [ ] No gradients, glows, blobs or glassmorphism
- [ ] Only token colours. Marigold is a fill, never text on cream, under 5% of the screen.
- [ ] Radius 0, 2 or 4px (pills only for chips)
- [ ] No decorative shadows
- [ ] Tiro / Mukta / mono used as specified. Numbers tabular. Money in en-IN format.
- [ ] Works in Hindi as well as English, with no clipped Devanagari
- [ ] Real photography only. No AI-generated food, animals or people.
- [ ] Copy states facts. No banned words.
- [ ] Every animation explains a change. Reduced motion and Lite mode verified.
- [ ] Empty, loading, error and offline states designed
- [ ] Usable at 360px width with 48px tap targets
- [ ] Keyboard and screen reader path works. axe passes.
- [ ] Looks deliberate in light and dark
- [ ] Recognisable as this brand with the logo removed
