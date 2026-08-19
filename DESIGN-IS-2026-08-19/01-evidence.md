# 01 — Evidence

Consolidated from parallel evidence subagents. Every finding carries a source citation.
Subagents did not score; scoring is in `02-scorecard.md`.

Flow/journey evidence is in the companion file `01b-flow-evidence.md` (gathered by the
orchestrator — the `design-is` subagent roster has no journey dimension).

---

## A. Structural Evidence

### A1. Interactive-element count — patient portal

**62 focusable controls** (47 `<button>`, 9 `<input>`, 3 `<select>`, 3 `<textarea>`).
**Zero `<a>` elements exist in the entire file** — the only `href` is a programmatic download
anchor at `shared/LumaApp.tsx:947`. Navigation, actions, and external links are all buttons.

Simultaneously visible on Overview with no modal open: **25 controls** (15 chrome + 10 dashboard).

### A2. Nesting depth

- DOM depth excluding `Icon` internals: **8**
- DOM depth including `Icon` internals: **10**
- JSX depth including component boundaries: **13**
  (`main` → `section.workspace` → `PatientDashboard` :492 → `div.page-content` :738 →
  `section.content-grid` :765 → `div.panel.activity-panel` :766 → `Activity` :768 →
  `div.activity-row` :861 → `span.activity-icon` → `Icon` → `svg` → `g` → `path`)

### A3. Overview ≡ Appointments — CONFIRMED

Routing chain, `shared/LumaApp.tsx:471-524`, verbatim:

```
471:  {activeNav === "Messages" ? (
478:  ) : activeNav === "Results" ? (
484:  ) : role === "patient" && activeNav === "Forms" ? (
491:  ) : role === "patient" ? (
508:  ) : (
```

**There is no `activeNav === "Appointments"` branch anywhere in the file.** The string
`"Appointments"` appears only as a `navItems` entry (`:62`). Both Overview and Appointments
fall through the catch-all at `:491` and render `PatientDashboard` (`:492-507`) with
byte-identical props.

Inside `PatientDashboard` (`:715-781`) the `activeNav` prop is referenced at **exactly one
line, 740, twice**:

```jsx
740: <div><p className="eyebrow">PATIENT PORTAL</p><h1>{activeNav === "Overview" ? `Hello, ${patientName}.` : activeNav}</h1><p className="subtitle">{activeNav === "Overview" ? "Here is a summary of your care today." : "Keep track of your health information in one place."}</p></div>
```

**Total difference between the two destinations: 2 text nodes.** Identical: the eyebrow, the
Book/Manage primary button (`:741`), the entire hero card (`:744-756`), the "Quick actions"
heading and all 3 QuickCards (`:758-763`), the whole content-grid with 3 activity rows and
the care panel (`:765-778`), and the date note (`:779`). Same 10 controls.

### A4. Staff role is worse — 3 of 5 destinations are byte-identical

`StaffDashboard` (`:509-523`) is **never passed `activeNav`** (the prop is absent from its
type at `:797-811`). Because the Forms branch at `:484` is gated on `role === "patient"`, a
staff user selecting **Overview, Appointments, or Forms** all fall to the `:508` else-branch
and render `StaffDashboard` with *zero* variation — not even a heading change; `<h1>` is
hardcoded `Good morning, {staffName}.` at `:830`. Only Results and Messages differ.

### A5. Forms and Results are near-clones of each other

`PatientForms` (`:892-899`) and `ClinicalDocuments` (`:901-907`) share the same shell:
`page-content` → `welcome-row` → `eyebrow` → `document-grid` → 2× `article.panel.document-card`
(`activity-icon` + `eyebrow` + `h2` + `p` + `secondary-button`) → `date-note`. Two components,
one layout. `ClinicalDocuments` swaps a single eyebrow string at `:906`.

### A6. Duplicated affordances

| # | Pattern | Count | Lines |
|---|---|---|---|
| 1 | Nav rendered twice from one `navItems` array, same handler | 2 × 5 | 62; 435-445; 527-529 |
| 2 | Book/manage-appointment trigger → same `onBook` | **3 on one screen** | 741, 753, 760 |
| 3 | Open-intake trigger → `onOpenIntake` | 3 (2 on Overview) | 761, 776, 898 |
| 4 | Open-visit-summary trigger | 4 | 769, 880, 889, 906 |
| 5 | View-lab-result trigger | 2 | 768, 906 |
| 6 | Sign-out control | 2 | 452, 589 |
| 7 | Search affordance — one dead, one live | 2 | 465 (no handler), 830 |
| 8 | Hand-copied modal shell — **no shared `Modal` component** | **9** | 589, 871, 880, 889, 925, 929, 956, 976, 997 |
| 9 | `dl.review-details` key/value block | 6 | 589, 871, 880, 889, 956, 997 |
| 10 | `p.eyebrow` micro-label | 22 | file-wide |
| 11 | `button.primary-button.full` | 8 | file-wide |
| 12 | `span.patient-avatar` | 9 | file-wide |
| 13 | `<Icon name="arrow-right">` trailing chevron | 9 | file-wide |
| 14 | `brand-mark` markup | 4 | 425, 462, 545, 640 |
| 15 | Duplicated business predicate `["none","cancelled","completed"].includes(...)` as both `canBookAppointment` and `canBook` | 2 | 734-736, 870 |

### A7. Dead and non-functional affordances

**6 buttons with no `onClick` and no `type="submit"` — they look interactive and do nothing:**

| Line | Control | Surface |
|---|---|---|
| 465 | `icon-button` `aria-label="Search"` | patient chrome |
| 466 | `icon-button notification` `aria-label="Notifications"` | patient chrome |
| 767 | `View all` | patient Overview, Recent activity |
| 838 | `View schedule` | staff |
| 846 | `.text-action` "Review form" — Alex Carter | staff |
| 847 | `.text-action` "Open request" — Priya Shah | staff |

