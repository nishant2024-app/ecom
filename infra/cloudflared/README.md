# Cloudflare Tunnel (optional)

Instead of Nginx on the server, `cloudflared` can connect out to Cloudflare so the server needs no open web ports. It is a Compose **profile** in `infra/compose/single.yml`, off by default: start it with `--profile tunnel` and set `TUNNEL_TOKEN` in `/opt/dairy/.env`.

Public hostnames (Cloudflare dashboard → Zero Trust → Networks → Tunnels → your tunnel):

| Hostname                       | Service             |
| ------------------------------ | ------------------- |
| `example.in`, `www.example.in` | `http://web:3000`   |
| `api.example.in`               | `http://api:4000`   |
| `admin.example.in`             | `http://admin:8080` |

Cache rules (Cloudflare → Caching → Cache Rules): cache `example.in/_next/static/*` for a year; let HTML follow the origin headers; bypass everything else on `api.example.in` except public catalogue reads, which send their own `Cache-Control`.

Full steps: [docs/17-deploy-single-server.md](../../docs/17-deploy-single-server.md). The default path (Nginx + Let's Encrypt) is in [DEPLOYMENT.md](../../DEPLOYMENT.md).
