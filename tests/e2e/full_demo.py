import os
import shutil
import signal
import socket
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "test-results" / "e2e"
DEV_VARS = ROOT / ".dev.vars"
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:4173")
PARSED_BASE_URL = urlparse(BASE_URL)
HOST = PARSED_BASE_URL.hostname or "127.0.0.1"
PORT = PARSED_BASE_URL.port or 4173


AXE = Axe()
# Rules the audit and the redesign explicitly own. Failing any of these is a
# regression, not a new discovery.
AXE_RULES = [
  "aria-allowed-attr",
  "aria-required-attr",
  "aria-roles",
  "aria-valid-attr-value",
  "button-name",
  "color-contrast",
  "duplicate-id-aria",
  "empty-table-header",
  "form-field-multiple-labels",
  "html-has-lang",
  "label",
  # Landmark structure, added once the shell had real banner/main/contentinfo.
  "landmark-one-main",
  "landmark-unique",
  "region",
  "bypass",
  "page-has-heading-one",
  "skip-link",
  "link-name",
  "list",
  "select-name",
  "th-has-data-cells",
]


def audit_surface(page: Page, surface: str) -> None:
  """Fail the deploy on any violation of the rules this redesign owns.

  Semantics and geometry both, because a surface can be perfectly accessible
  and still render wrong: axe reads the DOM and the colours, never where an
  element actually landed.
  """
  results = AXE.run(
    page,
    # The Swagger console is vendor DOM (swagger-ui-react); its violations are
    # not ours to fix and must not gate this deploy.
    context={"exclude": [[".api-docs-console"]]},
    options={
      "runOnly": {"type": "rule", "values": AXE_RULES},
      # "incomplete" matters as much as "violations": axe declines to judge
      # contrast when it cannot resolve the background, which is exactly what a
      # gradient does. Ignoring it once reported a fully unreadable hero card as
      # clean. Anything axe cannot judge is asserted by measure_contrast below.
      "resultTypes": ["violations", "incomplete"],
    },
  )
  violations = results.response.get("violations", [])
  undetermined = [
    node["target"]
    for entry in results.response.get("incomplete", [])
    if entry["id"] == "color-contrast"
    for node in entry["nodes"]
  ]
  if violations:
    lines = []
    for violation in violations:
      targets = [node["target"] for node in violation["nodes"]]
      lines.append(f"  {violation['id']} ({violation['impact']}): {violation['help']}")
      for target in targets[:4]:
        lines.append(f"    at {target}")
    detail = "\n".join(lines)
    raise AssertionError(f"axe violations on {surface}:\n{detail}")
  for target in undetermined:
    measure_contrast(page, target[0] if isinstance(target, list) else target, surface)
  assert_avatars_fit(page, surface)
  suffix = f" ({len(undetermined)} gradient nodes measured directly)" if undetermined else ""
  print(f"  audited: {surface}{suffix}")


def assert_avatars_fit(page: Page, surface: str) -> None:
  """No avatar may overlap what sits beside it.

  Four grids reserve a fixed column for an avatar. The `min-width: 1000px` block
  grows the avatar from --space-6 to --space-7; the schedule row and the request
  card grow their columns with it and the conversation header is already wide
  enough, but the patient directory was missed, so on desktop its avatars
  overhung the names beside them by 4px. Nothing else in the gate can see that:
  the DOM is valid, the accessible names are right, the contrast passes.
  """
  overlaps = page.evaluate(
    """() => Array.from(document.querySelectorAll('.patient-avatar')).flatMap(avatar => {
      const next = avatar.nextElementSibling;
      if (!next) return [];
      const own = avatar.getBoundingClientRect();
      const beside = next.getBoundingClientRect();
      if (own.right <= beside.left + 0.5) return [];
      return [{
        container: avatar.parentElement.closest('[class]').className,
        overlapPx: Math.round(own.right - beside.left),
      }];
    })"""
  )
  assert overlaps == [], f"avatar overlaps its neighbour on {surface}: {overlaps}"


MIN_CONTRAST = 4.5