**5 more conditionally dead:**
- `:769` — when `refillStatus === "approved"`, the visible "Open" button becomes inert with
  identical styling (`onClick={refillStatus === "approved" ? undefined : onOpenSummary}`).
- `:839` — only 1 of 4-5 staff schedule rows has a working chevron; the other 4 render a
  styled arrow button with `undefined` handler while their `aria-label` promises
  "Open {patient}'s record".

**Other dead code:** `Icon`'s `className` prop (declared `Icon.tsx:26`, consumed `:111`,
**never passed by any call site**); the `"arrow-up-right"` icon (`Icon.tsx:5`, `:44-47`, zero
references); `appointmentBooked` never rendered on the patient surface (`:103`, read only at
`:832`); `demoBusy` stores the specific action at `:281` but all six consumers collapse it to
`demoBusy !== null` (`:475, :500, :518, :533-535`), so **one action disables every button**;
`--white` token declared (`globals.css:6`) with 0 usages while the bare keyword `white`
appears 39 times.

### A8. State-shape duplication

**36 `useState` declarations**; 22 in `Home` alone.

**All 8 fields of `DemoState` (`lib/demo-state.ts:35-44`) are mirrored as 8 separate
`useState` atoms** in `Home` (`LumaApp.tsx:103-118`), re-synced field-by-field by a
hand-written 8-line setter `applyDemoState` (`:258-267`) called from `:158` and `:292`.
**Eight state setters fire per server round-trip where one would do.** The `insurance`
initial value (`:113-118`) is a verbatim duplicate of `DEFAULT_INSURANCE`
(`lib/demo-state.ts:96-99`) — the same four literals maintained in two files.

Additionally **9 independent modal booleans** instead of one `activeModal` discriminant:
6 in `Home` (`:97-102`) + 3 in `StaffDashboard` (`:812-814`).

### A9. Token discipline

12 tokens declared in `:root` (`globals.css:1-13`) against **111 unique hex literals** in the
file. Only **3 `:focus` rules** (`globals.css:40, :124, :125`), all scoped to text
inputs/textareas — **zero `:focus-visible`, and no focus style for any of the 47 buttons**,
though `cursor: pointer` appears 24 times.

### A10. Structural known gaps

- `/api-docs` surface not inspected; its 13 classes in `globals.css:22-29` were treated as
  in-use rather than orphaned.
- Overview ≡ Appointments was confirmed by static trace of `activeNav` (single reference at
  `:740`), not by DOM diff — no browser was run. The static evidence is unambiguous: no
  `"Appointments"` branch exists.
- `globals.css` packs multiple rules per physical line (line 361 is 2,600 chars; 161 `{`
  blocks in 364 lines), so CSS line citations may point at a line holding 5-10 selectors.

---

## B. Visual Evidence

`grep -c "style=" shared/LumaApp.tsx` → **0**. Zero inline styles, no CSS-in-JS. The entire
visual surface is `app/globals.css` (364 content lines, written 10-40 selectors per physical
line, so a citation may point at a line holding many rules).

### B1. Type scale — there is no scale

**157 px `font-size` declarations, 24 distinct values.**

| ≤ threshold | count | share |
|---|---|---|
| ≤12px | **102** | **65.0%** |
| ≤11px | 67 | 42.7% |
| ≤10px | 38 | 24.2% |
| ≤9px | 6 | 3.8% |

At the **base** breakpoint (`globals.css:1-130`) it is worse: **90 of 117 (76.9%) are ≤12px**
and 37 (31.6%) are ≤10px. The `min-width:1000px` query bumps 32 declarations upward — meaning
**small type is the default and larger type is the wide-desktop exception.** Every viewport
below 1000px renders the small scale.

Sizes 8→22px are **contiguous integers with no gaps** — 15 consecutive values all in use, a
~1.05 step ratio that is below the just-noticeable difference for text size. Above 22px the
scale is sparse and irregular (22→24→25→26→29→30→33→36→38→42→48→63). No typographic ratio
(1.125 / 1.2 / 1.25 / 1.333 / 1.5) fits any run. **Zero font-size custom properties** — all
157 are literals.

The extremes:

| Size | Selector | Citation |
|---|---|---|
| **8px** | `.mobile-nav button` — the labels on the **primary navigation** at ≤680px | `globals.css:361` |
| 9px | `.message-bubble > span` (sender), `.message-bubble time` (timestamp), `.message-composer small` (the `0/500` counter), `.review-status`, `.doctor-avatar` | `globals.css:100, 122, 125` |
| 10px | 32 selectors including **all form labels** (`.modal label, .modal legend`), all definition-list keys (`.review-details dt`), and all helper text (`.form-hint`) | `globals.css:42-127` |

None of the five 9px rules is overridden at any breakpoint. Of the 32 10px rules, only 6 get
any upward override; **24 render at 10px at every viewport width.**

### B2. Spacing — 54 distinct values, two-thirds off-grid

**304 px spacing tokens, 54 distinct values.** Every integer from 2 to 32 is present except 33.
Only 18 of 54 are multiples of 4; **36 of 54 are off any 4px grid** (and it is not an 8px grid
either). Adjacent-value collisions where one token would do: 10/11/12/13 (68 uses),
14-19 (49 uses), 20-24 (44 uses), 26-32 (21 uses). Thirteen values are used exactly once.
**`:root` declares no spacing token at all** — all 304 values are hardcoded.

Sidebar width is duplicated as a literal in two places at three breakpoints
(`globals.css:47, 71, 133, 140, 355`).

### B3. Color — 141 distinct values against 11 tokens

No `oklch`/`lab`/`hsl`/`color-mix`. **111 distinct hex + 27 distinct `rgba()` + 3 keywords = 141.**
`:root` (`globals.css:1-13`) declares 11 tokens covering **10** hex values; **131 of 141 sit
outside the token layer**, hardcoded per rule. 89 hex values are used exactly once.

