# 04 — Handoff Prompt

Copy the fenced block below into a new session. It is self-contained — the next session will not
see this audit.

````
/make-plan Redesign the Luma Health Demo patient and staff portal UI (`shared/LumaApp.tsx`,
`app/globals.css`). Current design failed a Dieter Rams audit at 8/30 with critical gaps in
principles #3 aesthetic (0), #6 honest (0), #8 thorough (0), #10 as little design as possible (0),
and #2 useful (1) / #4 understandable (1).

Verdict paragraph (quoted from the audit):
> Luma Health's portal UI scores 8/30 and must be redesigned from purpose rather than refined,
> because its navigation contains a destination that does not exist in code, its interface asserts
> outcomes the data does not support, and three of Rams' load-bearing dimensions score zero.

Why redesign and not refine: #6 honest scored 0, a load-bearing principle, and the total is far
below the threshold — but the substantive reason is that the structure IS the defect. There is no
`activeNav === "Appointments"` branch anywhere in the codebase (`shared/LumaApp.tsx:471-524`); the
Overview is itself a duplicated index of the whole application; and nine of the most prominent
values on screen are fabricated rather than derived from state. Restyling cannot fix screens whose
purpose has not been decided.

Context you need:
- Two users. Nominal: a patient getting care. Actual: a QA engineer learning test automation. They
  mostly align, but the QA user benefits from MORE distinct, gated states, and the current design
  has fewer, ungated ones.
- `shared/LumaApp.tsx` compiles into TWO deployment targets (Cloudflare Worker via vinext, and
  Vercel via Vite), so it cannot take framework-specific dependencies.
- `tests/e2e/full_demo.py` is a DEPLOY GATE (`.github/workflows/deploy.yml`). It asserts on visible
  text and CSS class names. Any UI change must update it in the same commit.
- Fictional clinical content is REQUIRED, not a defect.

PRESERVE (already strong — do not damage these):
- `lib/demo-state.ts` — a pure, well-tested state machine (`transitionDemoState` at :203) with 18
  passing unit tests. Extend it; do not rewrite it.
- The code-splitting of `swagger-ui-react` via dynamic `import()` in `shared/ApiDocs.tsx:29-46`,
  which keeps 1.46 MB off the main route for a 73 KB gzip first paint.
- `app/globals.css:364` — the `prefers-reduced-motion` reset. It is complete and correct.
- All 21 of 21 labelled form controls (20 implicit wrapping `<label>`, 1 explicit `htmlFor` at
  `shared/LumaApp.tsx:993`), and the two `<fieldset>`/`<legend>` radio groups at `:662` and `:871`.
- All 9 dialogs' `role="dialog"` + `aria-modal="true"` + resolving `aria-labelledby`.
- All 13 icon-only buttons' `aria-label`, and `shared/Icon.tsx:110-113` (`aria-hidden` +
  `focusable="false"` on every svg).
- Zero `onClick` on non-interactive elements and zero `tabIndex` attributes across 998 lines.
- The teal/mint palette and card language (`--teal #117b72`, `--mint #dff2ed`) — durable, keep it.

DISCARD (these patterns caused the failures):
- The fall-through router at `shared/LumaApp.tsx:471-524`. Caused failure on #10 and #2: no
  `Appointments` branch exists, so Overview and Appointments differ by 2 text nodes at `:740`, and
  `StaffDashboard` (`:508-523`, type at `:797-811`) never receives `activeNav` so THREE of five
  staff destinations render byte-identically.
- The Overview's role as an index of everything else — hero duplicates Appointments, Quick actions
  duplicate the nav, Recent activity duplicates Results and Messages (`:744-778`). Caused failure
  on #10.
- All nine hand-copied modal shells (`:589, 871, 880, 889, 925, 929, 956, 976, 997`) — zero shared
  code, and all nine lack focus trap, initial focus, focus restore, and Escape. Caused failure on #8.
- Every hardcoded value presented as computed: progress ring `:774-775`, staff metrics `:832-834`,
  activity rows `:767-770`, notification dot `:466`. Caused failure on #6.
- The 11 dead / conditionally-dead controls (`:465, :466, :767, :769, :838, :839, :846, :847`).
  Caused failure on #2 and #10.
- The untokenised style layer: 24 font sizes, 54 spacing values, 141 colors against 11 tokens.
  Caused failure on #3.
- The 8 `useState` atoms mirroring the 8 fields of `DemoState` (`:103-118`) plus the hand-written
  8-line resync at `:258-267`, and the 9 separate modal booleans (`:97-102`, `:812-814`).

