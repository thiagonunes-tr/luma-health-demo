# API Reference

The Luma Health demo exposes a small HTTP API for authentication, email MFA, session management, and shared demo workflow state. It does not provide clinical or production-grade healthcare APIs.

## Base URLs

Local development:

```text
http://localhost:3000
```

Cloudflare Worker:

```text
https://luma-health-demo.thiago-nunes-5e0.workers.dev
```

The Vercel frontend rewrites `/api/*` requests to the Cloudflare Worker. API availability always follows the commit currently deployed to the target environment; newly added routes or methods are not available in production until the corresponding deployment completes.

## Authentication model

Successful authentication creates an HTTP-only `luma_session` cookie:

- Eight-hour lifetime.
- SameSite `Lax`.
- Available to the complete site.
- `Secure` on HTTPS deployments and compatible with local HTTP development.

Clients and automation tools must preserve this cookie when calling authenticated endpoints.

## Endpoint summary

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Validate credentials, begin registration, request MFA, or use the fixed-account demo bypass |
| `POST` | `/api/auth/verify` | Public, with challenge | Verify MFA and create a session |
| `GET` | `/api/auth/session` | Optional | Return the current user or `null` |
| `POST` | `/api/auth/logout` | Optional | Clear the session cookie |
| `GET` | `/api/demo-state` | Required | Read the shared demo workflow state |
| `PATCH` | `/api/demo-state` | Required | Apply a role-authorized workflow action |
| `DELETE` | `/api/demo-state` | Fixed demo account | Reset the shared workflow state |

## Authentication endpoints

### `POST /api/auth/login`

This endpoint serves three related flows: login with MFA, fixed-account login without MFA, and the first step of personal-account registration.

#### Login with MFA

Request:

```json
{
  "email": "patient.demo@testrigor-mail.com",
  "password": "PatientDemo!2026"
}
```

Successful response:

```json
{
  "challengeId": "6cd209b4-0985-4d04-b69a-44999268ce26",
  "destination": "pat•••••••••@testrigor-mail.com",
  "expiresInSeconds": 600
}
```

The code is sent through Brevo. Requests are limited to one code per minute and five codes per email address per rolling hour.

#### Fixed demo account bypass

Request:

```json
{
  "email": "patient.demo@testrigor-mail.com",
  "password": "PatientDemo!2026",
  "skipMfa": true
}
```

Successful response:

```json
{
  "user": {
    "email": "patient.demo@testrigor-mail.com",
    "name": "Maria Lopez",
    "role": "patient"
  }
}
```

The bypass is restricted to the two fixed accounts:

| Role | Email | Password |
| --- | --- | --- |
| Patient | `patient.demo@testrigor-mail.com` | `PatientDemo!2026` |
| Employee | `employee.demo@testrigor-mail.com` | `EmployeeDemo!2026` |

Setting `skipMfa: true` for any personal account returns HTTP `403`.

#### Personal-account registration

When the email does not belong to an existing account, the same endpoint begins registration:

```json
{
  "email": "qa.patient@example.com",
  "password": "Password123!",
  "role": "patient"
}
```

The role may be `patient` or `staff`; it defaults to `patient` when omitted. Passwords must contain at least eight characters. The account remains pending until the MFA challenge is successfully verified.

#### Relevant responses

| Status | Meaning |
| --- | --- |
| `200` | MFA challenge created or demo session created |
| `400` | Invalid payload or password shorter than eight characters |
| `401` | Incorrect credentials or role mismatch |
| `403` | MFA bypass attempted with a non-demo account |
| `429` | Resend cooldown or hourly email limit reached |
| `502` | The verification email could not be sent |

### `POST /api/auth/verify`

Request:

```json
{
  "challengeId": "6cd209b4-0985-4d04-b69a-44999268ce26",
  "code": "123456"
}
```

The code must contain exactly six digits, expires after ten minutes, permits at most five incorrect attempts, and can be consumed only once.

Successful response:

```json
{
  "user": {
    "email": "patient.demo@testrigor-mail.com",
    "name": "Maria Lopez",
    "role": "patient"
  }
}
```

For a pending registration, successful verification also persists the new account.

| Status | Meaning |
| --- | --- |
| `200` | Challenge verified and session created |
| `400` | Missing challenge or malformed code |
| `401` | Incorrect code or unavailable account |
| `409` | Challenge was already consumed |
| `410` | Challenge does not exist, was consumed, or expired |
| `429` | Maximum incorrect attempts reached |
| `500` | Verification could not be completed |

### `GET /api/auth/session`

Authenticated response:

```json
{
  "user": {
    "email": "patient.demo@testrigor-mail.com",
    "name": "Maria Lopez",
    "role": "patient"
  }
}
```

