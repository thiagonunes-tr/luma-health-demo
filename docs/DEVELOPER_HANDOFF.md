# Luma Health Demo — Developer Handoff

**Last reviewed:** July 23, 2026  
**Repository:** <https://github.com/thiagonunes-tr/luma-health-demo>  
**Primary branch:** `main`  
**Cloudflare Worker:** <https://luma-health-demo.thiago-nunes-5e0.workers.dev>

## 1. Purpose and current scope

Luma Health is an English-language healthcare portal demo. It provides two visual experiences:

- A patient portal with appointment booking, an intake-form action, refill requests, recent activity, and care progress.
- A clinic staff dashboard with schedule metrics, patient requests, and refill approval.

The project is intentionally a demonstration environment. It does not contain real patient data, does not implement a complete healthcare workflow, and must not be treated as a production medical system.

The currently implemented product requirements are:

- One login flow for patients and employees: email, password, then a six-digit email verification code.
- Real MFA email delivery through Brevo.
- Two exposed demo accounts whose credentials can be copied from the login screen.
- Any valid email may create a patient or employee account with its own password.
- A newly registered user is persisted only after successful MFA verification.
- User accounts survive environment resets.
- Mutable demo state resets automatically after 24 hours.
- The UI is hosted on Vercel while the backend and D1 database remain on Cloudflare.

## 2. Production topology

```text
Browser
  |
  | HTTPS
  v
Vercel (Vite/React frontend)
  |
  | /api/* external rewrite
  v
Cloudflare Worker (Vinext API and fallback full-stack UI)
  |                     |
  | D1 binding          | HTTPS
  v                     v
Cloudflare D1         Brevo API
users, MFA, state     MFA email delivery
```

### Vercel

Vercel is the public frontend deployment target. The repository-root `vercel.json` is the canonical Vercel configuration.

It performs the following operations:

- Installs the root dependencies.
- Builds `vercel-frontend` as a Vite application.
- Publishes `vercel-frontend/dist`.
- Rewrites `/api/:path*` to the Cloudflare Worker.
- Rewrites other paths to the SPA entry point.

The root dependency installation is intentional. The Vite frontend imports the shared UI component from outside the `vercel-frontend` directory, so React and its types must be resolvable from the repository root during a Vercel build.

The Vercel production URL is managed in the Vercel dashboard and is not currently stored in this repository.

### Cloudflare Workers

The Worker is named `luma-health-demo`. It hosts all API routes and can also serve the complete UI directly as a fallback deployment.

The Worker deployment URL is:

```text
https://luma-health-demo.thiago-nunes-5e0.workers.dev
```

The following resources are attached:

- D1 binding: `DB`
- D1 database name: `luma-health-demo-db`
- D1 database ID: `48796066-30ae-4bd0-9dd3-e3d361fea02c`
- Non-secret sender variables from `wrangler.jsonc`
- Cloudflare secrets for Brevo and session signing

### GitHub

The canonical repository is:

```text
https://github.com/thiagonunes-tr/luma-health-demo.git
```

Vercel is connected to the `main` branch. A push to `main` should trigger a new Vercel build automatically.

## 3. Code organization

| Path | Responsibility |
| --- | --- |
| `shared/LumaApp.tsx` | Shared React UI used by both Cloudflare and Vercel builds |
| `app/page.tsx` | Re-exports the shared UI for the Vinext app |
| `app/globals.css` | Complete application styling and responsive behavior |
| `app/layout.tsx` | Cloudflare/Vinext HTML shell and social metadata |
| `app/api/auth/login/route.ts` | Validates credentials, creates MFA challenge, and sends code |
| `app/api/auth/verify/route.ts` | Verifies MFA, persists newly registered users, and creates session |
| `app/api/auth/session/route.ts` | Returns the current signed-in user |
| `app/api/auth/logout/route.ts` | Clears the session cookie |
| `app/api/demo-state/route.ts` | Reads and updates the resettable global demo state |
| `lib/auth.ts` | Demo accounts, password checks, session signing, MFA hashing, and Brevo delivery |
| `lib/mfa-db.ts` | Runtime D1 initialization, users, MFA challenges, demo state, and reset logic |
| `db/schema.ts` | Drizzle schema definitions |
| `drizzle/` | Generated D1 migrations and metadata |
| `worker/index.ts` | Cloudflare Worker entry point |
| `vite.config.ts` | Vinext and Cloudflare binding configuration |
| `wrangler.jsonc` | Worker name, non-secret variables, and observability |
| `.openai/hosting.json` | Logical Sites project and D1 binding metadata |
| `vercel-frontend/` | Vite entry point and frontend-specific build configuration |
| `vercel.json` | Canonical Vercel build, output, and proxy configuration |

