# Requirements Traceability and Implementation Assessment

## 1. Purpose

This document compares the original requirements in `Demo App Projects.pdf` with the current Luma Health demo implementation.

It is intended to answer three questions:

1. What did the original project request?
2. What was implemented to satisfy it?
3. What remains partial, missing, or intentionally different because of later product decisions?

This assessment covers **Project 3: Health Tech Demo Apps - Thiago**, identified on pages 2–3 of the original document, plus the build rules that apply to all demo projects.

## 2. Status definitions

| Status | Meaning |
| --- | --- |
| **Implemented** | The requirement is available as a working, testable flow. |
| **Partial** | The requirement is represented in the UI, but part of the expected interaction or state change is missing. |
| **Agreed adaptation** | The original requirement was intentionally replaced by a later approved implementation decision. |
| **Not implemented** | The required workflow is not currently available. |
| **Intentional extension** | The implementation goes beyond the original scope because of a later product decision. |

## 3. Executive assessment

The project **partially satisfies the original requirements and successfully delivers the core testRigor demo concept**.

The strongest areas are:

- A believable English-language health portal.
- A single responsive web experience for desktop and mobile browsers.
- Separate patient and employee experiences.
- Appointment booking, structured intake, shared messaging, refill request, and refill approval state changes.
- Predictable demo data and simple business logic.
- Password login followed by a real email verification code, with an explicit bypass for the two fixed demo accounts.
- Persistent demo users and an automatically resetting shared demo state.
- A frontend hosted on Vercel and an API hosted on Cloudflare Workers.

The most important gaps are:

- No native mobile application.
- Lab results and visit summaries use deterministic fictional content rather than a clinical records backend.
- The original fake-authentication guidance was replaced by real registration, password hashing, sessions, and email MFA.

The project should therefore be described as a **functional demo implementation with agreed platform and authentication adaptations**, not as full literal compliance with every original requirement.

## 4. Original demo story

The original health-tech story says:

- A patient books appointments, fills forms, views results, and sends requests from web or mobile.
- Clinic staff handles scheduling, patient records, refill requests, and intake review from an employee application.

The current product demonstrates the main cross-role story:

1. A patient signs in and confirms an email verification code.
2. The patient books an appointment, completes an intake task, or submits a refill request.
3. The shared demo state is stored by the Cloudflare API.
4. An employee signs in through the employee web experience.
5. The employee sees the clinic schedule and can approve or decline a pending refill request.

This is a credible implementation of the central story, although several supporting workflows remain static or incomplete.

## 5. Platform requirements

| Original requirement | Current implementation | Status | Evidence and notes |
| --- | --- | --- | --- |
| Desktop Web Patient Portal | The patient portal runs as a responsive React application in desktop browsers. | **Implemented** | Shared UI in `shared/LumaApp.tsx`; production frontend is built from `vercel-frontend/` and hosted on Vercel. |
| Mobile Web Patient Portal | The same patient portal adapts to smaller browser sizes. | **Implemented** | Responsive layouts and mobile navigation are defined in `app/globals.css`. This follows the original rule that desktop and mobile web should share one application. |
| Native Mobile Patient App | No iOS or Android application exists. | **Not implemented** | The responsive web application provides mobile browser coverage but is not a native application. |
| Windows Desktop Clinic/Admin App | The employee experience is available inside the same web application. | **Agreed adaptation** | A later product decision explicitly replaced the Windows application with employee access in the web application. |

### Platform conclusion

Desktop web and mobile web are covered. The employee workflow is covered through an approved web adaptation. Native mobile platform coverage remains the clearest unmet platform requirement.

## 6. Patient functionality

| Original requirement | Current implementation | Status | Evidence and notes |
| --- | --- | --- | --- |
| Book appointment | The patient selects an available time, books, reschedules, or cancels, and sees the shared lifecycle status. | **Implemented** | Appointment actions persist selected time and status through `/api/demo-state`. |
| Fill intake form | The patient completes, reviews, and updates a four-field intake form. Staff sees the submitted answers. | **Implemented** | `submit-intake` validates and persists structured content through `/api/demo-state`. |
| View lab results | The patient can open a CBC detail view with three deterministic values and reference ranges. | **Implemented** | Results navigation and recent activity both open `LabResultModal`. |
| Update insurance information | The patient can review and update provider, plan, and member ID. | **Implemented** | `update-insurance` validates and persists coverage in the shared state. |
| Message provider | Patient and staff share a persisted conversation and can append replies. | **Implemented** | `send-message` derives the sender from the session and validates a 500-character body. |
| Request prescription refill | The patient can submit a refill request and see pending, approved, or rejected status. A rejected request can be submitted again. | **Implemented** | Role-authorized actions persist through `/api/demo-state`; shared state uses `refillStatus`. |
| View visit summary | Patient and staff can open a deterministic primary-care visit summary. | **Implemented** | Results, recent activity, appointment review, and patient profile expose `VisitSummaryModal`. |

## 7. Employee functionality

