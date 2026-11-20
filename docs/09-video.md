# 09 · Video with Remotion

`apps/video` turns React components into MP4s using the **same `PackShot` illustrations and fonts** as the site. Rendering runs on our own machine with the installed Chromium; there's no Remotion Lambda and no AWS bill.

## Compositions

| ID | Size | Length | Use |
|---|---|---|---|
| `PantryReel` | 1080 × 1080 | 10 s | Instagram/WhatsApp posts and ads (removed from the home page in design v2; `ReelVideo` remains available). Headline reveal, packs spring in on a hill, fact chips, logo outro. |
| `ProductReel` | 1080 × 1350 | 8 s | One product from catalog data: pack rises in, name, tagline, three facts, price stamp. Props: `name, size, tagline, price, pack, facts`. |

## Commands

```bash
pnpm --filter @dairy/video studio                 # preview and tweak in Remotion Studio
pnpm --filter @dairy/video render                 # PantryReel → apps/web/public/video/pantry-reel.mp4 (+ .jpg poster)
pnpm --filter @dairy/video render ProductReel out/ghee.mp4 '{"name":"A2 Gir Cow Ghee","size":"500 ml","tagline":"Bilona method","price":"₹1,150","pack":{"kind":"jar","color":"#E9B44C","accent":"#14432F"},"facts":["Hand-churned","Wood-fire cooked","Keeps 9 months"]}'
```

The render script uses `CHROME_PATH` if set, otherwise the local headless Chromium. Output: H.264, CRF 26 (~0.6 MB for the 10-second reel).

## On the site

The storefront serves the rendered file, never the Remotion runtime: `<video muted loop playsInline preload="none" poster>` that plays only while on screen. Reduced-motion users see the poster and a Play button.

## Next

- "Render reel" button in Admin → Products: the API queues a job; the worker renders `ProductReel` from the product's data and uploads it to R2 as product media.
- Festival campaign template (Diwali ghee and mithai) with 9:16, 1:1 and 16:9 outputs.

## Licence

Remotion is free for individuals and companies with **up to 3 people**. From 4 people a paid company licence is needed; if that happens, the compositions can move to Revideo (MIT), since they're plain React and the renderer is isolated in `scripts/render.ts`. Re-check headcount each quarter.
