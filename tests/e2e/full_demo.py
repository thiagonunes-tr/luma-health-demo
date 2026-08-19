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


def audit_accessibility(page: Page, surface: str) -> None:
  """Fail the deploy on any violation of the rules this redesign owns."""
  results = AXE.run(
    page,
    # The Swagger console is vendor DOM (swagger-ui-react); its violations are
    # not ours to fix and must not gate this deploy.
    context={"exclude": [[".api-docs-console"]]},
    options={
      "runOnly": {"type": "rule", "values": AXE_RULES},
      "resultTypes": ["violations"],
    },
  )
  violations = results.response.get("violations", [])
  if violations:
    lines = []
    for violation in violations:
      targets = [node["target"] for node in violation["nodes"]]
      lines.append(f"  {violation['id']} ({violation['impact']}): {violation['help']}")
      for target in targets[:4]:
        lines.append(f"    at {target}")
    detail = "\n".join(lines)
    raise AssertionError(f"axe violations on {surface}:\n{detail}")
  print(f"  axe clean: {surface}")


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
  heading = "Good morning, Thiago." if role == "staff" else "Hello, Maria."
  page.get_by_role("heading", name=heading).wait_for()


def sign_out(page: Page) -> None:
  # The sidebar row opens Account settings; sign-out is a labelled button inside.
  page.locator(".sidebar-user").click()
  page.get_by_role("dialog", name="Account settings").get_by_role(
    "button", name="Sign out"
  ).click()
  page.get_by_role("heading", name="Sign in to Luma Health").wait_for()


def sidebar(page: Page, item: str) -> None:
  page.locator(".sidebar").get_by_role("button", name=item).click()


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
  audit_accessibility(page, "sign-in screen")

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
    data={"action": "approve-refill"},
  )
  assert forbidden.status == 403

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
  page.locator(".sidebar").get_by_role("button", name="Appointments").click()
  page.get_by_text("Cardiology · Follow-up", exact=True).wait_for()
  page.get_by_text("Dr. John Lima · Room 204", exact=True).wait_for()
  page.locator(".sidebar").get_by_role("button", name="Home").click()
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

  sidebar(page, "Home")
  page.get_by_role("button", name="Request a refill").click()
  page.get_by_text("Request submitted", exact=True).wait_for()

  sidebar(page, "Messages")
  page.get_by_label("Reply to your care team").fill(
    "I submitted the form. Should I bring my medication list?"
  )
  page.get_by_role("button", name="Send message").click()
  page.get_by_text(
    "I submitted the form. Should I bring my medication list?"
  ).wait_for()

  sidebar(page, "Health record")
  audit_accessibility(page, "patient · health record")
  page.get_by_role("button", name="View result").click()
  page.get_by_text("13.6 g/dL", exact=True).wait_for()
  page.get_by_text("6.4 K/uL", exact=True).wait_for()
  page.get_by_text("248 K/uL", exact=True).wait_for()
  audit_accessibility(page, "patient · lab result dialog")
  page.get_by_role("button", name="Done").click()
  page.get_by_role("button", name="Open summary").click()
  download_summary(page)
  page.locator(".clinical-modal").get_by_role(
    "button", name="Close"
  ).last.click()

  # Check-in is the patient's own step now, not a staff action.
  sidebar(page, "Home")
  audit_accessibility(page, "patient · home")
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
  audit_accessibility(page, "staff · requests")
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
  page.get_by_role("button", name="Approve").click()
  page.get_by_text("Refill approved", exact=True).wait_for()

  sidebar(page, "Today")
  audit_accessibility(page, "staff · today")
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
  page.get_by_role("heading", name="Good morning, Thiago.").wait_for()
  assert page.locator("main#main-content").inner_text().strip() != ""

  sign_out(page)
  sign_in(
    page,
    "patient",
    "patient.demo@testrigor-mail.com",
    "PatientDemo!2026",
  )
  page.get_by_role("heading", name="Visit completed").wait_for()
  page.get_by_text("Refill approved by the clinic", exact=True).wait_for()
  # The unread badge counts messages from the other role, not the thread length.
  page.locator(".sidebar").get_by_role("button", name="Messages 1").wait_for()
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
  assert state["refillStatus"] == "none"
  assert len(state["messages"]) == 2
  assert state["insurance"]["memberId"] == "HF-2048"


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
