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

## Automated deployment

A push or merge to `main` publishes both production targets from the same commit:

- The Vercel Git integration builds and publishes `vercel-frontend`.
- GitHub Actions runs lint and unit tests, builds both targets, and deploys the Cloudflare Worker.

The workflow is defined in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It can also be started manually from the repository's **Actions** tab.

Required GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Brevo and session-signing secrets remain stored in Cloudflare and are not copied to GitHub.

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
npm test
```

## Documentation

Open `/api-docs` in a running application, or use the
[deployed Swagger API documentation](https://luma-health-demo.thiago-nunes-5e0.workers.dev/api-docs),
to inspect the OpenAPI contract and execute requests from the browser. The
versioned contract is available at [`public/openapi.json`](public/openapi.json).

Read [Developer Handoff](docs/DEVELOPER_HANDOFF.md) before changing authentication, persistence, deployment, or the reset behavior. It documents the complete architecture, data model, operational procedures, known limitations, and recommended next steps.

Read [QA Automation Guide](docs/QA_AUTOMATION.md) for deterministic setup, cross-role scenarios, API actions, expected failures, and test isolation.

Read [API Reference](docs/API_REFERENCE.md) for endpoint payloads, authentication requirements, response formats, status codes, and command-line examples.

Read [Requirements Traceability and Implementation Assessment](docs/REQUIREMENTS_TRACEABILITY.md) for a requirement-by-requirement comparison between the original project brief and the current implementation, including agreed adaptations, gaps, and recommended follow-up work.
