# 02 — Scorecard

Scored by the orchestrator against the Phase 2 anchors, applied verbatim. Rules honored:
**tie-break to the lower score**, **score the worst instance not the mean**, no weights, no
bonuses. Anchors reference `01-evidence.md` and `01b-flow-evidence.md`.

---**1. Good design is innovative — Score: 1/3**
   Evidence: A3-A5 (route structure), B1-B3 (visual language), 01b (journey table).
   Justification: A competent composite of the standard patient-portal dashboard — sidebar nav,
   hero next-appointment card, quick-action tiles, activity feed, progress ring — assembled with
   minor variation and no new pattern; it imitates the category rather than advancing it, but it
   is not a wholesale copy of one competitor's flow.

**2. Good design makes a product useful — Score: 1/3**
   Evidence: A3 (no `Appointments` branch exists), A4 (staff: 3 of 5 destinations byte-identical),
   A7 (11 dead or conditionally-dead controls), C1a (2 of 3 booking inputs discarded), 01b
   (intake ungated, check-in on the wrong actor, no confirm step).
   Justification: The primary task does complete — "Book appointment" works from the Overview —
   but reaching it requires detours through duplicate destinations, and the surface is populated
   with decoy actions, which the 3-level anchor explicitly disqualifies; it is not a 0 because
   booking is still directly supported on the screen audited.

**3. Good design is aesthetic — Score: 0/3**
   Evidence: B1 (24 font sizes, contiguous integers 8→22px), B2 (54 spacing values, 36 off any
   4px grid, zero spacing tokens), B3 (141 distinct colors against 11 tokens; 12 near-whites,
   8 near-identical grays, 14 mint tints), A9 (111 hex literals).
   Justification: The 0 anchor's first clause — "no visible system" — is literally satisfied at
   the token layer: there is no type scale, no spacing scale, and no color scale, and the
   consequence is visible in the output as adjacent surfaces that differ imperceptibly but really.

**4. Good design makes a product understandable — Score: 1/3**
   Evidence: C5 (all six checked labels fail as self-explanatory; ~40 jargon items; four role
   vocabularies), C1a/C1c/C1e/C1f (label→behavior mismatches), C1h (four labels, one destination).
   Justification: Far more than the 2-3 unclear controls the 1-level allows, and several labels
   actively mislead on destructive actions — yet the 0 anchor is narrowly about the primary action,
   and "Book appointment" remains identifiable without help.

**5. Good design is unobtrusive — Score: 1/3**
   Evidence: D6 (7 attention indicators on load, 3 of them not backed by data — hardcoded red
   notification dot, badge flipping 0→2 unprompted, fabricated progress ring), A6 (22 `.eyebrow`
   micro-labels, 9 avatar chips, 9 trailing chevrons), A1 (25 controls visible at once on Overview:
   15 chrome, 10 content).
   Justification: Chrome does not dominate, but decoration competes with content — and the worst
   instances are decoration masquerading as signal, which is louder than ornament.

**6. Good design is honest — Score: 0/3**
   Evidence: C1a (Specialty/Provider silently discarded, cross-confirmed by E5 — the selects have
   no `name`, so `FormData` omits them — followed by "Your appointment is confirmed"), C4.3
   (a pending refill rendered with a completion check mark), C1b (every patient shown another
   named patient's blood counts and medication as their own portal), C2 (nine fabricated values
   presented as computed), C3 ("protecting every account" contradicted by the skip-MFA button).
   Justification: The 0 anchor's head clause is "any deceptive flow" — the system tells the user a
   cardiology appointment with a chosen provider is confirmed when neither was recorded, and
   renders "pending" as done; this is not one minor inflation but a pattern of the interface
   asserting outcomes the data does not support.

**7. Good design is long-lasting — Score: 2/3**
   Evidence: B3 (teal/mint palette, card language), the rendered screenshots, A6 (22 uppercase
   letterspaced eyebrows), D6 (donut progress ring), B4 (gradient-glow hero).
   Justification: The palette and card language are durable and free of skeuomorph residue or fad
   gradients; the identifiable markers — letterspaced eyebrows, pastel tint chips, donut ring,
   radial-glow hero — cluster into essentially one of-its-moment SaaS-dashboard idiom rather than
   several independent dated choices.

**8. Good design is thorough down to the last detail — Score: 0/3**
   Evidence: B6 and E3 — focus falls back to the **browser default ring** for ~49 buttons, 3
   selects, and every radio, and is **entirely absent** in both radio groups
   (`opacity: 0` inputs with no `:has(input:focus-visible)` rule); `:focus-visible` appears 0
   times; `:active` appears 0 times; one empty state exists in the whole app; `aria-invalid`
   appears 0 times so no field is ever marked; all 9 modals lack focus trap, focus restore, and
   Escape.
   Justification: The 0 anchor's "or default-browser" clause is met outright on the focus state,
   and the primary keyboard flow — the appointment-time picker — is operable with no visible
   indicator at all.

**9. Good design is environmentally friendly — Score: 2/3**
   Evidence: D1 (73,755 B gzip initial JS, under the 100KB bar), D2 (swagger-ui correctly split,
   1.46 MB kept off the main route), D5 (0 idle animations; `prefers-reduced-motion` complete and
   genuinely so), B6 (`prefers-color-scheme` → 0 matches), D3 (1,517,095 B orphaned `og.png`
   deployed and never requested), D4 (253 KB raw parse cost dominates TTI; two serially chained
   round trips).
   Justification: Byte and motion discipline are real and measured — this is squarely the 2-level
   "<500KB, motion gated" — and the 0-level's dominant signals (>2MB, autoplay video) are absent;
   it misses 3 only because dark mode is ignored entirely.

**10. Good design is as little design as possible — Score: 0/3**
   Evidence: A3 (Overview and Appointments differ by 2 text nodes; no `Appointments` branch
   exists), A4 (staff Overview/Appointments/Forms byte-identical), A5 (Forms and Results are
   near-clone layouts), A6 (3 book-appointment triggers on one screen, 4 visit-summary triggers,
   2 sign-out controls, nav rendered twice, **9 hand-copied modal shells with no shared `Modal`
   component**), A7 (11 dead or conditionally-dead controls), A8 (8 `useState` atoms mirroring one
   server object; 9 modal booleans instead of one discriminant).
   Justification: The Overview is itself a duplicated index of the entire application and a whole
   navigation destination duplicates it — the 0 anchor's "dominated by duplicated affordances" is
   the plain description of the surface, not an exaggeration of it.

---

## Total: **8 / 30**

| # | Principle | Score |
|---|---|---|
| 1 | Innovative | 1 |
| 2 | Useful | 1 |
| 3 | Aesthetic | **0** |
| 4 | Understandable | 1 |
| 5 | Unobtrusive | 1 |
| 6 | **Honest** | **0** |
| 7 | Long-lasting | 2 |
| 8 | Thorough | **0** |
| 9 | Environmentally friendly | 2 |
| 10 | As little design as possible | **0** |
| | **Total** | **8/30** |

## Scoring note

These scores measure distance from Rams' standard for a shipped product. The artifact is a
QA-training demo, and several of its engineering choices are genuinely strong — the pure state
machine in `lib/demo-state.ts`, the correct code-splitting, the complete `prefers-reduced-motion`
handling, 21/21 labelled form controls, 9/9 correctly-labelled dialogs, zero click handlers on
non-interactive elements. The scorecard does not measure the demo's value as an automation target;
it measures the design. Both readings are in `03-verdict.md`.
