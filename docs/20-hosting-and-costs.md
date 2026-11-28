# 20 · Hosting and costs, explained

Plain answers to: *what do I have to pay for, where should I host, and what will it cost?* Prices were checked in **November 2026** and **change often** (and many providers show a cheap first-term price that rises at renewal). Treat every number here as a guide, and confirm on the provider's checkout page before you pay. Where a number is my estimate rather than a published price, it says so.

For the step-by-step setup see [DEPLOYMENT.md](../DEPLOYMENT.md).

## 1. What actually needs hosting

| Piece | What it is | Where it runs | Cost |
|---|---|---|---|
| The shop, the API, the admin, the database, the background worker | One program set (Docker) | **One small server (a VPS)** | The main cost |
| Product photos | Image files | Cloudflare R2 (or the same server's disk) | Free for a small shop |
| Domain name | `yourshop.in` | A domain registrar | About ₹600 to ₹1,600 a year |
| HTTPS certificate | The padlock | Let's Encrypt (installed on the server) | Free |
| Sign-in | "Sign in with Google" | Google | Free |
| Payments | Cashfree | Cashfree | A fee on each sale (section 4) |
| Order emails | "Your order shipped" | Resend or Brevo | Free at small volume |
| Maps and address lookup | Pin on a map, "use my location" | OpenStreetMap services | Free for light use |
| Page translation | The language picker | Google Translate, in the visitor's browser | Free (see the note in section 6) |
| Couriers | Delivery | Shiprocket, Delhivery and similar | Per parcel, paid by you or the customer |

There is **no separate database bill, no per-visitor bill and no SMS bill**: the database runs on the same server, sign-in is Google only, and the shop does not send text messages.

## 2. Where to host the server

A "VPS" is a small computer you rent that runs 24 hours a day. You need **Ubuntu 24.04, at least 2 CPU cores and 4 GB of memory** (8 GB is more comfortable), in a location close to your customers: **India (Mumbai or Bangalore) or Singapore**. A server in Europe works but every page is slower for Indian visitors.

| Provider | Typical plan | Price (checked Nov 2026) | Good for | Watch out for |
|---|---|---|---|---|
| **Hostinger** (KVM 2) | 2 vCPU, 8 GB RAM, 100 GB SSD | About **₹799 a month** on the first term, about **₹1,199 on renewal**, plus GST. Sources disagree, so check at checkout | Indian billing and GST invoices, simple panel, plenty of memory | Renewal is higher than the headline; choose an India or Singapore location |
| **Hetzner** (CAX11 ARM or CX23) | 2 vCPU, 4 GB RAM, 40 GB SSD | About **€5.5 to €6 a month** (the price was raised in June 2026) | Cheapest for the power | Servers are mostly in Europe/US (check for Singapore); in autumn 2026 some cheap plans were temporarily unavailable to order |
| **DigitalOcean** (Bangalore) | 2 vCPU, 4 GB RAM | About **$24 to $28 a month** | Indian location, polished, includes 4 TB of traffic | Costs several times more than Hostinger or Hetzner |
| **Oracle Cloud "Always Free"** | ARM server | **₹0**, but the free allowance was reported cut to 2 cores and 12 GB in 2026, and idle free servers can be reclaimed | Trying things out | Not a base for a real shop: the terms keep changing |
| Shared web hosting (for example Hostinger Single) | n/a | Cheap | n/a | **Cannot run this shop** (no Docker, no PostgreSQL, no background worker) |

**My recommendation for launch:** a **Hostinger KVM 2** (or an equivalent 4 to 8 GB VPS in India or Singapore) with the setup in DEPLOYMENT.md. If you are comfortable with Europe's latency and want the lowest bill, Hetzner is the cheapest. Do not run a real shop on a free tier that can be withdrawn.

## 3. What the first year really costs (my estimate)

Rough monthly figures in rupees. Assumed exchange rates: about ₹96 to the dollar and about ₹110 to the euro. **These are estimates, not quotes.**

| Stage | Orders | Server | Domain | Photos | Email | Total per month (without payment fees) |
|---|---|---|---|---|---|---|
| **Start** | up to a few hundred a month | ₹800 to ₹1,200 (Hostinger KVM 2) or about ₹650 (Hetzner) | about ₹100 | ₹0 (R2 free tier) | ₹0 (free plans) | **about ₹900 to ₹1,400** |
| **Growing** | a few thousand a month | a 4-core, 8 to 16 GB server, ₹2,000 to ₹4,500 | about ₹100 | ₹0 to ₹150 | a paid email plan if you pass the free limits (confirm current price) | **about ₹2,500 to ₹5,000** |
| **Large** (50,000 to 100,000 customers) | many thousands | two app servers plus a managed database | about ₹100 | ₹150 to ₹500 | paid email plan | **roughly ₹10,000 to ₹25,000, widely uncertain**; plan this when you get there, with a real load test |

Capacity: the design targets about 100,000 registered customers on a modest server because most pages are cached and the database is small. That is a design estimate, **not a measured result**. Run a load test before a big campaign.

## 4. Payment fees (Cashfree)

Cashfree charges **per sale**, not per month. As of November 2026, third-party summaries and Cashfree's own pages say:

- Standard rate about **1.95%** on cards, net banking and wallets (more for American Express and international cards), plus **18% GST on the fee**.
- **UPI is listed at 0%**, but a small UPI charge for larger payments was announced and then postponed, so confirm the current rule.
- **No setup fee and no yearly fee.**
- New merchants may get a **0% platform fee up to ₹20,00,000 of sales**; the terms and dates in different sources conflict, so ask Cashfree.

Worked example (card payment, ₹500 order at 1.95% plus GST): fee ₹9.75, GST on fee ₹1.76, total ₹11.51, about **2.3%** of the sale. The same order paid by UPI at 0% costs nothing. The fee is deducted from your settlement. The shop prices already include GST for your customers.

## 5. Email, photos and the free tiers

- **Cloudflare R2 (photos):** free forever up to **10 GB** of stored photos and 1 million writes and 10 million reads a month; **no charge for downloads**. Beyond that, **$0.015 per GB a month**. A shop with a few hundred products uses well under 1 GB. You can also skip R2 and keep photos on the server (DEPLOYMENT.md, option B) at the price of backing up the disk.
- **Resend:** free plan of about **100 emails a day** (about 3,000 a month). **Brevo:** free plan of **300 emails a day**, with a "Sent with Brevo" footer on the free plan. Order emails (confirmed, shipped, delivered, cancelled) are a few per order, so small shops stay free. Confirm the plan limits on their pricing pages.
- **Cloudflare (optional):** DNS, CDN and Tunnel are free; useful but not required.
- **Let's Encrypt** certificates are free and renew themselves.

## 6. Language picker: what it costs and its one risk

The language picker uses **Google's Website Translator**, which is **free** and runs in the visitor's browser. Nothing is stored in your database. **Risk:** Google announced it no longer supports this widget from 1 October 2026. It still worked when this was built (it was tested in a real browser), but Google could switch it off. If it stops, the picker shows a message and visitors can still use their browser's own "Translate this page". The paid, supported alternative is Google Cloud Translation, which needs code changes and bills per character.

## 7. Other costs that are not hosting

Not technology, but part of running the shop: FSSAI licence and renewals, GST registration and your accountant, courier charges, packaging, and a lawyer or CA's review of the policy pages. Budget for these separately.

## 8. How to choose, in one minute

1. Buy a **domain** (a `.in` or `.com`).
2. Rent a **4 to 8 GB VPS in India or Singapore** (Hostinger KVM 2 is the simple choice).
3. Follow [DEPLOYMENT.md](../DEPLOYMENT.md): about two hours.
4. Create free accounts: Google (sign-in), Cashfree (payments), Cloudflare R2 (photos), Resend or Brevo (email).
5. Start with Cashfree **sandbox**, test an order end to end, then go live.
6. Turn on the **nightly backup** before the first real order, and copy backups off the server.

Starting cost: a domain plus the first server term, roughly **₹1,500 to ₹3,000 up front**, then about **₹900 to ₹1,400 a month** plus payment fees.

## Sources (checked November 2026)

- Hetzner price changes: [Hetzner price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [Northflank summary](https://northflank.com/blog/hetzner-cloud-server-price-increases), [Bitdoze review](https://www.bitdoze.com/hetzner-cloud-review/)
- Hostinger India VPS: [Hostinger India pricing](https://www.hostinger.com/in/pricing/vps-hosting), [renewal analysis](https://hostadvice.com/hosting-company/hostinger-reviews/hostinger-india-pricing/)
- DigitalOcean: [Droplet pricing](https://www.digitalocean.com/pricing/droplets)
- Oracle free tier: [Always Free resources](https://docs.oracle.com/iaas/Content/FreeTier/resourceref.htm), [InfoQ on the 2026 limits](https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- Cashfree: [pricing docs](https://www.cashfree.com/docs/help/account/pricing), [payment gateway charges](https://www.cashfree.com/payment-gateway-charges/)
- Cloudflare R2: [R2 pricing](https://developers.cloudflare.com/r2/pricing)
- Email: [Resend pricing](https://resend.com/pricing), [Brevo free plan limits](https://help.brevo.com/hc/en-us/articles/208580669)
- Google Website Translator retirement: [WP Hive report](https://wphive.com/news/google-to-retire-website-translator-widget/)
