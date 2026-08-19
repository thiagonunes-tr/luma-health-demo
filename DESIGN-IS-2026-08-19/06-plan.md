# 06 — Implementation Plan

Six phases, each self-contained enough to execute in a fresh context. Target decisions are in
`05-target-design.md`; evidence is in `01-evidence.md` and `01b-flow-evidence.md`.

**Ground rules for every phase**

- `tests/e2e/full_demo.py` is a **deploy gate** (`.github/workflows/deploy.yml` runs lint → unit
  tests → E2E → builds → deploy). Every phase that changes UI must update it in the same commit.
- `shared/LumaApp.tsx` and `app/globals.css` are consumed by **two** entry points —
  `app/page.tsx:1` (Next/Worker) and `vercel-frontend/src/main.tsx:4-5` (Vite). New files under
  `shared/` must keep those relative imports valid.
- **There are no component tests for `LumaApp.tsx`.** `tests/` holds only server-side unit tests.
  The E2E script is the only safety net for UI work — treat it as such.
- `npm run lint && npm test` must pass at the end of every phase.

---

## Phase 0 — Discovery output (complete; read this before Phase 1)

### The deploy gate is far narrower than it looks

`tests/e2e/full_demo.py` has 11 `locator(` calls, and only **five app-owned CSS class names**
gate the deploy:

| Class | E2E line | Defined at |
|---|---|---|
| `.sidebar` | 57 (the `sidebar()` helper, 6 call sites) | `globals.css:47, 132, 355, 361` |
| `.sidebar-user` | 52 (sign-out) | `globals.css:65, 67, 69, 171, 177` |
| `.time-options` | 148, 152 (appointment time picker) | `globals.css:122` |
| `.clinical-modal` | 193, 212 | `globals.css:126` |
| `.patient-results` | 205 | `globals.css:123` |

**`.activity-*`, `.schedule-row`, `.quick-card`, `.metric-card`, and `.document-card` are NOT used
as locators anywhere** — verified by grep (zero hits). They are safe to rename. Everything else in
the E2E is role/label/text/aria-based. The five vendor classes (`.swagger-ui`, `.info`, `.title`,
`.live-responses-table`, `.response-col_status`) come from `swagger-ui-react`, not `globals.css`.

### Three traps that will fail the deploy silently

1. **`navIcons` is index-parallel to `navItems`.** `navItems` (`LumaApp.tsx:62`) and `navIcons`
   (`:63-69`) are two separate arrays joined by index at `:437` and `:528`. Shortening one without
   the other yields `<Icon name={undefined}>`, a React warning, and
   `assert console_errors == []` (`full_demo.py:329`) **fails the entire run**. Phase 4 must merge
   them into one array of objects.
2. **"Confirm appointment" is already taken.** `full_demo.py:149` does
   `get_by_role("button", name="Confirm appointment")` against the *booking submit* button
   (`:871`), and Playwright role-name matching is **case-insensitive substring** by default. The
   new `confirm-appointment` action must therefore use a button label that does **not** contain
   that string. Use **"Confirm attendance"**.
3. **The patient `<h1>` is derived from the nav label.** `:740` renders
   `activeNav === "Overview" ? \`Hello, ${patientName}.\` : activeNav`. `full_demo.py:47-48`
   asserts the heading `"Hello, Maria."` on **all four** `sign_in` calls (36, 116, 198, 256).
   Renaming Overview → Home breaks every one. Fix by decoupling the nav **id** from its **label**
   (Phase 4), which also removes the `activeNav`-as-heading hack.

Also: `setActiveNav("Overview")` appears at **three** call sites — `:195`, `:225`, `:538`.
And `.mobile-nav` hardcodes `grid-template-columns: repeat(5,1fr)` at `globals.css:361`, which must
become 4 (patient) and 3 (staff).

### Contract facts

- **No D1 migration is required.** `demo_state.state_json` is a single opaque TEXT column
  (`db/schema.ts:44-48`, `drizzle/0001_nasty_taskmaster.sql`) written with `JSON.stringify(state)`
  (`lib/mfa-db.ts:253-266`). Do **not** run `npm run db:generate`.