Near-duplicate clusters — values within perceptual noise of each other:

| Cluster | Distinct values |
|---|---|
| Near-white surfaces | **12** (`#fff`, `#fbfdfc`, `#f7faf9`, `#f5faf8`, `#f5fbf9`, `#f4f8f7`, `#f2faf7`, `#f5f8f7`, `#f5f7f7`, `#f1f5f4`, `#f0f5f3`, `#fff8f6`) |
| Gray text | **8** (`#718087`, `#8c999d`, `#8b999d`, `#899598`, `#89979a`, `#7f8e92`, `#66787f`, `#65757a`) |
| Pale mint tints | **14** |
| Border grays | **9** |
| Dark greens | **6** |

`--teal` `#117b72` is re-expressed as literal RGB channels at 6 different alphas
(`rgba(17,123,114,.08/.1/.12/.18/.22)`) because the token cannot carry an alpha variant.
`--white` is declared (`globals.css:6`) and **never referenced**; the keyword `white` is used
39 times.

### B4. Contrast — `--muted` fails everywhere it is used

Method: WCAG 2.1 relative luminance, ratios computed against the resolved ancestor background.

**38 distinct failing combinations.** The floor is 4.5:1 for every failing item, because none
reaches the large-text allowance (all are ≤13px).

| Ratio | Foreground / background | Size | Selector | Citation |
|---|---|---|---|---|
| **2.72:1** | `#fff` on `#e88069` | 10px | `.nav-badge` — the unread count | `globals.css:62` |
| **2.87:1** | `#89979a` on `#f7faf9` | **9px** | `.message-bubble time` — message timestamps | `globals.css:125` |
| **2.88:1** | `#8b999d` on `#fbfdfc` | 11px | `.nav-label` — sidebar section headers | `globals.css:57` |
| **2.93:1** | `#8c999d` on `#fff` | 10px | `.activity-row time`, `.date-note` | `globals.css:114, 116` |
| **3.08:1** | `#899598` on `#fff` | **8px** | `.mobile-nav button` — mobile nav labels | `globals.css:361` |
| **3.39:1** | `#7f8e92` on `#fff` | 10px | `.privacy-copy` — legal/consent text | `globals.css:43` |

**The dominant finding:** `--muted` (`#718087`, `globals.css:3`) is the app's secondary-text
token, and it **fails 4.5:1 on every background it is used against** — best case 4.09:1 on pure
white (9% short), worst case 3.75:1 on `#eef7f5` (17% short). All ~40 of its uses are
normal-weight text at 9-13px, so 4.5:1 applies in every case. One token value is the largest
contrast liability in the codebase.

Passing, for the record: `.eyebrow` `#117b72` = 4.78:1 on canvas / 5.12:1 on white.

*INFERRED:* three surfaces use `linear-gradient` + additive `radial-gradient`
(`globals.css:23, 33, 95`). Light text on the hero card passes at the dark end (`#0a5755`:
5.23-5.75:1) and **fails at the light end** (`#136f68`: 3.74-4.12:1); which end a glyph lands
on depends on runtime geometry. The radial overlay's additive lift is not modelled, so
gradient ratios reported are best-case. `.status-pill` sits on `rgba(255,255,255,.13)` over the
gradient — its true ratio is below the 6.00:1 computed without that layer.

### B5. Touch targets — 22 of 31 interactive rules are under 44×44px

| Declared | Selector | Citation |
|---|---|---|
| **31×31** | `.modal-close` — every modal's close button | `globals.css:122` |
| **35×35** | `.icon-button` — topbar search/notifications | `globals.css:76` |
| **22px wide** | `.toast button` — dismiss (grid column `22px`) | `globals.css:128` |
| **25px wide** | `.schedule-row > button` (22px at ≤680px) | `globals.css:119, 361` |
| **34px** | `.request-actions button` — Approve / Decline | `globals.css:120` |
| **40px** | `.account-tabs button`, `.time-options label` — the appointment time picker | `globals.css:39, 122` |
| **43px** | `.account-role-picker label`, `.skip-mfa-button`, `.danger-button`, `.modal select` — four targets one pixel under the floor | `globals.css:41, 43, 92, 122` |
| **43×45** | `.welcome-row .primary-button` at ≤680px — `font-size: 0`, icon-only, fails on width | `globals.css:361` |
| **~12-13px tall** *(INFERRED)* | Six `padding: 0` text buttons relying on the line box alone: `.auth-back`, `.resend-copy button`, `.privacy-copy button`, `.appointment-time button`, `.panel-heading button` / `.text-action`, `.activity-row button` | `globals.css:43, 103, 113, 114` |

`.icon-button` (35×35) and `.modal-close` (31×31) are **never resized at any breakpoint**,
including the ≤680px touch breakpoint. There is **no `pointer: coarse` / `hover: none` query
anywhere** — all 5 media queries are width-only, so touch input never gets larger targets.
Gaps between adjacent undersized targets are also under-spec (8px, 7px, 5px), so the effective
44px virtual target cannot be recovered from surrounding whitespace.

Meeting the floor: `.nav-item` (45px), `.primary-button`/`.secondary-button` (min 45px),
`.auth-form input` / `.auth-submit` (49px), `.code-input` (59px), `.quick-card` (min 128px),
`.patient-results > button` (min 61px), `.mobile-nav button` (min 64px tall).

### B6. States checklist

