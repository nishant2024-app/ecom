# Deploying to a VPS (step by step)

This guide takes you from a brand-new Linux server to the shop running live on your own domain with HTTPS, automatic restarts, nightly backups and an easy update command. It assumes you have never set up a server before. Every command can be copied as is; replace `example.in` with your real domain.

**What you will run on one server**

```
Internet ──▶ Nginx (ports 80/443, HTTPS certificates from Let's Encrypt)
               ├─ example.in, www.example.in ──▶ shop    (container, 127.0.0.1:3000)
               ├─ api.example.in             ──▶ API     (container, 127.0.0.1:4000)
               └─ admin.example.in           ──▶ admin   (container, 127.0.0.1:8080)
             Docker Compose also runs: PostgreSQL, Valkey, the background worker, a one-time migration job
```

Only Nginx is reachable from the internet. Everything else listens on `127.0.0.1`, and the firewall allows only SSH, HTTP and HTTPS.

Time needed: about 2 hours, plus waiting for DNS and for Cashfree to approve your account. Do the whole thing on a test subdomain with Cashfree **sandbox** keys first, then go live (section 13).

---

## 1. What you need before you start

| Item                         | Details                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A server (VPS)**           | Ubuntu 24.04 LTS (22.04 also works). **2 vCPU, 4 GB RAM, 40 GB SSD** is a good start (about ₹500 to 900 a month at Hetzner, DigitalOcean, Hostinger KVM, Vultr and similar). 2 GB RAM can work if you add swap (step 3.5) but builds are slow. Not shared/web hosting: you need a VPS where you are `root` and can run Docker |
| **A domain**                 | Bought anywhere. You will create four DNS records (section 2)                                                                                                                                                                                                                                                                 |
| **Google sign-in**           | A Google Cloud project with an OAuth client ID (section 8)                                                                                                                                                                                                                                                                    |
| **Cashfree account**         | Sandbox keys now, live keys after approval (section 9)                                                                                                                                                                                                                                                                        |
| **Photos storage**           | Either a free Cloudflare account with R2 (recommended, section 10) or just the server's disk                                                                                                                                                                                                                                  |
| **Email sending** (optional) | A free Resend or Brevo account, see [docs/18-order-emails.md](docs/18-order-emails.md)                                                                                                                                                                                                                                        |
| **Your computer**            | Windows 10/11, macOS or Linux. Any has `ssh` in its terminal (Windows: Command Prompt or PowerShell)                                                                                                                                                                                                                          |

Where each key comes from is explained in [docs/14-go-live.md](docs/14-go-live.md).

---

## 2. Point your domain at the server

1. Create the server. When asked, choose **Ubuntu 24.04**, and add your SSH key if the provider offers it (or let it email you a root password). Note the server's **public IP address**.
2. At your domain's DNS settings, add four **A records** pointing to that IP (add matching `AAAA` records if the server has an IPv6 address):

| Type | Name                  | Value     |
| ---- | --------------------- | --------- |
| A    | `@` (the bare domain) | server IP |
| A    | `www`                 | server IP |
| A    | `api`                 | server IP |
| A    | `admin`               | server IP |

If you want product photos on the server itself you need nothing more. If you use Cloudflare R2 for photos, you will add a `media` hostname later (section 10).

3. Check from your computer that DNS has spread (it can take minutes to hours): `nslookup api.example.in` should print your server IP. Do not continue to section 7 until it does, because Let's Encrypt needs it.

---

## 3. Log in and secure the server

### 3.1 First login

```bash
ssh root@YOUR_SERVER_IP
```

### 3.2 Update the system

```bash
apt-get update && apt-get -y upgrade
apt-get -y install ufw fail2ban unattended-upgrades git curl
```

### 3.3 Create your own user (do not work as root)

```bash
adduser deploy                      # choose a strong password; the other questions can stay empty
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys 2>/dev/null || true
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
```