- `getDemoState` (`lib/mfa-db.ts:193-251`) rebuilds the state field-by-field from
  `Partial<DemoState>`, validating each with a whitelist or a type guard and falling back to a
  `DEFAULT_*`. **Every new field must follow this pattern** or old rows return `undefined` for it.
  Derived booleans (`appointmentBooked`, `intakeComplete`) deliberately ignore the persisted value.
- `public/openapi.json` is **26,832 bytes, 910 lines, hand-formatted 2-space indent** with short
  arrays collapsed onto one line. The action enum at **`:774-789`** is the only multi-line enum.
  Do not reformat the file — the diff would be unreadable. Never edit
  `dist/client/openapi.json` or `vercel-frontend/dist/openapi.json`; they are build artifacts
  (`vercel-frontend/vite.config.ts` sets `publicDir: "../public"`).
- `DemoStateActionRequest` (`openapi.json:768-800`) has **`additionalProperties: false`**, so new
  input fields (provider, specialty) must be added there or they are documented as illegal.
- `PATCH /api/demo-state` already declares a `409` response — **no new response object needed.**
- `app/api/demo-state/route.ts` **never names an action** (it delegates to `isDemoStateAction` at
  `:46`). It only changes if new *input fields* are added — the body destructure at `:33-39` and
  the forward at `:51-54` are field-by-field, not a spread.
- **Nothing validates the OpenAPI action enum against the TypeScript union.** `tests/openapi.test.ts`
  asserts only the 8 method+path pairs (`:36-45`), the 8 operationIds (`:49-63`), and that
  `securitySchemes.sessionCookie` exists (`:64`). Drift is silent. Phase 2 closes this.
- As long as new actions ride the existing `PATCH`, neither `openapi.test.ts` nor
  `full_demo.py:102` (`len(document["paths"]) == 6`) needs to change.

### `app/globals.css` editing constraints

**Zero comments, no section markers.** The only anchors are 16 blank lines (14, 21, 31, 45, 55, 70,
80, 94, 105, 111, 117, 121, 130, 351, 357, 363). The file has **4** media queries — three
width-only plus `prefers-reduced-motion` at `:364`; the fifth at-rule is `@keyframes toast-in`
(`:129`). The `min-width: 1000px` block (`:131-350`) is **220 lines, 60% of the file**, and is
purely font-size and padding scale-ups — it is the biggest collapse candidate once type and spacing
are tokens.

---

## Phase 1 — Token layer (CSS only, no JSX)

Lowest risk, highest impact ratio. Touches `app/globals.css` exclusively.

### What to implement

1. **Extend `:root`** (`globals.css:1-13`, currently 11 tokens). Copy the existing block's format
   and add the scales from `05-target-design.md` §3: 7 type tokens, 8 spacing tokens, a
   `--sidebar-width` token, and the collapsed color set. Delete `--white` (declared at `:6`, never
   referenced; the keyword `white` is used 39 times).
2. **Replace `--muted: #718087` with `--muted: #5c6b71`.** Verify with the audit's arithmetic:
   `L(#5c6b71) = 0.13987` → 5.53:1 on `#ffffff`, 5.02:1 on `#eef7f5`. This single line clears **39
   of the 59** AA failures.
3. **Sweep every `font-size` to a type token.** 157 declarations, 24 distinct values → 7 tokens.
   The floor is `--text-xs: 12px`; nothing renders below it. Specific kills: the **8px**
   `.mobile-nav button` (`:361`), the five 9px rules (`:100, :122, :125`), and the 24 10px rules
   that never get an override.
4. **Sweep every padding/margin/gap to a spacing token.** 304 values, 54 distinct → 8 tokens.
5. **Sweep hardcoded colors to tokens.** 101 hex literals live outside `:root` today.
6. **Fix the 20 non-`--muted` contrast failures individually** — `.nav-badge` 2.72:1 (`:62`),
   `.date-note` 2.74:1 (`:116`), `.message-bubble time` 2.87:1 (`:125`), `.nav-label` 2.88:1
   (`:57`), `.activity-row time` 2.93:1 (`:114`), `.mobile-nav button` 3.08:1 (`:361`),
   `.privacy-copy` 3.32:1 (`:43`), `.care-mark` icon 2.84:1 (`:115`), and the rest listed in
   `01-evidence.md` B4.
