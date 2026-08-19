# 08 — Re-audit and new score

Same process as the original audit: three independent evidence subagents, each explicitly told
**not** to read `DESIGN-IS-2026-08-19/`, so the measurement is independent rather than a
confirmation of the first pass. Same Phase 2 anchors, applied verbatim: **tie-break to the lower
score**, **score the worst instance not the mean**, no weights.

The re-audit found **eleven defects, two of them introduced by the redesign itself**. All were
fixed before scoring; scoring a state the audit had just flagged would be worthless. The two
regressions now have permanent tests in the deploy gate.

---

## Defects the re-audit found

### Introduced by the redesign (regressions)

1. **A staff user reloading the page got an empty `<main>`.** `destinations` is
   `Partial<Record<NavId, …>>`; the session-restore effect set `user` without touching
   `activeNav`, which stays `"home"` — a destination staff has no branch for. Six phases and a
   green E2E missed it because the E2E only ever reaches a destination through `startLogin`, which
   resets `activeNav`. **Fixed** in three places (restore effect, router fallback,
   account-deleted reset) and now asserted in `tests/e2e/full_demo.py`.
2. **Two `aria-modal` dialogs could be mounted at once.** The staff dialogs' "Open visit summary"
   set the *parent's* modal state without clearing their own, so `VisitSummaryModal` mounted on top
   of the opener — two focus traps, two document-level Escape listeners, one keypress closing both.
   **Fixed**: the child closes itself first. The E2E now asserts
   `page.locator('[role="dialog"]').count() == 0` at that point.

### Missed by the redesign

3. **The booking dialogs ignored the provider and specialty the patient chose**, re-typing
   "Dr. Ana Costa" / "Primary Care". Phase 2 made those selects real fields and Phase 5 claimed the
   honesty fix — but two read-only views still hardcoded the defaults. **Fixed**, with an E2E
   assertion that a Cardiology / Dr. John Lima booking survives into the Appointments view.
4. **`app/layout.tsx` — the Next entry point's social card had no demo disclosure at all.** Phase 5
   only fixed `vercel-frontend/index.html`. **Fixed**, and its declared OG image width (1734)
   corrected to the file's actual 1731.
5. **"A real verification code will be sent by email after sign-in"** sat directly above the
   skip-MFA button, which sends no email. **Fixed.**
6. **`SharedRecordNotice` rendered on only 2 of 4 patient destinations** — absent from Appointments
   and Messages. **Fixed** on all four.
7. **`:where(button):active` has specificity 0**, so the hover transforms beat the pressed state:
   the `:active` feedback was suppressed in the normal mouse case. **Fixed.**
8. **11 of 17 `disabled` call sites had no visual change** — there was no
   `.primary-button:disabled` or `.secondary-button:disabled`. **Fixed.**
9. **The focus ring measured 1.17:1 / 1.47:1 / 2.28:1 on the three dark-teal surfaces**, because
   `outline-offset` paints the ring on the parent. **Fixed** with an inverted ring on dark surfaces.
10. **The focus trap escaped when the focused control became disabled** — submitting a form dialog
    disables its button, focus falls to `<body>`, and neither wrap branch matched. **Fixed.**
11. **Three demo disclosures vanished on phones** (`.security-note`, `.conversation-status`) and the
    lab table hid its "Normal range" column, leaving three clinical values without reference.
    **Fixed.**

Also fixed: the field-level-error CSS that no component ever used (removed rather than left as
hollow coverage), two dead icons shipping in the first-paint chunk, five dead CSS rule groups, a
heading-level skip (`h1` → `h3`), `aria-label` on two `role="generic"` divs, the
`@media (pointer: coarse)` block that listed nine controls already at 44px while omitting the two
that were not, the reduced-motion reset that stopped `transition` and `animation` but not
`transform`, and the "did not attend" action that was styled identically to two harmless buttons.

### Three claims of mine that were overstated, now corrected in the source

- A comment asserted **"Every number below is counted from state; none is a hardcoded floor."** The
  count is taken over a four-row hardcoded fixture array, so it cannot read below 4.
- The stylesheet header claimed **no spacing value outside `:root`**. Padding/margin/gap is
  tokenised; border widths and container dimensions are not.
- The type-scale comment claimed **ratio 1.25**. It holds from 16px up; the bottom two steps are
  1.167 and 1.143.

---

## Scorecard

**1. Innovative — 1/3.** The Home destination genuinely refreshes the shortcut-tile dashboard
pattern: it now shows only state-derived cards instead of indexing the rest of the app. But
score-the-worst-instance applies — the four-item nav, the merged Health record and the Messages
thread are category-standard, so the surface as a whole imitates with minor variation.

**2. Useful — 2/3.** Zero controls without a handler (verified: no `<button>` in the codebase lacks
`onClick` or `type="submit"`); every destination has distinct content; the booking form persists
every input it collects; the client's intake enable-predicate now matches the server guard. Not 3
because adjacent surface still adds steps: Home carries two controls that open the same booking
dialog, and Appointments carries three.

**3. Aesthetic — 1/3.** A real system exists — 63 tokens, **0 colour literals and 0 font-size
literals outside `:root`**, an 8-step type scale with a 12px floor, spacing on a 4px grid. But five
inconsistencies remain: `--on-dark` and `--surface` are the same value under two names; nine
near-white tokens sit within ΔE 9.6 of each other; 23 `rgba()` values are untokenised; 88 distinct
sizing `px` literals live outside `:root`, 53 of them off the 4px grid; and the type ratio breaks at
the bottom two steps. That is the 1-anchor's "3-5 inconsistencies" exactly.

