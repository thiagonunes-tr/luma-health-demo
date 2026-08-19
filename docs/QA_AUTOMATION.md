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
  "appointmentStatus": "none",
  "appointmentTime": "10:30",
  "appointmentProvider": null,
  "appointmentSpecialty": null,
  "intakeSubmission": null,
  "messages": ["Two deterministic starter messages"],
  "lastRead": { "patient": null, "staff": null },
  "insurance": {
    "provider": "HealthFirst Demo",
    "planName": "Silver Care",
    "memberId": "HF-2048",
    "updatedAt": "Initial demo record"
  },
  "medications": ["med-losartan, med-metformin, med-atorvastatin — each refillStatus: none"],
  "results": ["result-cbc, result-lipids — both status: new"],
  "statement": { "id": "statement-jul", "amount": "$40.00", "status": "unpaid" }
}
```

Reset once before a cross-role scenario. Resetting between the patient and employee portions would erase the state that the second role needs to inspect.

## Automation API contract

All demo-state endpoints require an authenticated session.

For complete authentication payloads, response bodies, MFA limits, and status codes, see [API Reference](./API_REFERENCE.md).

The same contract is available through the
[production Swagger interface](https://luma-health-demo.thiago-nunes-5e0.workers.dev/api-docs)
or locally at <http://localhost:3000/api-docs> after `npm run dev`. It is also
linked as **QA API documentation** below the login form.

The Swagger page supports current-origin requests, retains the session cookie
created by the fixed-account login example, and exposes the protected reset
operation. Keep **Current application origin** selected, execute
`POST /api/auth/login` with `skipMfa: true`, and use
`DELETE /api/demo-state` when the scenario is complete. The source of truth is
the versioned [`public/openapi.json`](../public/openapi.json) file.

| Request | Allowed role | Result |
| --- | --- | --- |
| `GET /api/auth/session` | Anonymous or authenticated | `200` with `{ "user": null }` or the current user |
| `DELETE /api/auth/account` | Personal account | Requires current password and exact `DELETE`; fixed demos return `403` |
| `GET /api/demo-state` | Any authenticated role | Returns the current shared state |
| `PATCH /api/demo-state` with `book-appointment` | Patient | Sets the selected time and changes status to `scheduled` |
| `PATCH /api/demo-state` with `confirm-appointment` | Patient | Changes `scheduled` to `confirmed` |
| `PATCH /api/demo-state` with `reschedule-appointment` | Patient | Changes the selected time while status is `scheduled` or `confirmed`, and returns it to `scheduled` |
| `PATCH /api/demo-state` with `cancel-appointment` | Patient | Changes `scheduled` or `confirmed` to `cancelled` |
| `PATCH /api/demo-state` with `check-in-appointment` | **Patient** | Changes `confirmed` to `checked-in`. Returns `409` from any other status |
| `PATCH /api/demo-state` with `submit-intake` | Patient | Validates and stores all four intake fields. Returns `409` unless an appointment is `scheduled`, `confirmed`, or `checked-in` |
| `PATCH /api/demo-state` with `send-message` | Patient or employee | Appends a message and derives the sender from the session |
| `PATCH /api/demo-state` with `update-insurance` | Patient | Validates and persists provider, plan, and member ID |
| `PATCH /api/demo-state` with `request-refill` | Patient | Moves the medication named by `medicationId` from `none` or `rejected` to `pending` |
| `PATCH /api/demo-state` with `approve-refill` | Employee | Moves the medication named by `medicationId` from `pending` to `approved` |
| `PATCH /api/demo-state` with `decline-refill` | Employee | Moves the medication named by `medicationId` from `pending` to `rejected` |
| `PATCH /api/demo-state` with `acknowledge-result` | Patient | Marks the result named by `resultId` as `viewed`; repeating it is a no-op |
| `PATCH /api/demo-state` with `pay-statement` | Patient | Marks the statement `paid`; a second attempt returns `409` |
| `PATCH /api/demo-state` with `start-appointment` | Employee | Changes `checked-in` to `in-progress` |
| `PATCH /api/demo-state` with `complete-appointment` | Employee | Changes `in-progress` to `completed` |
| `PATCH /api/demo-state` with `no-show-appointment` | Employee | Changes `scheduled` or `confirmed` to `no-show` |
| `PATCH /api/demo-state` with `mark-messages-read` | Patient or employee | Records the last read message for the calling role only |
| `DELETE /api/demo-state` | Fixed demo accounts | Restores the default state |

Example action:

```bash
curl --fail-with-body \
  --cookie "$COOKIE_JAR" \
  --request PATCH \
  --header "Content-Type: application/json" \
  --data '{"action":"request-refill","medicationId":"med-losartan"}' \
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
3. Assert the negative paths that depend on an empty state: `approve-refill` as the patient returns `403`, `complete-intake` with no appointment returns `409`, and `check-in-appointment` before confirming returns `409`. Assert the malformed paths too, which are `400` and not `409`: `request-refill` with no `medicationId`, `request-refill` with an id that is not on file, and `acknowledge-result` with an unknown `resultId`.
4. Book an appointment, reschedule it, then **confirm attendance**. Rescheduling clears any earlier confirmation, so confirm after the final time is set.
5. Complete all intake fields, update insurance, and send a care-team message. Then open **Medications** and request a refill for one medication by its accessible name (`Request a refill for Losartan 50 mg`), and assert the other two are untouched — one medication's refill must not move the others.
6. Open Results, verify the CBC values, and download the visit summary as `maria-lopez-visit-summary.csv`.
7. **Check in** as the patient. This is the patient's own step; the employee portal cannot perform it.
8. Sign out.
9. Sign in as the employee using the demo MFA bypass.
10. Search for Maria Lopez and verify that her profile reflects the shared appointment, intake, insurance, refill, result and billing state, and that the appointment reads as checked in at the selected time.
11. Verify that Maria Lopez's submitted intake appears in Requests and assert the entered answers.
12. Open Messages, assert the patient's text, and send a staff reply.
13. Verify the pending refill names the medication it is for, then approve or decline it by its accessible name (`Approve the refill for Losartan 50 mg`).
14. Start the visit and complete it. Alternatively, from a `scheduled` or `confirmed` appointment, record a no-show instead.
15. Assert that `start-appointment` on a completed visit returns `409`.
16. Sign out and sign in again as the patient.
17. Verify the staff reply, the completed visit, and that the decision landed on the medication it was made for — not on the other two.
18. If the refill was declined, submit a new request for the same medication and confirm it returns to `pending`.
19. Reset the demo state and assert that the appointment, provider, specialty, intake, insurance and read markers return to their defaults, that every medication is back to `refillStatus: "none"`, that both results are back to `status: "new"`, and that the statement is `unpaid`.