7. **Raise every touch target to 44×44.** Named fixes in `05-target-design.md` §3. Add a
   `@media (pointer: coarse)` block — there is none today.
8. **Collapse the `min-width: 1000px` block** (`:131-350`) wherever a `clamp()` token makes the
   override redundant.
9. **Un-hide the mobile demo disclosure.** `:361` sets `.date-note { display: none }` at ≤680px,
   removing the only demo marker from the patient landing page on mobile.

### Verification checklist

```bash
# no hex literal outside :root  (returns 101 today, must return 0)
sed '1,13d' app/globals.css | grep -oE '#[0-9a-fA-F]{3,8}' | wc -l
# no font-size below the 12px floor  (must return 0)
grep -oE 'font-size: *(8|9|10|11)px' app/globals.css | wc -l
# focus-visible exists  (returns 0 today)
grep -c 'focus-visible' app/globals.css
# the five load-bearing classes still exist
for c in sidebar sidebar-user time-options clinical-modal patient-results; do
  printf '%s: %s\n' "$c" "$(grep -c "\.$c" app/globals.css)"; done
# reduced-motion reset survives
grep -c 'prefers-reduced-motion' app/globals.css
npm run lint && npm test && npm run test:e2e
```

### Anti-pattern guards

- **Do not rename `.sidebar`, `.sidebar-user`, `.time-options`, `.clinical-modal`, or
  `.patient-results`.** They gate the deploy.
- Do not touch `globals.css:364` — the `prefers-reduced-motion` reset is already correct and
  complete, and it works *because* all motion is CSS-driven.
- Do not introduce a CSS framework or preprocessor; the dual-target build has no pipeline for one.
- Do not reformat the file wholesale — there are no comments to anchor a diff review on.

---

## Phase 2 — State machine, contract, and docs

Server-side only. No JSX. Fully covered by unit tests, so this phase can be verified without a
browser — except for the E2E flow reordering, which it must also do.

### What to implement

1. **`lib/demo-state.ts`** — implement `05-target-design.md` §2:
   - Add `confirmed` and `no-show` to `AppointmentStatus` (`:3-9`).
   - Add `confirm-appointment`, `no-show-appointment`, `mark-messages-read` to the
     `DemoStateAction` union (`:46-58`) **and** the runtime `actions` array (`:113-127`). Keep the
     two lists in the same order — they are byte-identical today and `openapi.json` mirrors them.
   - Move `check-in-appointment` from the staff allow-list (`:231-238`) to the patient
     allow-list (`:211-220`); add `no-show-appointment` to staff.
   - Add the transition cases. Copy the existing case shape verbatim (e.g. `:312-323` for
     `check-in-appointment`).
   - Gate `complete-intake` (`:352`) and `submit-intake` (`:361`) on an active appointment.
   - Add `appointmentProvider`, `appointmentSpecialty`, `lastRead` to `DemoState` (`:35-44`) and
     `DEFAULT_DEMO_STATE` (`:102-111`), plus `isAppointmentProvider` / `isAppointmentSpecialty`
     guards copied from the shape of `isAppointmentTime` (`:133-135`).
   - Add `confirmed` and `no-show` keys to `appointmentStatusLabel` — note this lives in
     `shared/LumaApp.tsx:79-88`, not in `lib/`.
2. **`lib/mfa-db.ts` `getDemoState`** (`:193-251`) — add validation/defaulting for the three new
   fields, following the existing per-field pattern exactly. `appointmentBooked` is derived from
   `["scheduled","checked-in","in-progress"]` at `:233-235` and **must gain `"confirmed"`**.
   `resetDemoState` (`:280-294`) clones `messages` with a spread — do the same for any new
   mutable field.