| State | Verdict | Evidence |
|---|---|---|
| Empty | **Partial — 1 instance in the whole app** | Only `.patient-results > p` "No patients found." (`globals.css:123`, `LumaApp.tsx:889`). **Missing** for the message thread (`:993` maps unguarded), activity feed, staff schedule, request queue, and document grid. |
| Loading | **Partial — text-swap only** | `.auth-loading` with `role="status"` (`globals.css:44`, `LumaApp.tsx:408, 544`); button labels swap to "Sending code…" / "Verifying…" / "Saving…". **No skeleton or spinner exists** — `grep -c "skeleton\|spinner"` → 0. |
| Error | **Partial — form-level only** | `.auth-error` with `role="alert"` (`globals.css:42`, `LumaApp.tsx:669, 699`), `.toast.error` (`globals.css:128`). But `grep -c "aria-invalid"` → **0**; there is no `[aria-invalid]`, `:invalid`, or `.error` input rule, so **a failed field is never visually marked** — only the form banner appears. |
| Success | **Present** | `.toast` + `role="status"` (`globals.css:128`, `LumaApp.tsx:539`), `.review-status`, `.queue-status`, quick-card `done` icon swap. |
| **Focus** | **Effectively missing** | `grep -c "focus-visible"` → **0**. Only **3** `:focus` rules exist, all on text inputs (`globals.css:40, 124, 125`). **Zero focus rules for buttons, selects, or radio-card labels** — 47 buttons with none. `outline` is suppressed 4×; the one at `globals.css:123` (`.patient-search-input input`) is **uncompensated** — no `:focus`, no `:focus-within` — so focusing patient search produces no indicator at all. Both radio groups (`.account-role-picker`, `.time-options`) hide the real input and style a proxy keyed on `:checked`, never on focus, so **keyboard focus inside them is invisible**. No `:focus-within` anywhere. |
| Disabled | **Present, opacity-only** | 5 rules (`globals.css:40, 43, 93, 109, 120`), all `opacity: .55-.72`, which **further degrades already-failing contrast**. `grep -c "\[disabled\]"` → 0, so `.modal-close` — which is `disabled={busy}` at `LumaApp.tsx:589, 871, 925, 976` — has no disabled styling. `cursor` is inconsistent: `wait` on 3, `not-allowed` on 2. |
| Active/pressed | **Missing** | `:active` → **0 occurrences**. No pressed state on any control. |
| `prefers-reduced-motion` | **Present and complete** | `globals.css:364` — universal reset covering all 4 transitions and the one `@keyframes toast-in`. |
| Dark mode | **Missing** | `prefers-color-scheme` → **0**. No `[data-theme]`, no `color-scheme` property. `html`/`body` hardcode `--canvas` (`globals.css:16-17`); with 101 hex values hardcoded per rule, no dark theme is reachable without editing every rule. |
| `forced-colors` / `prefers-contrast` | **Missing** | Neither appears. Combined with B4, there is no high-contrast escape hatch. |

### B7. Visual known gaps

- No running server: all values are literal declarations. Line-box heights for the six
  zero-padding buttons assume the UA default `line-height: normal` (≈1.15 for Arial) and are
  marked INFERRED. `body` declares no global `line-height` (`globals.css:17`); 24 scattered
  values exist (1.04 … 1.65).
- Gradient and alpha compositing not fully modelled (see B4) — those ratios are best-case.
- The Swagger UI subtree is only partially characterised; most of its type/color/target values
  come from the vendor stylesheet loaded at runtime.
- Icon glyph sizes come from JSX `size={…}` props, not CSS; `shared/Icon.tsx` stroke widths and
  glyph-level contrast were not audited.
- Not measured: z-index scale (7 values), border-radius scale (~25 distinct), box-shadow
  inventory (13 distinct, 1 tokenised), and RTL/logical-property coverage (the file mixes
  physical `left`/`right` with logical `padding-inline`).

## C. Copy & Honesty Evidence

The full string inventory (several hundred strings across 18 contexts) was collected; only the
findings are reproduced here.

**Not present, verified by search:** no pricing, subscription, trial, renewal, or payment string
exists anywhere — forced continuity and hidden cost are absent. No countdown or "only N left" —
fake scarcity absent. Every negative path is neutrally labeled ("Close", "Done", "Decline",
"Back to sign in") — confirmshaming absent.

### C1. Label→behavior mismatches

**C1a. The booking modal's Specialty and Provider selects are silently discarded.**
`LumaApp.tsx:871` offers Specialty (Primary Care / **Cardiology** / **Dermatology**) and
Provider (Dr. Ana Costa / **Dr. John Lima**). The handler `bookAppointment` (`:307-319`) reads
**only** `form.get("time")`. `DemoState` has no specialty or provider field
(`lib/demo-state.ts:35-44`) and the transition persists only `appointmentTime` (`:267-275`).
After booking "Cardiology / Dr. John Lima" the toast says "Appointment booked / Your appointment
is confirmed…" (`:314-315`) while the hero still reads "Dr. Ana Costa · Primary Care · Room 204"
(`:749`) and the staff review modal still reads "Primary Care · Follow-up" (`:880`). **Two of
three inputs are decorative and the confirmation copy does not admit it.**

**C1b. Every patient sees a different named patient's clinical record as their own.**
`:126-133` derives `displayName` from the real session, so a newly registered account is greeted
"Hello, {their own name}." at `:740` — and is then shown, as its own portal content:
"Keep it up, **Maria**!" (`:773`), "Review deterministic clinical documents for **Maria Lopez**"
(`:906`), a conversation "between **Maria Lopez** and the care team" (`:993`), and Maria's CBC
and medication (`:929`, `:956`). Every clinical string is hardcoded to one person; the router
(`:478-483`, `:491-507`) serves them to any session.

**C1c. `Sign out` looks like a link; the whole row is the button — and the identical pattern
elsewhere does something else.** `:455` renders `<span className="sign-out">Sign out</span>`
inside `:452` `<button className="sidebar-user" onClick={signOut}>`, which also wraps the avatar
and the name/role block. `globals.css:67` gives `.sidebar-user` `border: 0; background:
transparent` — no button affordance at all — while `globals.css:69` styles `.sign-out` in teal
bold, identical to the genuine text links at `globals.css:43`. **The only element that looks
clickable is the small text; the hit area is the entire footer row, and it signs you out with no
confirmation.** `tests/e2e/full_demo.py:51-53` signs out by clicking `.sidebar-user`, so the test
depends on the mismatch. Compounding it: `:467` `.top-user` renders the *same* avatar + bold name
+ small subtitle pattern in the top bar and opens **Account settings** instead.