def _relative_luminance(rgb: tuple[float, float, float]) -> float:
  channels = []
  for raw in rgb:
    c = raw / 255
    channels.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def measure_contrast(page: Page, selector: str, surface: str) -> None:
  """Assert contrast for a node axe could not judge.

  Samples every gradient stop behind the text. Translucent stops are composited
  over each opaque stop rather than treated as solid, because a radial highlight
  at 24% alpha is not its own colour - reading it as opaque produced a false
  failure on the auth gradient.
  """
  sample = page.evaluate(
    r"""(selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const parse = (value) => {
        const parts = value.match(/[\d.]+/g).map(Number);
        return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
      };
      let el = node, stops = null;
      while (el && !stops) {
        const style = getComputedStyle(el);
        if (style.backgroundImage !== "none") {
          const found = (style.backgroundImage.match(/rgba?\([^)]*\)/g) || [])
            .map(parse)
            .filter(s => s.alpha > 0);
          if (found.length) stops = found;
        } else if (style.backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(style.backgroundColor)) {
          stops = [parse(style.backgroundColor)];
        }
        el = el.parentElement;
      }
      return stops ? { color: parse(getComputedStyle(node).color).rgb, stops } : null;
    }""",
    selector,
  )
  if sample is None:
    return

  opaque = [s["rgb"] for s in sample["stops"] if s["alpha"] >= 1]
  translucent = [s for s in sample["stops"] if s["alpha"] < 1]
  if not opaque:
    return

  candidates = list(opaque)
  for stop in translucent:
    for base in opaque:
      candidates.append([
        stop["alpha"] * stop["rgb"][i] + (1 - stop["alpha"]) * base[i]
        for i in range(3)
      ])

  foreground = _relative_luminance(sample["color"])
  for background_rgb in candidates:
    background = _relative_luminance(background_rgb)
    lighter, darker = max(foreground, background), min(foreground, background)
    ratio = (lighter + 0.05) / (darker + 0.05)
    assert ratio >= MIN_CONTRAST, (
      f"contrast {ratio:.2f}:1 on {surface} at {selector} (text "
      f"{sample['color']} on background {[round(c) for c in background_rgb]}); "
      f"needs {MIN_CONTRAST}:1"
    )


def wait_for_server(process: subprocess.Popen, timeout_seconds: int = 60) -> None:
  deadline = time.monotonic() + timeout_seconds
  while time.monotonic() < deadline:
    if process.poll() is not None:
      raise RuntimeError(
        f"Development server exited early with code {process.returncode}."
      )
    try:
      with socket.create_connection((HOST, PORT), timeout=1):
        return
    except OSError:
      time.sleep(0.25)
  raise TimeoutError(f"Development server did not open port {PORT}.")


def sign_in(page: Page, role: str, email: str, password: str) -> None:
  page.goto(BASE_URL)
  page.wait_for_load_state("networkidle")
  page.get_by_role("button", name="QA API documentation").wait_for()
  if role == "staff":
    page.get_by_role("button", name="Employee", exact=True).click()
  page.get_by_label("Email address").fill(email)
  page.get_by_label("Password").fill(password)
  page.get_by_role(
    "button", name="Sign in without two-factor authentication"
  ).click()
  heading = "Good morning, Daniel." if role == "staff" else "Hello, Maria."
  page.get_by_role("heading", name=heading).wait_for()


def verify_tooltips(page: Page) -> None:
  """A tooltip describes, is reachable by keyboard, and dismisses with Escape.

  It arrived as a request for hover text. Hover-only would be unreachable by
  keyboard and undismissable (WCAG 2.1 1.4.13), and an `aria-label` on a wrapper
  would have replaced the control's own name, so it ships wider than asked: the
  bubble opens on keyboard focus too, Escape hides it without closing the page
  behind it, and it is wired with `aria-describedby`.
  """
  switch = page.get_by_role("switch", name="Dark mode")
  assert switch.get_attribute("aria-describedby") is None, (
    "the tooltip is described before anything pointed at it"
  )

  switch.hover()
  tip = page.locator(".tooltip")
  tip.wait_for()
  assert switch.get_attribute("aria-describedby") == tip.get_attribute("id")
  assert tip.inner_text().startswith("Switch to the ")
  # Described, never named: the switch keeps the name it had.
  assert switch.get_attribute("aria-label") == "Dark mode"
  page.mouse.move(0, 0)
  tip.wait_for(state="detached")

  # The keyboard path, and Escape on it.
  page.evaluate("() => document.activeElement instanceof HTMLElement && document.activeElement.blur()")
  for _ in range(40):
    page.keyboard.press("Tab")
    if page.evaluate("() => document.activeElement?.getAttribute('role') === 'switch'"):
      break
  else:
    raise AssertionError("the theme switch is not reachable by keyboard")
  tip.wait_for()
  page.keyboard.press("Escape")
  tip.wait_for(state="detached")
  # Escape dismissed the tooltip and nothing else: the theme did not toggle and
  # the page is still here.
  assert switch.get_attribute("aria-checked") == "false"
  page.get_by_role("heading", name="Good morning, Daniel.").wait_for()


