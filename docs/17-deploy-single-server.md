# 17 · Put the shop live on one server

This is the simplest way to launch: **one small server** runs the shop, the API, the database and the background worker. Cloudflare sits in front (free HTTPS, protection, caching). It handles thousands of customers a day; move to bigger or separate servers later without code changes ([Infrastructure](03-infrastructure.md)).

Time needed: about 2 hours of work, plus waiting for Cashfree to approve your account.

> Do this on a **test domain or sub-domain first** (for example `test.yourdomain.in`) with Cashfree **sandbox** keys, then switch to live. Section 9 lists the final checks.

## 0. What you need

| Item | Notes |
|---|---|
| A server | Ubuntu 24.04, 2 vCPU, 4 GB RAM or more, 40 GB disk. Hetzner, DigitalOcean, Hostinger KVM or Oracle Always Free all work. About ₹500–900 a month paid |
| A domain | In your Cloudflare account (free plan), nameservers pointed to Cloudflare |
| Keys | Google sign-in client ID, Cashfree keys, Cloudflare R2 keys, Tunnel token. Where to get each: [Go-live checklist](14-go-live.md) |
| Your PC | Windows 10/11 already has `ssh` in Command Prompt |

## 1. Create the server and connect

1. Create an Ubuntu 24.04 server at your provider. Add your SSH key, or use the password it emails you.
2. From Command Prompt: `ssh root@YOUR_SERVER_IP`
3. Update and install Docker and git:

```bash
apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh
apt-get -y install git ufw
ufw allow OpenSSH && ufw --force enable      # nothing else needs to be open
```

## 2. Create two R2 buckets and the Tunnel

In the Cloudflare dashboard:

1. **R2 → Create bucket** `dairy-media` (product photos). Open it → **Settings → Custom domain** → `media.yourdomain.in`. This is `R2_PUBLIC_BASE_URL`.
2. **R2 → Create bucket** `dairy-backups` (database backups, keep it private). Add a lifecycle rule: delete objects after 30 days.
3. **R2 → Manage API tokens → Create** with *Object Read & Write* for both buckets. Note the account ID, access key and secret.
4. **Zero Trust → Networks → Tunnels → Create tunnel** (type *Cloudflared*). Copy the **token**. Add these public hostnames:

| Hostname | Service |
|---|---|
| `yourdomain.in` and `www.yourdomain.in` | `http://web:3000` |
| `api.yourdomain.in` | `http://api:4000` |

## 3. Get the code and fill in the settings

```bash
mkdir -p /opt/dairy/backups && cd /opt/dairy
git clone https://github.com/nishant2024-app/ecom.git app
cd app && git checkout claude/ecommerce-admin-panel-35t392
cp .env.production.example /opt/dairy/.env
chmod 600 /opt/dairy/.env
nano /opt/dairy/.env
```

Fill in every line (the comments say what each is). Replace `example.in` with your domain, set two long random passwords (use the same password in the matching `…_URL` lines), paste the R2 values and the Tunnel token. Make the login signing key with this one command and paste the **whole printed line** over the `JWT_PRIVATE_KEYS=` line:

```bash
docker run --rm node:22-slim node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'});console.log('JWT_PRIVATE_KEYS='+JSON.stringify([{kid:'k1',privateKeyPem:k}]))"
```

Keep `CASHFREE_ENV=sandbox` for now. Set `SEED_OWNER_EMAIL` to the Google account that will run the admin.

The API **refuses to start in production** if Google, signing keys, Cashfree or R2 settings are missing, so a half-finished setup can never take orders.

## 4. Start everything

```bash
cd /opt/dairy/app
docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env up -d --build
```

The first build takes 5–10 minutes. It creates the database, applies all migrations, then starts the API, worker, shop and tunnel. Check:

```bash
docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env ps
curl -s https://api.yourdomain.in/v1/health/ready      # {"status":"ready"}
```

Load the first data (**once only**; it does nothing on a database that already has a store):

```bash
docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env run --rm migrate pnpm seed
```

