# Luma Health Demo

Luma Health is an English-language healthcare portal demo with patient and clinic staff experiences, password-plus-email MFA, persistent demo users, and automatically resetting demo state.

## Production architecture

- **Frontend:** Vite/React on Vercel
- **API:** Vinext/Next-compatible routes on Cloudflare Workers
- **Database:** Cloudflare D1
- **Transactional email:** Brevo
- **Source repository:** <https://github.com/thiagonunes-tr/luma-health-demo>
- **Cloudflare Worker:** <https://luma-health-demo.thiago-nunes-5e0.workers.dev>

The Vercel frontend proxies `/api/*` to the Cloudflare Worker. The Worker remains the source of truth for authentication, MFA, users, sessions, and demo state.

## Quick start

```bash
npm install
npm run dev
```

Build and validate both deployment targets:

```bash
npm run build
npm --prefix vercel-frontend run build
npm run lint
```

## Documentation

Read [Developer Handoff](docs/DEVELOPER_HANDOFF.md) before changing authentication, persistence, deployment, or the reset behavior. It documents the complete architecture, data model, operational procedures, known limitations, and recommended next steps.

Read [Requirements Traceability and Implementation Assessment](docs/REQUIREMENTS_TRACEABILITY.md) for a requirement-by-requirement comparison between the original project brief and the current implementation, including agreed adaptations, gaps, and recommended follow-up work.
