# 17 · Put the shop live on one server

The full beginner guide is **[DEPLOYMENT.md](../DEPLOYMENT.md)**: server hardening, Docker, Nginx, free HTTPS with automatic renewal, settings, first data, Google and Cashfree setup, backups, updates, monitoring and troubleshooting.

## Cloudflare Tunnel instead of Nginx (optional)

If you prefer not to open ports 80/443 at all, or want Cloudflare's network in front, use a tunnel and skip the Nginx and Certbot steps (DEPLOYMENT.md section 7.1):

1. Put your domain's DNS on Cloudflare (free plan).
2. Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create tunnel** (type *Cloudflared*). Copy the token into `TUNNEL_TOKEN=` in `/opt/dairy/.env`.
3. Add public hostnames to the tunnel:

   | Hostname | Service |
   |---|---|
   | `yourdomain.in`, `www.yourdomain.in` | `http://web:3000` |
   | `api.yourdomain.in` | `http://api:4000` |
   | `admin.yourdomain.in` | `http://admin:8080` |

4. Start with the tunnel profile: `docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env --profile tunnel up -d --build`.
5. Close ports 80 and 443 in the firewall if you like (`sudo ufw delete allow 80/tcp`, same for 443).

Notes: the admin container serves plain files and sets no security headers itself; add the headers from `infra/nginx/dairy.conf` with a Cloudflare Transform Rule, or put Cloudflare Access in front of the admin. Cloudflare's tunnel sets `CF-Connecting-IP`; the API reads `X-Forwarded-For`, which Cloudflare also sets, so rate limits keep working per visitor.

Everything else (backups, updates, `.env` contents, troubleshooting) is identical to DEPLOYMENT.md.
