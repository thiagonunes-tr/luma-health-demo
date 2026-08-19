"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_DEMO_STATE,
  countUnreadMessages,
} from "../lib/demo-state";
import type {
  AppointmentProvider,
  AppointmentSpecialty,
  AppointmentStatus,
  AppointmentTime,
  DemoMessage,
  DemoState,
  DemoStateAction,
  InsuranceInfo,
  IntakeSubmission,
  RefillStatus,
} from "../lib/demo-state";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";

type Role = "patient" | "staff";
type AppointmentAdvanceAction =
  | "start-appointment"
  | "complete-appointment"
  | "no-show-appointment";
type Toast = { title: string; message: string; tone: "success" | "error" } | null;
type PortalModal =
  | null
  | "account"
  | "booking"
  | "intake"
  | "insurance"
  | "lab-result"
  | "visit-summary";
type StaffModal = null | "appointment" | "intake-review" | "patient-search";
type AuthUser = { email: string; name: string; role: Role };
type Challenge = {
  id: string;
  destination: string;
  email: string;
  password: string;
  requestedRole?: Role;
};

type StaffAppointment = {
  time: string;
  patient: string;
  type: string;
  status: string;
  fromPatientPortal?: boolean;
};

type PatientProfile = {
  name: string;
  initials: string;
  dateOfBirth: string;
  email: string;
  lastVisit: string;
};

const appointments: StaffAppointment[] = [
  { time: "8:30 AM", patient: "Riley Smith", type: "Routine visit", status: "Confirmed" },
  { time: "9:15 AM", patient: "Jordan Lee", type: "Follow-up", status: "In waiting room" },
  { time: "10:00 AM", patient: "Alex Carter", type: "First appointment", status: "Confirmed" },
  { time: "11:30 AM", patient: "Priya Shah", type: "Follow-up", status: "Confirmed" },
];

const DEMO_PATIENT_EMAIL = "patient.demo@testrigor-mail.com";

const patientProfiles: PatientProfile[] = [
  { name: "Maria Lopez", initials: "ML", dateOfBirth: "May 14, 1987", email: "patient.demo@testrigor-mail.com", lastVisit: "July 12, 2026" },
  { name: "Alex Carter", initials: "AC", dateOfBirth: "September 3, 1991", email: "alex.carter@example.test", lastVisit: "June 28, 2026" },
  { name: "Priya Shah", initials: "PS", dateOfBirth: "January 22, 1979", email: "priya.shah@example.test", lastVisit: "July 3, 2026" },
  { name: "Jordan Lee", initials: "JL", dateOfBirth: "November 8, 1984", email: "jordan.lee@example.test", lastVisit: "May 19, 2026" },
  { name: "Riley Smith", initials: "RS", dateOfBirth: "March 30, 1995", email: "riley.smith@example.test", lastVisit: "June 11, 2026" },
];

type PatientNavId = "home" | "appointments" | "record" | "messages";
type StaffNavId = "today" | "requests" | "messages";
type NavId = PatientNavId | StaffNavId;
type NavEntry = { id: NavId; label: string; icon: IconName };

const PATIENT_NAV: NavEntry[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "appointments", label: "Appointments", icon: "calendar" },
  { id: "record", label: "Health record", icon: "clipboard" },
  { id: "messages", label: "Messages", icon: "message" },
];

const STAFF_NAV: NavEntry[] = [
  { id: "today", label: "Today", icon: "home" },
  { id: "requests", label: "Requests", icon: "clipboard" },
  { id: "messages", label: "Messages", icon: "message" },
];

/** Where each role lands after signing in. */
function homeNavFor(role: Role): NavId {
  return role === "patient" ? "home" : "today";
}

function formatAppointmentTime(time: AppointmentTime): string {
  return {
    "09:00": "9:00 AM",
    "10:30": "10:30 AM",
    "15:00": "3:00 PM",
  }[time];
}

/**
 * Mirrors the server's per-field rules (lib/demo-state.ts `isRequiredText`) so
 * the message names the field instead of the form. Returns a message per
 * invalid field, keyed by input name.
 */
function validateText(
  values: Record<string, string>,
  limits: Record<string, number>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [name, max] of Object.entries(limits)) {
    const value = (values[name] ?? "").trim();
    if (value.length === 0) errors[name] = "This field is required.";
    else if (value.length > max) errors[name] = `Use ${max} characters or fewer.`;
  }
  return errors;
}