Use accessible names and visible labels when locating UI controls. Wait for the confirmation toast or resulting UI state instead of using fixed timeouts. Do not continue to the next role until the action request has completed.

The employee dashboard derives all three cross-role views from the same persisted state:

- Appointment fields add Maria Lopez at the selected time, expose the lifecycle action appropriate to the current status, and update both portals after each state load.
- `intakeComplete: true` and `intakeSubmission` add Maria Lopez's submitted form, update the counts, and expose the exact submitted answers in the review dialog.
- `messages` is a single shared thread. New entries retain deterministic IDs and server-generated sender roles; reload the other portal before asserting a reply.
- `insurance` is visible in the patient Forms screen and Maria Lopez's staff profile after reload.
- A medication whose `refillStatus` is `"pending"` adds one refill review card **per medication**, each carrying its own approve and decline controls. The decision is visible to the patient on the next state load, on that medication's row only.
- `results` and `statement` are patient-owned: staff cannot open a result or pay a statement (both return `403`), but Maria Lopez's staff profile reports how many results are unread and whether the statement is settled.

For the deterministic CSV, assert the suggested filename and contents rather than a filesystem-specific path. The file must contain Maria Lopez, July 12, 2026, Dr. Ana Costa, the stable assessment, and the care plan.

There is no live push or polling. A portal that was already open before another session changed the state must reload before asserting the new value.

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

### Versioned browser suite

The complete cross-role scenario is stored in `tests/e2e/full_demo.py`. It starts the application on port `4173`, resets the global state, runs serially in headless Chromium, and stops the server even when an assertion fails.

Install its isolated Python dependency and browser:

```bash
python3 -m venv .venv-e2e
.venv-e2e/bin/python -m pip install --requirement requirements-e2e.txt
.venv-e2e/bin/python -m playwright install chromium
```

Then either create the ignored `.dev.vars` described above or provide an E2E-only secret:

```bash
E2E_MFA_SESSION_SECRET=local-e2e-only-secret \
  .venv-e2e/bin/python tests/e2e/full_demo.py
```

The scenario covers:

- Anonymous and role-forbidden API responses.
- Protected demo-account deletion through both API and Account settings.
- Patient appointment, intake, insurance, per-medication refill, lab-result acknowledgement, statement payment, messaging, summary, and CSV flows.
- Staff patient search, intake review, reply, per-medication refill approval, appointment lifecycle, and summary export.
- Final patient-visible state, invalid-transition handling, and deterministic reset.

The deployment suite deliberately does not create or delete a personal account because doing so requires real Brevo delivery. Personal-account deletion should be exercised in an isolated manual or provider-injected environment; never send test email from the deployment gate.

Screenshots, downloads, the development-server log, and failure traces are written under ignored `test-results/e2e/`. Open a failed `trace.zip` with `python -m playwright show-trace`.

## Isolation and parallelism

The demo workflow state is global and shared by all sessions. Stateful end-to-end scenarios must therefore run serially or against separate deployments. Parallel tests may overwrite each other's appointment, intake, message, refill, result or billing state.

For reliable suites:

- Reset the state before each independent stateful scenario.
- Keep all roles in one serialized scenario when testing cross-role behavior.
- Avoid resetting while another suite is using the same deployment.
- Use separate environments when destructive stateful suites must run concurrently.

Unit tests do not use the shared deployed state and may run independently. The versioned browser suite must remain serial unless the demo state is later isolated per test run.

## Continuous deployment

The GitHub Actions deployment workflow installs locked dependencies, runs lint, unit tests, and the serial Chromium suite, builds both application targets, and deploys only after those checks pass. Failed browser runs upload `test-results/e2e` as a workflow artifact. See the [deployment section of the Developer Handoff](./DEVELOPER_HANDOFF.md#10-deployment) for required secrets and operational details.