3. **`public/openapi.json`** — add the three actions to the enum at `:774-789`; add `provider` and
   `specialty` properties to `DemoStateActionRequest` (`:768-800`, remember
   `additionalProperties: false`); add the three new fields to the `DemoState` schema's one-line
   `required` array and `properties` map (`:717-757`); add `confirmed`/`no-show` to the
   `AppointmentStatus` schema (`:605-616`); update the PATCH `description` prose at `:350`, which
   asserts the role split and becomes factually wrong.
4. **Close the enum-drift gap.** Add a test to `tests/openapi.test.ts` asserting that
   `components.schemas.DemoStateActionRequest.properties.action.enum` deep-equals the `actions`
   array imported from `lib/demo-state.ts`, and that the `DemoState` schema's `required` array
   matches the keys of `DEFAULT_DEMO_STATE`. Nothing checks this today.
5. **Unit tests** — `tests/demo-state.test.ts`:
   - `:348-381` is the primary rewrite: the `check-in-appointment` call at `:357` passes `"staff"`.
     Split into a patient check-in test and a staff start/complete test.
   - `:51-94` starts from `DEFAULT_DEMO_STATE` (`appointmentStatus: "none"`), so the intake happy
     path now returns 409. Reseed from a `scheduled` state and add a **new** negative test:
     `submit-intake` from `DEFAULT_DEMO_STATE` → 409.
   - `:21-49` and `:268-305` use whole-state `assert.deepEqual` and break on any new `DemoState`
     field. Update the expected objects.
   - `:248-266` is the canonical home for the new role assertions: staff cannot
     `check-in-appointment`; patient cannot `no-show-appointment`.
   - `:383-407` is the home for the new 409 guards (check-in from `scheduled`, confirm from
     `none`, no-show from `checked-in`).
   - Copy the assertion idiom verbatim from `:348-381` and `:383-407` — `node:test` +
     `node:assert/strict`, top-level `test()`, no `describe`, and the narrowing guard
     `assert.equal(x.ok, true); if (!x.ok) return;`.
6. **E2E flow reorder** — `tests/e2e/full_demo.py`:
   - **Delete line 241** (`"Check in patient"` in the staff modal). Check-in is no longer a staff
     action.
   - Insert a patient-side **"Confirm attendance"** then **check-in** step before the sign-out at
     `:197`.
   - `:208` asserts `"Scheduled · 3:00 PM"`. After a patient check-in it becomes
     `"Checked in · 3:00 PM"` — update it.
   - `:242` (`"Start visit"`) only resolves if the appointment is already `checked-in` when staff
     opens the modal, which the inserted step guarantees.
   - `:249-253` asserts `start-appointment` → 409 from `completed`; still valid.
7. **Docs, same commit.** Every location was inventoried:
   - `docs/API_REFERENCE.md` — patient action table `:344-353`, employee table `:409-417`, the
     conflict-examples sentence `:457`, and **four separate copies** of the default-state JSON at
     `:260-297`, `:299-336`, `:425-447`, `:459-483`.
   - `docs/DEVELOPER_HANDOFF.md` — the `PATCH` section `:409-424` (its bullet lists name every
     action), the `demo_state` section `:263-298`, and the validation checklists at `:614-627` and
     `:642-650` (the staff bullet at `:642-650` is directly contradicted).
   - `docs/QA_AUTOMATION.md` — the action table at `:76-95` has an **Allowed role** column, and the
     `check-in-appointment` row at `:90` says "Employee"; also the reset-state JSON at `:37-52` and
     the scenario script at `:117-146`.
   - `docs/REQUIREMENTS_TRACEABILITY.md` — row `:101` ("Staff can check in the patient…") is
     directly contradicted; also `:35`, `:84-88`, `:158`, `:163-167`, and the approved-decisions
     list at `:185-197`, which exists to record exactly this kind of actor change.
   - **`README.md` needs no change** — it contains zero action names and zero state field names.

### Verification checklist

