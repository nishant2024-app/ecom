# Cloudflare Tunnel

The app VM has no open inbound ports. `cloudflared` (in `infra/compose/app.yml`) dials out to
Cloudflare and serves these public hostnames, configured in the Cloudflare dashboard
(Zero Trust → Networks → Tunnels → Public hostnames) or with OpenTofu:

| Public hostname                | Service                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| `example.in`, `www.example.in` | `http://web:3000`                                                       |
| `api.example.in`               | `http://api:4000`                                                       |
| `ssh.example.in`               | `ssh://host.docker.internal:22` (behind Cloudflare Access; admins only) |

The admin (`admin.example.in`) is a static build on
Cloudflare Pages, so they don't go through the tunnel.

Cache rules (Cloudflare → Caching → Cache Rules):

- `example.in/_next/static/*`: cache everything, edge TTL 1 year.
- `example.in/*` HTML: respect origin headers (Next.js sends `s-maxage` for ISR pages).
- `api.example.in/v1/store/products*`, `/v1/store/categories`: respect origin (`public, max-age=60`).
- Everything else on `api.example.in`: bypass.