| Original requirement | Current implementation | Status | Evidence and notes |
| --- | --- | --- | --- |
| Search patient | Staff can filter a deterministic directory, open a patient profile, inspect shared state, and verify an empty result. | **Implemented** | `PatientSearchModal` exposes five fictional profiles; Maria reflects the current appointment, intake, and refill state. |
| Review appointment queue | The clinic dashboard displays schedule metrics and a list of appointments with statuses. A patient booking appears at its selected time with a details dialog. | **Implemented** | `StaffDashboard` derives the schedule entry, time, lifecycle status, and metric from the shared appointment state. |
| Review intake form | A form completed by the patient appears in the employee request queue and shows the actual submitted answers. | **Implemented** | `StaffDashboard` derives the request, counts, and review dialog from `intakeSubmission`. |
| Approve/reject refill request | Staff can approve or decline a pending refill and the resulting state is visible to the patient. | **Implemented** | `approve-refill` and `decline-refill` are staff-only API actions. |
| Update visit status | Staff can check in the patient, start the visit, and complete it in sequence. The patient sees the resulting status. | **Implemented** | Role-authorized actions enforce `scheduled` → `checked-in` → `in-progress` → `completed`. |
| Export visit summary | Patient and staff can download a deterministic CSV summary. | **Implemented** | The browser generates `maria-lopez-visit-summary.csv` with stable QA assertions. |

## 8. Authentication and MFA comparison

### Original direction

The original build rules requested:

- Fake authentication with hardcoded users.
- No real registration.
- No encrypted password storage.
- No complex session management.
- Demo-controlled MFA, preferably through a fixed code or testRigor-controlled email.
- No external email provider unless an integration is required to demonstrate a testRigor capability.

### Current implementation

The application now provides:

- Fixed patient and employee demo accounts.
- A **Create account** flow for both Patient and Employee roles.
- Registration using any valid email address.
- User-selected passwords stored as hashes in Cloudflare D1.
- Password login followed by a six-digit email verification code.
- Verification codes that expire after 10 minutes.
- Attempt and resend limits.
- Secure, HTTP-only, SameSite session cookies with an eight-hour lifetime.
- Transactional email delivery through Brevo.

| Requirement or decision | Current result | Status |
| --- | --- | --- |
| Provide simple demo login accounts | Fixed patient and employee credentials remain available and visible for copy and paste. | **Implemented** |
| Do not prefill credentials | Login fields are empty; demo credentials are presented separately. | **Implemented** |
| Allow login with a user's own email | A user can create a Patient or Employee account with any valid email and then sign in. | **Intentional extension** |
| Use password plus MFA for patient and employee | Both roles use the same password-plus-email-code sequence. The two fixed demo accounts may explicitly skip the code after password validation; registered accounts may not. | **Implemented with demo bypass** |
| Avoid real registration and security infrastructure | The project intentionally implements registration, password hashing, sessions, rate controls, and database-backed users. | **Intentional deviation** |
| Avoid external email providers | Brevo is used for real MFA delivery. | **Agreed exception** |

### Rationale for the deviation

Real email MFA was explicitly selected so testRigor can validate receipt of an actual code. This supports a key demo capability, but it creates an external dependency and exceeds the original fake-security scope.

Brevo is consistent with the original integration exception only while it remains:

- Available on a free or acceptable demo tier.
- Controlled by the demo team.
- Stable enough for automated tests.
- Easy to replace or disable.
- Useful for demonstrating email-based test automation.

## 9. Data, state, and reset requirements

| Original requirement | Current implementation | Status | Evidence and notes |
| --- | --- | --- | --- |
| Use simple data storage | Cloudflare D1 stores users, MFA challenges, sessions-related records, pending registrations, and demo state. | **Partial alignment** | D1 is more elaborate than static JSON, but it is a small managed database that supports real MFA and persistent users. |
| Use predictable demo data | Patient names, appointments, results, and clinical content are predefined demo values. | **Implemented** | The UI uses stable, fake healthcare data. |
| Make the demo easy to reset | Shared workflow state resets after a rolling 24-hour interval. | **Implemented with limitation** | Reset is checked lazily when demo state is accessed; it is not a scheduled midnight reset. |
| Preserve registered users | User records are excluded from the 24-hour environment reset. | **Agreed adaptation** | This was a later explicit requirement. |
| Allow a personal user to delete their account | Account settings requires the current password and exact `DELETE` confirmation, then clears related authentication rows and the session. | **Implemented extension** | Fixed demo accounts are protected and return HTTP `403`. |
| Reset workflow changes | Appointment, intake, and refill state return to their defaults. | **Implemented** | `resetEnvironmentIfDue` in `lib/mfa-db.ts` clears `demo_state`. |
| Provide an explicit reset option or endpoint | Fixed demo accounts can call `DELETE /api/demo-state` to restore the default workflow state immediately. | **Implemented** | The endpoint requires an authenticated fixed demo account and preserves users. |

### Current reset behavior