```bash
npm test                      # all unit tests, including the new enum-drift test
npm run test:e2e              # the reordered scenario
# the four full-list sites agree
grep -c 'check-in-appointment' lib/demo-state.ts public/openapi.json
# no doc still claims staff check-in
grep -rn 'check in the patient\|Staff.*check-in-appointment' docs/
# no migration was generated
git status --short drizzle/ db/
```

### Anti-pattern guards

- **Do not rewrite `transitionDemoState`** — extend it. It is a pure function with 18 passing tests
  and it is on the Preserve list.
- **Do not run `npm run db:generate`.** No DDL changes; `state_json` absorbs the new fields.
- Do not add a new HTTP path. New actions ride the existing `PATCH`. A new path would force
  lockstep edits to `openapi.test.ts:36-45`, `:49-63`, and `full_demo.py:102`.
- Do not reformat `public/openapi.json`.
- Do not name the new confirm button anything containing **"Confirm appointment"** (see Phase 0
  trap 2).

---

## Phase 3 — Shared `Modal` and the focus system

### What to implement

1. **Create `shared/Modal.tsx`.** All nine shells are byte-identical in their wrapper:
   `<div className="modal-backdrop" onMouseDown={onClose}>` → `<div className="modal …"
   role="dialog" aria-modal="true" aria-labelledby={id} onMouseDown={e => e.stopPropagation()}>` →
   `<button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close"
   size={18} /></button>`. Attribute order is identical in all nine. Copy that shape verbatim.

   The component must support: `onClose`, `labelledById`, optional `className` variant
   (`account-modal`, `patient-search-modal`, `clinical-modal`, `intake-modal`, or none),
   optional `closeDisabled` (4 of 9 set it, 5 do not), and **children that include the eyebrow and
   heading** — `PatientSearchModal` (`:889`) renders both inside a ternary with the `<h2>` nested
   two levels deep, so the shell cannot own them.

   Add what all nine lack: **focus trap, initial focus, focus restore on close, Escape-to-close.**

2. **Backdrop dismissal becomes conditional.** Today `onMouseDown={onClose}` on all nine silently
   destroys typed input — including a password and the word DELETE in `AccountModal`. Allow it only
   for read-only dialogs (`LabResultModal`, `VisitSummaryModal`, `AppointmentReviewModal`,
   `IntakeReviewModal`); form dialogs require an explicit close.

3. **One `activeModal` discriminant** replacing 9 booleans — 6 in `Home` (`:97-102`) and 3 in
   `StaffDashboard` (`:812-814`). Note modal open-state is currently **split across two
   components**; consolidate it.

4. **Focus system in `globals.css`** — the `:focus-visible` block and the two mandatory
   `:has(input:focus-visible)` rules from `05-target-design.md` §3. Remove the uncompensated
   `outline: 0` at `:123` (`.patient-search-input input`), and resolve the specificity collision
   where `globals.css:124` (`.modal input:not([type="radio"])`, 0-2-1) overrides
   `globals.css:123` (0-1-1).

5. **Fix the two ambiguous destructive controls** while here: move "Cancel appointment" (`:871`)
   out from directly beneath "Save new time", and make `.sidebar-user` (`:452`) not sign out on
   whole-row click — `.top-user` (`:467`) uses the identical avatar+name pattern to open settings.

### Verification checklist

```bash
grep -c 'modal-backdrop' shared/LumaApp.tsx     # 9 today, must be 0
grep -c 'role="dialog"' shared/Modal.tsx        # must be 1
grep -c 'Escape' shared/Modal.tsx               # 0 today, must be ≥1
npm run lint && npm test && npm run test:e2e
npm --prefix vercel-frontend run build          # new shared/ file must resolve in the Vite build
```

### Anti-pattern guards

- **These accessible names are asserted by the E2E and must not change:** the dialog names
  `"Account settings"` (`full_demo.py:146`) and `"Appointment details"` (`:245`), and
  `aria-label="Close"` (`:146`, `:215`).
- `VisitSummaryModal` and `AppointmentReviewModal` each have **two** buttons whose accessible name
  contains "Close", which is why the E2E uses `.last` (`:193`, `:212`, `:245`). Preserve that
  structure or update those three lines.
