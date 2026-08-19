# 01b — Process-Flow Evidence (orchestrator, not delegated)

Domain reference: Epic MyChart, athenahealth Patient Portal, Zocdoc, and Luma Health's own
real product (patient communication + appointment reminders).

All findings below are read directly from `lib/demo-state.ts` (the authoritative state
machine) and cross-checked against `shared/LumaApp.tsx`.

## The 13 implemented actions

`lib/demo-state.ts:113-127` defines the complete action set:

| Patient (`:211-220`) | Staff (`:231-238`) |
|---|---|
| `book-appointment` | `check-in-appointment` |
| `reschedule-appointment` | `start-appointment` |
| `cancel-appointment` | `complete-appointment` |
| `complete-intake` | `approve-refill` |
| `submit-intake` | `decline-refill` |
| `send-message` | `send-message` |
| `update-insurance` | |
| `request-refill` | |

Appointment lifecycle (`:247-351`):
`none → scheduled → checked-in → in-progress → completed` plus `cancelled` from `scheduled`.

## The canonical patient journey vs what exists

| # | Real-world stage | Implemented? | Evidence |
|---|---|---|---|
| 1 | Find care / triage by reason | **No** | `book-appointment` accepts only `appointmentTime`, one of three fixed slots (`:260`, `isAppointmentTime` `:133`). No provider, no location, no modality, no reason-for-visit at booking. |
| 2 | Schedule | **Partial** | Time-only. `AppointmentTime = "09:00" \| "10:30" \| "15:00"` (`:10`). |
| 3 | Pre-visit registration | **Partial, ungated** | Intake exists but has **zero preconditions** — `complete-intake` (`:352`) and `submit-intake` (`:361`) succeed with `appointmentStatus === "none"`. Insurance (`:401`) is likewise standalone. |
| 4 | Confirm / remind | **Missing entirely** | No `confirm-appointment` action exists. State jumps `scheduled → checked-in`. Notable because the product is named after a company whose actual business is appointment reminders. |
| 5 | Check-in / arrival | **Wrong actor** | `check-in-appointment` is **staff-only** (`:232`); the patient list at `:211-220` excludes it. In every reference portal the patient self-checks-in. No queue position or waiting-room state. |
| 6 | The visit | **Opaque to patient** | `in-progress` exists (`:334`) but no patient-facing representation of it. |
| 7 | Post-visit | **Partial** | Visit summary + CSV exist. No follow-up booking prompt, no after-care instructions as state, no billing, no feedback survey. |
| 8 | Ongoing care | **Partial** | Refill is a single global `RefillStatus` (`:2`) with no medication selected and no pharmacy. Lab results are **not in `DemoState` at all** — they are static JSX, so there is no new/seen/acknowledged state. |

## Concrete flow defects (each is simultaneously a UX gap and a missing test scenario)

1. **Intake is not bound to a visit.** A patient can submit a pre-visit questionnaire when
   no visit exists (`:352`, `:361` — no status guard). Real intake belongs to a specific
   appointment. Correct behavior would be `409` when `appointmentStatus` is `none`,
   `completed`, or `cancelled` — a new negative test case that does not exist today.

2. **The patient cannot check themselves in.** (`:232` vs `:211-220`.) This inverts the
   real-world actor and removes an entire class of patient-side scenarios.

3. **No confirmation step.** No `confirm-appointment` action, so the `scheduled` state has
   no sub-state and there is nothing for a reminder to act on.

4. **No no-show or late-cancel path.** `cancelled` is reachable only by the patient from
   `scheduled` (`:296-303`). Staff cannot mark a no-show, which is one of the most common
   real clinic events.

5. **Insurance is not a precondition of anything.** `update-insurance` (`:401`) mutates a
   card that no other transition reads. A realistic gate — valid insurance required before
   `check-in` — would create a dependency chain worth automating.

6. **Refill is decoupled from medication and from the visit.** One global
   `refillStatus` (`:434-463`); no medication identifier, no dosage, no pharmacy, no link
   to the completed visit that would justify it.

7. **Results have no lifecycle.** Lab results are static markup, never part of `DemoState`,
   so "new result" → "patient viewed it" → "patient asked a question about it" cannot be
   asserted.

8. **Message badge counts total, not unread.** `shared/LumaApp.tsx:443` renders
   `{messages.length}`. The rendered screenshot shows a badge of `4` on a thread where all
   4 messages had been read. There is no unread concept in `DemoMessage` (`:22-27`) — no
   `readAt`, no recipient. The badge therefore asserts something the data cannot support.

## Why this matters for the stated purpose

The demo's value is as an automation target. Every gate above converts a currently
unconditional `200` into a `200`-or-`409` pair — which is exactly the branching a QA trainee
needs to practice on. The flow gaps are not merely cosmetic realism; they are the missing
half of the test matrix.
