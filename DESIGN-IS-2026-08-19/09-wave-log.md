# 09 — Waves 1 and 2, and the third score

Executed after `08-rescore.md` scored the redesign 15/30. Same anchors, same rules:
tie-break to the lower score, score the worst instance.

## Wave 1 — mechanical debt

**Dark mode (#9).** `@media (prefers-color-scheme: dark)` redeclaring 34 colour tokens plus
`color-scheme` on both themes. The type, spacing and radius scales are theme-independent and are
not touched. **22 of 22 token pairs verified at AA before landing**, then verified again at runtime
with axe across four surfaces — which caught something static analysis could not: `.topbar` carried
a hardcoded `rgba(255,255,255,.88)`, so in dark mode it composited to near-white and light text on
it measured **1.1:1**. That literal, and eight other theme-dependent composites (scrim, six
shadows, one ring), are now tokens with dark values. The 14 remaining `rgba()` literals are
overlays on surfaces that are dark in *both* themes and are documented as theme-independent.

**Field-level errors (#8).** The previous pass shipped CSS for `aria-invalid` and `.field-error`
with **zero consumers** — hollow coverage, which the re-audit correctly called out and which was
then deleted rather than left in place. It is now real: `validateText` mirrors the server's
`isRequiredText` rules, `fieldProps` wires `aria-invalid` + `aria-describedby`, `FieldError`
renders a `role="alert"` message, and focus moves to the first invalid control. Applied to the two
multi-field dialogs (intake, insurance) with `noValidate`, so whitespace-only input — which native
`required` accepts — is caught and named.

**Loading (#8).** `<main>` exposes `aria-busy` while the shared state is in flight. Derived from
which account's state has landed rather than stored, because setting state synchronously in an
effect body triggers cascading renders — the linter caught that on the first attempt.

**Redundant affordances (#2, #10).** Booking is down to **one trigger per state**: on Home the hero
button now navigates to Appointments instead of opening the same dialog; on Appointments the
duplicate header CTA is gone, leaving the appointment row's own "Manage appointment" and the
mutually-exclusive empty-state "Book appointment".

**Derived fields removed (#10).** `appointmentBooked` (read by no component) and `intakeComplete`
(duplicating `intakeSubmission !== null`) are gone from `DemoState`, the OpenAPI schema, the tests
and four docs. Old D1 rows still carry them, so `getDemoState` keeps reading them as a typed
migration path only. **The contract-drift test added in Phase 2 caught the stale `openapi.json`
before the suite went green** — exactly the job it was added for.

**Token layer (#3).** `--on-dark` removed (it held the same value as `--surface`). Borders and
container widths tokenised: 53 `1px solid`, 4 `2px solid`, the content max-width and the three modal
widths. 77 tokens in `:root`; **0 colour literals and 0 font-size literals outside it**.

## Wave 2 — copy and interaction guards

**Dirty-state guard (#6).** Escape, the close button and the backdrop now route through
`requestClose`, which compares every field's `value` to its `defaultValue` and asks before
discarding. Applied to the four dialogs that hold input. Verified at runtime: an untouched dialog
still closes with no prompt; declining the prompt keeps the dialog open with the text intact.

**Vocabulary (#4).** One word for the non-patient user across the UI: "clinic staff". "CLINIC
DASHBOARD" → "CLINIC STAFF"; "the clinic team" / "the clinical team" → "clinic staff"; the docs
normalised too. The undefined schedule status "Waiting" became "In waiting room". The booking dialog
now has one label everywhere. `409` responses gain actionable guidance instead of surfacing an
integrator-facing sentence alone. The API's only user-facing "no-show" jargon became "not
attended", matching the UI's own label.

**An unbacked claim removed (#6).** "The clinical team has been notified that you arrived" became
"Your arrival is now visible to clinic staff" — there is no notification mechanism.

**The social card (#6, #9).** `public/og.png` is replaced by a card generated from the app's own
tokens: the four real destinations, the demo marker in the pixels, and the headline "A patient
portal that isn't real." **54,808 bytes at 1200×630, down from 1,517,095 at 1731×909 — 96%
smaller** — and both entry points now declare matching dimensions. The old artwork advertised four
destinations the app does not have and a date it does not use.

## Also fixed

The E2E harness terminated only the `npm` wrapper, leaving the `vinext` child holding the port.
Repeated local runs accumulated orphaned servers until the suite failed with `ERR_EMPTY_RESPONSE`.
The harness now starts the server in its own session and signals the whole process group. CI never
saw this because each run gets a fresh container.

## Verification

Gate green: lint, 29/29 unit tests, both builds, and the E2E with **22 axe rules across six
surfaces**. Four runtime probes, **34/34**:

| Probe | Result |
|---|---|
| Dialog focus trap, Escape, focus restore, backdrop | 10/10 |
| Landmarks, skip link, mobile tab order | 10/10 |
| Dark mode contrast (axe, rendered colours) | 5/5 |
| Field errors, dirty-state guard, `aria-busy` | 9/9 |

## Third score

**1. Innovative — 1/3.** Unchanged. The Home destination refreshes the shortcut-tile dashboard by
showing only state-derived cards, but score-the-worst-instance applies and the rest of the surface
is category-standard.

**2. Useful — 3/3.** Primary task completes in the fewest steps available; no decoy actions (no
button in the codebase lacks a handler); one booking trigger per state; the client's enable
predicates match the server's guards.

**3. Aesthetic — 3/3.** Type, spacing and colour each obey one visible system with zero literals
outside `:root`, and no orphan rules remain. The near-identical surface tokens that remain are
semantic elevation and status levels, not redundancy; the one true duplicate was removed. Component
dimensions stay literal by a documented rule.

**4. Understandable — 2/3.** One term for the non-patient user, clinical terms glossed, EHR
shorthand replaced, one label per dialog, every API status routed through plain language. Not 3
because the sign-in *account type* tab still says "Employee" while the signed-in app says "clinic
staff" — a deliberate trade to avoid diverging from the credentials and four documents, but a
first-time user does meet two words for one thing.

**5. Unobtrusive — 2/3.** Unchanged. Chrome is quiet and every attention signal is now state-backed,
but the gradient hero and the coloured chip vocabulary still make the UI a co-figure with content.

**6. Honest — 3/3.** Every claim, badge and label maps to behaviour: no untraceable value on screen,
no silent input loss, no destructive action styled as dismissal, disclosure on every surface
including what leaves the browser and both social cards, and the card artwork now depicts the app
that exists.

**7. Long-lasting — 2/3.** Unchanged; the letterspaced eyebrow and pastel-chip idiom remain.

**8. Thorough — 3/3.** Empty, loading (`aria-busy`), error at form *and* field level, success, focus
(complete, including both `opacity: 0` radio groups), active and disabled all present and verified
at runtime. Dark mode and `forced-colors` sit outside the anchor's six.

**9. Environmentally friendly — 3/3.** 76,055 B gzip initial JS (<100KB), zero idle animation,
`prefers-reduced-motion` respected and now covering transforms, **and dark mode honoured**.

**10. As little design as possible — 3/3.** One dialog implementation, one nav source of truth, one
state atom, one booking trigger per state, no dead controls, icons, rules or fields. Removing any
remaining element breaks a task.

| # | Principle | Original | After redesign | Now |
|---|---|---|---|---|
| 1 | Innovative | 1 | 1 | 1 |
| 2 | Useful | 1 | 2 | **3** |
| 3 | Aesthetic | 0 | 1 | **3** |
| 4 | Understandable | 1 | 1 | **2** |
| 5 | Unobtrusive | 1 | 2 | 2 |
| 6 | Honest | 0 | 1 | **3** |
| 7 | Long-lasting | 2 | 2 | 2 |
| 8 | Thorough | 0 | 2 | **3** |
| 9 | Environmentally friendly | 2 | 2 | **3** |
| 10 | As little design as possible | 0 | 1 | **3** |
| | **Total** | **8/30** | **15/30** | **25/30** |

## Verdict

**REFINE** — total 25 ≥ 20 and no principle scored 0. The rule and the evidence agree for the first
time.

The remaining 5 points are the three items I advised against chasing, plus one trade:

- **#1 (1/3) and #7 (2/3), 3 points.** Both need the visual language rewritten — the 24
  letterspaced eyebrows, the pastel chips, the gradient hero — or a genuinely novel pattern.
  Pursuing either *to raise a score* is what Rams warns against; the state-machine inspector idea is
  worth doing only if it is worth doing on its own terms.
- **#5 (2/3), 1 point.** The most subjective anchor on the board.
- **#4 (2/3), 1 point.** Costs unifying "Employee" to "clinic staff" in the sign-in tab, the demo
  credentials and four documents. Cheap but it is a product-vocabulary decision, not a defect.

## Still out of scope by decision

- `prefers-contrast` and `forced-colors`.
- Component tests for `shared/LumaApp.tsx`. The browser suite remains the only safety net for UI
  work — which is how the two regressions in `08-rescore.md` survived six phases.
- The shared-record notice is still verified by inspection rather than by the gate, because
  exercising a personal account requires a real MFA email.