- `full_demo.py:215` is `page.get_by_label("Close")` **completely unscoped**. It works only because
  no toast is live at that moment (the toast at `:539` also has `aria-label="Close"`). Do not
  introduce a toast anywhere in the staff flow before that line.
- Keep `role="dialog"` + `aria-modal="true"` + a resolving `aria-labelledby` on all nine — 9/9 is
  currently correct and is on the Preserve list.
- Do not add a focus-trap dependency that breaks the dual-target build; write it with refs.

---

## Phase 4 — Information architecture

The structural phase. Do it after Phases 1-3 so the token layer and the `Modal` already exist.

### What to implement

1. **Merge `navItems` and `navIcons` into one array of objects** with a **stable `id` decoupled
   from the visible `label`** — `[{ id: "home", label: "Home", icon: "home" }, …]`. This fixes
   Phase 0 trap 1 (index desync → `<Icon name={undefined}>` → console error → deploy failure) and
   trap 3 (the `<h1>` derived from the nav label) at once. Build separate patient and staff arrays;
   `navItems` is a single shared array today (`:62`).
2. **Replace the fall-through router** (`:471-524`) with an explicit map keyed on
   `(role, navId)`. Every destination gets its own branch; a missing key must be a type error, not
   a silent fall-through. This is the defect that produced the phantom `Appointments` destination
   and the three byte-identical staff screens.
3. **Give each destination its own component**, per `05-target-design.md` §1. `PatientForms`
   (`:892-899`) and `ClinicalDocuments` (`:901-907`) merge into one **Health record** surface —
   they already share the same shell. Build the **Appointments** list with the full lifecycle
   (confirm, reschedule, cancel, self-check-in) — this destination has never existed.
4. **Give the patient `<h1>` a real per-destination title** instead of
   `activeNav === "Overview" ? … : activeNav` (`:740`). Pass `activeNav` to `StaffDashboard`, which
   never receives it today (`:509-523`, type at `:797-811`).
5. **Update the three `setActiveNav("Overview")` call sites** — `:195`, `:225`, `:538`.
6. **Collapse the 8 mirrored `useState` atoms into one `useState<DemoState>`.** The 8 setters have
   **zero call sites** outside their declarations (`:103-118`) and `applyDemoState` (`:258-267`),
   so the blast radius is only **7 spots in `Home`** that read an individual value outside a prop
   pass-through: `:311`, `:316`, `:343`, `:443`, plus the prop lists at `:486-517` and `:533-535`.
   Child components need no signature change if you pass `demo.field`. Also delete the duplicate
   insurance literal at `:113-118`, which copies `DEFAULT_INSURANCE` (`lib/demo-state.ts:96-99`).
7. **Fix `.mobile-nav`** — `globals.css:361` hardcodes `grid-template-columns: repeat(5,1fr)`;
   it becomes 4 for patient and 3 for staff. Also address that `.mobile-nav` is DOM-last and
   therefore the **last** tab stop while being visually the primary navigation.
8. **Delete the 11 dead controls** — `:465` (search), `:466` (bell), `:767` ("View all"), `:838`
   ("View schedule"), `:846`, `:847`, the four inert `:839` rows, and the conditionally-inert
   `:769`. Do not restyle them.
9. **E2E selector updates**, same commit:
   - `sidebar(page, "Forms")` `:164` and `sidebar(page, "Results")` `:185` → "Health record".
   - `sidebar(page, "Overview")` `:172` → "Home"; `:237` (staff) → "Today".
   - The h1 assertions at `:47-48` — now stable per destination.
   - `:147` / `:151` use `exact=True` on "Book appointment" / "Manage appointment", which is the
     only thing preventing collision with the `QuickCard` titles at `:760`. Preserve or re-scope.
   - `:156` ("Intake form"), `:165` ("Update insurance"), `:186` ("View result"), `:191`
     ("Open summary") all move to the merged Health record surface.
   - `:173` ("Request a refill") and `:263` ("Refill approved by the clinic") must stay reachable
     from Home.
   - `:204` ("Search patients"), `:217-219` (the `aria-label`-scoped "Review form"), `:238`
     ("Approve"), `:240` (the `aria-label`-scoped schedule row) move to the staff Today/Requests
     split.