**4. Understandable — 1/3.** The copy pass glossed the clinical terms, replaced the EHR shorthand,
and removed a support promise with nothing behind it. But the re-audit counted **eight distinct
terms for the non-patient user** ("Employee" at sign-in, "Clinic staff" after, plus Care team /
clinic team / clinical team / Clinic dashboard); "Waiting" is an undefined schedule status;
`400` and `409` API strings still reach toasts verbatim; `no-show` surfaces in a toast while the UI
calls that state "Did not attend"; and one dialog is opened by three differently-labelled controls.

**5. Unobtrusive — 2/3.** The fabricated attention signals are gone — the decorative unread dot,
the handler-less bell and search, the fake progress ring, the hardcoded activity feed. Nine controls
visible on the landing destination in the default state, zero idle animation. Chrome is visible but
quiet, not competing.

**6. Honest — 1/3.** The reason this principle scored 0 is gone: no value on screen is untraceable
to a `DemoState` field, the booking form no longer discards inputs it collected, the badge counts
real unread messages, both entry points' social cards disclose, and the CSV and the MFA email carry
their own notices. It is 1 rather than 2 because one dark-pattern-class issue remains: **Escape and
the close button silently discard typed input** in the intake, insurance and account dialogs — there
is no dirty-state guard. (Backdrop dismissal was already fixed and is off for every form dialog.)

**7. Long-lasting — 2/3.** Unchanged in character; one dated marker (the donut progress ring) went
away with the fabricated data. The letterspaced eyebrow and pastel-chip idiom remain.

**8. Thorough — 2/3.** Empty states in five places; focus complete and verified at runtime,
including the two `opacity: 0` radio groups; `:active` and `:disabled` now real; 22 axe rules gate
the deploy across six surfaces. Not 3 because loading is a label swap with no `aria-busy` anywhere,
and field-level error marking is absent — the CSS that pretended to cover it was removed rather
than left as hollow coverage.

**9. Environmentally friendly — 2/3.** First paint is **75,554 B gzip JS + 8,628 B CSS**; the
1.29 MB `swagger-ui-react` chunk is correctly deferred behind a dynamic import; zero idle animation;
`prefers-reduced-motion` now also stops transforms. Misses 3 solely because dark mode is
unimplemented — `prefers-color-scheme` appears nowhere.

**10. As little design as possible — 1/3.** Nine hand-copied dialog shells became one; dead
controls, dead icons and dead CSS are gone; state is a single atom. Still removable: the second
booking trigger on Home, one of the three on Appointments, the `appointmentBooked` field no
component reads, `intakeComplete` which duplicates `intakeSubmission !== null`, and the duplicate
`--on-dark` token. Five removable elements is the 1-anchor.

| # | Principle | Before | After |
|---|---|---|---|
| 1 | Innovative | 1 | 1 |
| 2 | Useful | 1 | **2** |
| 3 | Aesthetic | **0** | **1** |
| 4 | Understandable | 1 | 1 |
| 5 | Unobtrusive | 1 | **2** |
| 6 | Honest | **0** | **1** |
| 7 | Long-lasting | 2 | 2 |
| 8 | Thorough | **0** | **2** |
| 9 | Environmentally friendly | 2 | 2 |
| 10 | As little design as possible | **0** | **1** |
| | **Total** | **8/30** | **15/30** |

## Verdict, and where the rule breaks

Applying Phase 3 mechanically: **total 15 < 20, so the rule still says REDESIGN.**

I am reporting that rather than re-scoring to reach the answer that feels right, because the
committed process forbids working backwards from a preferred verdict. But the rule and the evidence
now disagree, and the disagreement is informative: **all four zeros are gone, no principle is
below 1, and the two load-bearing dimensions that justified the original REDESIGN (#6 honest at 0,
#2 useful at 1) are now 1 and 2.** A threshold designed to separate "restart from purpose" from
"iterate" is not measuring anything useful at 15/30 with no zeros — the structure is sound and the
remaining work is concentrated, not foundational.

The honest reading of the evidence is **REFINE**, and the residual 15 points are concentrated in
three places:

1. **#4 understandable (1/3) — a real copy pass, not the partial one I did.** Unify the
   non-patient vocabulary to one term end to end, define or remove "Waiting", route the remaining
   `400`/`409` API strings through `friendlyActionError`, and give the booking dialog one label.
2. **#6 honest (1/3) and #8 thorough (2/3) — two interaction guards.** A dirty-state confirmation
   before Escape or close discards a form, and field-level error marking with `aria-invalid` plus
   `aria-describedby`.
3. **#3 aesthetic (1/3) and #10 (1/3) — finish the token layer and delete the last duplicates.**
   Collapse the near-identical surface tokens, tokenise the sizing layer, and remove
   `appointmentBooked`, `intakeComplete` and `--on-dark`.

## Still out of scope by decision

- **Dark mode**, `prefers-contrast`, `forced-colors` — the token layer makes them reachable, which
  they were not before. Caps #9 at 2.
- **`public/og.png`** — 1,517,095 bytes at 1731×909, roughly ten times what those dimensions
  warrant, and its artwork depicts four destinations the app does not have. Now referenced from both
  entry points, so no longer orphaned, but re-encoding or redrawing a branding asset belongs to its
  owner.
- **Component tests for `shared/LumaApp.tsx`.** The browser suite remains the only safety net for UI
  work — which is precisely how regressions 1 and 2 survived six phases.
