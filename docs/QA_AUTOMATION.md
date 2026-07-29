# QA Automation Guide

This guide describes the deterministic flows available to automated tests in the Luma Health demo. The application is intended for demonstration and QA training only; do not use real patient data.

## Demo accounts

The fixed demo accounts may bypass MFA. Accounts created through the registration flow must still complete MFA.

| Role | Email | Password |
| --- | --- | --- |
| Patient | `patient.demo@testrigor-mail.com` | `PatientDemo!2026` |
| Employee | `employee.demo@testrigor-mail.com` | `EmployeeDemo!2026` |

The UI exposes **Sign in without two-factor authentication** for this purpose. API-driven setup can send `skipMfa: true` to `POST /api/auth/login`.

## Deterministic test setup

Keep the session cookie returned by login and reset the shared demo state before starting a suite:

```bash
export BASE_URL=http://localhost:3000
export COOKIE_JAR=/tmp/luma-health-demo.cookies

curl --fail-with-body \
  --cookie-jar "$COOKIE_JAR" \
  --header "Content-Type: application/json" \
  --data '{"email":"patient.demo@testrigor-mail.com","password":"PatientDemo!2026","skipMfa":true}' \
  "$BASE_URL/api/auth/login"

curl --fail-with-body \
  --cookie "$COOKIE_JAR" \
  --request DELETE \
  "$BASE_URL/api/demo-state"
```

After reset, the state is:

```json
{
  "appointmentBooked": false,
  "intakeComplete": false,
  "refillStatus": "none"
}
```

Reset once before a cross-role scenario. Resetting between the patient and employee portions would erase the state that the second role needs to inspect.

## Automation API contract

All demo-state endpoints require an authenticated session.

For complete authentication payloads, response bodies, MFA limits, and status codes, see [API Reference](./API_REFERENCE.md).

| Request | Allowed role | Result |
| --- | --- | --- |
| `GET /api/auth/session` | Anonymous or authenticated | `200` with `{ "user": null }` or the current user |
| `GET /api/demo-state` | Any authenticated role | Returns the current shared state |
| `PATCH /api/demo-state` with `book-appointment` | Patient | Sets `appointmentBooked` to `true` |
| `PATCH /api/demo-state` with `complete-intake` | Patient | Sets `intakeComplete` to `true` |
| `PATCH /api/demo-state` with `request-refill` | Patient | Changes refill status from `none` or `rejected` to `pending` |
| `PATCH /api/demo-state` with `approve-refill` | Employee | Changes refill status from `pending` to `approved` |
| `PATCH /api/demo-state` with `decline-refill` | Employee | Changes refill status from `pending` to `rejected` |
| `DELETE /api/demo-state` | Fixed demo accounts | Restores the default state |

Example action:

```bash
curl --fail-with-body \
  --cookie "$COOKIE_JAR" \
  --request PATCH \
  --header "Content-Type: application/json" \
  --data '{"action":"request-refill"}' \
  "$BASE_URL/api/demo-state"
```

Expected error responses:

| Status | Meaning |
| --- | --- |
| `400` | Missing or unsupported action |
| `401` | No valid session |
| `403` | The current role cannot perform the action |
| `409` | The transition is invalid for the current state |

Tests should assert these responses when covering negative paths. The client waits for a successful API response before updating the UI, so a failed persistence request must not produce a success state.

## Recommended end-to-end scenario

1. Sign in as the patient using the demo MFA bypass.
2. Reset the demo state.
3. Complete intake, book an appointment, and request a refill.
4. Sign out.
5. Sign in as the employee using the demo MFA bypass.
6. Verify the pending refill and approve or decline it.
7. Sign out and sign in again as the patient.
8. Verify the final refill status.
9. If the refill was declined, submit a new request and confirm it returns to `pending`.

Use accessible names and visible labels when locating UI controls. Wait for the confirmation toast or resulting UI state instead of using fixed timeouts. Do not continue to the next role until the action request has completed.

## Local execution

Create an ignored `.dev.vars` file for local development:

```dotenv
MFA_SESSION_SECRET=replace-with-a-long-local-only-secret
```

Do not commit this file or reuse a production secret. Then run:

```bash
npm install
npm run dev
```

Use the URL printed by the development server. Session cookies automatically follow the request protocol: local HTTP works without a `Secure` cookie, while HTTPS deployments use one.

Run the automated validation commands before opening a pull request:

```bash
npm test
npm run lint
npm run build
npm --prefix vercel-frontend run build
```

## Isolation and parallelism

The demo workflow state is global and shared by all sessions. Stateful end-to-end scenarios must therefore run serially or against separate deployments. Parallel tests may overwrite each other's appointment, intake, or refill state.

For reliable suites:

- Reset the state before each independent stateful scenario.
- Keep all roles in one serialized scenario when testing cross-role behavior.
- Avoid resetting while another suite is using the same deployment.
- Use separate environments when destructive stateful suites must run concurrently.

Unit tests do not use the shared deployed state and may run independently.

## Continuous deployment

The GitHub Actions deployment workflow installs locked dependencies, runs lint and unit tests, builds both application targets, and deploys only after those checks pass. See the [deployment section of the Developer Handoff](./DEVELOPER_HANDOFF.md#10-deployment) for required secrets and operational details.