def verify_logo_goes_home(page: Page, home: str) -> None:
  """The logo a reviewer clicked. Both marks go to the role's home destination."""
  sidebar(page, "Requests")
  page.get_by_role("heading", name="Requests", exact=True).wait_for()
  page.get_by_role("button", name=f"Luma Health — back to {home}").click()
  page.get_by_role("heading", name="Good morning, Daniel.").wait_for()


def verify_avatar_quick_profile(page: Page) -> None:
  """Patient initials open that patient's card, not the generic directory.

  The schedule holds five different patients, so the assertion has to be that
  the avatar carried its own identity through - opening the directory on
  whoever happened to be first would pass a weaker check.
  """
  page.get_by_role("button", name="Quick profile for Riley Smith").click()
  dialog = page.get_by_role("dialog", name="Riley Smith")
  dialog.wait_for()
  dialog.get_by_text("March 30, 1995", exact=True).wait_for()
  # And it is the directory dialog, so the rest of it is still reachable.
  dialog.get_by_role("button", name="Back to results").click()
  page.get_by_role("dialog", name="Search patients").wait_for()
  page.locator(".patient-search-modal").get_by_role("button", name="Close").last.click()
  page.locator(".modal-backdrop").wait_for(state="detached")


def verify_patient_search(page: Page) -> None:
  """The patient directory: a surface the gate never opened until it broke.

  Both defects a reviewer found here were invisible to every other check. The
  search field is composed - the wrapper draws the box, the icon sits inside it
  - so the control itself must stay bare; a broad `.modal input` rule outranked
  the field's own rule and painted a second bordered, padded box inside the
  first. Assert the computed style, not a screenshot: the point is that what the
  component authored is what the browser applied.
  """
  page.get_by_role("button", name="Search patients").click()
  # The dialog is labelled by its heading, so its accessible name changes from
  # "Search patients" to the patient's once a result is opened. Hold the
  # container by class and let the role query stay honest about the name.
  page.get_by_role("dialog", name="Search patients").wait_for()
  dialog = page.locator(".patient-search-modal")
  result = dialog.get_by_role("button", name="Maria Lopez")
  result.wait_for()

  painted = page.evaluate(
    r"""() => {
      const input = document.querySelector('.patient-search-input input');
      const style = getComputedStyle(input);
      return Object.entries({
        borderTopWidth: style.borderTopWidth,
        borderTopStyle: style.borderTopStyle,
        paddingTop: style.paddingTop,
        marginTop: style.marginTop,
        backgroundColor: style.backgroundColor,
      }).filter(([key, value]) => !(
        key === 'backgroundColor' ? /rgba\(0, 0, 0, 0\)|transparent/.test(value)
        : key === 'borderTopStyle' ? value === 'none'
        : parseFloat(value) === 0
      ));
    }"""
  )
  assert painted == [], (
    f"the search control is painting its own box, not staying inside the "
    f"wrapper's: {painted}"
  )

  audit_surface(page, "staff · patient directory")

  result.click()
  page.get_by_role("dialog", name="Maria Lopez").wait_for()
  audit_surface(page, "staff · patient profile")
  dialog.get_by_role("button", name="Close").last.click()


def sign_out(page: Page) -> None:
  # One account control, in the topbar: it is the only one present on phones,
  # where the sidebar is hidden. Sign-out is a labelled button inside the dialog.
  page.get_by_role("button", name="Account settings").click()
  page.get_by_role("dialog", name="Account settings").get_by_role(
    "button", name="Sign out"
  ).click()
  page.get_by_role("heading", name="Sign in to Luma Health").wait_for()


def sidebar(page: Page, item: str) -> None:
  # Scoped to the nav list, not the whole sidebar: the logo is a button now too,
  # and its label names the home destination, so "Home" matched both.
  page.locator(".sidebar .nav-item").filter(has_text=item).click()