Anonymous response:

```json
{
  "user": null
}
```

Both cases return HTTP `200`, allowing clients to probe the initial session without producing an expected authentication error.

### `POST /api/auth/logout`

Clears the `luma_session` cookie.

Response:

```json
{
  "ok": true
}
```

## Demo-state endpoints

The state is global and shared by every session:

```json
{
  "appointmentBooked": false,
  "appointmentStatus": "none",
  "appointmentTime": "10:30",
  "intakeComplete": false,
  "refillStatus": "none"
}
```

`appointmentStatus` may be `none`, `scheduled`, `checked-in`, `in-progress`, `completed`, or `cancelled`. `appointmentTime` may be `09:00`, `10:30`, or `15:00`.

`refillStatus` may be `none`, `pending`, `approved`, or `rejected`.

### `GET /api/demo-state`

Requires a valid session and returns:

```json
{
  "state": {
    "appointmentBooked": false,
    "appointmentStatus": "none",
    "appointmentTime": "10:30",
    "intakeComplete": false,
    "refillStatus": "none"
  }
}
```

An anonymous request returns HTTP `401`.

### `PATCH /api/demo-state`

Applies one action instead of allowing the client to overwrite the complete state.

Patient actions:

| Action | Result |
| --- | --- |
| `book-appointment` | Creates a scheduled appointment at the supplied `appointmentTime` |
| `reschedule-appointment` | Changes the time of a scheduled appointment |
| `cancel-appointment` | Cancels a scheduled appointment |
| `complete-intake` | Sets `intakeComplete` to `true` |
| `request-refill` | Changes `none` or `rejected` to `pending` |

Booking and rescheduling requests include `appointmentTime`:

```json
{
  "action": "book-appointment",
  "appointmentTime": "09:00"
}
```

The employee portal reads the appointment and intake fields from the same persisted state. An appointment appears in the clinic schedule with its selected time and lifecycle status, and a completed intake appears in the request queue with a deterministic review dialog.

Employee actions:

| Action | Result |
| --- | --- |
| `check-in-appointment` | Changes `scheduled` to `checked-in` |
| `start-appointment` | Changes `checked-in` to `in-progress` |
| `complete-appointment` | Changes `in-progress` to `completed` |
| `approve-refill` | Changes `pending` to `approved` |
| `decline-refill` | Changes `pending` to `rejected` |

Example:

```json
{
  "action": "request-refill"
}
```

Successful response:

```json
{
  "state": {
    "appointmentBooked": false,
    "appointmentStatus": "none",
    "appointmentTime": "10:30",
    "intakeComplete": false,
    "refillStatus": "pending"
  }
}
```

| Status | Meaning |
| --- | --- |
| `200` | Action persisted |
| `400` | Missing or unsupported action |
| `401` | No valid session |
| `403` | Action is not allowed for the current role |
| `409` | Transition is incompatible with the current state |

Examples of conflicts include advancing an appointment out of sequence, changing an appointment after check-in, requesting an already pending or approved refill, and attempting to approve or decline a refill that is not pending.

### `DELETE /api/demo-state`

Restores the default state without removing registered users:

```json
{
  "state": {
    "appointmentBooked": false,
    "appointmentStatus": "none",
    "appointmentTime": "10:30",
    "intakeComplete": false,
    "refillStatus": "none"
  }
}
```

This endpoint requires a valid session belonging to one of the two fixed demo accounts. Personal accounts receive HTTP `403`.

## Command-line example

Create a patient session:

```bash
curl --fail-with-body \
  --cookie-jar /tmp/luma-health-demo.cookies \
  --header "Content-Type: application/json" \
  --data '{"email":"patient.demo@testrigor-mail.com","password":"PatientDemo!2026","skipMfa":true}' \
  http://localhost:3000/api/auth/login
```

Request a refill using that session:

```bash
curl --fail-with-body \
  --cookie /tmp/luma-health-demo.cookies \
  --request PATCH \
  --header "Content-Type: application/json" \
  --data '{"action":"request-refill"}' \
  http://localhost:3000/api/demo-state
```

Reset the environment:

```bash
curl --fail-with-body \
  --cookie /tmp/luma-health-demo.cookies \
  --request DELETE \
  http://localhost:3000/api/demo-state
```

## Out-of-scope APIs

There are no dedicated endpoints for messages, laboratory-result details, visit summaries, insurance updates, or clinical records. Those areas remain static demo content. Patient search uses a deterministic client-side directory, while appointment lifecycle, intake completion, and refill review are represented by the shared workflow state.

For deterministic cross-role automation and parallelism guidance, see [QA Automation Guide](./QA_AUTOMATION.md).