/** Props that wire an input to its error message for assistive tech. */
function fieldProps(name: string, errors: Record<string, string>) {
  return errors[name]
    ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` }
    : {};
}

/** The error <p> sits after the wrapping <label>, so query the control by name. */
function focusFirstInvalid(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLElement) field.focus();
}

function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  if (!errors[name]) return null;
  return <p className="field-error" id={`${name}-error`} role="alert">{errors[name]}</p>;
}

function refillStatusLabel(status: RefillStatus): string {
  return {
    none: "No request",
    pending: "Awaiting review",
    approved: "Approved",
    rejected: "Declined",
  }[status];
}

function appointmentStatusLabel(status: AppointmentStatus): string {
  return {
    none: "No appointment",
    scheduled: "Scheduled",
    confirmed: "Confirmed",
    "checked-in": "Checked in",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    "no-show": "Did not attend",
  }[status];
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [activeNav, setActiveNav] = useState<NavId>("home");
  // One discriminant instead of six booleans that were never meant to overlap.
  const [activeModal, setActiveModal] = useState<PortalModal>(null);
  const closeModal = () => setActiveModal(null);
  const [demo, setDemo] = useState<DemoState>(DEFAULT_DEMO_STATE);
  // Derived rather than stored: setting state synchronously inside the effect
  // body triggers cascading renders. Track which account's state has landed.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const { appointmentStatus, appointmentTime, intakeSubmission, messages, insurance } = demo;
  const [demoBusy, setDemoBusy] = useState<DemoStateAction | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  const dateLabel = useMemo(() =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long" })
      .format(new Date(2026, 6, 24)), []);
  const role = user?.role ?? "patient";
  const navEntries = role === "patient" ? PATIENT_NAV : STAFF_NAV;
  // A personal account shares Maria Lopez's clinical record; say so plainly.
  const sharedRecord = role === "patient" && user?.email !== DEMO_PATIENT_EMAIL;
  const unreadMessages = countUnreadMessages(demo, role);
  const displayName = user?.name ?? (role === "patient" ? "Maria Lopez" : "Thiago Nunes");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "LH";

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) return null;
        const data = await response.json() as { user: AuthUser };
        return data.user;
      })
      .then(sessionUser => {
        if (!active) return;
        setUser(sessionUser);
        // A restored session must land on a destination its role actually has.
        if (sessionUser) setActiveNav(homeNavFor(sessionUser.role));
      })
      .catch(() => undefined)
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch("/api/demo-state", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("The demo environment could not be loaded.");
        return response.json() as Promise<{ state: DemoState }>;
      })
      .then(data => {
        if (active) setDemo(data.state);
      })
      .catch(error => {
        if (active) {
          notify(
            "Environment unavailable",
            error instanceof Error ? error.message : "Please reload and try again.",
            "error",
          );
        }
      })
      .finally(() => { if (active) setLoadedFor(user.email); });
    return () => { active = false; };
  }, [user]);

  async function startLogin(
    email: string,
    password: string,
    requestedRole?: Role,
    skipMfa = false,
  ) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: requestedRole, skipMfa }),
      });
      const data = await response.json() as {
        challengeId?: string;
        destination?: string;
        user?: AuthUser;
        error?: string;
      };
      if (response.ok && data.user) {
        setUser(data.user);
        setChallenge(null);
        setActiveNav(homeNavFor(data.user.role));
        return;
      }
      if (!response.ok || !data.challengeId || !data.destination) {
        throw new Error(data.error ?? "Sign-in could not be completed.");
      }
      setChallenge({ id: data.challengeId, destination: data.destination, email, password, requestedRole });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-in could not be completed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyCode(code: string) {
    if (!challenge) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, code }),
      });
      const data = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "The code could not be verified.");
      }
      setUser(data.user);
      setChallenge(null);
      setActiveNav(homeNavFor(data.user.role));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "The code could not be verified.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
    setUser(null);
    setChallenge(null);
    setAuthError("");
  }

  function notify(
    title: string,
    message: string,
    tone: "success" | "error" = "success",
  ) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ title, message, tone });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3600);
  }


  async function performDemoAction(
    action: DemoStateAction,
    successTitle: string,
    successMessage: string,
    input: {
      appointmentTime?: AppointmentTime;
      provider?: AppointmentProvider;
      specialty?: AppointmentSpecialty;
      intake?: Omit<IntakeSubmission, "submittedAt">;
      messageBody?: string;
      insurance?: Omit<InsuranceInfo, "updatedAt">;
    } = {},
  ): Promise<boolean> {
    if (demoBusy) return false;
    setDemoBusy(action);
    try {
      const response = await fetch("/api/demo-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...input }),
      });
      const data = await response.json() as { state?: DemoState; error?: string };
      if (!response.ok || !data.state) {
        throw new Error(friendlyActionError(response.status, data.error));
      }
      setDemo(data.state);
      notify(successTitle, successMessage);
      return true;
    } catch (error) {
      notify(
        "Action not saved",
        error instanceof Error ? error.message : "Please try again.",
        "error",
      );
      return false;
    } finally {
      setDemoBusy(null);
    }
  }

  async function bookAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedTime = String(form.get("time")) as AppointmentTime;
    const isRescheduling =
      appointmentStatus === "scheduled" || appointmentStatus === "confirmed";
    const saved = await performDemoAction(
      isRescheduling ? "reschedule-appointment" : "book-appointment",
      isRescheduling ? "Appointment rescheduled" : "Appointment booked",
      `Your appointment is booked for July 24 at ${formatAppointmentTime(selectedTime)}. Confirm your attendance to finish.`,
      {
        appointmentTime: selectedTime,
        provider: String(form.get("provider")) as AppointmentProvider,
        specialty: String(form.get("specialty")) as AppointmentSpecialty,
      },
    );
    if (saved) closeModal();
  }

  /**
   * The API's error strings are part of its documented contract and are written
   * for an integrator. Two of them name the other role, which reads as a
   * non-sequitur to the person who just clicked something.
   */
  function friendlyActionError(status: number, apiError?: string): string {
    if (status === 403) return "That action is not available for your account.";
    if (status === 401) return "Your session ended. Sign in again to continue.";
    if (status === 409) {
      // 409 strings are written for an integrator ("Only a checked-in
      // appointment can be started"). Say what the reader should do instead.
      return `${apiError ?? "This step is not available yet."} Reload to see the current state.`;
    }
    return apiError ?? "The change could not be saved.";
  }

  async function markMessagesRead() {
    // Silent: reading a thread is not an event worth a toast.
    if (demoBusy) return;
    try {
      const response = await fetch("/api/demo-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-messages-read" }),
      });
      const data = await response.json() as { state?: DemoState };
      if (response.ok && data.state) setDemo(data.state);
    } catch {
      // A failed read marker is not worth interrupting the user over.
    }
  }

  async function confirmAppointment() {
    await performDemoAction(
      "confirm-appointment",
      "Attendance confirmed",
      "The clinic knows you are coming to this visit.",
    );
  }

  async function checkInAppointment() {
    await performDemoAction(
      "check-in-appointment",
      "You are checked in",
      "Your arrival is now visible to clinic staff.",
    );
  }

  async function cancelAppointment() {
    const saved = await performDemoAction(
      "cancel-appointment",
      "Appointment cancelled",
      "The clinic schedule and your portal have been updated.",
    );
    if (saved) closeModal();
  }

  async function requestRefill() {
    await performDemoAction(
      "request-refill",
      "Request submitted",
      "Clinic staff can now review your refill request.",
    );
  }

  async function submitIntake(
    intake: Omit<IntakeSubmission, "submittedAt">,
  ) {
    const saved = await performDemoAction(
      "submit-intake",
      intakeSubmission !== null ? "Form updated" : "Form submitted",
      "Your answers are available to clinic staff.",
      { intake },
    );
    if (saved) closeModal();
  }

  async function sendMessage(messageBody: string) {
    return performDemoAction(
      "send-message",
      "Message sent",
      role === "patient"
        ? "Clinic staff can now read your message."
        : "The patient can now read your reply.",
      { messageBody },
    );
  }

  async function updateInsurance(
    insuranceInput: Omit<InsuranceInfo, "updatedAt">,
  ) {
    const saved = await performDemoAction(
      "update-insurance",
      "Insurance updated",
      "The new demo coverage information was saved.",
      { insurance: insuranceInput },
    );
    if (saved) closeModal();
  }

  async function approveRefill() {
    await performDemoAction(
      "approve-refill",
      "Refill approved",
      "The patient will see the update in the portal.",
    );
  }

  async function declineRefill() {
    await performDemoAction(
      "decline-refill",
      "Refill declined",
      "The patient can now submit a new request.",
    );
  }

  async function advanceAppointment(action: AppointmentAdvanceAction) {
    const copy = {
      "no-show-appointment": {
        title: "Marked as did not attend",
        message: "The patient can book a new appointment.",
      },
      "start-appointment": {
        title: "Visit started",
        message: "The appointment is now in progress.",
      },
      "complete-appointment": {
        title: "Visit completed",
        message: "The completed status is now visible in the patient portal.",
      },
    }[action];
    if (!copy) return;
    await performDemoAction(action, copy.title, copy.message);
  }

  const messageCenter = () => (
    <MessageCenter
      role={role}
      sharedRecord={sharedRecord}
      messages={messages}
      busy={demoBusy !== null}
      unread={unreadMessages}
      onSend={sendMessage}
      onRead={markMessagesRead}
    />
  );

  const patientDestinations: Record<PatientNavId, () => ReactNode> = {
    home: () => (
      <PatientHome
        sharedRecord={sharedRecord}
        patientName={displayName.split(/\s+/)[0] || "there"}
        demo={demo}
        busyAction={demoBusy}
        onBook={() => setActiveModal("booking")}
        onConfirm={confirmAppointment}
        onCheckIn={checkInAppointment}
        onOpenIntake={() => setActiveModal("intake")}
        onRequestRefill={requestRefill}
        onGoTo={setActiveNav}
      />
    ),
    appointments: () => (
      <PatientAppointments
        sharedRecord={sharedRecord}
        demo={demo}
        busyAction={demoBusy}
        onBook={() => setActiveModal("booking")}
        onConfirm={confirmAppointment}
        onCheckIn={checkInAppointment}
      />
    ),
    record: () => (
      <HealthRecord
        demo={demo}
        sharedRecord={sharedRecord}
        onOpenIntake={() => setActiveModal("intake")}
        onOpenInsurance={() => setActiveModal("insurance")}
        onOpenLab={() => setActiveModal("lab-result")}
        onOpenSummary={() => setActiveModal("visit-summary")}
      />
    ),
    messages: messageCenter,
  };

  const staffDestinations: Record<StaffNavId, () => ReactNode> = {
    today: () => (
      <StaffToday
        staffName={displayName.split(/\s+/)[0] || "there"}
        demo={demo}
        busyAction={demoBusy}
        onAdvanceAppointment={advanceAppointment}
        onOpenSummary={() => setActiveModal("visit-summary")}
        onGoTo={setActiveNav}
      />
    ),
    requests: () => (
      <StaffRequests
        demo={demo}
        busyAction={demoBusy}
        onApproveRefill={approveRefill}
        onDeclineRefill={declineRefill}
      />
    ),
    messages: messageCenter,
  };

  const destinations: Partial<Record<NavId, () => ReactNode>> =
    role === "patient" ? patientDestinations : staffDestinations;

  if (authLoading) return <AuthLoading />;
  if (!user) {
    return <AuthScreen
      challenge={challenge}
      busy={authBusy}
      error={authError}
      onLogin={startLogin}
      onVerify={verifyCode}
      onBack={() => { setChallenge(null); setAuthError(""); }}
      onResend={() => challenge && startLogin(challenge.email, challenge.password, challenge.requestedRole)}
    />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      {/* The primary navigation sits early in the DOM so the mobile bar is not
          the last tab stop on small screens, where it is the only nav. */}
      <nav className="mobile-nav" aria-label="Primary">
        {navEntries.map(entry => (
          <button key={entry.id} className={activeNav === entry.id ? "active" : ""} onClick={() => setActiveNav(entry.id)}><span><Icon name={entry.icon} size={19} /></span>{entry.label.split(" ")[0]}</button>
        ))}
      </nav>

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i></i><b></b></span>
          <span>Luma <strong>Health</strong></span>
        </div>

        <div className="role-label">
          <span><Icon name="shield-check" size={13} /></span>{role === "patient" ? "Patient portal" : "Clinic staff portal"}
        </div>

        <nav aria-label="Main navigation">
          <p className="nav-label">MENU</p>
          {navEntries.map(entry => (
            <button
              key={entry.id}
              className={activeNav === entry.id ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(entry.id)}
            >
              <span className="nav-icon"><Icon name={entry.icon} size={18} /></span>
              {entry.label}
              {entry.id === "messages" && unreadMessages > 0 && <span className="nav-badge">{unreadMessages}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <span className="help-icon" aria-hidden="true"><Icon name="help-circle" size={18} /></span>
          <div><strong>Demo environment</strong><small>No support channel exists</small></div>
        </div>
        <button className="sidebar-user" onClick={() => setActiveModal("account")}>
          <span className="avatar">{initials}</span>
          <div><strong>{displayName}</strong><small>{role === "patient" ? "Patient" : "Clinic staff"}</small></div>
          <span className="user-action">Account <Icon name="arrow-right" size={13} /></span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setActiveNav(homeNavFor(role))} aria-label="Back to start">
            <span className="brand-mark small" aria-hidden="true"><i></i><b></b></span>Luma Health
          </button>
          <div className="top-actions">
            <button className="top-user" onClick={() => setActiveModal("account")} aria-label="Account settings"><span className="avatar">{initials}</span><span><strong>{displayName}</strong><small>{role === "patient" ? "Patient · Account settings" : "Clinic staff · Account settings"}</small></span></button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} aria-busy={(user !== null && loadedFor !== user.email) || demoBusy !== null}>
          {(destinations[activeNav] ?? destinations[homeNavFor(role)])?.() ?? null}
        </main>

        <footer className="app-footer">
          <p>Luma Health is a fictional healthcare portal for QA automation training. Nothing here is real medical information.</p>
          <p>Demo data · {dateLabel}</p>
        </footer>
      </div>

      {activeModal === "booking" && <BookingModal appointmentStatus={appointmentStatus} appointmentTime={appointmentTime} appointmentProvider={demo.appointmentProvider} appointmentSpecialty={demo.appointmentSpecialty} busy={demoBusy !== null} onCancel={cancelAppointment} onClose={() => closeModal()} onSubmit={bookAppointment} />}
      {activeModal === "intake" && <IntakeFormModal intakeSubmission={intakeSubmission} busy={demoBusy !== null} onClose={() => closeModal()} onSubmit={submitIntake} />}
      {activeModal === "insurance" && <InsuranceModal insurance={insurance} busy={demoBusy !== null} onClose={() => closeModal()} onSubmit={updateInsurance} />}
      {activeModal === "lab-result" && <LabResultModal onClose={() => closeModal()} />}
      {activeModal === "visit-summary" && <VisitSummaryModal onClose={() => closeModal()} />}
      {activeModal === "account" && <AccountModal user={user} onClose={() => closeModal()} onDeleted={() => { closeModal(); setUser(null); setActiveNav(homeNavFor(role)); }} onSignOut={signOut} />}
      {toast && <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}><span><Icon name={toast.tone === "error" ? "alert-circle" : "check"} size={16} /></span><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button onClick={() => setToast(null)} aria-label="Close"><Icon name="close" size={17} /></button></div>}
    </div>
  );
}

function AuthLoading() {
  return <main className="auth-shell"><div className="auth-loading" role="status"><span className="brand-mark" aria-hidden="true"><i></i><b></b></span><p>Loading secure access…</p></div></main>;
}

function AccountModal({ user, onClose, onDeleted, onSignOut }: {
  user: AuthUser;
  onClose: () => void;
  onDeleted: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fixedDemoAccount = [
    "patient.demo@testrigor-mail.com",
    "employee.demo@testrigor-mail.com",
  ].includes(user.email);

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "The account could not be deleted.");
      }
      onDeleted();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The account could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return <Modal confirmDiscard labelledBy="account-title" className="account-modal" closeDisabled={busy} onClose={onClose}><p className="eyebrow">ACCOUNT</p><h2 id="account-title">Account settings</h2><p>Manage the signed-in account for this demonstration.</p><dl className="review-details"><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Role</dt><dd>{user.role === "staff" ? "Clinic staff" : "Patient"}</dd></div></dl>{fixedDemoAccount ? <div className="protected-account"><span><Icon name="shield-check" size={18} /></span><div><strong>Protected demo account</strong><p>Fixed accounts cannot be deleted, so shared QA credentials remain available.</p></div></div> : <form className="danger-zone" onSubmit={deleteAccount}><div><strong>Delete account permanently</strong><p>This removes the user, pending registrations, and MFA challenges. Shared fictional workflow data is not affected.</p></div><label>Current password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label><label>Type DELETE to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="danger-button full" type="submit" disabled={busy || !password || confirmation !== "DELETE"}>{busy ? "Deleting…" : "Delete my account"}</button></form>}<button className="secondary-button full" onClick={() => void onSignOut()} disabled={busy}>Sign out</button></Modal>;
}

function AuthScreen({ challenge, busy, error, onLogin, onVerify, onBack, onResend }: {
  challenge: Challenge | null;
  busy: boolean;
  error: string;
  onLogin: (email: string, password: string, requestedRole?: Role, skipMfa?: boolean) => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  onResend: () => void;
}) {
  const [selectedAccess, setSelectedAccess] = useState<"patient" | "employee" | "create">("patient");
  const [newAccountRole, setNewAccountRole] = useState<Role>("patient");
  const [code, setCode] = useState("");
  const [copiedCredential, setCopiedCredential] = useState<"email" | "password" | null>(null);
  const credentials = selectedAccess === "patient"
    ? { email: "patient.demo@testrigor-mail.com", password: "PatientDemo!2026", label: "Patient" }
    : selectedAccess === "employee"
      ? { email: "employee.demo@testrigor-mail.com", password: "EmployeeDemo!2026", label: "Employee" }
      : null;

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void onLogin(
      String(form.get("demo-email") ?? ""),
      String(form.get("demo-password") ?? ""),
      selectedAccess === "create"
        ? newAccountRole
        : selectedAccess === "employee"
          ? "staff"
          : "patient",
      submitter?.value === "skip-mfa",
    );
  }

  async function copyCredential(type: "email" | "password", value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedCredential(type);
    window.setTimeout(() => setCopiedCredential(current => current === type ? null : current), 1600);
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onVerify(code);
  }

  return <main className="auth-shell">
    <div className="auth-story">
      <div className="auth-brand"><span className="brand-mark" aria-hidden="true"><i></i><b></b></span><span>Luma <strong>Health</strong></span></div>
      <div className="auth-story-copy">
        <p className="eyebrow light">SECURE DIGITAL CARE</p>
        <h1>Healthcare access,<br />made reassuringly simple.</h1>
        <p>Patients and clinic staff use the same secure sign-in, with an email verification code protecting every account you create.</p>
      </div>
      <div className="security-note"><span><Icon name="shield-check" size={18} /></span><div><strong>Two-step verification</strong><small>Accounts you create are protected by a password and a one-time email code. The two shared demo accounts can skip the code.</small></div></div>
    </div>
    <section className="auth-panel">
      <div className="auth-card">
        {!challenge ? <>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to Luma Health</h2>
          <p className="auth-subtitle">Use a demo account or create a new patient or employee account.</p>
          <div className="account-tabs" role="group" aria-label="Choose an account type">
            <button type="button" className={selectedAccess === "patient" ? "active" : ""} onClick={() => { setSelectedAccess("patient"); setCopiedCredential(null); }}>Patient</button>
            <button type="button" className={selectedAccess === "employee" ? "active" : ""} onClick={() => { setSelectedAccess("employee"); setCopiedCredential(null); }}>Employee</button>
            <button type="button" className={selectedAccess === "create" ? "active" : ""} onClick={() => { setSelectedAccess("create"); setCopiedCredential(null); }}>Create account</button>
          </div>
          <form className="auth-form" key={selectedAccess} onSubmit={submitLogin} autoComplete="off">
            <label>Email address<input name="demo-email" type="email" autoComplete="off" placeholder="Enter your email address" required /></label>
            <label>Password<input name="demo-password" type="password" autoComplete="off" minLength={selectedAccess === "create" ? 8 : undefined} placeholder={selectedAccess === "create" ? "Create a password" : "Enter the demo password"} required /></label>
            {selectedAccess === "create" && <fieldset className="account-role-picker">
              <legend>Account type</legend>
              <div>
                <label className={newAccountRole === "patient" ? "selected" : ""}><input type="radio" name="new-account-role" value="patient" checked={newAccountRole === "patient"} onChange={() => setNewAccountRole("patient")} />Patient</label>
                <label className={newAccountRole === "staff" ? "selected" : ""}><input type="radio" name="new-account-role" value="staff" checked={newAccountRole === "staff"} onChange={() => setNewAccountRole("staff")} />Employee</label>
              </div>
            </fieldset>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Sending code…" : credentials ? `Continue as ${credentials.label}` : "Create account"}</button>
            {credentials && <button className="skip-mfa-button" type="submit" value="skip-mfa" disabled={busy}>
              {busy ? "Signing in…" : "Sign in without two-factor authentication"}
            </button>}
          </form>
          {credentials ? <div className="demo-credentials" aria-label={`${credentials.label} demo credentials`}>
              <div className="demo-credentials-heading"><strong>{credentials.label} demo credentials</strong><span>Copy and paste above</span></div>
              <div className="credential-row">
                <div><span>Email</span><code>{credentials.email}</code></div>
                <button type="button" onClick={() => void copyCredential("email", credentials.email)}>{copiedCredential === "email" ? "Copied" : "Copy"}</button>
              </div>
              <div className="credential-row">
                <div><span>Password</span><code>{credentials.password}</code></div>
                <button type="button" onClick={() => void copyCredential("password", credentials.password)}>{copiedCredential === "password" ? "Copied" : "Copy"}</button>
              </div>
              <p>Continue with the code to receive a real email. The skip button below signs in without one.</p>
            </div> : <div className="demo-credentials" aria-label="New account instructions">
              <div className="demo-credentials-heading"><strong>Create a new account</strong><span>Password + email code</span></div>
              <p>Choose whether you are a patient or employee, then enter your email and create a password with at least 8 characters.</p>
              <p>Your account will be saved after you verify the code sent to your email.</p>
            </div>}
        </> : <>
          <button className="auth-back" type="button" onClick={onBack}><Icon name="arrow-left" size={14} /> Back to sign in</button>
          <div className="mail-icon"><Icon name="mail" size={24} /></div>
          <p className="eyebrow">CHECK YOUR EMAIL</p>
          <h2>Enter your verification code</h2>
          <p className="auth-subtitle">We sent a six-digit code to <strong>{challenge.destination}</strong>. It expires in 10 minutes.</p>
          <form className="auth-form code-form" onSubmit={submitCode}>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- this step exists only to
        type the emailed code, and focus arrives here after a deliberate
        navigation, not on initial page load. */}
                <label>Verification code<input className="code-input" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus required /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and sign in"}</button>
          </form>
          <p className="resend-copy">Didn&apos;t receive it? <button type="button" onClick={onResend} disabled={busy}>Send a new code</button></p>
        </>}
      </div>
      <p className="privacy-copy">
        Protected access · Demo environment · No real patient data ·{" "}
        <button type="button" onClick={() => window.location.assign("/api-docs")}>
          QA API documentation
        </button>
      </p>
    </section>
  </main>;
}

function VisitStep({ appointmentStatus, busyAction, onConfirm, onCheckIn }: {
  appointmentStatus: AppointmentStatus;
  busyAction: DemoStateAction | null;
  onConfirm: () => void | Promise<unknown>;
  onCheckIn: () => void | Promise<unknown>;
}) {
  if (appointmentStatus === "scheduled") {
    return <section className="visit-step" aria-label="Next step for your visit">
      <div><p className="eyebrow">NEXT STEP</p><strong>Confirm you are attending</strong><p>The clinic needs to know you are coming before you can check in on the day.</p></div>
      <button className="primary-button" disabled={busyAction !== null} onClick={() => void onConfirm()}><Icon name="check" size={17} /> {busyAction === "confirm-appointment" ? "Saving…" : "Confirm attendance"}</button>
    </section>;
  }
  if (appointmentStatus === "confirmed") {
    return <section className="visit-step" aria-label="Next step for your visit">
      <div><p className="eyebrow">NEXT STEP</p><strong>Check in for your visit</strong><p>Check in when you arrive at the clinic so the care team knows you are here.</p></div>
      <button className="primary-button" disabled={busyAction !== null} onClick={() => void onCheckIn()}><Icon name="shield-check" size={17} /> {busyAction === "check-in-appointment" ? "Saving…" : "Check in now"}</button>
    </section>;
  }
  return null;
}

function AppointmentHero({ demo, onOpen }: { demo: DemoState; onOpen: () => void }) {
  const { appointmentStatus, appointmentTime, appointmentProvider, appointmentSpecialty } = demo;
  const isAhead = ["scheduled", "confirmed", "checked-in", "in-progress"].includes(appointmentStatus);
  const provider = appointmentProvider ?? "Dr. Ana Costa";
  const specialty = appointmentSpecialty ?? "Primary Care";
  return <section className="hero-card" aria-label="Next appointment">
    <div className="hero-copy">
      <span className="status-pill"><i></i> {appointmentStatusLabel(appointmentStatus).toUpperCase()}</span>
      <p className="hero-date">{isAhead ? "July 24" : "Patient portal"}</p>
      <h2>{isAhead ? "Follow-up appointment" : appointmentStatus === "completed" ? "Visit completed" : appointmentStatus === "cancelled" ? "Appointment cancelled" : appointmentStatus === "no-show" ? "Appointment missed" : "No appointment scheduled"}</h2>
      <p className="doctor"><span className="doctor-avatar">{provider.replace("Dr. ", "").split(" ").map(part => part[0]).join("")}</span><span><strong>{provider}</strong><small>{specialty} · Room 204</small></span></p>
    </div>
    <div className="appointment-time">
      <strong>{isAhead ? formatAppointmentTime(appointmentTime) : appointmentStatus === "completed" ? "DONE" : "—"}</strong><span>{isAhead ? "clinic time" : "book when ready"}</span>
      <button onClick={onOpen}>Open appointments <Icon name="arrow-right" size={13} /></button>
    </div>
    <div className="hero-decoration" aria-hidden="true"><i></i><b></b><em></em></div>
  </section>;
}

function PatientHome({ sharedRecord, patientName, demo, busyAction, onBook, onConfirm, onCheckIn, onOpenIntake, onRequestRefill, onGoTo }: {
  sharedRecord: boolean;
  patientName: string;
  demo: DemoState;
  busyAction: DemoStateAction | null;
  onBook: () => void;
  onConfirm: () => void | Promise<unknown>;
  onCheckIn: () => void | Promise<unknown>;
  onOpenIntake: () => void;
  onRequestRefill: () => void | Promise<unknown>;
  onGoTo: (id: NavId) => void;
}) {
  const { appointmentStatus, intakeSubmission, refillStatus } = demo;
  const canBook = ["none", "cancelled", "completed", "no-show"].includes(appointmentStatus);
  const intakeDue = intakeSubmission === null &&
    ACTIVE_APPOINTMENT_STATUSES.includes(appointmentStatus);

  return <div className="page-content">
    <div className="welcome-row">
      <div><p className="eyebrow">PATIENT PORTAL</p><h1>Hello, {patientName}.</h1><p className="subtitle">Here is what needs your attention today.</p></div>
      <button className="primary-button" onClick={onBook}><Icon name={canBook ? "plus" : "calendar"} size={17} /> {canBook ? "Book appointment" : "Manage appointment"}</button>
    </div>

    {sharedRecord && <SharedRecordNotice />}
    <VisitStep appointmentStatus={appointmentStatus} busyAction={busyAction} onConfirm={onConfirm} onCheckIn={onCheckIn} />
    <AppointmentHero demo={demo} onOpen={() => onGoTo("appointments")} />

    <div className="section-heading"><div><h2>Your care</h2><p>Every card here reflects your current state.</p></div></div>
      <div className="quick-grid">
        {intakeDue && <QuickCard color="coral" icon="clipboard" title="Pre-visit questions" text="Your care team reads this before the visit" action="Complete form" onClick={onOpenIntake} disabled={busyAction !== null} />}
        <QuickCard color="mint" icon="pill" title="Request a refill" text={refillStatus === "approved" ? "Refill approved by the clinic" : refillStatus === "pending" ? "Under staff review" : refillStatus === "rejected" ? "The clinic declined the previous request" : "Ask the clinic to renew a medication"} action={refillStatus === "approved" ? "Approved" : refillStatus === "pending" ? "Under review" : refillStatus === "rejected" ? "Request again" : "Request refill"} onClick={onRequestRefill} done={refillStatus === "approved"} disabled={busyAction !== null || refillStatus === "pending" || refillStatus === "approved"} />
        {intakeSubmission !== null && <QuickCard color="blue" icon="clipboard" title="Your answers" text={`Submitted ${intakeSubmission.submittedAt}`} action="Review or update" onClick={onOpenIntake} done disabled={busyAction !== null} />}
      </div>
  </div>;
}

function PatientAppointments({ sharedRecord, demo, busyAction, onBook, onConfirm, onCheckIn }: {
  sharedRecord: boolean;
  demo: DemoState;
  busyAction: DemoStateAction | null;
  onBook: () => void;
  onConfirm: () => void | Promise<unknown>;
  onCheckIn: () => void | Promise<unknown>;
}) {
  const { appointmentStatus, appointmentTime, appointmentProvider, appointmentSpecialty } = demo;
  const hasAppointment = appointmentStatus !== "none";

  return <div className="page-content">
    <div className="welcome-row">
      <div><p className="eyebrow">PATIENT PORTAL</p><h1>Appointments</h1><p className="subtitle">Your visits, and the step each one is waiting on.</p></div>
    </div>

    {sharedRecord && <SharedRecordNotice />}
    <VisitStep appointmentStatus={appointmentStatus} busyAction={busyAction} onConfirm={onConfirm} onCheckIn={onCheckIn} />

    {hasAppointment ? <section className="panel appointment-list" aria-label="Your appointments">
      <div className="panel-heading"><div><h2>Friday, July 24</h2><p>One visit on file for this demo patient.</p></div></div>
      <article className="appointment-item">
        <div className="appointment-item-time"><strong>{formatAppointmentTime(appointmentTime)}</strong><small>clinic time</small></div>
        <div>
          <strong>{appointmentSpecialty ?? "Primary Care"} · Follow-up</strong>
          <p>{appointmentProvider ?? "Dr. Ana Costa"} · Room 204</p>
        </div>
        <span className={`queue-status${appointmentStatus === "scheduled" ? " waiting" : ""}`}>{appointmentStatusLabel(appointmentStatus)}</span>
        <button className="secondary-button" onClick={onBook}>Manage appointment</button>
      </article>
      <ol className="visit-timeline" aria-label="Visit progress">
        {(["scheduled", "confirmed", "checked-in", "in-progress", "completed"] as const).map(step => {
          const order = ["scheduled", "confirmed", "checked-in", "in-progress", "completed"];
          const reached = order.indexOf(appointmentStatus) >= order.indexOf(step);
          return <li key={step} className={reached ? "reached" : ""}>{appointmentStatusLabel(step)}</li>;
        })}
      </ol>
    </section> : <section className="panel empty-panel" aria-label="Nothing booked"><p>You have no appointments booked. Booking one also unlocks the pre-visit questions.</p><button className="primary-button" onClick={onBook}><Icon name="plus" size={17} /> Book appointment</button></section>}
  </div>;
}

function SharedRecordNotice() {
  return <section className="panel shared-record-notice" aria-label="Shared demo record">
    <span className="activity-icon coral"><Icon name="alert-circle" size={18} /></span>
    <div>
      <strong>You are looking at the shared demo record</strong>
      <p>The clinical documents, messages, and workflow below belong to <b>Maria Lopez</b>, the fictional patient every demo account shares. Nothing here is yours, and nothing here is real.</p>
    </div>
  </section>;
}

function HealthRecord({ demo, sharedRecord, onOpenIntake, onOpenInsurance, onOpenLab, onOpenSummary }: {
  demo: DemoState;
  sharedRecord: boolean;
  onOpenIntake: () => void;
  onOpenInsurance: () => void;
  onOpenLab: () => void;
  onOpenSummary: () => void;
}) {
  const { intakeSubmission, insurance, appointmentStatus } = demo;
  const intakeAvailable = ACTIVE_APPOINTMENT_STATUSES.includes(appointmentStatus);

  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">PATIENT PORTAL</p><h1>Health record</h1><p className="subtitle">Forms, coverage, and clinical documents for the shared demo patient.</p></div></div>
    {sharedRecord && <SharedRecordNotice />}
    <div className="document-grid">
      <article className="panel document-card">
        <span className="activity-icon coral"><Icon name="clipboard" size={18} /></span>
        <div><p className="eyebrow">BEFORE YOUR VISIT</p><h2>Pre-visit questions</h2><p>{!intakeAvailable ? (intakeSubmission !== null ? "Answers on file. Book your next visit to update them." : "Book an appointment to unlock this form.") : intakeSubmission !== null ? "Submitted and ready for staff review." : "Complete this before your next appointment."}</p>{intakeSubmission !== null && <small>Submitted {intakeSubmission.submittedAt}</small>}</div>
        <button className="secondary-button" onClick={onOpenIntake} disabled={!intakeAvailable}>{intakeSubmission !== null ? "Review answers" : "Complete form"}</button>
      </article>
      <article className="panel document-card">
        <span className="activity-icon purple"><Icon name="shield-check" size={18} /></span>
        <div><p className="eyebrow">COVERAGE</p><h2>Insurance information</h2><p>{insurance.provider} · {insurance.planName}</p><small>Member {insurance.memberId} · Last update: {insurance.updatedAt}</small></div>
        <button className="secondary-button" onClick={onOpenInsurance}>Update insurance</button>
      </article>
      <article className="panel document-card">
        <span className="activity-icon green"><Icon name="flask" size={18} /></span>
        <div><p className="eyebrow">LAB RESULT</p><h2>Complete blood count</h2><p>A routine blood test · Collected July 23 · Final</p><span className="review-status">All values in range</span></div>
        <button className="secondary-button" onClick={onOpenLab}>View result</button>
      </article>
      <article className="panel document-card">
        <span className="activity-icon orange"><Icon name="heart" size={18} /></span>
        <div><p className="eyebrow">VISIT DOCUMENT</p><h2>Primary care summary</h2><p>July 12 appointment · Dr. Ana Costa</p><span className="review-status">Available</span></div>
        <button className="secondary-button" onClick={onOpenSummary}>Open summary</button>
      </article>
    </div>
  </div>;
}

function StaffToday({ staffName, demo, busyAction, onAdvanceAppointment, onOpenSummary, onGoTo }: {
  staffName: string;
  demo: DemoState;
  busyAction: DemoStateAction | null;
  onAdvanceAppointment: (action: AppointmentAdvanceAction) => void | Promise<unknown>;
  onOpenSummary: () => void;
  onGoTo: (id: NavId) => void;
}) {
  const [activeModal, setActiveModal] = useState<StaffModal>(null);
  const closeModal = () => setActiveModal(null);
  // Close this dialog before the parent opens the summary: two aria-modal
  // dialogs mounted at once means two focus traps and two Escape listeners.
  const openSummary = () => { setActiveModal(null); onOpenSummary(); };
  const { appointmentStatus, appointmentTime, intakeSubmission, insurance, refillStatus } = demo;

  const portalAppointment: StaffAppointment = {
    time: formatAppointmentTime(appointmentTime),
    patient: "Maria Lopez",
    type: "Follow-up · Patient portal",
    status: appointmentStatusLabel(appointmentStatus),
    fromPatientPortal: true,
  };
  const appointmentVisible = appointmentStatus !== "none";
  const staffAppointments = appointmentVisible
    ? [...appointments.slice(0, 3), portalAppointment, ...appointments.slice(3)]
    : appointments;
  // Counted, not invented — but note the schedule is seeded with four fixture
  // rows (see `appointments`), so "appointments today" cannot read below 4.
  const pendingRefills = Number(refillStatus === "pending");
  const formsReceived = Number(intakeSubmission !== null);
  const openRequests = pendingRefills + formsReceived;
  const awaitingArrival = staffAppointments.filter(
    item => item.status === "In waiting room" || item.status === "Scheduled" || item.status === "Confirmed",
  ).length;

  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">CLINIC DASHBOARD</p><h1>Good morning, {staffName}.</h1><p className="subtitle">Track today&apos;s schedule and requests that need attention.</p></div><button className="secondary-button" onClick={() => setActiveModal("patient-search")}><Icon name="search" size={16} /> Search patients</button></div>
    <div className="metric-grid">
      <Metric value={String(staffAppointments.length)} label="Appointments today" detail={awaitingArrival === 1 ? "1 awaiting arrival" : `${awaitingArrival} awaiting arrival`} tone="blue" />
      <Metric value={String(pendingRefills)} label="Refills to review" detail={pendingRefills === 0 ? "Nothing waiting" : "From the patient portal"} tone="coral" />
      <Metric value={String(formsReceived)} label="Forms received" detail={formsReceived === 0 ? "Nothing waiting" : "From the patient portal"} tone="mint" />
    </div>
    <div className="staff-layout">
      <div className="panel schedule-panel">
        <div className="panel-heading"><div><h2>Today&apos;s schedule</h2><p>Friday, July 24</p></div></div>
        {staffAppointments.map(item => <div className={`schedule-row${item.fromPatientPortal ? " newly-booked" : ""}`} key={`${item.time}-${item.patient}`}><strong>{item.time}</strong><span className="patient-avatar">{item.patient.split(" ").map(n => n[0]).join("")}</span><div><b>{item.patient}</b><small>{item.type}</small></div><span className={`queue-status ${item.status === "In waiting room" ? "waiting" : ""}`}>{item.status}</span>{item.fromPatientPortal ? <button aria-label="Review Maria Lopez's new appointment" onClick={() => setActiveModal("appointment")}><Icon name="arrow-right" size={15} /></button> : <span />}</div>)}
      </div>
      <div className="panel request-panel">
        <div className="panel-heading"><div><h2>Requests</h2><p>Need your attention</p></div>{openRequests > 0 && <span className="count-badge">{openRequests}</span>}</div>
        {openRequests === 0
          ? <p className="empty-note">No open requests from the patient portal.</p>
          : <><p className="empty-note">{openRequests === 1 ? "One request is" : `${openRequests} requests are`} waiting in Requests.</p><button className="secondary-button full" onClick={() => onGoTo("requests")}>Open requests <Icon name="arrow-right" size={13} /></button></>}
      </div>
    </div>
    {activeModal === "appointment" && <AppointmentReviewModal appointmentStatus={appointmentStatus} appointmentTime={appointmentTime} appointmentProvider={demo.appointmentProvider} appointmentSpecialty={demo.appointmentSpecialty} busyAction={busyAction} onAdvance={onAdvanceAppointment} onOpenSummary={openSummary} onClose={() => closeModal()} />}
    {activeModal === "patient-search" && <PatientSearchModal appointmentStatus={appointmentStatus} appointmentTime={appointmentTime} intakeComplete={intakeSubmission !== null} refillStatus={refillStatus} insurance={insurance} onOpenSummary={openSummary} onClose={() => closeModal()} />}
  </div>;
}

function StaffRequests({ demo, busyAction, onApproveRefill, onDeclineRefill }: {
  demo: DemoState;
  busyAction: DemoStateAction | null;
  onApproveRefill: () => void | Promise<unknown>;
  onDeclineRefill: () => void | Promise<unknown>;
}) {
  const [activeModal, setActiveModal] = useState<StaffModal>(null);
  const closeModal = () => setActiveModal(null);
  const { intakeSubmission, refillStatus } = demo;
  const isEmpty = refillStatus === "none" && intakeSubmission === null;

  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">CLINIC DASHBOARD</p><h1>Requests</h1><p className="subtitle">Items submitted from the patient portal that need a decision.</p></div></div>
    <section className="panel request-panel" aria-label="Requests from the patient portal">
      {isEmpty && <p className="empty-note">No open requests. Anything the patient submits appears here.</p>}
      {refillStatus === "pending" && <div className="request-card highlighted"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Refill · Losartan 50 mg (blood pressure medicine)</small></div><span>Now</span></div><div className="request-actions"><button className="reject" onClick={onDeclineRefill} disabled={busyAction !== null}>{busyAction === "decline-refill" ? "Declining…" : "Decline"}</button><button className="approve" onClick={onApproveRefill} disabled={busyAction !== null}>{busyAction === "approve-refill" ? "Approving…" : "Approve"}</button></div></div>}
      {refillStatus === "approved" && <div className="request-card"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Refill · Losartan 50 mg (blood pressure medicine)</small></div><span>Reviewed</span></div><p>Request approved · The patient can see the update in the portal.</p></div>}
      {refillStatus === "rejected" && <div className="request-card"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Refill · Losartan 50 mg (blood pressure medicine)</small></div><span>Reviewed</span></div><p>Request declined · The patient may submit another request.</p></div>}
      {intakeSubmission !== null && <div className="request-card highlighted" aria-label="Maria Lopez submitted intake form"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Pre-visit questions · Patient portal</small></div><span>Now</span></div><p>Submitted {intakeSubmission.submittedAt}.</p><button className="text-action" onClick={() => setActiveModal("intake-review")}>Review form <Icon name="arrow-right" size={13} /></button></div>}
    </section>
    {activeModal === "intake-review" && intakeSubmission && <IntakeReviewModal intakeSubmission={intakeSubmission} onClose={() => closeModal()} />}
  </div>;
}

function QuickCard({ color, icon, title, text, action, onClick, done = false, disabled = false }: { color: string; icon: IconName; title: string; text: string; action: string; onClick: () => void | Promise<unknown>; done?: boolean; disabled?: boolean }) {
  return <button className="quick-card" onClick={onClick} disabled={disabled}><span className={`quick-icon ${color}`}><Icon name={done ? "check" : icon} size={20} /></span><span><strong>{title}</strong><small>{text}</small><b>{action} <Icon name="arrow-right" size={13} /></b></span></button>;
}

function Metric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: string }) {
  return <div className={`metric-card ${tone}`}><span className="metric-dot"></span><strong>{value}</strong><h2>{label}</h2><p>{detail}</p></div>;
}

function BookingModal({ appointmentStatus, appointmentTime, appointmentProvider, appointmentSpecialty, busy, onCancel, onClose, onSubmit }: { appointmentStatus: AppointmentStatus; appointmentTime: AppointmentTime; appointmentProvider: AppointmentProvider | null; appointmentSpecialty: AppointmentSpecialty | null; busy: boolean; onCancel: () => void | Promise<void>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const canManage =
    appointmentStatus === "scheduled" || appointmentStatus === "confirmed";
  const canBook = ["none", "cancelled", "completed", "no-show"].includes(appointmentStatus);
  return <Modal confirmDiscard labelledBy="booking-title" closeDisabled={busy} onClose={onClose}><p className="eyebrow">{canManage ? "MANAGE APPOINTMENT" : canBook ? "NEW APPOINTMENT" : "APPOINTMENT STATUS"}</p><h2 id="booking-title">{canManage ? "Reschedule or cancel" : canBook ? "Find a time" : appointmentStatusLabel(appointmentStatus)}</h2><p>{canManage || canBook ? "Choose the time that works best for you." : "The clinic has already started processing this visit, so changes are no longer available."}</p>{canManage || canBook ? <form onSubmit={onSubmit}><label>Specialty<select name="specialty" defaultValue={appointmentSpecialty ?? "Primary Care"}><option>Primary Care</option><option>Cardiology</option><option>Dermatology</option></select></label><label>Provider<select name="provider" defaultValue={appointmentProvider ?? "Dr. Ana Costa"}><option>Dr. Ana Costa</option><option>Dr. John Lima</option></select></label><fieldset><legend>Available times · July 24</legend><div className="time-options"><label><input type="radio" name="time" value="09:00" defaultChecked={appointmentTime === "09:00"} />9:00 AM</label><label><input type="radio" name="time" value="10:30" defaultChecked={appointmentTime === "10:30"} />10:30 AM</label><label><input type="radio" name="time" value="15:00" defaultChecked={appointmentTime === "15:00"} />3:00 PM</label></div></fieldset><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : canManage ? "Save new time" : "Book this time"}</button></form> : <><dl className="review-details"><div><dt>Date and time</dt><dd>July 24 · {formatAppointmentTime(appointmentTime)}</dd></div><div><dt>Provider</dt><dd>{appointmentProvider ?? "Dr. Ana Costa"}</dd></div><div><dt>Status</dt><dd><span className="review-status">{appointmentStatusLabel(appointmentStatus)}</span></dd></div></dl><button className="primary-button full" onClick={onClose}>Done</button></>}{canManage && <div className="modal-danger-zone"><strong>No longer able to attend?</strong><button className="danger-button full" type="button" onClick={onCancel} disabled={busy}>{busy ? "Saving…" : "Cancel this appointment"}</button></div>}</Modal>;
}

function AppointmentReviewModal({ appointmentStatus, appointmentTime, appointmentProvider, appointmentSpecialty, busyAction, onAdvance, onOpenSummary, onClose }: { appointmentStatus: AppointmentStatus; appointmentTime: AppointmentTime; appointmentProvider: AppointmentProvider | null; appointmentSpecialty: AppointmentSpecialty | null; busyAction: DemoStateAction | null; onAdvance: (action: AppointmentAdvanceAction) => void | Promise<unknown>; onOpenSummary: () => void; onClose: () => void }) {
  // Check-in belongs to the patient now; staff waits for arrival or records a no-show.
  const nextAction = {
    "checked-in": { action: "start-appointment" as const, label: "Start visit" },
    "in-progress": { action: "complete-appointment" as const, label: "Complete visit" },
  }[appointmentStatus as "checked-in" | "in-progress"];
  const canMarkNoShow =
    appointmentStatus === "scheduled" || appointmentStatus === "confirmed";
  return <Modal labelledBy="appointment-review-title" dismissOnBackdrop onClose={onClose}><p className="eyebrow">PATIENT PORTAL BOOKING</p><h2 id="appointment-review-title">Appointment details</h2><p>This appointment was booked by Maria Lopez and is part of the shared clinic schedule.</p><dl className="review-details"><div><dt>Patient</dt><dd>Maria Lopez</dd></div><div><dt>Date and time</dt><dd>July 24 · {formatAppointmentTime(appointmentTime)}</dd></div><div><dt>Provider</dt><dd>{appointmentProvider ?? "Dr. Ana Costa"}</dd></div><div><dt>Visit type</dt><dd>{(appointmentSpecialty ?? "Primary Care")} · Follow-up</dd></div><div><dt>Status</dt><dd><span className="review-status">{appointmentStatusLabel(appointmentStatus)}</span></dd></div></dl>{nextAction && <button className="primary-button full" disabled={busyAction !== null} onClick={() => void onAdvance(nextAction.action)}>{busyAction === nextAction.action ? "Saving…" : nextAction.label}</button>}{canMarkNoShow && <div className="modal-danger-zone"><strong>Patient did not arrive?</strong><button className="danger-button full" disabled={busyAction !== null} onClick={() => void onAdvance("no-show-appointment")}>{busyAction === "no-show-appointment" ? "Saving…" : "Mark as did not attend"}</button></div>}<button className="secondary-button full" onClick={onOpenSummary}>Open visit summary</button><button className="secondary-button full" onClick={onClose}>Close</button></Modal>;
}

function PatientSearchModal({ appointmentStatus, appointmentTime, intakeComplete, refillStatus, insurance, onOpenSummary, onClose }: { appointmentStatus: AppointmentStatus; appointmentTime: AppointmentTime; intakeComplete: boolean; refillStatus: RefillStatus; insurance: InsuranceInfo; onOpenSummary: () => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const results = patientProfiles.filter(patient =>
    patient.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return <Modal labelledBy="patient-search-title" className="patient-search-modal" onClose={onClose}>{selectedPatient ? <><button className="auth-back" type="button" onClick={() => setSelectedPatient(null)}><Icon name="arrow-left" size={14} /> Back to results</button><p className="eyebrow">PATIENT PROFILE</p><div className="patient-profile-heading"><span className="patient-avatar">{selectedPatient.initials}</span><div><h2 id="patient-search-title">{selectedPatient.name}</h2><p>{selectedPatient.email}</p></div></div><dl className="review-details"><div><dt>Date of birth</dt><dd>{selectedPatient.dateOfBirth}</dd></div><div><dt>Last visit</dt><dd>{selectedPatient.lastVisit}</dd></div>{selectedPatient.name === "Maria Lopez" && <><div><dt>Appointment</dt><dd>{appointmentStatusLabel(appointmentStatus)}{appointmentStatus !== "none" ? ` · ${formatAppointmentTime(appointmentTime)}` : ""}</dd></div><div><dt>Intake</dt><dd>{intakeComplete ? "Submitted" : "Not submitted"}</dd></div><div><dt>Refill</dt><dd>{refillStatusLabel(refillStatus)}</dd></div><div><dt>Insurance</dt><dd>{insurance.provider} · {insurance.planName}</dd></div></>}</dl>{selectedPatient.name === "Maria Lopez" && <button className="secondary-button full" onClick={onOpenSummary}>Open visit summary</button>}<p className="demo-disclaimer">Sample data · Not a real patient</p></> : <><p className="eyebrow">PATIENT DIRECTORY</p><h2 id="patient-search-title">Search patients</h2><p>Find one of the five sample patients by name.</p><label className="patient-search-input"><span>Patient name</span><div><Icon name="search" size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name" /></div></label><div className="patient-results" aria-live="polite">{results.map(patient => <button key={patient.email} onClick={() => setSelectedPatient(patient)}><span className="patient-avatar">{patient.initials}</span><span><strong>{patient.name}</strong><small>{patient.email}</small></span><Icon name="arrow-right" size={15} /></button>)}{results.length === 0 && <p>No patients found.</p>}</div></>} </Modal>;
}

function InsuranceModal({ insurance, busy, onClose, onSubmit }: {
  insurance: InsuranceInfo;
  busy: boolean;
  onClose: () => void;
  onSubmit: (insurance: Omit<InsuranceInfo, "updatedAt">) => Promise<void>;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      provider: String(form.get("provider") ?? ""),
      planName: String(form.get("planName") ?? ""),
      memberId: String(form.get("memberId") ?? ""),
    };
    const found = validateText(values, { provider: 80, planName: 80, memberId: 40 });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(event.currentTarget, Object.keys(found)[0]);
      return;
    }
    void onSubmit(values);
  }

  return <Modal confirmDiscard labelledBy="insurance-title" closeDisabled={busy} onClose={onClose}><p className="eyebrow">COVERAGE DETAILS</p><h2 id="insurance-title">Update insurance</h2><p>Use fictional coverage information for this demonstration.</p><form onSubmit={submit} noValidate><label>Insurance provider<input name="provider" maxLength={80} defaultValue={insurance.provider} {...fieldProps("provider", errors)} /></label><FieldError name="provider" errors={errors} /><label>Plan name<input name="planName" maxLength={80} defaultValue={insurance.planName} {...fieldProps("planName", errors)} /></label><FieldError name="planName" errors={errors} /><label>Member ID<input name="memberId" maxLength={40} defaultValue={insurance.memberId} {...fieldProps("memberId", errors)} /></label><FieldError name="memberId" errors={errors} /><p className="form-hint">All fields are required. Do not enter real policy information.</p><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : "Save insurance"}</button></form></Modal>;
}

function LabResultModal({ onClose }: { onClose: () => void }) {
  return <Modal labelledBy="lab-result-title" className="clinical-modal" dismissOnBackdrop onClose={onClose}><p className="eyebrow">FINAL RESULT</p><h2 id="lab-result-title">Complete blood count</h2><p>A routine blood test measuring red cells, white cells, and platelets · Collected July 23, 2026 at 8:15 AM · Ordered by Dr. Ana Costa</p><table className="lab-table"><caption>Complete blood count values</caption><thead><tr><th scope="col">Test</th><th scope="col">Result</th><th scope="col">Normal range</th></tr></thead><tbody>{[["Hemoglobin", "13.6 g/dL", "12.0–15.5"], ["White blood cells", "6.4 K/uL", "4.5–11.0"], ["Platelets", "248 K/uL", "150–450"]].map(([test, result, range]) => <tr key={test}><th scope="row">{test}</th><td><b>{result}</b></td><td>{range}</td></tr>)}</tbody></table><p className="demo-disclaimer">All values are fictional and provided only for QA training.</p><button className="primary-button full" onClick={onClose}>Done</button></Modal>;
}

function downloadVisitSummary() {
  const rows = [
    ["Field", "Value"],
    ["Patient", "Maria Lopez"],
    ["Visit date", "July 12, 2026"],
    ["Provider", "Dr. Ana Costa"],
    ["Visit type", "Primary care follow-up"],
    ["Assessment", "Blood pressure stable"],
    ["Plan", "Continue Losartan 50 mg and follow up in 3 months"],
    ["Notice", "Fictional demo data for QA training. Not a medical record and not medical advice."],
  ];
  const csv = rows
    .map(row => row.map(value => `"${value.replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "maria-lopez-visit-summary.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function VisitSummaryModal({ onClose }: { onClose: () => void }) {
  return <Modal labelledBy="visit-summary-title" className="clinical-modal" dismissOnBackdrop onClose={onClose}><p className="eyebrow">VISIT SUMMARY</p><h2 id="visit-summary-title">Primary care follow-up</h2><p>Maria Lopez · July 12, 2026 · Dr. Ana Costa</p><dl className="review-details"><div><dt>Reason for visit</dt><dd>Routine follow-up</dd></div><div><dt>Assessment</dt><dd>Blood pressure stable</dd></div><div><dt>Medication</dt><dd>Continue Losartan 50 mg daily</dd></div><div><dt>Care plan</dt><dd>Continue home monitoring and follow up in 3 months</dd></div></dl><p className="demo-disclaimer">Sample data · Not a real patient</p><button className="primary-button full" onClick={downloadVisitSummary}><Icon name="download" size={15} /> Download CSV</button><button className="secondary-button full" onClick={onClose}>Close</button></Modal>;
}

function IntakeFormModal({ intakeSubmission, busy, onClose, onSubmit }: {
  intakeSubmission: IntakeSubmission | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (intake: Omit<IntakeSubmission, "submittedAt">) => Promise<void>;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      currentSymptoms: String(form.get("currentSymptoms") ?? ""),
      medicationChanges: String(form.get("medicationChanges") ?? ""),
      allergies: String(form.get("allergies") ?? ""),
    };
    const found = validateText(values, {
      currentSymptoms: 240,
      medicationChanges: 240,
      allergies: 160,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(event.currentTarget, Object.keys(found)[0]);
      return;
    }
    void onSubmit({
      reasonForVisit: String(form.get("reasonForVisit")) as IntakeSubmission["reasonForVisit"],
      ...values,
    });
  }

  return <Modal confirmDiscard labelledBy="intake-form-title" className="intake-modal" closeDisabled={busy} onClose={onClose}><p className="eyebrow">{intakeSubmission ? "UPDATE INTAKE" : "PRE-VISIT INTAKE"}</p><h2 id="intake-form-title">{intakeSubmission ? "Review your answers" : "Tell us about your visit"}</h2><p>Your answers are shared with clinic staff for this QA demonstration.</p><form onSubmit={submit} noValidate><label>Reason for visit<select name="reasonForVisit" defaultValue={intakeSubmission?.reasonForVisit ?? "Routine follow-up"}><option>Routine follow-up</option><option>New symptoms</option><option>Medication review</option></select></label><label>Current symptoms<textarea name="currentSymptoms" maxLength={240} defaultValue={intakeSubmission?.currentSymptoms ?? ""} placeholder="Describe symptoms or enter None" {...fieldProps("currentSymptoms", errors)} /></label><FieldError name="currentSymptoms" errors={errors} /><label>Medication changes<textarea name="medicationChanges" maxLength={240} defaultValue={intakeSubmission?.medicationChanges ?? ""} placeholder="Describe changes or enter None" {...fieldProps("medicationChanges", errors)} /></label><FieldError name="medicationChanges" errors={errors} /><label>Allergies<input name="allergies" maxLength={160} defaultValue={intakeSubmission?.allergies ?? ""} placeholder="List allergies or enter None" {...fieldProps("allergies", errors)} /></label><FieldError name="allergies" errors={errors} /><p className="form-hint">Use fictional information only. All fields are required.</p><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : intakeSubmission ? "Update form" : "Submit form"}</button></form></Modal>;
}

