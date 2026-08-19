# 00 — Scope Lock

**Audit date:** 2026-08-19
**Framework:** Dieter Rams, ten principles (`design-is`)

## What is being audited

| Surface | Path |
|---|---|
| Patient + staff portal UI | `shared/LumaApp.tsx` (998 lines) |
| Icon set | `shared/Icon.tsx` (129 lines) |
| API docs console | `shared/ApiDocs.tsx` (105 lines) |
| All styling | `app/globals.css` (364 lines) |
| Process/state machine | `lib/demo-state.ts` (465 lines) |
| Built bundle | `vercel-frontend/dist/` |

**Rendered evidence:** two real screenshots from the last E2E run at 1440×1050 —
`test-results/e2e/completed.png` (Messages screen) and
`test-results/e2e/protected-account.png` (Overview screen behind a modal).
No live server was run; all CSS values are literal declared values read from source.

**Screens in scope:** login + MFA, patient Overview / Appointments / Forms / Results /
Messages, staff dashboard + patient search, and all modals (booking, intake, insurance,
lab result, visit summary, account settings).

**Out of scope:** the API contract, deployment topology, and security model — covered in a
prior analysis pass and in `docs/DEVELOPER_HANDOFF.md` §12.

## Primary user and primary task

This product has **two** users with different primary tasks, and that duality is the root
of most flow questions:

1. **Nominal user — a patient.** Primary task: *get care and keep track of it.* Book a
   visit, complete pre-visit paperwork, read results, message the clinic, request refills.
2. **Actual user — a QA engineer learning test automation.** Primary task: *drive every
   business state deterministically and assert on it.* This user needs stable selectors,
   observable state transitions, and a rich set of valid/invalid paths.

These two mostly align — a believable clinical flow is a good automation target — but they
diverge on one axis: the QA user benefits from **more distinct, gated states**, whereas the
current design favors **fewer, ungated ones**. Where the audit finds a flow gap, it is
usually a gap for *both* users at once.

## Constraints

- Fictional clinical content is **required**, not a defect (QA training, public demo).
- Stack is fixed: React 19, hand-written CSS (no component library), Cloudflare Worker + D1.
- `shared/LumaApp.tsx` compiles into **two** deployment targets (Worker and Vercel), so it
  cannot take framework-specific dependencies.
- The E2E suite in `tests/e2e/full_demo.py` is a **deploy gate**; it asserts on visible text
  and CSS classes, so any UI change must be reflected there in the same commit.
- Accessibility floor: none stated. This audit applies WCAG 2.2 AA as the floor.

## Reference designs

Real-world patient portals whose flows set the domain expectation: Epic MyChart,
athenahealth Patient Portal, Zocdoc, and Luma Health's own actual product (a
patient-communication and appointment-reminder platform — relevant because the demo carries
that name but currently implements no reminder or confirmation step at all).

## User-reported concerns to verify

1. "Overview and Appointments are the same thing."
2. "Some elements seem too small."
3. Open-ended: process flows feel incomplete, but the reporter is not a domain user.