### Shared UI rule

Do not edit a second copy of the product UI. Product behavior belongs in `shared/LumaApp.tsx`, and styling belongs in `app/globals.css`.

Both deployment targets import those same files:

- Cloudflare: `app/page.tsx` re-exports `shared/LumaApp.tsx`.
- Vercel: `vercel-frontend/src/main.tsx` imports `shared/LumaApp.tsx` and `app/globals.css`.

This arrangement keeps the two deployments visually identical.

## 4. Authentication and account behavior

### Demo accounts

The two fixed accounts are declared in `lib/auth.ts` and displayed on the login screen.

| Role | Email | Password |
| --- | --- | --- |
| Patient | `patient.demo@testrigor-mail.com` | `PatientDemo!2026` |
| Employee | `employee.demo@testrigor-mail.com` | `EmployeeDemo!2026` |

The login fields are deliberately blank. Credentials are shown separately with copy buttons to make automated and manual testing straightforward.

### New account registration

The **Create account** tab supports first-time registration. This flow works as follows:

1. A new user selects **Patient** or **Employee** as the account type.
2. The user enters a valid email and chooses a password with at least eight characters.
3. The backend hashes the proposed password and stores it in `pending_users`, linked to the MFA challenge and selected role.
4. A real MFA code is sent to the entered address.
5. The permanent user record is created only after the code is verified successfully.
6. Returning users use the matching Patient or Employee login surface with the email and password they created.
7. Subsequent sign-ins load the permanent user from D1 before sending MFA.

The display name is derived from the email local part. For example, `alex.smith@example.com` becomes `Alex Smith`.

The selected role controls which dashboard opens after MFA. The fixed employee demo account remains available as a shortcut. Personal users created before this registration flow was introduced retain the earlier shared patient-demo password hash and can continue using `PatientDemo!2026`.

### Password handling

Passwords are compared as SHA-256 hashes with a constant-time string comparison. New accounts store the hash of the password chosen during registration. The plaintext password is never written to D1.

This design is acceptable only for a controlled demo. It is not a production password architecture: hashes are unsalted and fast, and there is no password confirmation, password reset, account recovery, or identity-provider integration.

### MFA challenge

The MFA implementation has the following controls:

- Six numeric digits.
- Ten-minute expiration.
- Maximum five incorrect attempts.
- Sixty-second resend cooldown.
- Maximum five code requests per email per hour.
- Requesting a new challenge invalidates any unconsumed challenge for that email.
- Codes are never stored in plaintext.
- A code hash includes the challenge ID and `MFA_SESSION_SECRET`.
- A successfully consumed code cannot be reused.

Brevo sends both HTML and plaintext email content from `lib/auth.ts`.

### Session

After MFA succeeds, the backend issues the `luma_session` cookie.

Cookie behavior:

- HTTP-only
- Secure
- SameSite `Lax`
- Available to the entire site
- Eight-hour expiration

The session payload contains email, display name, role, and expiration. It is signed with HMAC-SHA-256 using `MFA_SESSION_SECRET`. Every session read also verifies that the account still exists and matches the stored role and name.

The Vercel `/api/*` rewrite is important because it keeps the browser-facing API same-origin. The session cookie is therefore stored for the Vercel domain while requests are transparently forwarded to Cloudflare.

## 5. Database model

Cloudflare D1 contains five tables.

### `mfa_challenges`

Stores short-lived MFA verification attempts.

Important columns:

- `id`: UUID challenge identifier
- `email`
- `role`
- `code_hash`
- `attempts`
- `created_at`
- `expires_at`
- `consumed_at`

An index on `(email, created_at)` supports cooldown and hourly-limit queries.

### `users`

Stores registered patient and employee users who completed MFA.

Important columns:

- `email`: primary key
- `name`
- `role`
- `password_hash`
- `created_at`