function MessageCenter({ role, sharedRecord, messages, busy, unread, onSend, onRead }: {
  role: Role;
  sharedRecord: boolean;
  messages: DemoMessage[];
  busy: boolean;
  unread: number;
  onSend: (messageBody: string) => Promise<boolean>;
  onRead: () => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");

  // Opening the thread is what marks it read, so the badge reflects reality.
  useEffect(() => {
    if (unread > 0) void onRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSend(draft);
    if (saved) setDraft("");
  }

  return <div className="page-content message-page"><div className="welcome-row"><div><p className="eyebrow">{role === "patient" ? "PATIENT PORTAL" : "CLINIC STAFF"}</p><h1>Messages</h1><p className="subtitle">A shared demo conversation between Maria Lopez and the care team.</p></div></div>{sharedRecord && <SharedRecordNotice />}<section className="panel conversation-panel" aria-label="Care team conversation"><header><span className="patient-avatar">{role === "patient" ? "CT" : "ML"}</span><div><strong>{role === "patient" ? "Care team" : "Maria Lopez"}</strong><small>{role === "patient" ? "Primary Care" : "Patient portal"}</small></div><span className="conversation-status"><i></i> Sample conversation</span></header><div className="message-thread" aria-live="polite">{messages.length === 0 && <p className="message-empty">No messages yet. Anything you send appears here for the care team.</p>}{messages.map(message => <article key={message.id} className={message.sender === role ? "message-bubble own" : "message-bubble"}><span>{message.sender === "patient" ? "Maria Lopez" : "Care team"}</span><p>{message.body}</p><time>{message.sentAt}</time></article>)}</div><form className="message-composer" onSubmit={submit}><label htmlFor="message-body">Reply to {role === "patient" ? "your care team" : "Maria Lopez"}</label><div><textarea id="message-body" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Write a demo message…" required /><button className="primary-button" type="submit" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send message"}</button></div><small>{draft.length}/500 · No real patient information</small></form></section></div>;
}

function IntakeReviewModal({ intakeSubmission, onClose }: { intakeSubmission: IntakeSubmission; onClose: () => void }) {
  return <Modal labelledBy="intake-review-title" dismissOnBackdrop onClose={onClose}><p className="eyebrow">SUBMITTED INTAKE</p><h2 id="intake-review-title">Maria Lopez</h2><p>Submitted through the patient portal on {intakeSubmission.submittedAt}.</p><dl className="review-details"><div><dt>Reason for visit</dt><dd>{intakeSubmission.reasonForVisit}</dd></div><div><dt>Current symptoms</dt><dd>{intakeSubmission.currentSymptoms}</dd></div><div><dt>Medication changes</dt><dd>{intakeSubmission.medicationChanges}</dd></div><div><dt>Allergies</dt><dd>{intakeSubmission.allergies}</dd></div><div><dt>Submission status</dt><dd><span className="review-status">Complete</span></dd></div></dl><p className="demo-disclaimer">Sample data · Not a real patient</p><button className="primary-button full" onClick={onClose}>Done</button></Modal>;
}