`SEED_CATALOG=draft` (the default in production) adds 12 sample products as hidden drafts with no stock, so you edit them rather than start from nothing.

## 5. The admin panel

The admin is a static site. Build it on your PC (or any machine with Node 22):

```bat
cd ecom
pnpm install
set VITE_API_URL=https://api.yourdomain.in
pnpm --filter @dairy/admin build
```

In Cloudflare: **Workers & Pages → Create → Pages → Upload assets**, upload the folder `apps\admin\dist`, and add the custom domain `admin.yourdomain.in`. Then protect it: **Zero Trust → Access → Applications → Add**, allow only the staff emails.

Open `https://admin.yourdomain.in` and sign in with the Google account in `SEED_OWNER_EMAIL`.

## 6. Connect Cashfree

1. Cashfree dashboard → **Developers → Webhooks → Add**: `https://api.yourdomain.in/v1/webhooks/cashfree`, with payment and refund events.
2. Put the sandbox keys in `/opt/dairy/.env`, then restart the API: `docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env up -d`.
3. Place a test order on the shop, pay with a Cashfree test card or UPI, and confirm the order shows **Paid** in the admin.
4. When Cashfree approves your live account: change `CASHFREE_ENV=production` and the live keys, restart, and make one real ₹10 purchase, then refund it from the admin.

## 7. Backups (do this before real orders)

```bash
chmod +x /opt/dairy/app/scripts/*.sh
/opt/dairy/app/scripts/backup.sh                         # try it once
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/dairy/app/scripts/backup.sh >> /opt/dairy/backups/backup.log 2>&1") | crontab -
```

It dumps the database every night at 2 am, keeps 7 days on the server and uploads each dump to the `dairy-backups` R2 bucket. **Test a restore now**, and again every few months:

```bash
/opt/dairy/app/scripts/restore.sh dairy-2026-12-01-0200.dump      # restores into a scratch database and prints row counts
```

To recover from a disaster, set up a new server (sections 1–4), download the newest dump from R2 into `/opt/dairy/backups`, and run `restore.sh <file> --live`.

## 8. Updating the live site later

```bash
ssh root@YOUR_SERVER_IP
/opt/dairy/app/scripts/deploy.sh
```

It backs up first, pulls the latest code, builds, applies database changes, restarts, and waits until the API is healthy. If the new version does not become healthy it prints the logs and how to go back.

## 9. Final checks before announcing

- [ ] Shop opens on `https://yourdomain.in`, images load from `media.yourdomain.in`.
- [ ] You can sign in with Google on the shop, and on the admin as the owner.
- [ ] A sandbox order is paid, packed, shipped and delivered; a cancel refunds.
- [ ] Products have real names, prices, GST rates, photos; batches with stock are recorded; products set to Active.
- [ ] Policy pages (`/terms`, `/privacy`, `/refunds`, `/shipping-policy`, `/contact`) reviewed by your CA or lawyer, and the FSSAI number is correct in the footer.
- [ ] A backup ran and a restore test worked.
- [ ] `SITE_NOINDEX=false`, then submit `https://yourdomain.in/sitemap.xml` in Google Search Console.
- [ ] Live Cashfree keys in place and one real ₹10 order refunded.
- [ ] Email sending set up if you want customers emailed ([Order emails](18-order-emails.md)).

## Useful commands

```bash
cd /opt/dairy/app && alias dc='docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env'
dc ps                    # what is running
dc logs -f --tail 100 api   # live API log (also: web, worker, postgres)
dc restart api           # restart one part
df -h /                  # disk space
```

## Known limits of this setup

- One server means a short outage if it reboots or fails. Backups let you rebuild in about an hour; run a second server only when downtime costs you real money.
- The public OpenStreetMap map and lookup services are for light use. Before heavy marketing, switch them ([Location](16-location-and-delivery.md#map-and-lookup-providers-cost-and-scale)).
- I wrote and statically checked these files and tested the production API start-up with all keys. I could not run Docker builds in the environment where this was developed, so treat your first deploy as the final test and send me any error you see.
