import os
import shutil
import socket
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "test-results" / "e2e"
DEV_VARS = ROOT / ".dev.vars"
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:4173")
PARSED_BASE_URL = urlparse(BASE_URL)
HOST = PARSED_BASE_URL.hostname or "127.0.0.1"
PORT = PARSED_BASE_URL.port or 4173


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
  page.locator(".sidebar-user").click()
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
  ]:
    assert expected in content


def run_scenario(page: Page) -> None:
  anonymous = page.request.get(f"{BASE_URL}/api/demo-state")
  assert anonymous.status == 401
  anonymous_delete = page.request.delete(
    f"{BASE_URL}/api/auth/account",
    data={"confirmation": "DELETE", "password": "irrelevant"},
  )
  assert anonymous_delete.status == 401

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

  page.reload()
  page.wait_for_load_state("networkidle")
  page.get_by_role("button", name="Account settings").click()
  page.get_by_text("Protected demo account", exact=True).wait_for()
  page.get_by_text("Fixed accounts cannot be deleted").wait_for()
  page.screenshot(path=ARTIFACTS / "protected-account.png", full_page=True)
  page.get_by_role("dialog", name="Account settings").get_by_label("Close").click()
  page.get_by_role("button", name="Book appointment", exact=True).click()
  page.locator(".time-options label").filter(has_text="9:00 AM").click()
  page.get_by_role("button", name="Confirm appointment").click()
  page.get_by_text("Appointment booked", exact=True).wait_for()
  page.get_by_role("button", name="Manage appointment", exact=True).click()
  page.locator(".time-options label").filter(has_text="3:00 PM").click()
  page.get_by_role("button", name="Save new time").click()
  page.get_by_text("Appointment rescheduled", exact=True).wait_for()

  page.get_by_role("button", name="Intake form").click()
  page.get_by_label("Reason for visit").select_option("New symptoms")
  page.get_by_label("Current symptoms").fill("Occasional headache after exercise")
  page.get_by_label("Medication changes").fill("Started vitamin D")
  page.get_by_label("Allergies").fill("Penicillin")
  page.get_by_role("button", name="Submit form").click()
  page.get_by_text("Form submitted", exact=True).wait_for()

  sidebar(page, "Forms")
  page.get_by_role("button", name="Update insurance").click()
  page.get_by_label("Insurance provider").fill("Demo Health")
  page.get_by_label("Plan name").fill("QA Gold")
  page.get_by_label("Member ID").fill("QA-9001")
  page.get_by_role("button", name="Save insurance").click()
  page.get_by_text("Insurance updated", exact=True).wait_for()

  sidebar(page, "Overview")
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

  sidebar(page, "Results")
  page.get_by_role("button", name="View result").click()
  page.get_by_text("13.6 g/dL", exact=True).wait_for()
  page.get_by_text("6.4 K/uL", exact=True).wait_for()
  page.get_by_text("248 K/uL", exact=True).wait_for()
  page.get_by_role("button", name="Done").click()
  page.get_by_role("button", name="Open summary").click()
  download_summary(page)
  page.locator(".clinical-modal").get_by_role(
    "button", name="Close"
  ).last.click()

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
  page.get_by_text("Scheduled · 3:00 PM", exact=True).wait_for()
  page.get_by_text("Demo Health · QA Gold", exact=True).wait_for()
  page.get_by_role("button", name="Open visit summary").click()
  download_summary(page)
  page.locator(".clinical-modal").get_by_role(
    "button", name="Close"
  ).last.click()
  page.get_by_label("Close").click()

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

  sidebar(page, "Overview")
  page.get_by_role("button", name="Approve").click()
  page.get_by_text("Refill approved", exact=True).wait_for()
  page.get_by_label("Review Maria Lopez's new appointment").click()
  page.get_by_role("button", name="Check in patient").click()
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

  sign_out(page)
  sign_in(
    page,
    "patient",
    "patient.demo@testrigor-mail.com",
    "PatientDemo!2026",
  )
  page.get_by_role("heading", name="Visit completed").wait_for()
  page.get_by_text("Refill approved by the clinic", exact=True).wait_for()
  sidebar(page, "Messages")
  page.get_by_text(
    "Yes, please bring the current medication list."
  ).wait_for()

  final_reset = page.request.delete(f"{BASE_URL}/api/demo-state")
  assert final_reset.status == 200
  state = final_reset.json()["state"]
  assert state["appointmentStatus"] == "none"
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
    process.terminate()
    try:
      process.wait(timeout=10)
    except subprocess.TimeoutExpired:
      process.kill()
      process.wait(timeout=5)
    server_log.close()
    if secret_created:
      DEV_VARS.unlink(missing_ok=True)

  print("Full deterministic demo E2E passed")


if __name__ == "__main__":
  main()