Top 5 moves from the audit (verbatim):
1. (#10 / #2) Decide what each of the five destinations is for, then make them differ. Give
   Appointments real content — an appointment list with the lifecycle states that already exist in
   `DemoState` — or delete it from the nav. Pass `activeNav` to `StaffDashboard` and give the staff
   role destinations that are not the same screen three times. Evidence:
   `shared/LumaApp.tsx:471-524`, `:740`, `:508-523`, `:797-811`.
2. (#6) Every rendered value must derive from state, or be deleted. Progress ring `:774-775`; staff
   metrics `:832-834`; activity rows `:767-770`; the hardcoded red dot on a handler-less bell
   `:466`; the badge at `:443` that counts your own sent messages. Make booking's Specialty and
   Provider real fields on `DemoState` or remove the selects — they currently lack a `name`
   attribute entirely, so `FormData` omits them while the handler at `:307-319` reads only
   `form.get("time")` and the UI still says "Your appointment is confirmed." Stop rendering a
   completion check mark for a pending refill (`:762` + `:857`).
3. (#8 / #4) Build one `Modal` component and one focus system. Add a single `:focus-visible`
   treatment for all interactive elements plus `:has(input:focus-visible)` for both radio groups,
   where focus is currently INVISIBLE because the inputs are `opacity: 0`
   (`app/globals.css:41, :122`) — `:focus-visible` appears 0 times in the file today and ~49
   buttons fall back to the browser default. Stop `onMouseDown` backdrop dismissal from silently
   destroying typed input, including the password and the word DELETE in `AccountModal`.
4. (#3) Introduce a token layer: one type scale, one spacing scale, one gray. Replace 24 font sizes
   (contiguous integers 8→22px, 65% of declarations ≤12px, an 8px primary mobile-nav label at
   `app/globals.css:361`) with roughly seven steps and raise the floor. Replace 54 spacing values —
   36 off any 4px grid, zero spacing tokens — with a real scale. Collapse 12 near-whites, 14 mint
   tints, and 8 near-identical grays. Fixing `--muted` (`#718087`, `app/globals.css:3`, 4.09:1 on
   white) alone clears 39 of the 59 AA contrast failures in one edit.
5. (#2 / flow) Bind the process to itself. Gate intake on an active appointment — it currently
   succeeds with no appointment at all (`lib/demo-state.ts:352, :361`). Move `check-in` to the
   patient, where every reference portal puts it (`:232` vs `:211-220`). Add a confirmation step and
   a staff no-show path. Each gate converts an unconditional `200` into a `200`/`409` pair — which
   is the branching this demo exists to teach.

Redesign principles in priority order:
1. #6 honest — every number, badge, and status on screen traces to a field in `DemoState`. If it
   cannot, it is deleted. Success: a reader can point at any value and name the state that produced it.
2. #2 useful — five nav destinations, five distinct purposes, zero decoy controls. Success: every
   focusable element does something, and no two adjacent tab stops fire the same action.
3. #10 as little design as possible — one `Modal`, one `Card`, one token set, no affordance
   appearing three times on one screen. Success: removing any element breaks a task.
4. #8 thorough — empty / loading / error / success / focus / disabled all designed, including
   field-level errors (`aria-invalid` appears 0 times today) and a visible focus ring everywhere.
5. #4 understandable — plain patient language, no EHR shorthand. Success: a first-time patient names
   every primary control correctly ("Intake form", "Overview", "Results", "Review form", "Open
   summary", and "Demo thread" all currently fail this).

Also fix while in here (small, unambiguous, independent of the IA decision):
- `dist/og.png` is 1,517,095 bytes, deployed and never requested — `vercel-frontend/index.html` has
  no `og:image` meta at all. Either wire it up or stop shipping it.
- The exported CSV (`shared/LumaApp.tsx:932-953`, filename `maria-lopez-visit-summary.csv`) carries
  no fictional-data marker, so the on-screen disclaimer does not travel with the file.
- `app/globals.css:361` sets `.date-note { display: none }` at ≤680px, removing the ONLY demo
  disclosure from the patient Overview on mobile while it still shows a lab result, a visit summary,
  and a medication.
- The MFA email (`lib/auth.ts:215-216`, `:296-316`) has no demo marker in sender, subject, or body.
- Every patient sees Maria Lopez's name, blood counts, and medication as their own portal content
  (`:773`, `:906`, `:929`, `:956`, `:993`), even though `:126-133` derives their real name.
- `.sidebar-user` (`:452`): the whole row signs you out with no confirmation, while only the small
  teal "Sign out" text looks clickable — and `.top-user` (`:467`) renders the identical avatar +
  name pattern but opens Account settings instead.
- "Cancel appointment" (`:871`) sits directly beneath "Save new time" in the same dialog, where
  "Cancel…" reads as "dismiss this dialog" but destroys the appointment immediately (`:321-328`).
- Add `eslint-plugin-jsx-a11y` to `eslint.config.mjs` and axe to `tests/e2e/full_demo.py` — no
  automated a11y check exists today, so nothing in CI would catch any of the above.

Out of scope for this redesign: the API contract and route handlers except where move 5 requires
new transitions; the deployment topology; the security model (documented separately in
`docs/DEVELOPER_HANDOFF.md` §12); native mobile (explicitly out of scope per
`docs/REQUIREMENTS_TRACEABILITY.md`).

Deliverables for the plan:
- New information architecture for the five destinations, per role — NOT derived from the current
  fall-through router.
- New primary flow (low-fi, labeled), compared side-by-side to the current one.
- Token decisions: type scale steps with a minimum size, spacing scale, and a color count cap.
- States checklist per component: empty, loading, error (form AND field), success, focus, disabled.
- A `DemoState` extension table: which new fields back which previously-fabricated values.
- Updated `tests/e2e/full_demo.py` selectors and assertions, in the same commit as the UI change.
- Migration path: this is a shared demo environment with a 24-hour reset and persistent registered
  users — state that survives the redesign, and cutover criteria.

Anti-patterns to guard against:
- Porting the old structure under new styling — the fall-through router must not survive.
- Keeping both designs behind a flag indefinitely.
- Redesigning to follow a trend rather than the principles above.
- Treating the PRESERVE list as optional — `lib/demo-state.ts`, the code-splitting, the
  `prefers-reduced-motion` reset, and the labelling/dialog/icon-name work are already correct and
  must still be correct afterward.
- Adding a component library that breaks the dual-target build (Worker + Vercel).
````