**C1d. Nine controls whose labels promise an action that never fires.** Beyond the six dead
buttons in A7: `:839` `aria-label="Open {patient}'s record"` promises a record for all four static
patients but only the portal-booked row responds; `:769` keeps an "Open" button after its label
changes to "Refill approved", where it does nothing; `:865` `Metric` renders "Review requests →"
inside a non-interactive `<div>`; `:448-451` "Need help? / Contact our team" is a `<div>`, not a
control, **and no contact method is given anywhere in the app**.

**C1e. Messages badge counts your own sent messages.** `:443` renders `{messages.length}` in
unread-badge position and styling; `lib/demo-state.ts:384-398` appends the sender's own message
to the same array, so sending increments your own badge. It starts at 2 with nothing unread.

**C1f. Staff metric decrements when a visit happens.** `:832` renders
`appointmentBooked ? "13" : "12"` for "Appointments today"; `lib/demo-state.ts:348` sets
`appointmentBooked: false` on `complete-appointment`. Completing today's visit rolls the count
back 13→12 while the row stays visible with status "Completed".

**C1g. "Send a new code" gives no success feedback and hides its limits.** `:702` → `:417` →
`startLogin` (`:172-207`) replaces `challenge` state with no toast — the screen looks unchanged.
The 60-second cooldown (`lib/mfa-policy.ts:2`) and 5-per-hour cap (`:3`) are never disclosed in
the UI; the user discovers them only through the error at `login/route.ts:107-126`.

**C1h. Four labels, one destination.** Nav "Forms" → card "Intake form" → button "Complete
form"/"Review answers" (`:898`); Overview quick card "Intake form" → "Complete form"/"Review or
update" (`:761`); care panel "Continue task"/"Review answers" (`:776`). All three open the same
`IntakeFormModal` (`:534`), two of them without naming the destination.

### C2. Fabricated values presented as computed

| String | Location | Backing |
|---|---|---|
| "75%" | `:774` | Hardcoded string, no state input |
| "3 of 4 tasks completed" | `:775` | Hardcoded; renders identically when nothing is completed |
| "Your care is on track" / "Keep it up, Maria!" | `:773` | Independent of `intakeComplete` / `appointmentStatus`, both in scope at `:719-721` |
| "Complete your form before your next appointment." | `:775` | Shown even when `intakeComplete === true` and when `appointmentStatus === "none"` |
| "12"/"13" appointments, "4 waiting" | `:832` | Only 4-5 rows exist; exactly one has status "Waiting" |
| "2"/"3" pending refills | `:833` | Base 2 fabricated; only 1 refill card can exist |
| "5"/"6" forms, "2 new today" | `:834` | Base 5 and "2 new" unbacked |
| "Ongoing medication · Last refill 30 days ago." | `:843` | Fabricated history, no data source |
| "Takes about 3 minutes" | `:761` | No basis for a 4-field form |

### C3. Inflation contradicted by the code

`:644` claims "an email verification code protecting **every** account" and `:646` repeats it —
but `:671-673` places "Sign in without two-factor authentication" as a second submit in the same
form, with no warning copy and no "demo only" qualifier in the label. The API *does* gate it to
demo accounts (`login/route.ts:69-75`); **the UI never says so.**

### C4. Dark patterns present

1. **Destructive action where "Cancel" is ambiguous.** `:871` renders
   `<button className="danger-button full" onClick={onCancel}>Cancel appointment</button>`
   directly beneath a "Save new time" submit. In a modal, "Cancel …" reads as "dismiss this
   dialog"; the handler (`:321-328`) destroys the appointment immediately, no confirmation.
2. **Every modal discards typed input on an outside click, silently.** `onMouseDown={onClose}`
   on the backdrop at all 9 modals — including `IntakeFormModal` (4 fields), `InsuranceModal`
   (3 fields), and `AccountModal`, where the user has typed a **password and the word DELETE**.
3. **A pending request is rendered with a completion check mark.** `:762` passes
   `done={refillStatus === "pending" || refillStatus === "approved"}`; `:857` renders
   `Icon name={done ? "check" : icon}`. A refill merely awaiting review shows the same success
   glyph as an approved one, and the card is disabled.
4. **Clicking your own name and avatar signs you out** (C1c) — irreversible, unconfirmed.

### C5. Jargon not self-explanatory to a first-time patient

Of the labels specifically checked, **all six fail**: "Intake form", "Overview", "Results",
"Review form", "Open summary", and "Demo thread" — five are EHR-industry shorthand and one is
build-time vocabulary leaking into the product. ~40 further items were catalogued with proposed
plain replacements ("Intake form" → "Pre-visit questions"; "Reference" column → "Normal range";
"Losartan 50 mg" → "Losartan 50 mg (blood pressure medicine)"; "Predictable demo profile" →
"Sample data — not a real patient"). Role vocabulary is inconsistent across four labels:
"Employee access" (`:430`), "Administrator" (`:454`), "Clinic staff" (`:467`), "Employee" (`:589`).
Raw API strings reach patient-facing toasts verbatim via `:288-298` — e.g. "Only clinic staff can
perform this action." (`lib/demo-state.ts:225`).

### C6. Demo disclosure — where it is absent

15 disclosure points exist and are well written (login footer `:706`, Forms `:898`, Results
`:906`, Messages `:993`, and every clinical modal). The gaps:

1. **The exported CSV carries none.** `:932-953` writes an assessment ("Blood pressure stable")
   and a plan ("Continue Losartan 50 mg and follow up in 3 months") under a patient name, with no
   fictional-data row, under filename `maria-lopez-visit-summary.csv` (`:948`). The on-screen
   disclaimer at `:956` **does not travel with the file** — this is the only clinical content that
   leaves the labeled environment as a document.
