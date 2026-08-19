# 05 — Target Design Decisions

Orchestrator synthesis. These are the decisions the implementation phases in `06-plan.md` execute.
Every number here is chosen against evidence in `01-evidence.md`.

---

## 1. Information architecture (decided by the user)

### Patient — 4 destinations

| Destination | Job | Replaces |
|---|---|---|
| **Home** | Triage only: what needs action *now*. No Quick actions grid, no duplicated activity feed. | Today's Overview (`:738-780`) minus its index role |
| **Appointments** | The appointment list with full lifecycle: confirm, reschedule, cancel, self-check-in. | Today's phantom destination (no branch exists) |
| **Health record** | Intake form, insurance, lab results, visit summary — one surface. | Forms (`:892-899`) + Results (`:901-907`), which are already near-clone layouts (A5) |
| **Messages** | The care-team thread. | `MessageCenter` (`:979-994`), kept |

### Staff — 3 destinations

| Destination | Job |
|---|---|
| **Today** | Schedule + queue + metrics that are actually derived |
| **Requests** | Refills and submitted intakes awaiting review |
| **Messages** | The same thread, staff side |

**Router rule:** replace the fall-through chain at `:471-524` with an explicit map keyed on
`(role, activeNav)`. Every destination must have its own branch. A missing key is a build error,
not a silent fall-through to the dashboard — that is the defect that produced the phantom
`Appointments` destination and the three identical staff screens.

---

## 2. Target state machine

### `AppointmentStatus` — 6 states become 8

```
none | scheduled | confirmed | checked-in | in-progress | completed | cancelled | no-show
```

`confirmed` and `no-show` are new.

### Transition graph

| From | Action | Actor | To |
|---|---|---|---|
| `none` / `cancelled` / `completed` / `no-show` | `book-appointment` | patient | `scheduled` |
| `scheduled` | **`confirm-appointment`** *(new)* | patient | `confirmed` |
| `scheduled` / `confirmed` | `reschedule-appointment` | patient | `scheduled` *(re-confirmation required)* |
| `scheduled` / `confirmed` | `cancel-appointment` | patient | `cancelled` |
| `confirmed` | `check-in-appointment` **(moved to patient)** | **patient** | `checked-in` |
| `scheduled` / `confirmed` | **`no-show-appointment`** *(new)* | staff | `no-show` |
| `checked-in` | `start-appointment` | staff | `in-progress` |
| `in-progress` | `complete-appointment` | staff | `completed` |

Two deliberate design rules worth stating because they create test cases:

- **Rescheduling un-confirms.** A confirmed appointment moved to a new time returns to
  `scheduled`, so the patient must confirm again. This mirrors every reference portal.
- **`check-in` requires `confirmed`, not `scheduled`.** The chain is
  book → confirm → check in. Attempting check-in from `scheduled` is a `409`.

### Action list — 13 becomes 16

| Patient (10) | Staff (6) |
|---|---|
| `book-appointment` | `start-appointment` |
| `confirm-appointment` ✨ | `complete-appointment` |
| `reschedule-appointment` | `no-show-appointment` ✨ |
| `cancel-appointment` | `approve-refill` |
| `check-in-appointment` ⬅ moved | `decline-refill` |
| `complete-intake` | `send-message` |
| `submit-intake` | `mark-messages-read` ✨ |
| `send-message` | |
| `update-insurance` | |
| `request-refill` | |
| `mark-messages-read` ✨ | |

### Intake gate

`complete-intake` and `submit-intake` currently succeed unconditionally
(`lib/demo-state.ts:352, :361`). New precondition: `appointmentStatus` must be one of
`scheduled | confirmed | checked-in`. Otherwise `409` — *"Book an appointment before completing
your pre-visit questions."*

### New `DemoState` fields

```ts
appointmentProvider: AppointmentProvider | null;   // "Dr. Ana Costa" | "Dr. John Lima"
appointmentSpecialty: AppointmentSpecialty | null; // "Primary Care" | "Cardiology" | "Dermatology"
lastRead: { patient: string | null; staff: string | null };  // last-read DemoMessage id
```

`appointmentProvider` / `appointmentSpecialty` make the two decorative booking selects real
(C1a, E5 — they currently lack a `name` attribute, so `FormData` omits them). Both are set by
`book-appointment` and `reschedule-appointment`, and cleared on `cancel-appointment`.

`lastRead` replaces the badge that counts your own sent messages (C1e). Unread for role *R* =
messages after `lastRead[R]` whose `sender !== R`. `mark-messages-read` fires when the Messages
destination mounts.