Fixed patient and employee demo accounts are code-defined and are not required in this table.

### `pending_users`

Temporarily stores a proposed personal account while email ownership is being verified.

Important columns:

- `challenge_id`: primary key matching the MFA challenge
- `email`
- `name`
- `role`: the selected `patient` or `staff` account type
- `password_hash`
- `created_at`

Starting another registration attempt for the same email replaces the earlier pending record. The record is deleted after successful verification, after an email-delivery failure, or during stale-record cleanup.

### `demo_state`

Contains one global row with ID `global`. `state_json` currently stores:

```json
{
  "appointmentBooked": false,
  "intakeComplete": false,
  "refillStatus": "none"
}
```

This state is global, not per user. A change made by one signed-in user is visible to other signed-in users after they reload the state.

### `environment_meta`

Contains the timestamp used to decide when the demo environment should reset. The current row ID is `global`.

### Runtime initialization and migrations

`lib/mfa-db.ts` creates all required tables with `CREATE TABLE IF NOT EXISTS` when a Worker isolate first accesses D1. Drizzle schema and migration files are also kept in the repository for controlled schema evolution.

When changing the schema:

```bash
npm run db:generate
```

Inspect the generated SQL before committing it. Keep runtime initialization and the Drizzle schema aligned.

## 6. Twenty-four-hour reset behavior

The reset preserves users but clears mutable demo state.

Current behavior:

1. The first demo-state access initializes `environment_meta.last_reset_at`.
2. Every demo-state read or write checks the elapsed time.
3. If at least 24 hours have passed, the application deletes `demo_state`.
4. It updates `last_reset_at` to the current time.
5. It also removes expired MFA challenges.
6. The `users` table is never deleted by the reset.

Important operational detail: this is a **lazy rolling reset**, not a scheduled midnight reset. If no one accesses the app after the 24-hour mark, the reset occurs on the first later demo-state request.

To change the interval, update `RESET_INTERVAL_MS` in `lib/mfa-db.ts`.

To implement a fixed daily reset time, add a Cloudflare Cron Trigger and move the reset operation into a scheduled Worker handler. Do not delete the `users` table.

## 7. API contract

### `POST /api/auth/login`

Input:

```json
{
  "email": "patient@example.com",
  "password": "chosen-password",
  "role": "patient"
}
```

`role` is `patient` or `staff`. It is required by the current frontend and determines the role of a new account. Existing accounts must sign in through the matching role option. Older clients that omit it remain compatible and default new registrations to patient.

Success response:

```json
{
  "challengeId": "uuid",
  "destination": "pat••••@example.com",
  "expiresInSeconds": 600
}
```

### `POST /api/auth/verify`

Input:

```json
{
  "challengeId": "uuid",
  "code": "123456"
}
```

Success returns the user and sets the session cookie.

### `GET /api/auth/session`

Returns the current signed-in user or HTTP 401.

### `POST /api/auth/logout`

Clears the session cookie.

### `GET /api/demo-state`

Requires a valid session. Applies the reset check and returns the current global state.

### `PUT /api/demo-state`

Requires a valid session. Accepts the complete state object and overwrites the global state.

This endpoint currently uses last-write-wins semantics and has no optimistic concurrency control.

## 8. Environment variables and secrets

Never commit `.env.local`, API keys, or session secrets.

Required Worker configuration:

| Name | Type | Purpose |
| --- | --- | --- |
| `BREVO_API_KEY` | Secret | Authorizes Brevo transactional email requests |
| `MFA_SESSION_SECRET` | Secret | Hashes MFA codes and signs session tokens |
| `BREVO_SENDER_EMAIL` | Variable | Sender email shown in MFA messages |
| `BREVO_SENDER_NAME` | Variable | Sender display name |

Current non-secret sender configuration:

```text
BREVO_SENDER_EMAIL=lumahealth.testrigordemo@gmail.com
BREVO_SENDER_NAME=Luma Health
```

Set production secrets through Wrangler or the Cloudflare dashboard:

```bash
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put MFA_SESSION_SECRET
```

For local backend development, create `.env.local` with placeholders:

```dotenv
BREVO_API_KEY=replace_me
MFA_SESSION_SECRET=replace_with_a_long_random_value
BREVO_SENDER_EMAIL=lumahealth.testrigordemo@gmail.com
BREVO_SENDER_NAME=Luma Health
```