2. **On mobile, the patient overview has zero disclosure.** `globals.css:361` sets
   `.date-note { display: none }` inside the ≤680px query — removing the only marker on a screen
   that still shows a lab result (`:768`), a visit summary (`:769`), and a medication.
3. **The staff dashboard has no disclosure at all** (`:829-853`) — metrics, five named patients,
   and the request queue all present as live clinic data.
4. **The MFA email has no demo marker** in sender, subject, or body (`lib/auth.ts:203, 215-216,
   296-316`) — real mail to a real inbox from a fictional healthcare brand.
5. **The social card presents a real product.** `app/layout.tsx:12-27` — "Luma Health | Patient
   Portal" / "Simple, connected, human care." with an `og.png` preview.
6. Also absent: booking modal (`:871`), staff appointment review (`:880`), API docs page, and all
   19 toasts (`:314-401`) — e.g. "Your appointment is confirmed for July 24 at 10:30 AM".

### C7. Copy known gaps

- `public/openapi.json` `summary`/`description` strings **are** rendered to users by Swagger UI
  (`ApiDocs.tsx:85-96`) but were outside the assigned surface and are un-audited.
- Static analysis only; the mobile `.date-note` suppression and the `.sign-out` link styling were
  verified in CSS, not in a browser.
- Copy is duplicated between `vercel-frontend/index.html:6,9` and `app/layout.tsx:12-13`, and
  between `LumaApp.tsx:114-117` and `lib/demo-state.ts:95-100` — any fix must be applied twice or
  the two builds diverge.
- Forced continuity / hidden cost / fake scarcity are reported absent because the *mechanism* does
  not exist, not because a deliberate decision was verified.

---

## D. Weight & Friction Evidence

### D1. First paint — measured from the built bundle

`vercel-frontend/dist/assets/` contains exactly 4 files:

| File | Raw | gzip -6 | brotli -q11 | On first paint? |
|---|---|---|---|---|
| `index-l1mgEIJJ.js` | 253,378 | **73,755** | 63,731 | **YES** |
| `index-C08qN3Iw.css` | 36,414 | **8,053** | 7,041 | **YES** |
| `swagger-ui-react-iaxgbGkh.js` | 1,287,806 | 353,698 | 284,073 | **NO — lazy** |
| `swagger-ui-CrIa5r46.css` | 176,793 | 26,313 | 19,059 | **NO — lazy** |

**First-paint total: 290,623 raw / 82,365 gzip / ~71,300 brotli across 4 requests.**

**Framework-vs-app attribution, measured not estimated.** A probe was built at
`/tmp/react-baseline-probe` — an entry doing only `createRoot(...).render(<div>hi</div>)`,
symlinked to the project's own `node_modules`, same Vite 8 + plugin-react config: React 19.2.6 +
react-dom/client baseline = **190,417 raw / 59,185 gzip**. Delta ⇒ app code = **62,961 raw
(24.8%)**. Cross-validated against the repo's *other* build, which splits by module:
`framework-BpSqSxVs.js` = 189,805 / 58,935 (within 0.3% of the probe), `LumaApp-DJKmRG-8.js` =
58,552 / 13,267. **~75% of initial JS is the React runtime; ~23% is `LumaApp.tsx`.**

### D2. swagger-ui is correctly code-split — the suspicion is not supported

`grep -o 'swagger-ui-react-iaxgbGkh\.js' index-l1mgEIJJ.js | wc -l` → **1**, and its context is a
runtime `import()` inside a `useEffect`, not a static import. Corroborated four ways: the entry
chunk's first line is a Vite lazy-CSS shim deferring `swagger-ui-CrIa5r46.css` (which is why it
is not linked from `index.html`); library-identifier leak tests on the entry chunk return 0 for
`OperationContainer`, `Topbar`, `js-yaml`, `immutable`, `redux`, `SwaggerUI` while the split chunk
returns 5/1/25/6; `dist/client/.vite/manifest.json` marks
`node_modules/swagger-ui-react/index.mjs` as `"isDynamicEntry": true`; and the source is an
explicit dynamic import at `shared/ApiDocs.tsx:29-46`.

**1,464,599 raw / 380,011 gzip is kept off the main route.** Counterfactual: unsplit, the entry
chunk would be 1,541,184 raw instead of 253,378 — a **6.08×** inflation.

Two precise caveats: (a) the split is hand-written *inside the component*, not route-driven —
`vercel-frontend/src/main.tsx` statically imports both `ApiDocs` and `LumaApp`, so the `ApiDocs`
shell (2,654 raw) ships on the main route and all of `LumaApp` (58,552 raw) ships on `/api-docs`;
both are small. (b) `swagger-ui-react` being a dependency of both `package.json:19` and
`vercel-frontend/package.json:12` is install-tree duplication (7.6 MB on disk per tree), not
shipped bytes.

### D3. A 1.48 MB orphan is deployed and never requested

`dist/og.png` = **1,517,095 bytes**. `grep -rl 'og.png' dist/` → **no references**. It is consumed
only by the root Next app (`app/layout.tsx:9` `openGraph` metadata); `vercel-frontend/index.html`
has **no `og:image` meta at all**. So the Vercel deployment ships 1.48 MB of orphaned image *and
still has no social preview card* — it is 5.2× the entire first-paint payload.

### D4. Requests and TTI

**5 requests anonymous, 6 authenticated.** `GET /api/auth/session` fires unconditionally on
mount (`LumaApp.tsx:137`); `GET /api/demo-state` is gated on `if (!user) return`
(`:152`) and therefore **serial after** the session call. Both are `cache: "no-store"`, so neither
ever benefits from caching, and each traverses a Vercel-edge → Cloudflare-Worker proxy hop
(`vercel-frontend/vercel.json:8-11`).