### Every previously-fabricated value, and what now backs it

| Fabricated today | Line | Derived from |
|---|---|---|
| Progress ring "75%" / "3 of 4 tasks completed" | `:774-775` | Count of completed visit tasks: appointment booked, appointment confirmed, intake submitted, checked in |
| "Complete your form before your next appointment." | `:775` | Only rendered when `intakeSubmission === null` **and** an active appointment exists |
| Staff "12"/"13" appointments, "4 waiting" | `:832` | `staffAppointments.length`; "waiting" = rows with status `confirmed` |
| Staff "2"/"3" pending refills | `:833` | `refillStatus === "pending" ? 1 : 0` — no fabricated floor |
| Staff "5"/"6" forms, "2 new today" | `:834` | `intakeSubmission === null ? 0 : 1` |
| Three hardcoded activity rows | `:767-770` | Conditional on state: intake row only when `intakeSubmission !== null`, using its real `submittedAt`; refill row only when `refillStatus !== "none"` |
| Hardcoded red notification dot on a handler-less bell | `:466` | **Deleted.** Unread signal already lives on the Messages badge |
| "Ongoing medication · Last refill 30 days ago." | `:843` | **Deleted** (no data source can exist) |
| Message badge `{messages.length}` | `:443` | Unread count from `lastRead` |

Rule for the phase: **if a value cannot be traced to a `DemoState` field, it is deleted, not
restyled.**

---

## 3. Token layer

### Type scale — 24 sizes become 7, floor raised to 12px

```css
--text-xs:   12px;  /* absorbs today's 8, 9, 10, 11, 12 */
--text-sm:   14px;
--text-base: 16px;
--text-lg:   20px;
--text-xl:   25px;
--text-2xl:  31px;
--text-3xl:  39px;
```

Ratio 1.25. This eliminates the entire ≤11px band — 67 declarations today (B1), including the
**8px primary mobile-nav label** at `globals.css:361` and the five 9px rules. It also removes the
contiguous 8→22px integer run whose 1px steps were below the just-noticeable difference.

The four `clamp()` display sizes (`globals.css:25, 36, 84, 192`) may stay as clamps but must
interpolate between scale steps.

### Spacing scale — 54 values become 8

```css
--space-1: 4px;   --space-5: 24px;
--space-2: 8px;   --space-6: 32px;
--space-3: 12px;  --space-7: 48px;
--space-4: 16px;  --space-8: 64px;
```

Replaces 304 hardcoded values across 54 distinct numbers, 36 of which were off any 4px grid (B2).
Sidebar width becomes a token too — it is currently duplicated as a literal at
`globals.css:47, 71, 133, 140, 355`.

### Color — 141 values become ~16 tokens

The single highest-leverage change in the whole redesign:

```css
--muted: #5c6b71;   /* replaces #718087 */
```

Verified with the audit's own arithmetic: `L(#5c6b71) = 0.13987`.
- On `#ffffff` (L=1.0): `1.05 / 0.18987` = **5.53:1** ✓
- On `#eef7f5` (L=0.9035), the worst tinted panel: `0.9535 / 0.18987` = **5.02:1** ✓

Both clear 4.5:1 with margin, where the current `#718087` peaked at 4.09:1 and bottomed at 3.75:1.
**This one edit clears 39 of the 59 AA failures.**

Collapse targets:

| Cluster | Today | Target |
|---|---|---|
| Near-white surfaces | 12 | 3 — `--surface: #fff`, `--canvas: #f4f8f7`, `--surface-sunken: #eef7f5` |
| Gray text | 8 | 1 — `--muted` |
| Pale mint tints | 14 | 2 |
| Border grays | 9 | 2 |
| Dark greens | 6 | 2 |
| Accent (teal, coral, blue) | — | keep `--teal`, `--coral`, `--blue` |

The remaining named failures need individual fixes, since they are not `--muted`:
`.nav-badge` white-on-`#e88069` at **2.72:1** (`:62`), `.date-note` `#8c999d` at **2.74:1**
(`:116`), `.message-bubble time` `#89979a` at **2.87:1** (`:125`), `.nav-label` `#8b999d` at
**2.88:1** (`:57`), `.mobile-nav button` `#899598` at **3.08:1** (`:361`), `.privacy-copy`
`#7f8e92` at **3.32:1** (`:43`), and `.care-mark` icon at **2.84:1** (`:115`).

**Guard:** after the token layer lands, a grep for hex literals outside the `:root` block must
return zero. Today it returns 101.

### Focus system

