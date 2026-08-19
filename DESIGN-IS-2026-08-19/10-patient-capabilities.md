# 10 — Patient capabilities, and the audit findings they closed

Prompted by two observations from the owner: an element was covering the hero's
"book when ready" label, and the patient panel was "muito limpo, sem opções" —
too empty to be a portal. The instruction was that anything added had to be
reflected in the rest of the system.

## The element that was covering content

`.hero-decoration` held a 100×100 translucent dot positioned `top: 105px;
left: 55px` inside a box anchored `right: -70px`. On a 1440px viewport that put
it directly over the appointment column, on top of "clinic time" and "book when
ready". Two earlier dots had already been removed for the same reason; the
comment claiming they were gone was left beside the one that remained.

The dot is gone and the surviving ring moved from `right: -70px` to `-150px`, so
its inner edge stops short of the column instead of crossing it. It also gained
`pointer-events: none`.

## Three new domains, chosen to close open findings rather than add surface

**Medications, with per-medication refills.** `DemoState.refillStatus` was one
global field: one request, one outcome, for a patient the UI told had three
medications. Approving "the refill" approved an unnamed thing. Refills now live
on `medications[]`, `request-refill` / `approve-refill` / `decline-refill`
require `medicationId`, and an unaddressed request is a **400** — malformed, not
out of sequence. The new **Medications** destination exists to name the
medication a request is for; the staff queue renders one review card per pending
medication.

**Lab results, as a list with a read lifecycle.** The single hardcoded CBC table
lived in `LabResultModal` with its three values written into JSX. `results[]`
now carries two results with their own values, and `acknowledge-result` marks one
`viewed`. **Opening the result is the acknowledgement** — a separate "mark as
read" control would only tell the app what it had just watched the patient do.
Re-opening is a no-op, not a `409`.

**A statement, payable once.** `statement` plus `pay-statement`. No money moves,
and the toast says so.

Home now shows only cards that correspond to outstanding state: unread results,
requestable refills, refills under review, an unpaid statement, intake. Each
navigates to the destination that owns the task rather than acting in place.

## What the additions forced elsewhere

| Surface | Change |
|---|---|
| `lib/demo-state.ts` | 3 types, 3 guards, 3 counters, 2 actions; refill transitions keyed by id |
| `lib/mfa-db.ts` | Per-list validation with whole-list fallback, and a legacy migration |
| `app/api/demo-state/route.ts` | Forwards `medicationId` and `resultId` |
| `public/openapi.json` | 6 new schemas, `DemoState` rewritten, 2 actions, 2 request inputs |
| `tests/demo-state.test.ts` | 8 new transition tests; 36 total |
| `tests/e2e/full_demo.py` | 4 new API assertions, per-medication independence, result and billing walkthroughs; **7 axe surfaces** |
| `public/og.png` | Regenerated: the card advertised four destinations and there are now five |
| 4 documents | State shape, action tables, scenario steps, traceability rows |

## A contract defect the type checker was not asked about

`tsc --noEmit` is not in the deploy gate — lint, unit tests and both builds are,
and none of them type-check. `getDemoState` was still **returning**
`appointmentBooked`, `intakeComplete` and `refillStatus`, three fields Wave 1
removed from `DemoState` and from the OpenAPI schema. The API response therefore
carried three undocumented fields the whole time, and the drift test could not
see it because it compares the schema to `DEFAULT_DEMO_STATE`, not to a response.

Fixed: the three are read as a migration path only and never written back. A
legacy pending refill is attached to the first medication so it does not vanish
from the staff queue. The E2E now asserts all three are absent from a real reset
response.

The input-field drift test was hollow for the same class of reason — it compared
`openapi.json` to a list hardcoded in the test, so it passed while the route grew
`medicationId` and `resultId`. It now reads the accepted fields off
`app/api/demo-state/route.ts`.

## Five defects the screenshots found that reading did not

Verified in a real browser, both themes, seven surfaces:

1. `.review-status.neutral` used `--surface-sunken`, which in the dark theme is
   **darker than the panel it sits on** — the "No request" chip had no visible
   container. Now `--line` / `--ink-soft`: 7.12:1 light, 6.75:1 dark.
2. `.activity-icon.coral` was referenced twice and **defined nowhere**, so the
   intake icon rendered with no container beside five that had one. The rule
   exists; the misnamed `.orange` duplicate of the same token is gone.
3. `.panel` carries no padding of its own — each panel class adds it. The
   medication list had none, so the first row touched the top border and the
   action button touched the right one.
4. The statement card ran `description.toLowerCase()`, which rendered
   "July 12, 2026" as "july 12, 2026".
5. With no appointment booked, the hero still named **"Dr. Ana Costa · Room
   204"** from a fallback, and printed an em-dash at display size as a
   placeholder for nothing. Both are honesty defects on the landing surface: it
   now says "Pick a time and a provider in Appointments."

## Verification

Gate green: lint, **36/36** unit tests, both builds, and the browser suite with
22 axe rules across **7 surfaces** (Medications is the new one). 14 colour pairs
for the new chips and icons computed in both themes; worst text **5.07:1**,
worst glyph **5.54:1**. Initial JS **79,090 B gzip**, still under the 100 KB
anchor for #9. CSS still has **0 colour literals and 0 font-size literals**
outside `:root`.