**TTI is analytical, not measured** (no browser available; the live third-party deployment was
deliberately not load-tested). Slow-4G Lighthouse constants — 200 KB/s, 150 ms RTT, 4× CPU,
1 ms/KB raw JS unthrottled → 4 ms/KB:

| Condition | TTI |
|---|---|
| Slow 4G, anonymous | **≈ 2.5 s** |
| Slow 4G, authenticated (serial second round trip) | **≈ 2.9 s** |
| Desktop cable, cold cache | ≈ 0.6-0.7 s |
| Warm cache | ≈ 0.4 s |
| `/api-docs` on Slow 4G (1,288 KB raw to parse ≈ 5.1 s main-thread) | **≈ 9-10 s** |

**The cost is structural, not byte-count.** ~2,150 ms of the 2,500 ms elapses before any content
is knowable: the app is a pure client-side SPA with zero server-rendered HTML
(`<div id="root"></div>` is the entire body) and first meaningful state depends on two *serially
chained* API round trips. FCP is the line "Loading secure access…", not content.

### D5. Idle motion — clean

**0 animations run on an idle screen.** 1 `@keyframes` (`toast-in`, `globals.css:129`), 1
`animation:` (on `.toast`), 3 real `transition:` rules — all three requiring hover or focus
(`globals.css:40, 86, 108`). No spinners, skeletons, shimmers, or pulses
(`grep -niE 'spin|pulse|skeleton|shimmer|blink|marquee|bounce|fade'` → 0). No JS-driven motion
(`grep -nE 'animate|setInterval|requestAnimationFrame' shared/*.tsx` → 0).
**`prefers-reduced-motion` gates all of it** (`globals.css:364`) and the universal `!important`
reset is genuinely complete *because* 100% of the motion is CSS-driven.

One exception: a toast can animate in with no user action — the `/api/demo-state` catch path
(`LumaApp.tsx:159-166`) fires "Environment unavailable" on backend failure during initial load.

### D6. Attention indicators on initial load

**Anonymous: 0 modals, 0 badges, 0 toasts.** No cookie notice, no dismissible banner.
**Modals: 0 on every initial load** — all 9 flags default `false`.

**Authenticated patient, default Overview — 7 attention indicators with no user action.** Three
are not backed by data:

1. **`.icon-button.notification span` (`:466`) is a hardcoded red dot.** `globals.css`:
   `width:7px; height:7px; background:#e88069; border:2px solid white; border-radius:50%`. It is
   an empty `<span>` with no data behind it, and the bell **has no `onClick`** — it signals unread
   activity that cannot be opened and never clears.
2. **`.nav-badge` (`:443`) renders unconditionally**, showing `0` on first paint (`messages` = `[]`)
   then flipping to `2` when `/api/demo-state` resolves — a visible 0→2 change the user did not cause.
3. **The progress ring (`:743`)** shows a hardcoded "75%" / "3 of 4 tasks completed" that does not
   move when a task is completed, and **3 activity rows (`:767-770`)** whose strings and
   timestamps are hardcoded rather than derived from state.

Staff Overview adds ~4 more, including a `.count-badge` (`:842`) computed as
`2 + Number(refillStatus === "pending") + Number(intakeComplete)` — **a fabricated floor of 2**
backing two static request cards with no data behind them.

### D7. Weight known gaps

- **TTI is analytical, never measured.** The 4 ms/KB JS cost and the 250-400 ms API-hop budget are
  the softest assumptions; the byte counts feeding them are exact.
- **Uncompressed parse cost (253 KB raw) is the dominant TTI term**, and compression does not help
  it — any conclusion about improving TTI by shrinking *transfer* bytes measures the wrong number.
- No `_headers` file in `vercel-frontend/dist/` (the root build emits one with
  `immutable` for `/assets/*`), so warm-cache behavior relies on Vercel preset defaults that
  could not be verified without live response headers.
- Brotli figures are local `brotli -q 11`, not Vercel's encoder — treat as a floor.
- The `/api/*` proxy hop latency, Worker cold start, and D1 read time are all unmeasured.
- `prefers-reduced-motion` was verified by source inspection, not by toggling the OS setting.

## E. Accessibility Evidence

### E1. Contrast — 59 of 170 text tokens fail AA, and 39 trace to one variable

170 declared text/background pairs evaluated; **111 pass, 59 fail.** Of the 170, **148 are
under 18.66px**, so the 4.5:1 threshold applies almost everywhere — only 12 tokens qualify for
the 3:1 large-text exemption, and all 12 pass.

The failures roll up to 19 foreground values, but **`--muted` (`#718087`, `globals.css:3`)
accounts for 39 of the 59** — 4.09:1 on white (0.41 short), 3.75-3.90 on tinted panels. Fixing
that single token clears two-thirds of the AA failures in one edit.

Worst five: `.nav-badge` **2.72** (`:62`), `.date-note` **2.74** (`:116`),
`.message-bubble time` **2.87** (`:125`), `.nav-label` **2.88** (`:57`), `.activity-row time`
**2.93** (`:114`). The `≥1000px` query enlarges many sizes but **changes no verdict** — every
token failing at base still fails enlarged. Icons: 10 of 11 pass the 3:1 non-text bar;
`.care-mark` fails at 2.84 (`:115`).

### E2. What is genuinely correct

Worth stating plainly, because it is a real strength and must not regress:

- **Zero `onClick` on non-interactive elements.** All 56 handlers sit on real `<button>`s (49
  direct, 7 via `QuickCard`/`Activity`, which render buttons at `:857`, `:861`). No
  `div`/`span`/`label` click targets anywhere.
- **Zero `tabIndex` attributes** in `shared/` or `app/` — so no positive tabindex, and DOM order
  is tab order.
- **21 of 21 form controls are labelled**, with zero `aria-label` on any of them. 20 use implicit
  wrapping `<label>`, one uses explicit `htmlFor`/`id` (`:993`). Two `<fieldset>`/`<legend>`
  groups correctly wrap the radio sets (`:662`, `:871`). This is why `get_by_label(...)` works
  throughout the E2E suite.
