# 15 · Competitor research and feature decisions

Researched 20 November 2026 by visiting the stores on desktop and mobile (Pune pincode 411045) and reading public reviews. Screenshots were taken for reference only; nothing (brand, text, photos, layout) is copied.

## Who we compete with

| Competitor | What it is | Where it sells |
|---|---|---|
| **Amul** (GCMMF) | India's largest dairy brand; the main competitor | shop.amul.com, Amul app, every kirana, Blinkit/Zepto/Instamart/BigBasket |
| Mother Dairy, Nandini, Gowardhan/Parag, Chitale, Milky Mist | Large regional dairy brands | Mostly retail and quick-commerce apps; little or no own web store |
| **Two Brothers India Farms** | Premium direct-to-consumer A2 bilona ghee and staples | twobrothersindiashop.com, app |
| **Akshayakalpa** | Organic dairy, farm-to-home subscriptions (now in Pune) | akshayakalpa.org, app |
| Quick-commerce apps (Blinkit, Zepto, Swiggy Instamart, BigBasket) | 10–30 minute delivery of Amul and others in metros | Apps only |

## What each does

### Amul (shop.amul.com)

- **Pincode wall:** a pop-up asks for a pincode and the catalogue shows "No products found" until one is chosen.
- **Catalogue:** about 16 categories. Ghee comes in 500 ml jars, 1 L cartons and tins, plus combo packs (Cow Ghee 1 L + Pure Ghee 1 L).
- **Price display:**
  - only MRP is shown, plus a **unit price** (for example "USP ₹0.80/mL");
  - no discounts.
- **Product page:**
  - gallery including back-of-pack, barcode, allergen and nutrition-label photos;
  - star rating with a handful of reviews;
  - quantity stepper, wishlist, share, collapsible "Know your product" sections;
  - **sticky "Add to Cart" bar on mobile.**
- **"No Return / No Cancellation"** on products.
- Sold-out items show **"Notify Me"**.
- **Mobile:** category rail on the left, grid/list toggle, sort.
- **Trust problems in public reviews:**
  - late or "delivered but not received" parcels;
  - support that doesn't answer;
  - fake look-alike sites (Amul shows a warning banner about them).

  Sources: PissedConsumer (~1.9★ from ~200 reviews) and consumercomplaints.in.
- Runs on a SaaS platform (StoreHippo), and the site feels generic.

### Two Brothers India Farms

- **Offers everywhere:**
  - a coupon bar ("12% off with code…", "10% off above ₹3000");
  - **members' price** (18% off with paid membership);
  - app-only discount.
- **Product page:**
  - sizes listed with **price per ml** (₹3.60/ml), including a **5 L family pack**;
  - claim badges ("Bilona-made", "Glyphosate-free");
  - "71% customers come back" and a **4.83★ rating from ~3,000 reviews** with a rating breakdown and AI review summary;
  - FAQ, description/ingredients/usage/storage tabs, sticky add-to-cart bar.
- **Trust content:** lab reports, traceability, farm life, founders.
- Free shipping above ₹1,499; COD available.
- **Weakness:** very busy pages and heavy marketing. Some health claims are not backed up.

### Akshayakalpa

- Trust-led: "Trusted by 180,000 families for 16 years", farm visits, **free sample**, recipes, customer quotes.
- Shows nutrition per 100 g. Sizes are 195 ml, 490 ml, 1 L and 5 L.
- **Ordering happens in the app (subscriptions)**, so the website is mostly information.

### Quick-commerce apps

- Fastest option in metros (10–30 min), but only for mass brands.
- They don't serve most tier-2/3 pincodes for specialty products, give no information about batch or freshness, and offer no brand story.

## Where we can win

1. **No pincode wall.** Show every product and price straight away, and check delivery when the customer wants to (Amul hides everything first).
2. **Freshness and authenticity you can see before buying.** Show the batch's manufacture and best-before dates on the product page (FEFO means we know which batch ships next). Add a **"Verify your pack"** page where the batch code printed on the jar shows whether it's genuine and its dates. This answers the fake-product worry that Amul and others face, and none of the competitors offer it on the product page.
3. **Customer-friendly policies.** Cancel any time until packed with an automatic refund (Amul: no cancellation). Order status and tracking on the order page.
4. **Unit price on every size** (like Amul and Two Brothers), so bigger packs clearly show the saving.
5. **Real reviews only from delivered orders**, moderated in the admin, with no fake counts. Stars appear only when real reviews exist.
6. **A clean, fast store.** Two Brothers is cluttered and Amul feels like a template. We stay simple (white and green, app-like), with no pop-ups on load.
7. **Pan-India reach for specialty products** (bilona ghee, mithai) where quick commerce doesn't reach.

## Feature list

### Must-have, built now

| Feature | Why | Seen at |
|---|---|---|
| Unit price (₹ per 100 ml / 100 g) on cards and product page | Shoppers compare sizes and brands | Amul, Two Brothers |
| Size picker on product cards | Choose 500 ml vs 1 L without opening the page | Amul lists each size separately; Two Brothers shows sizes on the page |
| Sticky add-to-cart bar on mobile product page | Keeps the main action in reach | Amul, Two Brothers |
| Batch freshness on product page ("Ships from batch made 17 Nov · best before Aug 2027") | Our main difference: honest freshness | Nobody |
| "Verify your pack" batch-code check page | Fights fakes and builds trust | Amul warns about fakes; Milko lists it as "coming soon" |
| Verified reviews (delivered orders only) with admin moderation, ratings on cards and product page, Google rating markup | Social proof is expected | Amul, Two Brothers, Akshayakalpa |
| No pincode wall; delivery check in the header and on the page | Lower friction than Amul | — |

### Next

| Feature | Notes |
|---|---|
| Coupon codes and automatic offers (e.g. % off above ₹X) | Two Brothers relies heavily on these; needs admin controls and GST-correct discounts |
| "Notify me" for sold-out sizes | Needs order and stock emails (Brevo/Resend) to be switched on first |
| Order and shipping emails, WhatsApp updates | Fixes the main complaint people have about Amul (no updates) |
| Combo and family packs | Possible today as products in the admin; add a "bundle" type that draws stock from its parts |
| Festive gift boxes (Diwali mithai and ghee) | Seasonal; admin-managed collection |
| Wishlist | Lower priority |
| Monthly ghee subscription | After repeat-purchase data exists |
| Recipes and "how it's made" stories, lab report per batch | Upload a lab report PDF to a batch so it shows on "Verify your pack" |
| Courier API (Shiprocket) and live tracking | Removes manual AWB entry |

### Decided against for now

- **Cash on delivery:** the owner chose prepaid only (Two Brothers offers COD).
- **Paid membership pricing:** too early.
- **Health claims we can't prove**, such as the cancer claims some competitors make.

## Sources

- Amul store: https://shop.amul.com/en/browse/ghee (visited with pincode 411045)
- Amul review pages: https://amul.pissedconsumer.com/review.html, https://www.consumercomplaints.in/amul-gcmmf-b101440
- Two Brothers: https://twobrothersindiashop.com/collections/ghee
- Akshayakalpa: https://akshayakalpa.org/products/akshayakalpa-organic-cow-ghee
- Reference for layout style chosen by the owner: https://milko.in/