Do not reuse the production session secret in untrusted environments.

## 9. Local development

### Full Cloudflare/Vinext application

Requirements:

- Node.js 22.13 or newer
- npm
- Cloudflare/Wrangler access for production deployment
- Brevo credentials to exercise real MFA locally

Install and start:

```bash
npm install
npm run dev
```

The root development server includes both UI and API routes.

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

### Vercel frontend only

Install its direct dependencies when working specifically inside the frontend package:

```bash
npm --prefix vercel-frontend install
```

Start Vite:

```bash
npm --prefix vercel-frontend run dev
```

The Vite development proxy currently sends `/api/*` to the production Cloudflare Worker. Be aware that local frontend actions can therefore affect the shared production demo state.

Build exactly what Vercel publishes:

```bash
npm --prefix vercel-frontend run build
```

## 10. Deployment

### Vercel frontend

The production project should import `thiagonunes-tr/luma-health-demo` and track `main`.

The repository-root `vercel.json` controls the deployment. It is not necessary to set a separate Root Directory when this file is used.

Expected build identity:

```text
luma-health-vercel-frontend
tsc -b && vite build
```

If logs show `luma-saude-demo` or `vinext build`, Vercel is deploying an old commit or ignoring the root `vercel.json`.

If the Worker URL changes, update all three locations:

- `vercel.json`
- `vercel-frontend/vercel.json`
- `vercel-frontend/vite.config.ts`

Do not cache authentication API rewrites at the CDN.

### Cloudflare Worker

Validate first:

```bash
npm run build
npm run lint
```

Deploy:

```bash
npx wrangler deploy
```

After deployment, confirm that the Worker still has:

- D1 binding `DB`
- Secret `BREVO_API_KEY`
- Secret `MFA_SESSION_SECRET`
- Sender variables from `wrangler.jsonc`

The build copies `.openai/hosting.json` and Drizzle migrations into `dist/.openai` for the existing Sites-compatible packaging flow.

## 11. Validation checklist

Run this checklist after authentication, database, proxy, or deployment changes.

### Build checks

```bash
npm run build
npm --prefix vercel-frontend run build
npm run lint
```

### Patient demo

- Login fields start blank.
- Patient credentials can be copied.
- Password submission sends a real email.
- The code expires after ten minutes.
- Successful verification creates a session.
- Appointment, intake, and refill actions update the UI.
- Reloading restores the persisted global state.

### New account registration

- The Create account tab is separate from the two demo login options.
- The user can select Patient or Employee during registration.
- A new user can choose a password with at least eight characters.
- The code arrives at the entered email.
- The user is created only after correct MFA.
- A returning patient or employee can sign in with the password created previously.
- The derived display name appears in the portal.
- A second login still works after the environment reset.

### Employee demo

- Employee credentials can be copied.
- MFA is delivered to the employee demo email.
- Employee access opens the clinic dashboard.
- Staff can observe and approve a pending refill in the shared state.

### Reset

- Users remain present.
- `demo_state` returns to defaults after the rolling 24-hour interval.
- Expired MFA challenges are cleaned during reset.

### Vercel proxy

- `/api/auth/session` is served through the Vercel domain.
- The session cookie is created for the Vercel domain.
- Refreshing a protected dashboard retains the session.
- Logout clears the cookie.

## 12. Known limitations and technical debt

### Demo-only security model

- Newly registered patients and employees can choose individual passwords, but hashes still use unsalted SHA-256.
- Password hashing is plain SHA-256 without a per-user salt or a slow password KDF.
- Registration and sign-in share one form; there is no password confirmation, password change, password reset, account deletion, or administrative user management.
- Any verified email can currently register as an employee; there is no invitation, approval, clinic membership, or staff allowlist.
- This system is not designed for HIPAA, PHI, or real clinical use.

Before any production healthcare use, replace the authentication model with a vetted identity provider and complete a security, privacy, compliance, logging, retention, and incident-response review.

### Global demo state

- All users share one state row.
- Concurrent updates are last-write-wins.
- The frontend sends the complete state object on every update.
- The reset is access-triggered rather than scheduled.

If the demo needs isolated sessions, add an environment or tenant identifier and key `demo_state` by that identifier.

### UI scope