**Open a second terminal** and check you can log in as the new user: `ssh deploy@YOUR_SERVER_IP`. If you have no SSH key and use passwords, skip step 3.4 until you have set up a key (see your provider's help, or `ssh-keygen` on your computer then `ssh-copy-id deploy@YOUR_SERVER_IP`).

### 3.4 Allow key logins only, no root login

Only after the `deploy` login worked with your key:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh
```

Keep your existing terminal open and test a fresh `ssh deploy@YOUR_SERVER_IP` before closing it.

### 3.5 Firewall, brute-force protection, automatic security updates, swap

```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status                                   # shows 22, 80, 443 only

systemctl enable --now fail2ban              # blocks IPs that guess SSH passwords
dpkg-reconfigure -plow unattended-upgrades   # answer Yes: installs security updates automatically

fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab   # swap lets the build survive memory spikes
```

From now on, log in as `deploy` and use `sudo` where shown.

```bash
exit
ssh deploy@YOUR_SERVER_IP
```

---

## 4. Install Docker, Nginx and Certbot

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy              # lets deploy run docker without sudo
sudo apt-get -y install nginx certbot python3-certbot-nginx
sudo systemctl enable docker nginx          # start automatically after a reboot
```

Log out and in again (`exit`, then `ssh deploy@YOUR_SERVER_IP`) so the docker group applies. Check:

```bash
docker --version && docker compose version && nginx -v
```

> **Why the firewall alone is not enough:** Docker can publish container ports around `ufw`. This setup is safe because `infra/compose/single.yml` binds every port to `127.0.0.1`. Never change those lines to `0.0.0.0` or remove the `127.0.0.1:` prefix.

---

## 5. Get the code

```bash
sudo mkdir -p /opt/dairy/backups && sudo chown -R deploy:deploy /opt/dairy
cd /opt/dairy
git clone https://github.com/nishant2024-app/ecom.git app
cd app
git checkout main             # or the branch you deploy
```

If the repository is private, create a _deploy key_ in GitHub (Settings → Deploy keys) and use the SSH clone URL.

---

## 6. Create the settings file (secrets)

All settings live in **one file outside the repository**, `/opt/dairy/.env`. It is never committed.

```bash
cp /opt/dairy/app/.env.production.example /opt/dairy/.env
chmod 600 /opt/dairy/.env
nano /opt/dairy/.env            # Ctrl+O, Enter to save, Ctrl+X to quit
```

Work through the file top to bottom. The comments explain each line and [`.env.example`](.env.example) describes every variable.

1. **Domain:** replace `example.in` everywhere with your domain, including `CORS_ORIGINS` (shop, www and admin) and `COOKIE_DOMAIN=.yourdomain.in` (with the leading dot).
2. **Database passwords:** make two long random passwords and use each **twice** (once in `POSTGRES_PASSWORD`/`APP_DB_PASSWORD`, once inside the matching `…_URL` line):

   ```bash
   openssl rand -hex 24      # run twice, one for each password
   ```

3. **Login signing key:** this makes the secret that signs login tokens. Paste the **whole printed line** over the `JWT_PRIVATE_KEYS=` line:

   ```bash
   docker run --rm node:22-slim node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'});console.log('JWT_PRIVATE_KEYS='+JSON.stringify([{kid:'k1',privateKeyPem:k}]))"
   ```

4. **Google, Cashfree, photos, email:** fill in the values you get in sections 8 to 10. The API **refuses to start in production** unless `GOOGLE_WEB_CLIENT_ID`, `JWT_PRIVATE_KEYS`, `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` and a photo storage setting (all `R2_*` values, or an `https://` `R2_PUBLIC_BASE_URL` for option B) are present, so a half-configured shop can never take orders. Put a placeholder in now if you want to start the server before you have the real key, then replace it and run `dc up -d`.
5. `SEED_OWNER_EMAIL`: the Google account that will be the shop's Owner in the admin. Also fill the `SEED_*` store details (name, legal name, FSSAI number, address). The owner can change them later in the admin.
6. Leave `CASHFREE_ENV=sandbox` for now.

Back this file up somewhere private (a password manager). Losing `JWT_PRIVATE_KEYS` only logs everyone out, but losing the database passwords means you cannot reach the data.

---

## 7. Start the shop

```bash
cd /opt/dairy/app
alias dc='docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env'
dc up -d --build
```

The first build takes 5 to 15 minutes. It builds the images, starts PostgreSQL (the init script creates the limited `app` role), applies all database migrations, then starts the API, worker, shop and admin. Check progress and health:

```bash
dc ps                                    # all "running"/"healthy"; "migrate" shows "exited (0)" which is correct
curl -s http://127.0.0.1:4000/v1/health/ready      # {"status":"ready",...}
curl -sI http://127.0.0.1:3000 | head -1           # HTTP/1.1 200 OK
```

If something is not healthy, run `dc logs --tail 80 api` (or `web`, `migrate`, `postgres`) and see section 15.

**Load the first data, once.** It does nothing on a database that already has a store:

```bash
dc run --rm migrate pnpm seed
```

With `SEED_CATALOG=draft` (the production default) it creates the store, categories, shipping zones, the Owner account, and 12 sample products as **hidden drafts with no stock**, so you can edit them instead of typing everything from scratch. Use `SEED_CATALOG=none` to start empty.

**Shell alias:** the `alias dc=…` line only lasts for this login. To keep it: `echo "alias dc='docker compose -f /opt/dairy/app/infra/compose/single.yml --env-file /opt/dairy/.env'" >> ~/.bashrc`.

### 7.1 Put Nginx in front and get HTTPS

```bash
cd /opt/dairy/app
sudo cp infra/nginx/dairy-proxy.conf /etc/nginx/snippets/dairy-proxy.conf
sudo cp infra/nginx/dairy.conf /etc/nginx/sites-available/dairy.conf
sudo sed -i 's/example\.in/yourdomain.in/g' /etc/nginx/sites-available/dairy.conf
sudo ln -sf /etc/nginx/sites-available/dairy.conf /etc/nginx/sites-enabled/dairy.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` must say `syntax is ok` and `test is successful`. Then ask Let's Encrypt for certificates (needs the DNS records from section 2):

```bash
sudo certbot --nginx -d yourdomain.in -d www.yourdomain.in -d api.yourdomain.in -d admin.yourdomain.in \
  --redirect --agree-tos -m you@yourdomain.in --no-eff-email
```

Certbot changes the Nginx file to listen on 443 with the certificates and redirects HTTP to HTTPS. Certificates last 90 days and **renew automatically** (a systemd timer installed by the package). Prove renewal works:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Now open `https://yourdomain.in` (the shop) and `https://admin.yourdomain.in`. Check the API: `curl -s https://api.yourdomain.in/v1/health/ready`.

---

## 8. Google sign-in

1. Go to <https://console.cloud.google.com/>, create a project, then **APIs & Services → OAuth consent screen** (External; app name, support email; publish it to "In production" so anyone can sign in).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
3. Under **Authorized JavaScript origins** add `https://yourdomain.in`, `https://www.yourdomain.in` and `https://admin.yourdomain.in`. (Redirect URIs are not needed; the shop uses Google's button with ID tokens.)
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) into `GOOGLE_WEB_CLIENT_ID=` in `/opt/dairy/.env`, then apply it: `dc up -d`.

The admin is built with the API address baked in, so after changing `PUBLIC_API_URL` you must rebuild it (`dc up -d --build admin`).

Test: open the shop, click Sign in, choose your Google account. Then open the admin and sign in with the email you put in `SEED_OWNER_EMAIL`.

## 9. Cashfree payments

1. In the Cashfree dashboard create the **sandbox** keys (Developers → API keys) and put them in `/opt/dairy/.env`: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` (keep `CASHFREE_ENV=sandbox`).
2. Add a webhook: **Developers → Webhooks → Add**, URL `https://api.yourdomain.in/v1/webhooks/cashfree/payments`, with the payment events (success, failed, user dropped).
3. Apply: `dc up -d`. Place a test order on the shop, pay with Cashfree's test card or UPI, and confirm it shows **Paid** in the admin.
4. Go live when Cashfree approves your account (section 13).

## 10. Product photos: choose one

**Option A, Cloudflare R2 (recommended).** Photos live outside the server, so a lost server loses no photos, and Cloudflare serves them fast.

1. Cloudflare dashboard → **R2 → Create bucket** `dairy-media`; open it → **Settings → Custom domain** → `media.yourdomain.in` (Cloudflare manages the DNS record for you if your domain uses Cloudflare DNS).
2. **R2 → Manage API tokens → Create** with _Object Read & Write_; note the account ID, access key ID and secret.
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_MEDIA=dairy-media`, `R2_PUBLIC_BASE_URL=https://media.yourdomain.in`, then `dc up -d`.

**Option B, on the server's disk (no Cloudflare needed).** Leave the four `R2_` values empty and set `R2_PUBLIC_BASE_URL=https://api.yourdomain.in/media`. Photos are stored in the Docker volume `dairy_media` and served by the API through Nginx. The nightly backup script archives this volume too (it can only restore if the server's disk survives or the backups are copied off the server, see section 12).