- **13 of 13 icon-only buttons have accessible names.** `Icon.tsx:110-113` sets
  `aria-hidden="true"` and `focusable="false"` on every `<svg>`, so `aria-label` does all the work.
- **9 of 9 modals have `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` whose id
  resolves.** Labelling is complete.
- `aria-live="polite"` on the message thread and patient results (`:993`, `:889`); `role="alert"`
  on all three error paths; `role="status"` on the toast; `<html lang="en">` set
  (`app/layout.tsx:33`); `role="table"`/`row`/`columnheader`/`cell` on the lab grid (`:929`).

### E3. Focus — the largest gap

- **`:focus-visible` appears 0 times.** Only 3 `:focus` rules exist (`globals.css:40, 124, 125`),
  all on text inputs, all paired with `outline: none`/`0`. All ~49 buttons, 3 selects, and every
  radio fall back to the **browser default ring** — undesigned, and unverified against the dark
  hero card, the teal primary buttons, and the dark toast.
- **Both radio groups have no visible focus at all.** `.time-options input` and
  `.account-role-picker input` are `opacity: 0` (`globals.css:122, 41`), which suppresses the UA
  ring, and no `:has(input:focus-visible)` rule styles the wrapping label. The appointment-time
  picker — a primary flow, exercised at `full_demo.py:148` — is keyboard-operable but **invisibly
  so**. This is worse than the default: it is nothing.
- **All 9 modals lack a focus trap, focus restore, and Escape-to-close.** Confirmed by absence:
  0 `onKeyDown`/`onKeyUp`/`onKeyPress`, 0 `.focus()`, 0 `inert`, no focus-trap dependency.
  Initial focus exists in only 2 of 9. Because the modals mount *after* the whole
  `<section className="workspace">` in DOM (`:533-538`, `:850-852`) and `.modal-backdrop` is
  `z-index: 50`, focus stays on the trigger and tabbing walks the **occluded page** before
  reaching the dialog's own controls. *(INFERRED from DOM position + absence of trap.)*
  Backdrop dismissal is `onMouseDown` on an unlabelled `<div>` — mouse-only, with no keyboard
  equivalent.
- **No skip link, and no `.sr-only`/`.visually-hidden` utility to build one with.** Keyboard users
  traverse 6 sidebar stops plus 3 topbar stops before reaching content, on every navigation.

### E4. Landmarks and structure

Patient Overview exposes **4 landmarks**: `main` (`:422`), `complementary` (`:423`),
`navigation` (`:433`), `complementary` (`:772`).

- **`<header className="topbar">` is not a `banner`** — it nests inside
  `<section className="workspace">` (`:459-460`), which strips the mapping per HTML-AAM. Same for
  `<header className="api-docs-header">` inside `<main>` (`ApiDocs.tsx:49-50`).
- **`<aside aria-label="Main navigation">` (`:423`) names a `complementary` landmark as
  navigation**, while the real `<nav>` inside it (`:433`) is unnamed.
- Nine unnamed `<section>` elements expose as `generic`. **No `contentinfo`, no `banner`, no
  `search`, no `form` landmark anywhere.**
- **Mobile navigation inverts the tab order.** At ≤680px `.sidebar` is `display: none` and
  `.mobile-nav` — DOM-last in the workspace — becomes a `position: fixed` bottom bar
  (`globals.css:361`), making the app's primary navigation the **last** tab stop, reachable only
  after the entire page. *(INFERRED.)*
- **`aria-label="Sign out"` on `.sidebar-user` (`:452`) suppresses** the visible `{displayName}`
  and role text (`:454`) from the accessible name — AT announces only "Sign out".

### E5. Cross-confirmation of the discarded booking inputs

Independent of the copy audit (C1a), the accessibility pass found the mechanism: the Specialty and
Provider `<select>` elements at `:871` **have no `name` attribute**, so `FormData` omits them
entirely. The handler could not read them even if it tried.

### E6. No automated a11y checking exists

No `eslint-plugin-jsx-a11y` in `eslint.config.mjs`; no axe in `tests/e2e/full_demo.py`. The E2E
suite asserts flow correctness only. Nothing in CI would catch any finding in this section.

### E7. Other confirmed defects

- **8 focusable no-op buttons consume tab stops** with no behavior (`:465, :466, :767, :838,
  :839`×4, `:846, :847`, and `:769` conditionally).
- **Two adjacent tab stops fire the same action** — `.primary-button` (`:741`) and
  `.appointment-time button` (`:753`) both call `onBook`.
- **No `prefers-contrast` or `forced-colors` block** (0 matches). Every color is a hardcoded hex,
  so there is no high-contrast escape hatch.
- **CSS specificity collision:** `globals.css:123` (`.patient-search-input input`, 0-1-1) sets
  `border: 0; background: transparent; outline: 0` for a borderless inline search field, but
  `globals.css:124` (`.modal input:not([type="radio"])`, 0-2-1) wins and reapplies a border,
  white background, and padding. The intended design is overridden.
- **Pressing Enter in the sign-in fields submits via `:670`** (the MFA path), not the skip-MFA
  button at `:671`. *(INFERRED.)*
- `.welcome-row .primary-button` gets `font-size: 0; width: 43px` at ≤680px (`globals.css:361`) —
  the accessible name survives from text content, the visible label does not.

### E8. Accessibility known gaps

- Tab sequence while a modal is open (E3) is derived from DOM position plus the absence of a trap,
  not observed at runtime.
- `.schedule-row > button` renders at roughly **25×17px** in a 25px grid column with no declared
  height — below SC 2.5.8's 24×24. INFERRED, needs runtime measurement.
- Landmark count and tab order flip at the 680px and 1000px breakpoints; all three of `.sidebar`,
  `.mobile-nav`, and `.mobile-brand` change exposure.
- Browser default focus rings were not verified against the dark surfaces — no browser was run.