- Several navigation items and secondary buttons are visual placeholders.
- Dates, clinicians, patients, metrics, and activity entries are hardcoded demo content.
- Booking does not create a real appointment record.
- Intake completion stores only a boolean.
- Refill workflow stores only a three-value status.

### Test suite

`tests/rendered-html.test.mjs` still targets the original starter loading skeleton and is obsolete. `npm test` should not be used as a release gate until these tests are replaced.

Recommended replacement coverage:

- Unit tests for account normalization and name derivation.
- Unit tests for session signing and expiration.
- API tests for login throttling, MFA expiration, attempt limits, and replay prevention.
- API tests proving that reset deletes demo state but preserves users.
- Browser tests for patient demo, employee demo, and new patient/employee registration flows.

### Build structure

- The root and `vercel-frontend` each have a `vercel.json`; the root file is canonical for the current Vercel project.
- Vercel installs root dependencies so the shared component can resolve React from outside the frontend package.
- The root application still contains template-era support files such as `app/chatgpt-auth.ts`, `examples/d1`, and generic public icons that are not part of the active product flow.
- The root package name still uses the older Portuguese identifier `luma-saude-demo` even though all user-facing content is English.

A future cleanup could convert the repository into explicit npm workspaces and remove unused starter files after confirming that no deployment tooling depends on them.

### Email delivery

- Delivery depends on Brevo account health, sender verification, quotas, and recipient filtering.
- The sender is currently a Gmail address rather than a dedicated authenticated product domain.
- If the sender changes, update `wrangler.jsonc` and redeploy the Worker.

## 13. Troubleshooting

### Vercel runs `vinext build`

The deployment is using an old commit or is not reading the root `vercel.json`. Confirm the deployed Git commit and the production branch.

### Vercel cannot resolve `react` from `shared/LumaApp.tsx`

Confirm the root `vercel.json` uses:

```json
"installCommand": "npm install"
```

Installing only inside `vercel-frontend` is insufficient for the current shared-source layout.

### Vercel asks for `.next`

Vercel detected the root as Next.js rather than using the Vite configuration. Confirm:

- The deployment includes the current root `vercel.json`.
- Framework is `vite`.
- Output directory is `vercel-frontend/dist`.
- Build command is `npm --prefix vercel-frontend run build`.

### MFA email is not received

Check:

- `BREVO_API_KEY` exists as a Worker secret.
- The Brevo sender is verified and active.
- Brevo logs show the request.
- The recipient spam folder.
- The per-email cooldown and hourly request limit.

### MFA returns HTTP 502

The backend could not create or deliver the challenge. Check Worker logs, D1 binding, Brevo response, and both secrets.

### Session disappears immediately

Check that:

- `MFA_SESSION_SECRET` is stable across Worker deployments.
- Requests use HTTPS.
- The frontend calls `/api/*` through the Vercel rewrite rather than calling the Worker directly from another origin.
- The account still exists and its role/name match the signed payload.

### Demo state does not reset exactly at midnight

This is expected. The current reset is rolling and lazy. It runs on the first state request after 24 elapsed hours.

### A new account opens the wrong dashboard

The selected role is saved with the pending MFA registration and becomes permanent after verification. Confirm that the frontend sends `role` as `patient` or `staff`, and that the matching `pending_users` row exists for the challenge.

## 14. Recommended next steps

Suggested priority order for a future developer:

1. Replace the obsolete starter test suite with authentication and reset tests.
2. Add a Cloudflare Cron Trigger if reset must happen at a fixed daily time.
3. Decide whether demo state should remain global or become isolated per test run/user.
4. Convert the repository to npm workspaces and simplify Vercel dependency resolution.
5. Remove unused starter files and rename the root package consistently.
6. Add structured Worker logging for MFA delivery and reset events without logging codes, passwords, secrets, or sensitive email content.
7. If requirements move beyond a demo, replace the custom password implementation before adding more product features.

## 15. Safe ownership transfer checklist

The incoming maintainer should receive access to:

- GitHub repository and branch protection settings.
- Vercel project and production domain settings.
- Cloudflare Worker, D1 database, secrets, and logs.
- Brevo account, API-key rotation process, sender configuration, and delivery logs.

Do not send secrets through repository files, issues, documentation, or chat. Rotate credentials when ownership changes and verify the application after rotation.
