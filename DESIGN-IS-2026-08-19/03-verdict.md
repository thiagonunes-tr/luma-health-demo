# 03 — Verdict

## REDESIGN

**Luma Health's portal UI scores 8/30 and must be redesigned from purpose rather than refined,
because its navigation contains a destination that does not exist in code, its interface asserts
outcomes the data does not support, and three of Rams' load-bearing dimensions score zero.**

## Why redesign and not refine

The Phase 3 rule is met twice over: the total (8) is far below the 20 threshold, and **#6 honest
scored 0**, which is one of the three load-bearing principles (#2, #4, #6).

But the substantive reason is structural, not arithmetic. A refine pass fixes styling within an
existing structure. Here the structure is the defect:

- There is **no `activeNav === "Appointments"` branch in the codebase**
  (`shared/LumaApp.tsx:471-524`). A top-level navigation destination is not a destination; it is
  the Overview with two words changed at `:740`. For the staff role, **three of five destinations
  are byte-identical** because `StaffDashboard` is never passed `activeNav` at all.
- The Overview is itself a **duplicated index of the whole application** — its hero duplicates
  Appointments, its Quick actions duplicate the nav, its Recent activity duplicates Results and
  Messages. Restyling it cannot remove the duplication; only re-deciding what each screen is for can.
- The booking form **accepts Specialty and Provider and discards both** — cross-confirmed two ways:
  the handler reads only `form.get("time")` (`:307-319`), and the selects carry no `name` attribute
  so `FormData` omits them (E5). The interface then says "Your appointment is confirmed." No
  styling change repairs a form that lies about what it recorded.
- **Nine of the app's most important elements are fabricated** rather than derived — the progress
  ring, the staff metrics, the three activity rows, the notification dot. These are not visual
  defects; they are the absence of a data model behind the presentation layer.

Refining would mean restyling screens whose purpose has not been decided. The information
architecture has to be settled first.

## What the scorecard is not saying

The engineering underneath is in far better shape than the design on top, and the redesign must be
careful not to damage it. `lib/demo-state.ts` is a pure, well-tested state machine. `swagger-ui` is
correctly code-split, keeping 1.46 MB off the main route for a 73 KB gzip first paint.
`prefers-reduced-motion` is complete and genuinely correct. 21 of 21 form controls are labelled,
9 of 9 dialogs carry a resolving `aria-labelledby`, 13 of 13 icon buttons have accessible names,
and there is **not one `onClick` on a non-interactive element** in 998 lines. Those are the assets.

## The five highest-leverage moves

**1. (#10 as little design as possible / #2 useful) — Decide what each of the five destinations is
for, then make them differ.** Give Appointments real content — an appointment list with the
lifecycle states that already exist in `DemoState` — or delete it from the nav. Pass `activeNav` to
`StaffDashboard` and give the staff role destinations that are not the same screen three times.
Evidence: `shared/LumaApp.tsx:471-524` (no `Appointments` branch), `:740` (the only `activeNav`
reference), `:508-523` and `:797-811` (staff never receives the prop).

**2. (#6 honest) — Every rendered value must derive from state, or be deleted.** The progress ring
"75%" / "3 of 4 tasks completed" (`:774-775`), the staff metrics "12"/"13" with "4 waiting"
(`:832-834`), the three hardcoded activity rows (`:767-770`), the hardcoded red notification dot on
a handler-less bell (`:466`), and the badge that counts your own sent messages (`:443`). Make the
booking Specialty and Provider real fields on `DemoState` or remove the selects — they currently
lack a `name` attribute entirely. Stop rendering a completion check mark for a pending refill
(`:762` + `:857`). Evidence: C1a, C1e, C2, C4.3, E5.

**3. (#8 thorough / #4 understandable) — Build one `Modal` component and one focus system.** Nine
hand-copied modal shells (`:589, 871, 880, 889, 925, 929, 956, 976, 997`) share zero code and all
nine lack a focus trap, initial focus, focus restore, and Escape-to-close. Add a single
`:focus-visible` treatment for all interactive elements plus `:has(input:focus-visible)` for both
radio groups, where focus is currently **invisible** because the inputs are `opacity: 0`. Stop
`onMouseDown` backdrop dismissal from silently destroying typed input — including the password and
the word DELETE in `AccountModal`. Evidence: E3, A6 #8, C4.2.

**4. (#3 aesthetic) — Introduce a token layer: one type scale, one spacing scale, one gray.**
Replace 24 font sizes (contiguous integers 8→22px, 65% of declarations ≤12px, an 8px primary
mobile nav label) with roughly seven steps and raise the floor. Replace 54 spacing values — 36 off
any 4px grid, with zero spacing tokens — with a real scale. Collapse 12 near-whites, 14 mint tints,
and 8 near-identical grays. **Fixing `--muted` (`#718087`, 4.09:1 on white) alone clears 39 of the
59 AA contrast failures in one edit.** Evidence: B1, B2, B3, E1.

**5. (#2 useful / flow) — Bind the process to itself.** Gate intake on an active appointment — it
currently succeeds with no appointment at all (`lib/demo-state.ts:352, :361`). Move `check-in` to
the patient, where every reference portal puts it (`:232` vs `:211-220`). Add the confirmation step
the product's namesake company actually sells, and a staff no-show path. Each gate converts an
unconditional `200` into a `200`/`409` pair — which is the branching this demo exists to teach.
Evidence: `01b-flow-evidence.md` items 1-4.

## Scope guidance

Moves 2, 3, and 4 are mechanical and self-contained; move 4 in particular has an outsized
ratio of impact to effort. Move 1 requires an information-architecture decision before any code.
Move 5 changes API behavior and therefore the E2E suite, which is a **deploy gate**
(`.github/workflows/deploy.yml`) — `tests/e2e/full_demo.py` asserts on visible text and CSS classes
and must be updated in the same commit as any UI change.