The reset is global, not per user. After 24 hours have elapsed, the next demo-state read or write restores the shared appointment, intake, message, and refill state to deterministic defaults. Registered users remain available. Expired MFA challenges and stale pending registrations are cleaned up.

Tests can establish an immediate known starting state through the protected reset endpoint before exercising patient and employee flows.

## 10. Build-rule assessment

| Original build rule | Assessment | Status |
| --- | --- | --- |
| Build the smallest believable version for a testRigor demo | The UI is focused, predictable, and uses simple state transitions. | **Implemented** |
| Keep desktop and mobile web in one responsive product | One shared responsive React UI serves both sizes. | **Implemented** |
| Use native mobile for platform coverage, not a separate business system | No native application exists. | **Not implemented** |
| Use Windows desktop only for employee/internal workflows | The employee workflow is internal, but it was moved to the web by agreement. | **Agreed adaptation** |
| Use simple role differences rather than a full permission system | Patient and Employee roles open different dashboards. | **Implemented** |
| Use simple, visible approval statuses | Refill state uses none, pending, approved, and rejected. | **Implemented** | Rejected requests can be submitted again by the patient. |
| Use local or mock APIs instead of unstable external business APIs | Business state and authentication use first-party API routes on the Worker. | **Implemented** |
| Avoid dependence on outside services | Core UI and state are controlled by the project; email MFA depends on Brevo. | **Partial** |
| Use only useful demo errors | Invalid credentials, role mismatch, invalid/expired MFA, duplicate account, and rate-limit errors are represented. | **Implemented** |
| Keep the UI clean, stable, consistent, and believable | Patient and clinic dashboards use consistent reusable components and responsive styling. | **Implemented** |
| Everything must be fake and safe for a public demo | Clinical and business content is fake. User-provided emails and password hashes are real account data. | **Partial / risk** |

## 11. Later approved decisions

The following decisions supersede or extend the original baseline:

1. **Employee web access replaces the Windows desktop application.**
2. **Both Patient and Employee accounts use password login followed by email MFA.**
3. **MFA codes are delivered through a real email provider.**
4. **Registration accepts email addresses outside the testRigor domain.**
5. **Create account replaces the earlier personal-use option.**
6. **The user selects Patient or Employee during registration.**
7. **Workflow changes reset every 24 hours, while registered users are preserved.**
8. **The frontend is deployed separately on Vercel and proxies API requests to Cloudflare Workers.**

These decisions are valid product choices, but they should remain visible in project documentation because they materially change the original scope and security model.

## 12. Safety and public-demo considerations

The original document requires fake, public-safe data. The current clinical content meets that rule, but open registration introduces real user data:

- Email addresses are stored in Cloudflare D1.
- Password hashes are stored in Cloudflare D1.
- Email addresses are sent to Brevo to deliver MFA codes.
- Registered users are intentionally preserved beyond the 24-hour workflow reset.

Consequently:

- The application must continue to be described as a demo, not a production healthcare system.
- Users should be instructed not to enter real medical information.
- No protected health information should be added.
- Secrets must remain in deployment secret stores and must never be committed.
- A user-retention or deletion policy should be defined before wider public use.
- Employee self-registration must not be interpreted as production-grade staff authorization.

## 13. Recommended work to close the main gaps

### Priority 2 — Complete the patient feature set

The currently listed patient flows are implemented. Future additions should be driven by new demonstration requirements rather than the original gap list.

### Priority 3 — Improve test control and safety

The repository now contains a serial, deployment-gating Playwright scenario for the deterministic demo accounts and all shared business flows. Retention and Brevo failure behavior are documented in the developer handoff.

MFA policy tests now cover expiration, consumed challenges, attempt locking, remaining-attempt calculation, resend cooldown, and hourly limits. Authenticated self-service account deletion is implemented with password confirmation and demo-account protection.

Remaining work:

1. Add provider-injected route-level tests for complete personal-account registration, delivery failure cleanup, and replay races without sending real email.
2. Add password reset/change only if personal accounts remain part of future scope.

### Priority 4 — Decide native mobile scope

Choose one of the following and record the decision:

- Build the small native application described in the original rules.
- Explicitly remove native mobile from the accepted scope and treat responsive mobile web as the final mobile deliverable.

## 14. Final conclusion

The implementation meets the central business-demo objective: it provides a believable health-tech workflow that testRigor can automate across patient and employee experiences.

It does **not** fully implement every platform and feature named in the original document. Its current compliance profile is:

- **Core demo story:** implemented for the agreed web scope.
- **Desktop and mobile web:** implemented.
- **Native mobile:** not implemented.
- **Employee Windows app:** replaced by an approved employee web experience.
- **Patient and employee feature lists:** implemented for the agreed web adaptation.
- **MFA and registration:** implemented beyond the original scope.
- **Demo reset:** implemented automatically, with users preserved.
- **Public-demo safety:** clinical data is fake, but real user account data requires explicit operational care.

This document should be updated whenever a missing workflow is completed or a scope decision changes.