def download_summary(page: Page) -> None:
  with page.expect_download() as download_info:
    page.get_by_role("button", name="Download CSV").click()
  download = download_info.value
  assert download.suggested_filename == "maria-lopez-visit-summary.csv"
  target = ARTIFACTS / download.suggested_filename
  download.save_as(target)
  content = target.read_text()
  for expected in [
    "Maria Lopez",
    "July 12, 2026",
    "Dr. Ana Costa",
    "Blood pressure stable",
    "Continue Losartan 50 mg",
    # The on-screen disclaimer does not travel with the file, so the file
    # carries its own.
    "Fictional demo data for QA training",
  ]:
    assert expected in content


def verify_api_docs(page: Page) -> None:
  response = page.goto(f"{BASE_URL}/api-docs")
  assert response is not None and response.status == 200
  page.wait_for_load_state("networkidle")
  page.get_by_role(
    "heading", name="Interactive API documentation"
  ).wait_for()
  page.locator(".swagger-ui .info .title").filter(
    has_text="Luma Health Demo API"
  ).wait_for()

  operation = page.locator("#operations-Authentication-getSession")
  operation.wait_for()
  operation.click()
  operation.get_by_role("button", name="Try it out").click()
  operation.get_by_role("button", name="Execute").click()
  operation.locator(".live-responses-table .response-col_status").get_by_text(
    "200", exact=True
  ).wait_for()

  contract = page.request.get(f"{BASE_URL}/openapi.json")
  assert contract.status == 200
  document = contract.json()
  assert document["openapi"].startswith("3.1.")
  assert len(document["paths"]) == 6