### Verification checklist

```bash
grep -c 'navIcons' shared/LumaApp.tsx            # 2 today, must be 0
grep -c 'setActiveNav("Overview")' shared/LumaApp.tsx   # 3 today, must be 0
grep -c 'applyDemoState' shared/LumaApp.tsx      # 3 today, must be 0 or 1
grep -c 'repeat(5,1fr)\|repeat(5, 1fr)' app/globals.css # must be 0
npm run lint && npm test && npm run test:e2e     # console-error gate at full_demo.py:329
npm --prefix vercel-frontend run build
```

### Anti-pattern guards

- **The fall-through `else` must not survive.** If a `(role, navId)` pair has no branch, that is a
  bug to surface, not to absorb.
- Do not shorten one nav array without the other — they are now one array precisely to prevent this.
- Do not let a React key/prop warning through: `full_demo.py:329` asserts
  `console_errors == []` and fails the whole run.
- Do not change `MessageCenter`'s role-conditional labels `"Reply to your care team"` /
  `"Reply to Maria Lopez"` (`:993`) — asserted at `full_demo.py:177` and `:229`.

---

## Phase 5 — Honesty pass

### What to implement

Work the table in `05-target-design.md` §2 ("Every previously-fabricated value"). The rule:
**if a value cannot be traced to a `DemoState` field, delete it — do not restyle it.**

1. Progress ring `:774-775` — derive from actual completed visit tasks.
2. Staff metrics `:832-834` — derive; remove the fabricated floors (`requestCount = 2 + …` at
   `:826-827`).
3. Activity rows `:767-770` — render conditionally from state, using real timestamps.
4. Notification bell `:466` — **delete**; the unread signal lives on the Messages badge.
5. Messages badge `:443` — unread count from `lastRead`, not `messages.length`.
6. `"Ongoing medication · Last refill 30 days ago."` `:843` — **delete**.
7. **Wire the booking selects.** They currently have no `name` attribute, so `FormData` omits them,
   and `bookAppointment` (`:307-319`) reads only `form.get("time")`. Add `name`, read them, and
   send `provider`/`specialty` through `performDemoAction` — copy the input-passing idiom from
   `:269-305` verbatim.
8. Refill quick card `:762` — stop passing `done={refillStatus === "pending" || … "approved"}`;
   a pending request must not render the completion check icon from `:857`.
9. **Per-control busy state.** `demoBusy` stores the specific action at `:281` but all six
   consumers collapse it to `demoBusy !== null` (`:475, :500, :518, :533-535`), so one action
   disables every button. Use the stored action.
10. Remove the "protecting **every** account" claim (`:644`, `:646`) or qualify the skip-MFA button
    (`:671-673`) — the API gates it to demo accounts, the UI never says so.
11. Stop showing Maria Lopez's record to every patient — `:773`, `:906`, `:929`, `:956`, `:993`.
12. Add a fictional-data row to the CSV export (`:932-953`); the on-screen disclaimer does not
    travel with the file.
13. Add a demo marker to the MFA email (`lib/auth.ts:215-216`, `:296-316`).
14. Either wire `og:image` into `vercel-frontend/index.html` or stop shipping `dist/og.png`
    (1,517,095 B deployed, never requested).

### Verification checklist

```bash
grep -c '"75%"\|3 of 4 tasks' shared/LumaApp.tsx        # must be 0
grep -c 'messages.length}</span>' shared/LumaApp.tsx    # must be 0
grep -c 'demoBusy !== null' shared/LumaApp.tsx          # 6 today, must be 0
grep -c 'name="provider"\|name="specialty"' shared/LumaApp.tsx  # must be 2
npm run lint && npm test && npm run test:e2e
```

### Anti-pattern guards