## 11. First setup in the admin

Sign in at `https://admin.yourdomain.in` and, in the admin (no code needed): check **Settings/Store** details, edit the sample products (names, prices, GST, photos), add **stock batches** (products without stock cannot be bought), set products to **Active**, review shipping zones and the policy pages. [docs/14-go-live.md](docs/14-go-live.md) lists the full checklist.

---

## 12. Backups (do this before real orders)

```bash
chmod +x /opt/dairy/app/scripts/*.sh
/opt/dairy/app/scripts/backup.sh            # run once by hand and look for "done:" at the end
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/dairy/app/scripts/backup.sh >> /opt/dairy/backups/backup.log 2>&1") | crontab -
crontab -l
```

Every night at 02:00 it dumps the database into `/opt/dairy/backups` (kept 7 days) and, if `BACKUP_BUCKET` and the R2 keys are set, uploads each dump to a **separate private R2 bucket** (set a 30-day delete rule on that bucket). If you store photos on the server (option B) it archives them too.

**A backup that lives only on the same server is not a backup.** Make sure the R2 upload works, or copy `/opt/dairy/backups` to another machine regularly (`scp`, `rsync`, or your provider's snapshot feature).

**Test a restore now, and every few months** (this restores into a scratch database and prints row counts; live data is not touched):

```bash
/opt/dairy/app/scripts/restore.sh dairy-2026-12-01-0200.dump      # use a real file name from /opt/dairy/backups
```

**Disaster recovery** (server lost): repeat sections 2 to 7 on a new server, download the newest `dairy-*.dump` (and `media-*.tgz`) from R2 into `/opt/dairy/backups`, then `restore.sh <file> --live`.

---

## 13. Going live (final checks)

- [ ] Shop opens on `https://yourdomain.in`; photos load; the padlock shows a valid certificate.
- [ ] Google sign-in works on the shop and on the admin as the Owner.
- [ ] A sandbox order can be paid, packed, shipped and delivered, and cancelling refunds it.
- [ ] Products have real names, prices, GST rates, photos and stock; policy pages (`/terms`, `/privacy`, `/refunds`, `/shipping-policy`, `/contact`) are reviewed by your accountant or lawyer; the FSSAI number is correct.
- [ ] A backup ran, reached R2 (or another machine), and a restore test worked.
- [ ] Order emails are set up if you want them (`EMAIL_PROVIDER`).
- [ ] Switch Cashfree: `CASHFREE_ENV=production` with the live keys, `dc up -d`, make one real ₹10 purchase, refund it from the admin.
- [ ] `SITE_NOINDEX=false`, then submit `https://yourdomain.in/sitemap.xml` in Google Search Console.
- [ ] `AUTH_TEST_MODE=false` (the API refuses to start in production otherwise).

---

## 14. Running it day to day

### Process management and restarts

Docker is the process manager: every service has `restart: unless-stopped`, and Docker starts at boot (`systemctl enable docker`, section 4), so the shop comes back by itself after a reboot or crash. Nginx and the certificate timer are systemd services that also start at boot.

```bash
dc ps                       # what is running and healthy
dc restart api              # restart one part (also: web, worker, admin, postgres, valkey)
dc up -d                    # apply changes made to /opt/dairy/.env
sudo systemctl status nginx
```

### Logs and monitoring

```bash
dc logs -f --tail 100 api              # live API log (also web, worker, postgres)
sudo tail -f /var/log/nginx/error.log  # Nginx problems
sudo tail -f /var/log/nginx/access.log
docker stats --no-stream               # memory and CPU per container
df -h /                                # disk space (alert yourself at 80%)
free -h                                # memory
```

Container logs are size-limited (10 MB x 5 files each), so they cannot fill the disk. Every API response carries an `x-request-id`; the same id is in the API log, so you can trace one customer's problem.

Set up a free **uptime monitor** (UptimeRobot, Better Stack and similar) on `https://api.yourdomain.in/v1/health/ready` and `https://yourdomain.in` with email alerts. `/v1/health/ready` checks the database too.

### Updating the live site

```bash
cd /opt/dairy/app && ./scripts/deploy.sh
```

It backs up the database first, pulls the latest code, builds, applies new database migrations, restarts, and waits until the API is healthy. If the new version does not become healthy it prints the logs and how to go back (`git checkout <previous commit> && ./scripts/deploy.sh`). Migrations only add things, so the previous version keeps working after a rollback.

Update the operating system monthly: `sudo apt-get update && sudo apt-get -y upgrade`, and reboot when it says so (`sudo reboot`; the shop restarts by itself). Docker image updates for Postgres/Valkey: edit the version in `infra/compose/single.yml` deliberately and take a backup first. Never jump Postgres across major versions without a dump and restore.

### Changing settings

Edit `/opt/dairy/.env`, then `dc up -d` (containers pick up new values). After changing `PUBLIC_API_URL` also run `dc up -d --build admin`. After changing `SITE_URL`/`SITE_NAME`, `dc up -d web`.

### Looking inside the database

```bash
dc exec postgres psql -U migrator -d dairy        # type \dt to list tables, \q to quit
```

Be careful: you are the table owner here. Prefer the admin panel for changes.

---

## 15. Troubleshooting

| Symptom                                                          | Likely cause and fix                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API container keeps restarting                               | `dc logs api`. "Invalid configuration" names the bad variable. In production it needs `GOOGLE_WEB_CLIENT_ID`, `JWT_PRIVATE_KEYS`, `CASHFREE_APP_ID` + `CASHFREE_SECRET_KEY`, and either all `R2_*` or an `https://` `R2_PUBLIC_BASE_URL`; `AUTH_TEST_MODE` must be false                                                                                       |
| `migrate` fails                                                  | `dc logs migrate`. Usually `DATABASE_MIGRATOR_URL` password differs from `POSTGRES_PASSWORD`. If you changed the password after the database was first created, the old one is still stored: either change it inside Postgres (`ALTER ROLE migrator PASSWORD '…'`) or, only on a brand-new empty install, `dc down -v` and start again (this deletes the data) |
| `password authentication failed for user "app"`                  | `APP_DB_PASSWORD` and the password inside `DATABASE_URL` differ, or the role was created with an older password (see above)                                                                                                                                                                                                                                    |
| 502 Bad Gateway from Nginx                                       | The container is not running: `dc ps`, `dc logs api`/`web`. Check `curl http://127.0.0.1:4000/v1/health/ready` and `…:3000` on the server                                                                                                                                                                                                                      |
| Certbot fails                                                    | DNS not pointing to this server yet (`nslookup`), port 80 blocked (`sudo ufw status`), or Nginx not reloaded. Fix and re-run the command; Let's Encrypt allows only a few failed attempts per hour                                                                                                                                                             |
| Sign-in button missing or "origin not allowed"                   | `GOOGLE_WEB_CLIENT_ID` empty or the domain missing from the Google client's _Authorized JavaScript origins_ (section 8)                                                                                                                                                                                                                                        |
| Logged in but immediately logged out, or admin says unauthorised | `COOKIE_DOMAIN` must be `.yourdomain.in` and `CORS_ORIGINS` must list the exact `https://` origins of the shop and admin                                                                                                                                                                                                                                       |
| Admin shows "network error"                                      | The admin was built with the wrong API address. Fix `PUBLIC_API_URL`, then `dc up -d --build admin`                                                                                                                                                                                                                                                            |
| Photos upload fails with 413                                     | Nginx limit: the API block allows 25 MB; check you copied the repository's `dairy.conf`                                                                                                                                                                                                                                                                        |
| Photos upload but do not show                                    | R2: `R2_PUBLIC_BASE_URL` does not match the bucket's public domain. Server disk: it must be `https://api.yourdomain.in/media` and the `media` volume must be writable (`dc logs api`)                                                                                                                                                                          |
| Orders stay "waiting for payment"                                | The webhook is not reaching the API: check the URL (it ends in `/cashfree/payments`) in the Cashfree dashboard and `dc logs api                                                                                                                                                                                                                                | grep -i webhook`. The worker also checks every unpaid order before expiring it; make sure it runs: `dc ps worker` |
| No order emails                                                  | `EMAIL_PROVIDER=log` only prints to the log. Set `resend` or `brevo` with a key and a verified sender domain ([docs/18-order-emails.md](docs/18-order-emails.md))                                                                                                                                                                                              |
| Server is slow or containers are killed                          | Out of memory: `free -h`, `docker stats`. Add swap (step 3.5) or upgrade to 4 GB RAM                                                                                                                                                                                                                                                                           |
| Disk full                                                        | `df -h`, `docker system prune -a` (removes unused images; safe for running containers), delete old files in `/opt/dairy/backups`                                                                                                                                                                                                                               |
| Rate-limited ("429")                                             | Normal protection. Limits are per user or IP: 300 reads and 60 writes a minute, plus Nginx limits on the API and sign-in                                                                                                                                                                                                                                       |
| Can't SSH in after hardening                                     | Use your provider's web console to fix `/etc/ssh/sshd_config` and `sudo systemctl reload ssh`                                                                                                                                                                                                                                                                  |

---

## 16. Security checklist

- [x] Only ports 22, 80, 443 open (`sudo ufw status`); containers bound to `127.0.0.1`.
- [x] SSH by key only, no root login, fail2ban running.
- [x] Automatic security updates on.
- [x] `/opt/dairy/.env` is mode 600, owned by `deploy`, backed up privately, never in git.
- [x] Database passwords are random and different; the API uses the limited `app` role.
- [x] HTTPS everywhere with automatic renewal; HSTS enabled.
- [x] The shop container never receives database or payment secrets.
- [ ] You: restrict who can reach the admin further if you can (Cloudflare Access, or Nginx `allow your.ip; deny all;` inside the admin server block).
- [ ] You: turn on 2-step verification for the Google account that owns the shop, and for your domain, hosting and Cloudflare accounts.
- [ ] You: review `pnpm audit` results from time to time and apply updates with `deploy.sh`.

---

## 17. Alternatives and scaling

- **Cloudflare Tunnel instead of Nginx:** create a tunnel with public hostnames pointing to `http://web:3000` and `http://api:4000` (and an admin hostname to `http://admin:8080`), put its token in `TUNNEL_TOKEN`, and start with `docker compose ... --profile tunnel up -d`. No inbound ports are needed then; see [infra/cloudflared/README.md](infra/cloudflared/README.md). You can skip sections 7.1 and the Nginx install.
- **Growing:** the API is stateless. Add a second API container behind Nginx (`upstream`), move PostgreSQL to a managed database (change `DATABASE_URL`), keep photos on R2 with Cloudflare in front. No code change is needed. At around thousands of orders a day, also self-host the map and address lookup service ([docs/16-location-and-delivery.md](docs/16-location-and-delivery.md)).

## 18. What has and has not been verified

Verified while preparing this guide (in a Linux container): the `nginx -t` syntax check of `infra/nginx/dairy.conf`; `docker compose config` on `infra/compose/single.yml`; the API, shop and admin production builds; the test suites; a clean database migration and seed; the API refusing a production start with missing settings.

**Not verified here, so treat your first deploy as the final test:** the Docker image builds and `docker compose up` on a real server (the sandbox that prepared this guide blocks package downloads inside builds); real Let's Encrypt issuance; real Google sign-in; real Cashfree payments and webhooks; real email sending. If a step fails, the error and section 15 usually point to the cause.