`:focus-visible` appears **0 times** today; only 3 `:focus` rules exist, all on text inputs (E3).

```css
:where(button, a, select, textarea, input, [tabindex]):focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}
/* the two label-wrapped radio groups, whose inputs are opacity:0 */
.time-options label:has(input:focus-visible),
.account-role-picker label:has(input:focus-visible) {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}
```

The `:has()` rules are mandatory, not optional — those two groups currently have **no visible
focus at all**, and one of them is the appointment-time picker the E2E suite drives.

### Touch targets — 22 of 31 rules are under 44×44px today (B5)

Floor: **44×44**. Named fixes: `.modal-close` 31→44, `.icon-button` 35→44,
`.toast button` 22→44, `.schedule-row > button` 25→44, `.request-actions button` 34→44,
`.account-tabs button` 40→44, `.time-options label` 40→48, and the four 43px near-misses
(`.account-role-picker label`, `.skip-mfa-button`, `.danger-button`, `.modal select`).
The six `padding: 0` text buttons (~13px tall) need real hit areas.

Add a `@media (pointer: coarse)` query — there is none today. The file has **4** media queries:
three width-only (`min-width: 1000px` at `globals.css:131-350`, `max-width: 900px` at `:352-356`,
`max-width: 680px` at `:358-362`) plus `prefers-reduced-motion` at `:364`. Nothing adapts to input
type.

### Editing constraints discovered in `app/globals.css`

These govern *how* the token layer can be applied safely:

- **The file has zero comments and no section markers.** The only anchors are 16 blank lines
  (14, 21, 31, 45, 55, 70, 80, 94, 105, 111, 117, 121, 130, 351, 357, 363), which are the de facto
  section boundaries.
- **The `min-width: 1000px` block is 220 lines — 60% of the file** — and is purely font-size and
  padding scale-ups, written one-declaration-per-line unlike the rest. It is the single biggest
  candidate for collapse: once type and spacing are tokens with `clamp()`, most of it disappears.
- `--white` is declared and never referenced; the keyword `white` is used 39 times.

### States to add

| State | Today | Target |
|---|---|---|
| Empty | 1 instance in the whole app | Message thread, activity list, staff schedule, request queue, health-record list |
| Error | form-level only; `aria-invalid` appears **0 times** | Field-level marking on every input |
| Focus | browser default / absent | Above |
| Active/pressed | **0** `:active` rules | One `:active` treatment on buttons |
| Dark mode | `prefers-color-scheme` → **0 matches** | Out of scope this pass — but the token layer makes it reachable, which it is not today |

---

## 4. One shared `Modal`

Nine hand-copied shells (`:589, 871, 880, 889, 925, 929, 956, 976, 997`) share zero code and all
nine lack a focus trap, initial focus, focus restore, and Escape-to-close (E3). One component
must provide all four, plus:

- Stop `onMouseDown` backdrop dismissal from silently destroying typed input (C4.2) — the
  `AccountModal` case destroys a typed password and the word DELETE. Dismissal on backdrop click
  is only safe for read-only dialogs; form dialogs require an explicit close.
- Replace the 9 modal booleans (`:97-102`, `:812-814`) with one `activeModal` discriminant.

## 5. Preserve list — must still hold afterward

`lib/demo-state.ts` stays a pure function (extend, do not rewrite); the `swagger-ui` dynamic
import at `ApiDocs.tsx:29-46`; the `prefers-reduced-motion` reset at `globals.css:364`; 21/21
labelled form controls; 9/9 dialogs with resolving `aria-labelledby`; 13/13 named icon buttons;
zero `onClick` on non-interactive elements; zero `tabIndex` attributes.

## 6. Also fix (independent of the IA decision)

- `dist/og.png` — 1,517,095 B deployed, never requested; `vercel-frontend/index.html` has no
  `og:image` meta.
- The exported CSV (`:932-953`) carries no fictional-data marker.
- `globals.css:361` hides `.date-note` at ≤680px, removing the **only** demo disclosure from the
  patient Home on mobile.
- The MFA email (`lib/auth.ts:215-216`, `:296-316`) has no demo marker.
- Every patient sees Maria Lopez's name and clinical record as their own (`:773, :906, :929,
  :956, :993`).
- `.sidebar-user` (`:452`) signs out on whole-row click with no confirmation, while only the small
  teal text looks clickable — and `.top-user` (`:467`) uses the identical pattern to open settings.
- "Cancel appointment" (`:871`) sits under "Save new time" in the same dialog.
- Add `eslint-plugin-jsx-a11y` and axe — no automated a11y check exists.