def run_scenario(page: Page) -> None:
  verify_api_docs(page)

  anonymous = page.request.get(f"{BASE_URL}/api/demo-state")
  assert anonymous.status == 401
  anonymous_delete = page.request.delete(
    f"{BASE_URL}/api/auth/account",
    data={"confirmation": "DELETE", "password": "irrelevant"},
  )
  assert anonymous_delete.status == 401

  page.goto(BASE_URL)
  page.wait_for_load_state("networkidle")
  audit_surface(page, "sign-in screen")

  sign_in(
    page,
    "patient",
    "patient.demo@testrigor-mail.com",
    "PatientDemo!2026",
  )
  reset = page.request.delete(f"{BASE_URL}/api/demo-state")
  assert reset.status == 200
  protected_delete = page.request.delete(
    f"{BASE_URL}/api/auth/account",
    data={
      "confirmation": "DELETE",
      "password": "PatientDemo!2026",
    },
  )
  assert protected_delete.status == 403
  assert protected_delete.json()["error"] == "Fixed demo accounts cannot be deleted."

  forbidden = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "approve-refill", "medicationId": "med-losartan"},
  )
  assert forbidden.status == 403

  # Refills are per medication, so an unaddressed request is malformed (400),
  # and an id that is not on file is malformed too.
  unaddressed_refill = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "request-refill"},
  )
  assert unaddressed_refill.status == 400
  unknown_medication = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "request-refill", "medicationId": "med-nope"},
  )
  assert unknown_medication.status == 400
  unknown_result = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "acknowledge-result", "resultId": "result-nope"},
  )
  assert unknown_result.status == 400
  # A statement pays once. The second attempt is out of sequence, not malformed.
  first_payment = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "pay-statement"},
  )
  assert first_payment.status == 200
  paid_twice = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "pay-statement"},
  )
  assert paid_twice.status == 409
  # Put the statement back so the UI walkthrough below still has one to pay.
  assert page.request.delete(f"{BASE_URL}/api/demo-state").status == 200

  # Pre-visit questions are bound to a visit: with no appointment this is a 409.
  intake_without_visit = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "complete-intake"},
  )
  assert intake_without_visit.status == 409

  # Check-in requires a confirmed appointment, and belongs to the patient.
  early_check_in = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "check-in-appointment"},
  )
  assert early_check_in.status == 409

  page.reload()
  page.wait_for_load_state("networkidle")
  page.get_by_role("button", name="Account settings").click()
  page.get_by_text("Protected demo account", exact=True).wait_for()
  page.get_by_text("Fixed accounts cannot be deleted").wait_for()
  page.screenshot(path=ARTIFACTS / "protected-account.png", full_page=True)
  page.get_by_role("dialog", name="Account settings").get_by_label("Close").click()
  page.get_by_role("button", name="Book appointment", exact=True).click()
  page.locator(".time-options label").filter(has_text="9:00 AM").click()
  page.get_by_role("button", name="Book this time").click()
  page.get_by_text("Appointment booked", exact=True).wait_for()

  # The two selects are real fields; a chosen provider must not be replaced by
  # the default in the read-only views.
  page.get_by_role("button", name="Manage appointment", exact=True).click()
  page.get_by_label("Provider").select_option("Dr. John Lima")
  page.get_by_label("Specialty").select_option("Cardiology")
  page.locator(".time-options label").filter(has_text="9:00 AM").click()
  page.get_by_role("button", name="Save new time").click()
  page.get_by_text("Appointment rescheduled", exact=True).wait_for()
  sidebar(page, "Appointments")
  page.get_by_text("Cardiology · Follow-up", exact=True).wait_for()
  page.get_by_text("Dr. John Lima · Room 204", exact=True).wait_for()
  sidebar(page, "Home")
  page.get_by_role("button", name="Manage appointment", exact=True).click()
  page.locator(".time-options label").filter(has_text="3:00 PM").click()
  page.get_by_role("button", name="Save new time").click()
  page.get_by_text("Appointment rescheduled", exact=True).wait_for()

  # Rescheduling invalidates any confirmation, so confirm after the final time.
  page.get_by_role("button", name="Confirm attendance").click()
  page.get_by_text("Attendance confirmed", exact=True).wait_for()

  sidebar(page, "Health record")
  page.get_by_role("button", name="Complete form").click()
  page.get_by_label("Reason for visit").select_option("New symptoms")
  page.get_by_label("Current symptoms").fill("Occasional headache after exercise")
  page.get_by_label("Medication changes").fill("Started vitamin D")
  page.get_by_label("Allergies").fill("Penicillin")
  page.get_by_role("button", name="Submit form").click()
  page.get_by_text("Form submitted", exact=True).wait_for()

  page.get_by_role("button", name="Update insurance").click()
  page.get_by_label("Insurance provider").fill("Demo Health")
  page.get_by_label("Plan name").fill("QA Gold")
  page.get_by_label("Member ID").fill("QA-9001")
  page.get_by_role("button", name="Save insurance").click()
  page.get_by_text("Insurance updated", exact=True).wait_for()

  # Refills live on their own destination now, because the request has to name
  # the medication it is for.
  sidebar(page, "Medications")
  audit_surface(page, "patient · medications")
  page.get_by_label("Request a refill for Losartan 50 mg").click()
  page.get_by_text("Request submitted", exact=True).wait_for()
  losartan = page.locator(".medication-row").filter(has_text="Losartan 50 mg")
  losartan.get_by_text("Awaiting review", exact=True).wait_for()
  # The other two medications must be untouched: one global refill field used to
  # make every medication share one outcome.
  metformin = page.locator(".medication-row").filter(has_text="Metformin 500 mg")
  metformin.get_by_text("No request", exact=True).wait_for()
  assert page.get_by_label("Request a refill for Metformin 500 mg").is_enabled()
  assert not page.get_by_label("Request a refill for Losartan 50 mg").is_enabled()

  sidebar(page, "Messages")
  page.get_by_label("Reply to your care team").fill(
    "I submitted the form. Should I bring my medication list?"
  )
  page.get_by_role("button", name="Send message").click()
  page.get_by_text(
    "I submitted the form. Should I bring my medication list?"
  ).wait_for()

  sidebar(page, "Health record")
  audit_surface(page, "patient · health record")
  # Both results start unread, and each card carries its own New marker.
  cbc = page.locator(".document-card").filter(has_text="Complete blood count")
  lipids = page.locator(".document-card").filter(has_text="Lipid panel")
  cbc.get_by_text("New", exact=True).wait_for()
  lipids.get_by_text("New", exact=True).wait_for()

  cbc.get_by_role("button", name="Open result").click()
  page.get_by_text("13.6 g/dL", exact=True).wait_for()
  page.get_by_text("6.4 K/uL", exact=True).wait_for()
  page.get_by_text("248 K/uL", exact=True).wait_for()
  audit_surface(page, "patient · lab result dialog")
  page.get_by_role("button", name="Done").click()

  # Opening it was the acknowledgement: that card loses New, the other keeps it.
  cbc.get_by_role("button", name="View result").wait_for()
  assert cbc.get_by_text("New", exact=True).count() == 0
  lipids.get_by_text("New", exact=True).wait_for()

  # The second result carries different values, so a hardcoded table would show.
  lipids.get_by_role("button", name="Open result").click()
  page.get_by_text("212 mg/dL", exact=True).wait_for()
  page.get_by_text("One value above range", exact=True).first.wait_for()
  page.get_by_role("button", name="Done").click()

  # Billing sits in the health record, and pays exactly once.
  billing = page.locator(".document-card").filter(has_text="Primary care follow-up")
  billing.get_by_text("Unpaid", exact=True).wait_for()
  billing.get_by_role("button", name="Pay statement").click()
  page.get_by_text("Statement paid", exact=True).wait_for()
  billing.get_by_text("Paid", exact=True).first.wait_for()
  assert not billing.get_by_role("button", name="Paid").is_enabled()
  page.get_by_role("button", name="Open summary").click()
  download_summary(page)
  page.locator(".clinical-modal").get_by_role(
    "button", name="Close"
  ).last.click()

  # Check-in is the patient's own step now, not a staff action.
  sidebar(page, "Home")
  audit_surface(page, "patient · home")
  page.get_by_role("button", name="Check in now").click()
  page.get_by_text("You are checked in", exact=True).wait_for()

  sign_out(page)
  sign_in(
    page,
    "staff",
    "employee.demo@testrigor-mail.com",
    "EmployeeDemo!2026",
  )
  page.get_by_role("button", name="Search patients").click()
  page.locator(".patient-results").get_by_role(
    "button", name="Maria Lopez"
  ).click()
  page.get_by_text("Checked in · 3:00 PM", exact=True).wait_for()
  page.get_by_text("Demo Health · QA Gold", exact=True).wait_for()
  page.get_by_role("button", name="Open visit summary").click()
  download_summary(page)
  page.locator(".clinical-modal").get_by_role(
    "button", name="Close"
  ).last.click()
  # Opening the summary closes the patient-search dialog, so only one
  # aria-modal dialog is ever mounted. Assert that instead of closing it again.
  assert page.locator('[role="dialog"]').count() == 0

  sidebar(page, "Requests")
  audit_surface(page, "staff · requests")
  page.locator(
    '[aria-label="Maria Lopez submitted intake form"]'
  ).get_by_role("button", name="Review form").click()
  page.get_by_text("Occasional headache after exercise").wait_for()
  page.get_by_text("Started vitamin D", exact=True).wait_for()
  page.get_by_text("Penicillin", exact=True).wait_for()
  page.get_by_role("button", name="Done").click()

  sidebar(page, "Messages")
  page.get_by_text(
    "I submitted the form. Should I bring my medication list?"
  ).wait_for()
  page.get_by_label("Reply to Maria Lopez").fill(
    "Yes, please bring the current medication list."
  )
  page.get_by_role("button", name="Send message").click()
  page.get_by_text(
    "Yes, please bring the current medication list."
  ).wait_for()

  sidebar(page, "Requests")
  page.get_by_label("Approve the refill for Losartan 50 mg").click()
  page.get_by_text("Refill approved", exact=True).wait_for()

  sidebar(page, "Today")
  audit_surface(page, "staff · today")
  verify_tooltips(page)
  verify_logo_goes_home(page, "Today")
  verify_avatar_quick_profile(page)
  verify_patient_search(page)

  # The portal appointment used to be spliced into the schedule at a fixed
  # index, so a 9:00 AM visit rendered after the 10:00 AM one.
  times = page.locator(".schedule-row > strong").all_inner_texts()
  minutes = []
  for label in times:
    hour, rest = label.strip().split(":")
    minute, meridiem = rest.split()
    minutes.append((int(hour) % 12 + (12 if meridiem.upper() == "PM" else 0)) * 60 + int(minute))
  assert minutes == sorted(minutes), f"clinic schedule is out of order: {times}"
  page.get_by_label("Review Maria Lopez's new appointment").click()
  page.get_by_role("button", name="Start visit").click()
  page.get_by_role("button", name="Complete visit").click()
  page.get_by_text("Visit completed", exact=True).wait_for()
  page.get_by_role("dialog", name="Appointment details").get_by_role(
    "button", name="Close"
  ).last.click()

  invalid_transition = page.request.patch(
    f"{BASE_URL}/api/demo-state",
    data={"action": "start-appointment"},
  )
  assert invalid_transition.status == 409

  # Reloading with a live staff session used to leave <main> empty, because the
  # restored session kept the patient's default destination, which staff has no
  # branch for. Assert the staff landing page survives a reload.
  page.reload()
  page.wait_for_load_state("networkidle")
  page.get_by_role("heading", name="Good morning, Daniel.").wait_for()
  assert page.locator("main#main-content").inner_text().strip() != ""

  sign_out(page)
  sign_in(
    page,
    "patient",
    "patient.demo@testrigor-mail.com",
    "PatientDemo!2026",
  )
  page.get_by_role("heading", name="Visit completed").wait_for()
  sidebar(page, "Medications")
  page.locator(".medication-row").filter(
    has_text="Losartan 50 mg"
  ).get_by_text("Approved", exact=True).wait_for()
  page.locator(".medication-row").filter(
    has_text="Metformin 500 mg"
  ).get_by_text("No request", exact=True).wait_for()
  sidebar(page, "Home")
  # The unread badge counts messages from the other role, not the thread length.
  page.locator(".sidebar .nav-item").filter(has_text="Messages1").wait_for()
  sidebar(page, "Messages")
  page.get_by_text(
    "Yes, please bring the current medication list."
  ).wait_for()

  final_reset = page.request.delete(f"{BASE_URL}/api/demo-state")
  assert final_reset.status == 200
  state = final_reset.json()["state"]
  assert state["appointmentStatus"] == "none"
  assert state["appointmentProvider"] is None
  assert state["appointmentSpecialty"] is None
  assert state["lastRead"] == {"patient": None, "staff": None}
  assert state["intakeSubmission"] is None
  assert len(state["messages"]) == 2
  assert state["insurance"]["memberId"] == "HF-2048"
  assert [med["refillStatus"] for med in state["medications"]] == ["none"] * 3
  assert [result["status"] for result in state["results"]] == ["new", "new"]
  assert state["statement"]["status"] == "unpaid"
  # The three fields the contract dropped must not come back through D1: an old
  # row still carries them, and getDemoState reads them without echoing them.
  for dropped in ("refillStatus", "appointmentBooked", "intakeComplete"):
    assert dropped not in state, f"{dropped} is back in the API response"


