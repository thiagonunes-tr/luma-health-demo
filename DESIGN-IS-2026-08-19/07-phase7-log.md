# 07 — Phase 7: the items the first six phases left open

Phases 1-6 executed `06-plan.md`. A review afterwards found that the plan itself had
under-scoped two dimensions: four accessibility findings from `01-evidence.md` §E were never in
the plan, and principle #4 (understandable) had no phase at all. Phase 7 closed both.

## A. Landmark structure and keyboard entry (#8 thorough)

| Finding (from `01-evidence.md` §E3-E4) | Fix |
|---|---|
| No skip link, and no `.sr-only` utility to build one | `shared/LumaApp.tsx` renders `<a className="skip-link" href="#main-content">` as the first focusable element; `app/globals.css` keeps it offscreen via `transform` until `:focus-visible` |
| `<main>` wrapped the sidebar, so navigation was inside main content | The shell is now a `<div className="app-shell">`; `<main id="main-content">` wraps only the destination |
| `<header className="topbar">` was not a `banner` — it nested inside `<section className="workspace">` | `workspace` is a `<div>`, so the header maps to `banner` with no explicit role |
| No `contentinfo` | A single `<footer className="app-footer">` carries the demo disclosure, replacing five per-destination `.date-note` paragraphs |
| `<aside aria-label="Main navigation">` named a `complementary` landmark as navigation, while the real `<nav>` was unnamed | The `aria-label` moved to the `<nav>`; the `<aside>` is unnamed |
| 12 of 15 `<section>` elements had no accessible name and exposed as `generic` | Five layout-only groupings became `<div>`; five genuine regions gained an `aria-label` |
| `.mobile-nav` was DOM-last while being the only navigation below 680px | Moved to immediately after the skip link |

## B. Copy (#4 understandable)

- **Role vocabulary: four words became one.** "Employee access" → "Clinic staff portal";
  "Administrator" → "Clinic staff"; the account dialog's "Employee" → "Clinic staff". The
  sign-in *account type* tab remains "Employee" because it names the account type the docs and
  credentials use, not the signed-in person.
- **Clinical jargon glossed.** "Complete blood count" gained "A routine blood test measuring red
  cells, white cells, and platelets"; "Losartan 50 mg" gained "(blood pressure medicine)" at
  three sites.
- **EHR shorthand replaced.** "Intake form" → "Pre-visit questions"; "PRE-VISIT" → "BEFORE YOUR
  VISIT"; "Demo thread" → "Sample conversation"; "Predictable demo records/summary/content/profile
  · No real patient data" → "Sample data · Not a real patient".
- **Raw API errors no longer reach patient toasts.** `friendlyActionError` maps `403` and `401` to
  plain language. The API strings themselves are unchanged — they are the documented contract and
  unit tests assert them.
- **A promise with nothing behind it was removed.** "Need help? / Contact our team" became "Demo
  environment / No support channel exists", because no contact method exists anywhere in the app.

## C. Enforcement added

The axe rule list in `tests/e2e/full_demo.py` grew from 15 to 22 rules, adding
`landmark-one-main`, `landmark-unique`, `region`, `bypass`, `page-has-heading-one`, and
`skip-link`. All six audited surfaces pass.

## D. Runtime probe

Structure of this kind cannot be confirmed by reading, so a disposable probe drove a real browser
and asserted the behaviour directly. 10/10:

```
[PASS] exactly one <main> (1)
[PASS] <main> has the skip target id (main-content)
[PASS] a <footer> exists for contentinfo (1)
[PASS] navs are named ['Primary', 'Main navigation']
[PASS] sidebar <aside> no longer claims to be nav (None)
[PASS] topbar <header> maps to banner (no sectioning ancestor)
[PASS] skip link is offscreen until focused
[PASS] skip link is the FIRST tab stop (skip-link)
[PASS] skip link targets main content (#main-content)
[PASS] mobile nav is early in tab order (stop 2 of 10, was last)
```

## Still open after Phase 7

- **Dark mode.** `prefers-color-scheme` appears nowhere; `prefers-contrast` and `forced-colors`
  likewise. Recorded as a decision in `docs/DEVELOPER_HANDOFF.md` §12, not an oversight.
- **`public/og.png` is 1,517,095 bytes at 1731×909** — roughly ten times what those dimensions
  warrant. It is now referenced (`vercel-frontend/index.html`), so it is no longer orphaned, but it
  was not re-encoded: that is a change to a branding asset and belongs to the owner.
- **No component tests for `shared/LumaApp.tsx`.** The browser suite is the only safety net for UI
  work.
- **The shared-record notice is verified by inspection, not by the gate**, because it renders only
  for a personal account and creating one requires a real MFA email.
- **Touch-target compliance is verified by inspection**, not measured at runtime — the axe rules
  enabled do not cover target size.