- Do not invent a data source to justify keeping a number. Deleting is the correct outcome for
  anything `DemoState` cannot back.
- Do not break the CSV assertions: `full_demo.py:64` asserts the filename
  `maria-lopez-visit-summary.csv`, and `:68-75` asserts five substrings including
  `"Continue Losartan 50 mg"`. A new disclosure row is additive and safe.
- Toast titles are asserted verbatim as exact text at `full_demo.py:150, 154, 162, 170, 174, 239,
  244, 263`. Changing a toast title breaks the gate.

---

## Phase 6 — Verification and tooling

### What to implement

1. **Add `eslint-plugin-jsx-a11y`** to `eslint.config.mjs` and **axe** to
   `tests/e2e/full_demo.py`. Neither exists today, so nothing in CI would have caught any Phase 1
   or 3 finding.
2. Re-run the audit's own measurements and confirm the deltas.
3. Update `docs/DEVELOPER_HANDOFF.md` §12 (Known limitations) and
   `docs/REQUIREMENTS_TRACEABILITY.md` to reflect what this redesign closed. Note
   `REQUIREMENTS_TRACEABILITY.md:254` instructs that the doc be updated whenever a workflow is
   completed or a scope decision changes — the actor move is exactly that.
4. Record what was deliberately **not** done: dark mode remains unimplemented
   (`prefers-color-scheme` → 0 matches). The token layer makes it reachable; the work is out of
   scope for this pass. Say so explicitly rather than leaving it as an unmarked gap.

### Final verification

```bash
# --- Rams #3 aesthetic ---
sed '1,13d' app/globals.css | grep -oE '#[0-9a-fA-F]{3,8}' | sort -u | wc -l   # 101 -> 0
grep -oE 'font-size: *[0-9]+px' app/globals.css | sort -u | wc -l              # 24 -> ~7
# --- Rams #8 thorough ---
grep -c 'focus-visible' app/globals.css        # 0 -> ≥1
grep -c ':active' app/globals.css              # 0 -> ≥1
grep -c 'aria-invalid' shared/LumaApp.tsx      # 0 -> >0
# --- Rams #10 as little design as possible ---
grep -c 'modal-backdrop' shared/LumaApp.tsx    # 9 -> 0
grep -c 'useState' shared/LumaApp.tsx          # 36 -> materially fewer
# --- Preserve list still holds ---
grep -c 'prefers-reduced-motion' app/globals.css          # must stay ≥1
grep -c 'role="dialog"' shared/*.tsx                      # must stay 9
grep -c 'import(' shared/ApiDocs.tsx                      # swagger split must survive
grep -rn 'onClick' shared/LumaApp.tsx | grep -vE '<button|QuickCard|Activity' # must stay empty
# --- gate ---
npm run lint && npm test && npm run test:e2e
npm run build && npm --prefix vercel-frontend run build
```

### Anti-pattern guards

- Do not declare the redesign done on a green E2E alone. The E2E asserts flow, not design; the
  measurements above are what the audit scored.
- Do not skip the `vercel-frontend` build — it runs *after* the E2E gate in
  `.github/workflows/deploy.yml`, so a break there is a separate deploy risk the E2E cannot catch.

---

## Risk register

| Risk | Mitigation |
|---|---|
| **No component tests for `LumaApp.tsx`** — E2E is the only net for Phases 3-5 | Run `npm run test:e2e` at every phase boundary, not just at the end |
| Console-error gate (`full_demo.py:329`) fails the whole run on any React warning | Merging `navItems`/`navIcons` in Phase 4 removes the main source |
| `full_demo.py:215` unscoped `get_by_label("Close")` | Do not add a toast to the staff flow before that line |
| "Confirm appointment" substring collision | New button is "Confirm attendance" |
| OpenAPI enum drift is untested | Phase 2 adds the test |
| Phases 2-5 each leave the E2E red if its updates are deferred | Each phase updates the E2E in the same commit; CI only gates on push to `main` |
| Five load-bearing CSS classes | Listed in Phase 0 and re-checked in every phase's verification block |