def main() -> None:
  ARTIFACTS.mkdir(parents=True, exist_ok=True)
  secret_created = False
  if not DEV_VARS.exists():
    secret = os.environ.get("E2E_MFA_SESSION_SECRET")
    if not secret:
      raise RuntimeError(
        "Create .dev.vars or set E2E_MFA_SESSION_SECRET before running E2E."
      )
    DEV_VARS.write_text(f"MFA_SESSION_SECRET={secret}\n")
    secret_created = True

  server_log = (ARTIFACTS / "server.log").open("w")
  process = subprocess.Popen(
    [
      "npm",
      "run",
      "dev",
      "--",
      "--host",
      HOST,
      "--port",
      str(PORT),
      "--strictPort",
    ],
    cwd=ROOT,
    stdout=server_log,
    stderr=subprocess.STDOUT,
    text=True,
    start_new_session=True,
  )

  try:
    wait_for_server(process)
    with sync_playwright() as playwright:
      browser = playwright.chromium.launch(headless=True)
      context = browser.new_context(
        viewport={"width": 1440, "height": 1050},
        accept_downloads=True,
      )
      context.tracing.start(screenshots=True, snapshots=True, sources=True)
      page = context.new_page()
      console_errors = []
      page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
      )
      try:
        run_scenario(page)
        assert console_errors == [], console_errors
        page.screenshot(path=ARTIFACTS / "completed.png", full_page=True)
        context.tracing.stop()
      except Exception:
        page.screenshot(path=ARTIFACTS / "failure.png", full_page=True)
        context.tracing.stop(path=ARTIFACTS / "trace.zip")
        raise
      finally:
        browser.close()
  finally:
    # npm spawns vinext as a child; terminating only the wrapper leaves the
    # server holding the port, which breaks the next run. Signal the group.
    try:
      os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
      process.terminate()
    try:
      process.wait(timeout=10)
    except subprocess.TimeoutExpired:
      try:
        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
      except (ProcessLookupError, PermissionError):
        process.kill()
      process.wait(timeout=5)
    server_log.close()
    if secret_created:
      DEV_VARS.unlink(missing_ok=True)

  print("Full deterministic demo E2E passed")


if __name__ == "__main__":
  main()
