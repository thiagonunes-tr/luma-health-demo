"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
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

type Role = "patient" | "staff";
type AppointmentAdvanceAction =
  | "check-in-appointment"
  | "start-appointment"
  | "complete-appointment";
type Toast = { title: string; message: string; tone: "success" | "error" } | null;
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
  { time: "9:15 AM", patient: "Jordan Lee", type: "Follow-up", status: "Waiting" },
  { time: "10:00 AM", patient: "Alex Carter", type: "First appointment", status: "Confirmed" },
  { time: "11:30 AM", patient: "Priya Shah", type: "Follow-up", status: "Confirmed" },
];

const patientProfiles: PatientProfile[] = [
  { name: "Maria Lopez", initials: "ML", dateOfBirth: "May 14, 1987", email: "patient.demo@testrigor-mail.com", lastVisit: "July 12, 2026" },
  { name: "Alex Carter", initials: "AC", dateOfBirth: "September 3, 1991", email: "alex.carter@example.test", lastVisit: "June 28, 2026" },
  { name: "Priya Shah", initials: "PS", dateOfBirth: "January 22, 1979", email: "priya.shah@example.test", lastVisit: "July 3, 2026" },
  { name: "Jordan Lee", initials: "JL", dateOfBirth: "November 8, 1984", email: "jordan.lee@example.test", lastVisit: "May 19, 2026" },
  { name: "Riley Smith", initials: "RS", dateOfBirth: "March 30, 1995", email: "riley.smith@example.test", lastVisit: "June 11, 2026" },
];

const navItems = ["Overview", "Appointments", "Forms", "Results", "Messages"];
const navIcons: IconName[] = [
  "home",
  "calendar",
  "clipboard",
  "flask",
  "message",
];

function formatAppointmentTime(time: AppointmentTime): string {
  return {
    "09:00": "9:00 AM",
    "10:30": "10:30 AM",
    "15:00": "3:00 PM",
  }[time];
}

function appointmentStatusLabel(status: AppointmentStatus): string {
  return {
    none: "No appointment",
    scheduled: "Scheduled",
    "checked-in": "Checked in",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[status];
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [showBooking, setShowBooking] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);
  const [showLabResult, setShowLabResult] = useState(false);
  const [showVisitSummary, setShowVisitSummary] = useState(false);
  const [appointmentBooked, setAppointmentBooked] = useState(false);
  const [appointmentStatus, setAppointmentStatus] =
    useState<AppointmentStatus>("none");
  const [appointmentTime, setAppointmentTime] =
    useState<AppointmentTime>("10:30");
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [intakeSubmission, setIntakeSubmission] =
    useState<IntakeSubmission | null>(null);
  const [refillStatus, setRefillStatus] = useState<RefillStatus>("none");
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [insurance, setInsurance] = useState<InsuranceInfo>({
    provider: "HealthFirst Demo",
    planName: "Silver Care",
    memberId: "HF-2048",
    updatedAt: "Initial demo record",
  });
  const [demoBusy, setDemoBusy] = useState<DemoStateAction | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  const dateLabel = useMemo(() =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long" })
      .format(new Date(2026, 6, 24)), []);
  const role = user?.role ?? "patient";
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
      .then(sessionUser => { if (active) setUser(sessionUser); })
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
        if (active) applyDemoState(data.state);
      })
      .catch(error => {
        if (active) {
          notify(
            "Environment unavailable",
            error instanceof Error ? error.message : "Please reload and try again.",
            "error",
          );
        }
      });
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
        setActiveNav("Overview");
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
      setActiveNav("Overview");
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

  function applyDemoState(state: DemoState) {
    setAppointmentBooked(state.appointmentBooked);
    setAppointmentStatus(state.appointmentStatus);
    setAppointmentTime(state.appointmentTime);
    setIntakeComplete(state.intakeComplete);
    setIntakeSubmission(state.intakeSubmission);
    setRefillStatus(state.refillStatus);
    setMessages(state.messages);
    setInsurance(state.insurance);
  }

  async function performDemoAction(
    action: DemoStateAction,
    successTitle: string,
    successMessage: string,
    input: {
      appointmentTime?: AppointmentTime;
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
        throw new Error(data.error ?? "The change could not be saved.");
      }
      applyDemoState(data.state);
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
    const isRescheduling = appointmentStatus === "scheduled";
    const saved = await performDemoAction(
      isRescheduling ? "reschedule-appointment" : "book-appointment",
      isRescheduling ? "Appointment rescheduled" : "Appointment booked",
      `Your appointment is confirmed for July 24 at ${formatAppointmentTime(selectedTime)}.`,
      { appointmentTime: selectedTime },
    );
    if (saved) setShowBooking(false);
  }

  async function cancelAppointment() {
    const saved = await performDemoAction(
      "cancel-appointment",
      "Appointment cancelled",
      "The clinic schedule and your portal have been updated.",
    );
    if (saved) setShowBooking(false);
  }

  async function requestRefill() {
    await performDemoAction(
      "request-refill",
      "Request submitted",
      "The clinic team can now review your refill request.",
    );
  }

  async function submitIntake(
    intake: Omit<IntakeSubmission, "submittedAt">,
  ) {
    const saved = await performDemoAction(
      "submit-intake",
      intakeComplete ? "Form updated" : "Form submitted",
      "Your answers are available to the clinic team.",
      { intake },
    );
    if (saved) setShowIntake(false);
  }

  async function sendMessage(messageBody: string) {
    return performDemoAction(
      "send-message",
      "Message sent",
      role === "patient"
        ? "Your care team can now read your message."
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
    if (saved) setShowInsurance(false);
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
      "check-in-appointment": {
        title: "Patient checked in",
        message: "Maria Lopez is ready for the clinical team.",
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
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i></i><b></b></span>
          <span>Luma <strong>Health</strong></span>
        </div>

        <div className="role-label" aria-label="Signed-in account type">
          <span><Icon name="shield-check" size={13} /></span>{role === "patient" ? "Patient portal" : "Employee access"}
        </div>

        <nav>
          <p className="nav-label">MENU</p>
          {navItems.map((item, index) => (
            <button
              key={item}
              className={activeNav === item ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(item)}
            >
              <span className="nav-icon"><Icon name={navIcons[index]} size={18} /></span>
              {item}
              {item === "Messages" && <span className="nav-badge">{messages.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <span className="help-icon"><Icon name="help-circle" size={18} /></span>
          <div><strong>Need help?</strong><small>Contact our team</small></div>
        </div>
        <button className="sidebar-user" onClick={signOut} aria-label="Sign out">
          <span className="avatar">{initials}</span>
          <div><strong>{displayName}</strong><small>{role === "patient" ? "Patient" : "Administrator"}</small></div>
          <span className="sign-out">Sign out</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setActiveNav("Overview")} aria-label="Back to overview">
            <span className="brand-mark small" aria-hidden="true"><i></i><b></b></span>Luma Health
          </button>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search"><Icon name="search" size={18} /></button>
            <button className="icon-button notification" aria-label="Notifications"><Icon name="bell" size={18} /><span></span></button>
            <button className="top-user" onClick={signOut} aria-label="Sign out"><span className="avatar">{initials}</span><span><strong>{displayName}</strong><small>{role === "patient" ? "Patient · Sign out" : "Clinic staff · Sign out"}</small></span></button>
          </div>
        </header>

        {activeNav === "Messages" ? (
          <MessageCenter
            role={role}
            messages={messages}
            busy={demoBusy !== null}
            onSend={sendMessage}
          />
        ) : activeNav === "Results" ? (
          <ClinicalDocuments
            role={role}
            onOpenLab={() => setShowLabResult(true)}
            onOpenSummary={() => setShowVisitSummary(true)}
          />
        ) : role === "patient" && activeNav === "Forms" ? (
          <PatientForms
            intakeComplete={intakeComplete}
            insurance={insurance}
            onOpenIntake={() => setShowIntake(true)}
            onOpenInsurance={() => setShowInsurance(true)}
          />
        ) : role === "patient" ? (
          <PatientDashboard
            patientName={displayName.split(/\s+/)[0] || "there"}
            activeNav={activeNav}
            dateLabel={dateLabel}
            appointmentStatus={appointmentStatus}
            appointmentTime={appointmentTime}
            intakeComplete={intakeComplete}
            refillStatus={refillStatus}
            busy={demoBusy !== null}
            onBook={() => setShowBooking(true)}
            onOpenIntake={() => setShowIntake(true)}
            onOpenMessages={() => setActiveNav("Messages")}
            onOpenLab={() => setShowLabResult(true)}
            onOpenSummary={() => setShowVisitSummary(true)}
            onRequestRefill={requestRefill}
          />
        ) : (
          <StaffDashboard
            staffName={displayName.split(/\s+/)[0] || "there"}
            appointmentBooked={appointmentBooked}
            appointmentStatus={appointmentStatus}
            appointmentTime={appointmentTime}
            intakeComplete={intakeComplete}
            intakeSubmission={intakeSubmission}
            insurance={insurance}
            refillStatus={refillStatus}
            busy={demoBusy !== null}
            onApproveRefill={approveRefill}
            onDeclineRefill={declineRefill}
            onAdvanceAppointment={advanceAppointment}
            onOpenSummary={() => setShowVisitSummary(true)}
          />
        )}

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item, index) => {
            return <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><span><Icon name={navIcons[index]} size={19} /></span>{item.split(" ")[0]}</button>;
          })}
        </nav>
      </section>

      {showBooking && <BookingModal appointmentStatus={appointmentStatus} appointmentTime={appointmentTime} busy={demoBusy !== null} onCancel={cancelAppointment} onClose={() => setShowBooking(false)} onSubmit={bookAppointment} />}
      {showIntake && <IntakeFormModal intakeSubmission={intakeSubmission} busy={demoBusy !== null} onClose={() => setShowIntake(false)} onSubmit={submitIntake} />}
      {showInsurance && <InsuranceModal insurance={insurance} busy={demoBusy !== null} onClose={() => setShowInsurance(false)} onSubmit={updateInsurance} />}
      {showLabResult && <LabResultModal onClose={() => setShowLabResult(false)} />}
      {showVisitSummary && <VisitSummaryModal onClose={() => setShowVisitSummary(false)} />}
      {toast && <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}><span><Icon name={toast.tone === "error" ? "alert-circle" : "check"} size={16} /></span><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button onClick={() => setToast(null)} aria-label="Close"><Icon name="close" size={17} /></button></div>}
    </main>
  );
}

function AuthLoading() {
  return <main className="auth-shell"><div className="auth-loading" role="status"><span className="brand-mark" aria-hidden="true"><i></i><b></b></span><p>Loading secure access…</p></div></main>;
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
    <section className="auth-story" aria-label="Luma Health introduction">
      <div className="auth-brand"><span className="brand-mark" aria-hidden="true"><i></i><b></b></span><span>Luma <strong>Health</strong></span></div>
      <div className="auth-story-copy">
        <p className="eyebrow light">SECURE DIGITAL CARE</p>
        <h1>Healthcare access,<br />made reassuringly simple.</h1>
        <p>Patients and clinic employees use the same secure sign-in, with an email verification code protecting every account.</p>
      </div>
      <div className="security-note"><span><Icon name="shield-check" size={18} /></span><div><strong>Two-step verification</strong><small>Your password and a one-time email code protect your account.</small></div></div>
    </section>
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
              <p>A real verification code will be sent by email after sign-in.</p>
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
            <label>Verification code<input className="code-input" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus required /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and sign in"}</button>
          </form>
          <p className="resend-copy">Didn&apos;t receive it? <button type="button" onClick={onResend} disabled={busy}>Send a new code</button></p>
        </>}
      </div>
      <p className="privacy-copy">Protected access · Demo environment · No real patient data</p>
    </section>
  </main>;
}

function PatientDashboard({ patientName, activeNav, dateLabel, appointmentStatus, appointmentTime, intakeComplete, refillStatus, busy, onBook, onOpenIntake, onOpenMessages, onOpenLab, onOpenSummary, onRequestRefill }: {
  patientName: string;
  activeNav: string;
  dateLabel: string;
  appointmentStatus: AppointmentStatus;
  appointmentTime: AppointmentTime;
  intakeComplete: boolean;
  refillStatus: RefillStatus;
  busy: boolean;
  onBook: () => void;
  onOpenIntake: () => void;
  onOpenMessages: () => void;
  onOpenLab: () => void;
  onOpenSummary: () => void;
  onRequestRefill: () => void | Promise<unknown>;
}) {
  const hasActiveAppointment = ["scheduled", "checked-in", "in-progress"].includes(
    appointmentStatus,
  );
  const canBookAppointment = ["none", "cancelled", "completed"].includes(
    appointmentStatus,
  );

  return <div className="page-content">
    <div className="welcome-row">
      <div><p className="eyebrow">PATIENT PORTAL</p><h1>{activeNav === "Overview" ? `Hello, ${patientName}.` : activeNav}</h1><p className="subtitle">{activeNav === "Overview" ? "Here is a summary of your care today." : "Keep track of your health information in one place."}</p></div>
      <button className="primary-button" onClick={onBook}><Icon name={canBookAppointment ? "plus" : "calendar"} size={17} /> {canBookAppointment ? "Book appointment" : "Manage appointment"}</button>
    </div>

    <section className="hero-card">
      <div className="hero-copy">
        <span className="status-pill"><i></i> {appointmentStatusLabel(appointmentStatus).toUpperCase()}</span>
        <p className="hero-date">{hasActiveAppointment ? "July 24" : "Patient portal"}</p>
        <h2>{hasActiveAppointment ? "Follow-up appointment" : appointmentStatus === "completed" ? "Visit completed" : appointmentStatus === "cancelled" ? "Appointment cancelled" : "No appointment scheduled"}</h2>
        <p className="doctor"><span className="doctor-avatar">AC</span><span><strong>Dr. Ana Costa</strong><small>Primary Care · Room 204</small></span></p>
      </div>
      <div className="appointment-time">
        <strong>{hasActiveAppointment ? formatAppointmentTime(appointmentTime) : appointmentStatus === "completed" ? "DONE" : "—"}</strong><span>{hasActiveAppointment ? "local time" : "book when ready"}</span>
        <button onClick={onBook}>{canBookAppointment ? "Book now" : "View details"} <Icon name="arrow-right" size={13} /></button>
      </div>
      <div className="hero-decoration" aria-hidden="true"><i></i><b></b><em></em></div>
    </section>

    <div className="section-heading"><div><h2>Quick actions</h2><p>What would you like to do?</p></div></div>
    <section className="quick-grid">
      <QuickCard color="blue" icon="calendar" title={canBookAppointment ? "Book an appointment" : "Manage appointment"} text={hasActiveAppointment ? `${appointmentStatusLabel(appointmentStatus)} · ${formatAppointmentTime(appointmentTime)}` : appointmentStatus === "cancelled" ? "Previous appointment cancelled" : appointmentStatus === "completed" ? "Previous visit completed" : "Choose the best date and time"} action={canBookAppointment ? "Book now" : appointmentStatus === "scheduled" ? "Reschedule or cancel" : "View status"} onClick={onBook} />
      <QuickCard color="coral" icon="clipboard" title="Intake form" text={intakeComplete ? "Your answers are available to the clinic" : "Takes about 3 minutes"} action={intakeComplete ? "Review or update" : "Complete form"} onClick={onOpenIntake} done={intakeComplete} disabled={busy} />
      <QuickCard color="mint" icon="pill" title="Request a refill" text={refillStatus === "approved" ? "Refill approved by the clinic" : refillStatus === "pending" ? "Under staff review" : refillStatus === "rejected" ? "The clinic declined the previous request" : "Request it quickly and securely"} action={refillStatus === "approved" ? "Approved" : refillStatus === "pending" ? "Under review" : refillStatus === "rejected" ? "Request again" : "Request refill"} onClick={onRequestRefill} done={refillStatus === "pending" || refillStatus === "approved"} disabled={busy || refillStatus === "pending" || refillStatus === "approved"} />
    </section>

    <section className="content-grid">
      <div className="panel activity-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest updates</p></div><button>View all</button></div>
        <Activity icon="flask" color="green" title="Result available" text="Complete blood count" time="Today, 9:42 AM" action="View" onClick={onOpenLab} />
        <Activity icon={refillStatus === "approved" ? "pill" : "clipboard"} color="purple" title={refillStatus === "approved" ? "Refill approved" : "Visit summary"} text={refillStatus === "approved" ? "Losartan 50 mg" : "July 12 appointment"} time={refillStatus === "approved" ? "Now" : "Jul 12, 4:20 PM"} action="Open" onClick={refillStatus === "approved" ? undefined : onOpenSummary} />
        <Activity icon="mail" color="orange" title="New message" text="Care team" time="Jul 24, 9:10 AM" action="Reply" onClick={onOpenMessages} />
      </div>
      <aside className="panel care-panel">
        <div className="care-header"><span className="care-mark"><Icon name="heart" size={16} /></span><div><h2>Your care is on track</h2><p>Keep it up, Maria!</p></div></div>
        <div className="progress-ring"><span>75<small>%</small></span></div>
        <div className="care-copy"><strong>3 of 4 tasks completed</strong><p>Complete your form before your next appointment.</p></div>
        <button onClick={onOpenIntake} disabled={busy}>{intakeComplete ? "Review answers" : "Continue task"} <Icon name="arrow-right" size={13} /></button>
      </aside>
    </section>
    <p className="date-note">Demo data · {dateLabel}</p>
  </div>;
}

function StaffDashboard({
  staffName,
  appointmentBooked,
  appointmentStatus,
  appointmentTime,
  intakeComplete,
  intakeSubmission,
  insurance,
  refillStatus,
  busy,
  onApproveRefill,
  onDeclineRefill,
  onAdvanceAppointment,
  onOpenSummary,
}: {
  staffName: string;
  appointmentBooked: boolean;
  appointmentStatus: AppointmentStatus;
  appointmentTime: AppointmentTime;
  intakeComplete: boolean;
  intakeSubmission: IntakeSubmission | null;
  insurance: InsuranceInfo;
  refillStatus: RefillStatus;
  busy: boolean;
  onApproveRefill: () => void | Promise<unknown>;
  onDeclineRefill: () => void | Promise<unknown>;
  onAdvanceAppointment: (action: AppointmentAdvanceAction) => void | Promise<unknown>;
  onOpenSummary: () => void;
}) {
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showIntakeReview, setShowIntakeReview] = useState(false);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
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
  const requestCount =
    2 + Number(refillStatus === "pending") + Number(intakeComplete);

  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">CLINIC DASHBOARD</p><h1>Good morning, {staffName}.</h1><p className="subtitle">Track today&apos;s schedule and requests that need attention.</p></div><button className="secondary-button" onClick={() => setShowPatientSearch(true)}><Icon name="search" size={16} /> Search patients</button></div>
    <section className="metric-grid">
      <Metric value={appointmentBooked ? "13" : "12"} label="Appointments today" detail={appointmentBooked ? "1 new from patient portal" : "4 waiting"} tone="blue" />
      <Metric value={refillStatus === "pending" ? "3" : "2"} label="Pending refills" detail="Review requests" tone="coral" />
      <Metric value={intakeComplete ? "6" : "5"} label="Forms received" detail={intakeComplete ? "1 new from patient portal" : "2 new today"} tone="mint" />
    </section>
    <section className="staff-layout">
      <div className="panel schedule-panel">
        <div className="panel-heading"><div><h2>Today&apos;s schedule</h2><p>Friday, July 24</p></div><button>View schedule</button></div>
        {staffAppointments.map(item => <div className={`schedule-row${item.fromPatientPortal ? " newly-booked" : ""}`} key={`${item.time}-${item.patient}`}><strong>{item.time}</strong><span className="patient-avatar">{item.patient.split(" ").map(n => n[0]).join("")}</span><div><b>{item.patient}</b><small>{item.type}</small></div><span className={`queue-status ${item.status === "Waiting" ? "waiting" : ""}`}>{item.status}</span><button aria-label={item.fromPatientPortal ? "Review Maria Lopez's new appointment" : `Open ${item.patient}'s record`} onClick={item.fromPatientPortal ? () => setShowAppointmentDetails(true) : undefined}><Icon name="arrow-right" size={15} /></button></div>)}
      </div>
      <div className="panel request-panel">
        <div className="panel-heading"><div><h2>Requests</h2><p>Need your attention</p></div><span className="count-badge">{requestCount}</span></div>
        {refillStatus === "pending" && <div className="request-card highlighted"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Refill · Losartan 50 mg</small></div><span>Now</span></div><p>Ongoing medication · Last refill 30 days ago.</p><div className="request-actions"><button className="reject" onClick={onDeclineRefill} disabled={busy}>Decline</button><button className="approve" onClick={onApproveRefill} disabled={busy}>Approve</button></div></div>}
        {refillStatus === "rejected" && <div className="request-card highlighted"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Refill · Losartan 50 mg</small></div><span>Reviewed</span></div><p>Request declined · The patient may submit another request.</p></div>}
        {intakeComplete && <div className="request-card highlighted" aria-label="Maria Lopez submitted intake form"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Intake form · Patient portal</small></div><span>Now</span></div><p>Submitted for the July 24 follow-up appointment.</p><button className="text-action" onClick={() => setShowIntakeReview(true)}>Review form <Icon name="arrow-right" size={13} /></button></div>}
        <div className="request-card"><div className="request-top"><span className="patient-avatar lavender">AC</span><div><strong>Alex Carter</strong><small>Intake form</small></div><span>12 min</span></div><button className="text-action">Review form <Icon name="arrow-right" size={13} /></button></div>
        <div className="request-card"><div className="request-top"><span className="patient-avatar peach">PS</span><div><strong>Priya Shah</strong><small>Appointment change</small></div><span>28 min</span></div><button className="text-action">Open request <Icon name="arrow-right" size={13} /></button></div>
      </div>
    </section>
    {showAppointmentDetails && <AppointmentReviewModal appointmentStatus={appointmentStatus} appointmentTime={appointmentTime} busy={busy} onAdvance={onAdvanceAppointment} onOpenSummary={onOpenSummary} onClose={() => setShowAppointmentDetails(false)} />}
    {showIntakeReview && intakeSubmission && <IntakeReviewModal intakeSubmission={intakeSubmission} onClose={() => setShowIntakeReview(false)} />}
    {showPatientSearch && <PatientSearchModal appointmentStatus={appointmentStatus} appointmentTime={appointmentTime} intakeComplete={intakeComplete} refillStatus={refillStatus} insurance={insurance} onOpenSummary={onOpenSummary} onClose={() => setShowPatientSearch(false)} />}
  </div>;
}

function QuickCard({ color, icon, title, text, action, onClick, done = false, disabled = false }: { color: string; icon: IconName; title: string; text: string; action: string; onClick: () => void | Promise<unknown>; done?: boolean; disabled?: boolean }) {
  return <button className="quick-card" onClick={onClick} disabled={disabled}><span className={`quick-icon ${color}`}><Icon name={done ? "check" : icon} size={20} /></span><span><strong>{title}</strong><small>{text}</small><b>{action} <Icon name="arrow-right" size={13} /></b></span></button>;
}

function Activity({ icon, color, title, text, time, action, onClick }: { icon: IconName; color: string; title: string; text: string; time: string; action: string; onClick?: () => void }) {
  return <div className="activity-row"><span className={`activity-icon ${color}`}><Icon name={icon} size={15} /></span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time><button onClick={onClick}>{action}</button></div>;
}

function Metric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: string }) {
  return <div className={`metric-card ${tone}`}><span className="metric-dot"></span><strong>{value}</strong><h3>{label}</h3><p>{detail} <Icon name="arrow-right" size={12} /></p></div>;
}

function BookingModal({ appointmentStatus, appointmentTime, busy, onCancel, onClose, onSubmit }: { appointmentStatus: AppointmentStatus; appointmentTime: AppointmentTime; busy: boolean; onCancel: () => void | Promise<void>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const canManage = appointmentStatus === "scheduled";
  const canBook = ["none", "cancelled", "completed"].includes(appointmentStatus);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><Icon name="close" size={18} /></button><p className="eyebrow">{canManage ? "MANAGE APPOINTMENT" : canBook ? "NEW APPOINTMENT" : "APPOINTMENT STATUS"}</p><h2 id="booking-title">{canManage ? "Reschedule or cancel" : canBook ? "Find a time" : appointmentStatusLabel(appointmentStatus)}</h2><p>{canManage || canBook ? "Choose the time that works best for you." : "The clinic has already started processing this visit, so changes are no longer available."}</p>{canManage || canBook ? <form onSubmit={onSubmit}><label>Specialty<select defaultValue="Primary Care"><option>Primary Care</option><option>Cardiology</option><option>Dermatology</option></select></label><label>Provider<select defaultValue="Dr. Ana Costa"><option>Dr. Ana Costa</option><option>Dr. John Lima</option></select></label><fieldset><legend>Available times · July 24</legend><div className="time-options"><label><input type="radio" name="time" value="09:00" defaultChecked={appointmentTime === "09:00"} />9:00 AM</label><label><input type="radio" name="time" value="10:30" defaultChecked={appointmentTime === "10:30"} />10:30 AM</label><label><input type="radio" name="time" value="15:00" defaultChecked={appointmentTime === "15:00"} />3:00 PM</label></div></fieldset><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : canManage ? "Save new time" : "Confirm appointment"}</button>{canManage && <button className="danger-button full" type="button" onClick={onCancel} disabled={busy}>Cancel appointment</button>}</form> : <><dl className="review-details"><div><dt>Date and time</dt><dd>July 24 · {formatAppointmentTime(appointmentTime)}</dd></div><div><dt>Provider</dt><dd>Dr. Ana Costa</dd></div><div><dt>Status</dt><dd><span className="review-status">{appointmentStatusLabel(appointmentStatus)}</span></dd></div></dl><button className="primary-button full" onClick={onClose}>Done</button></>}</div></div>;
}

function AppointmentReviewModal({ appointmentStatus, appointmentTime, busy, onAdvance, onOpenSummary, onClose }: { appointmentStatus: AppointmentStatus; appointmentTime: AppointmentTime; busy: boolean; onAdvance: (action: AppointmentAdvanceAction) => void | Promise<unknown>; onOpenSummary: () => void; onClose: () => void }) {
  const nextAction = {
    scheduled: { action: "check-in-appointment" as const, label: "Check in patient" },
    "checked-in": { action: "start-appointment" as const, label: "Start visit" },
    "in-progress": { action: "complete-appointment" as const, label: "Complete visit" },
  }[appointmentStatus as "scheduled" | "checked-in" | "in-progress"];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="appointment-review-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button><p className="eyebrow">PATIENT PORTAL BOOKING</p><h2 id="appointment-review-title">Appointment details</h2><p>This appointment was booked by Maria Lopez and is part of the shared clinic schedule.</p><dl className="review-details"><div><dt>Patient</dt><dd>Maria Lopez</dd></div><div><dt>Date and time</dt><dd>July 24 · {formatAppointmentTime(appointmentTime)}</dd></div><div><dt>Provider</dt><dd>Dr. Ana Costa</dd></div><div><dt>Visit type</dt><dd>Primary Care · Follow-up</dd></div><div><dt>Status</dt><dd><span className="review-status">{appointmentStatusLabel(appointmentStatus)}</span></dd></div></dl>{nextAction && <button className="primary-button full" disabled={busy} onClick={() => void onAdvance(nextAction.action)}>{busy ? "Saving…" : nextAction.label}</button>}<button className="secondary-button full" onClick={onOpenSummary}>Open visit summary</button><button className="secondary-button full" onClick={onClose}>Close</button></div></div>;
}

function PatientSearchModal({ appointmentStatus, appointmentTime, intakeComplete, refillStatus, insurance, onOpenSummary, onClose }: { appointmentStatus: AppointmentStatus; appointmentTime: AppointmentTime; intakeComplete: boolean; refillStatus: RefillStatus; insurance: InsuranceInfo; onOpenSummary: () => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const results = patientProfiles.filter(patient =>
    patient.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal patient-search-modal" role="dialog" aria-modal="true" aria-labelledby="patient-search-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>{selectedPatient ? <><button className="auth-back" type="button" onClick={() => setSelectedPatient(null)}><Icon name="arrow-left" size={14} /> Back to results</button><p className="eyebrow">PATIENT PROFILE</p><div className="patient-profile-heading"><span className="patient-avatar">{selectedPatient.initials}</span><div><h2 id="patient-search-title">{selectedPatient.name}</h2><p>{selectedPatient.email}</p></div></div><dl className="review-details"><div><dt>Date of birth</dt><dd>{selectedPatient.dateOfBirth}</dd></div><div><dt>Last visit</dt><dd>{selectedPatient.lastVisit}</dd></div>{selectedPatient.name === "Maria Lopez" && <><div><dt>Appointment</dt><dd>{appointmentStatusLabel(appointmentStatus)}{appointmentStatus !== "none" ? ` · ${formatAppointmentTime(appointmentTime)}` : ""}</dd></div><div><dt>Intake</dt><dd>{intakeComplete ? "Submitted" : "Not submitted"}</dd></div><div><dt>Refill</dt><dd>{refillStatus === "none" ? "No request" : refillStatus}</dd></div><div><dt>Insurance</dt><dd>{insurance.provider} · {insurance.planName}</dd></div></>}</dl>{selectedPatient.name === "Maria Lopez" && <button className="secondary-button full" onClick={onOpenSummary}>Open visit summary</button>}<p className="demo-disclaimer">Predictable demo profile · No real patient data</p></> : <><p className="eyebrow">PATIENT DIRECTORY</p><h2 id="patient-search-title">Search patients</h2><p>Find a predictable demo patient by name.</p><label className="patient-search-input"><span>Patient name</span><div><Icon name="search" size={17} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name" /></div></label><div className="patient-results" aria-live="polite">{results.map(patient => <button key={patient.email} onClick={() => setSelectedPatient(patient)}><span className="patient-avatar">{patient.initials}</span><span><strong>{patient.name}</strong><small>{patient.email}</small></span><Icon name="arrow-right" size={15} /></button>)}{results.length === 0 && <p>No patients found.</p>}</div></>} </div></div>;
}

function PatientForms({ intakeComplete, insurance, onOpenIntake, onOpenInsurance }: {
  intakeComplete: boolean;
  insurance: InsuranceInfo;
  onOpenIntake: () => void;
  onOpenInsurance: () => void;
}) {
  return <div className="page-content"><div className="welcome-row"><div><p className="eyebrow">PATIENT PORTAL</p><h1>Forms</h1><p className="subtitle">Review the information shared with your care team.</p></div></div><section className="document-grid"><article className="panel document-card"><span className="activity-icon purple"><Icon name="clipboard" size={18} /></span><div><p className="eyebrow">PRE-VISIT</p><h2>Intake form</h2><p>{intakeComplete ? "Submitted and ready for staff review." : "Complete this before your next appointment."}</p></div><button className="secondary-button" onClick={onOpenIntake}>{intakeComplete ? "Review answers" : "Complete form"}</button></article><article className="panel document-card"><span className="activity-icon green"><Icon name="shield-check" size={18} /></span><div><p className="eyebrow">COVERAGE</p><h2>Insurance information</h2><p>{insurance.provider} · {insurance.planName}<br />Member {insurance.memberId}</p><small>Last update: {insurance.updatedAt}</small></div><button className="secondary-button" onClick={onOpenInsurance}>Update insurance</button></article></section><p className="date-note">Predictable demo records · No real patient data</p></div>;
}

function ClinicalDocuments({ role, onOpenLab, onOpenSummary }: {
  role: Role;
  onOpenLab: () => void;
  onOpenSummary: () => void;
}) {
  return <div className="page-content"><div className="welcome-row"><div><p className="eyebrow">{role === "patient" ? "PATIENT PORTAL" : "CLINIC DASHBOARD"}</p><h1>Results</h1><p className="subtitle">Review deterministic clinical documents for Maria Lopez.</p></div></div><section className="document-grid"><article className="panel document-card"><span className="activity-icon green"><Icon name="flask" size={18} /></span><div><p className="eyebrow">LAB RESULT</p><h2>Complete blood count</h2><p>Collected July 23 · Final</p><span className="review-status">All values in range</span></div><button className="secondary-button" onClick={onOpenLab}>View result</button></article><article className="panel document-card"><span className="activity-icon purple"><Icon name="clipboard" size={18} /></span><div><p className="eyebrow">VISIT DOCUMENT</p><h2>Primary care summary</h2><p>July 12 appointment · Dr. Ana Costa</p><span className="review-status">Available</span></div><button className="secondary-button" onClick={onOpenSummary}>Open summary</button></article></section><p className="date-note">Predictable clinical content · No real patient data</p></div>;
}

function InsuranceModal({ insurance, busy, onClose, onSubmit }: {
  insurance: InsuranceInfo;
  busy: boolean;
  onClose: () => void;
  onSubmit: (insurance: Omit<InsuranceInfo, "updatedAt">) => Promise<void>;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onSubmit({
      provider: String(form.get("provider") ?? ""),
      planName: String(form.get("planName") ?? ""),
      memberId: String(form.get("memberId") ?? ""),
    });
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="insurance-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><Icon name="close" size={18} /></button><p className="eyebrow">COVERAGE DETAILS</p><h2 id="insurance-title">Update insurance</h2><p>Use fictional coverage information for this demonstration.</p><form onSubmit={submit}><label>Insurance provider<input name="provider" maxLength={80} defaultValue={insurance.provider} required /></label><label>Plan name<input name="planName" maxLength={80} defaultValue={insurance.planName} required /></label><label>Member ID<input name="memberId" maxLength={40} defaultValue={insurance.memberId} required /></label><p className="form-hint">All fields are required. Do not enter real policy information.</p><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : "Save insurance"}</button></form></div></div>;
}

function LabResultModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal clinical-modal" role="dialog" aria-modal="true" aria-labelledby="lab-result-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button><p className="eyebrow">FINAL RESULT</p><h2 id="lab-result-title">Complete blood count</h2><p>Collected July 23, 2026 at 8:15 AM · Ordered by Dr. Ana Costa</p><div className="lab-table" role="table" aria-label="Complete blood count values"><div role="row"><strong role="columnheader">Test</strong><strong role="columnheader">Result</strong><strong role="columnheader">Reference</strong></div><div role="row"><span role="cell">Hemoglobin</span><b role="cell">13.6 g/dL</b><span role="cell">12.0–15.5</span></div><div role="row"><span role="cell">White blood cells</span><b role="cell">6.4 K/uL</b><span role="cell">4.5–11.0</span></div><div role="row"><span role="cell">Platelets</span><b role="cell">248 K/uL</b><span role="cell">150–450</span></div></div><p className="demo-disclaimer">All values are fictional and provided only for QA training.</p><button className="primary-button full" onClick={onClose}>Done</button></div></div>;
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal clinical-modal" role="dialog" aria-modal="true" aria-labelledby="visit-summary-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button><p className="eyebrow">VISIT SUMMARY</p><h2 id="visit-summary-title">Primary care follow-up</h2><p>Maria Lopez · July 12, 2026 · Dr. Ana Costa</p><dl className="review-details"><div><dt>Reason for visit</dt><dd>Routine follow-up</dd></div><div><dt>Assessment</dt><dd>Blood pressure stable</dd></div><div><dt>Medication</dt><dd>Continue Losartan 50 mg daily</dd></div><div><dt>Care plan</dt><dd>Continue home monitoring and follow up in 3 months</dd></div></dl><p className="demo-disclaimer">Predictable demo summary · No real patient data</p><button className="primary-button full" onClick={downloadVisitSummary}><Icon name="download" size={15} /> Download CSV</button><button className="secondary-button full" onClick={onClose}>Close</button></div></div>;
}

function IntakeFormModal({ intakeSubmission, busy, onClose, onSubmit }: {
  intakeSubmission: IntakeSubmission | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (intake: Omit<IntakeSubmission, "submittedAt">) => Promise<void>;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onSubmit({
      reasonForVisit: String(form.get("reasonForVisit")) as IntakeSubmission["reasonForVisit"],
      currentSymptoms: String(form.get("currentSymptoms") ?? ""),
      medicationChanges: String(form.get("medicationChanges") ?? ""),
      allergies: String(form.get("allergies") ?? ""),
    });
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal intake-modal" role="dialog" aria-modal="true" aria-labelledby="intake-form-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><Icon name="close" size={18} /></button><p className="eyebrow">{intakeSubmission ? "UPDATE INTAKE" : "PRE-VISIT INTAKE"}</p><h2 id="intake-form-title">{intakeSubmission ? "Review your answers" : "Tell us about your visit"}</h2><p>Your answers are shared with the clinic team for this QA demonstration.</p><form onSubmit={submit}><label>Reason for visit<select name="reasonForVisit" defaultValue={intakeSubmission?.reasonForVisit ?? "Routine follow-up"}><option>Routine follow-up</option><option>New symptoms</option><option>Medication review</option></select></label><label>Current symptoms<textarea name="currentSymptoms" maxLength={240} defaultValue={intakeSubmission?.currentSymptoms ?? ""} placeholder="Describe symptoms or enter None" required /></label><label>Medication changes<textarea name="medicationChanges" maxLength={240} defaultValue={intakeSubmission?.medicationChanges ?? ""} placeholder="Describe changes or enter None" required /></label><label>Allergies<input name="allergies" maxLength={160} defaultValue={intakeSubmission?.allergies ?? ""} placeholder="List allergies or enter None" required /></label><p className="form-hint">Use fictional information only. All fields are required.</p><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : intakeSubmission ? "Update form" : "Submit form"}</button></form></div></div>;
}

function MessageCenter({ role, messages, busy, onSend }: {
  role: Role;
  messages: DemoMessage[];
  busy: boolean;
  onSend: (messageBody: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSend(draft);
    if (saved) setDraft("");
  }

  return <div className="page-content message-page"><div className="welcome-row"><div><p className="eyebrow">{role === "patient" ? "PATIENT PORTAL" : "CLINIC DASHBOARD"}</p><h1>Messages</h1><p className="subtitle">A shared demo conversation between Maria Lopez and the care team.</p></div></div><section className="panel conversation-panel" aria-label="Care team conversation"><header><span className="patient-avatar">{role === "patient" ? "CT" : "ML"}</span><div><strong>{role === "patient" ? "Care team" : "Maria Lopez"}</strong><small>{role === "patient" ? "Primary Care" : "Patient portal"}</small></div><span className="conversation-status"><i></i> Demo thread</span></header><div className="message-thread" aria-live="polite">{messages.map(message => <article key={message.id} className={message.sender === role ? "message-bubble own" : "message-bubble"}><span>{message.sender === "patient" ? "Maria Lopez" : "Care team"}</span><p>{message.body}</p><time>{message.sentAt}</time></article>)}</div><form className="message-composer" onSubmit={submit}><label htmlFor="message-body">Reply to {role === "patient" ? "your care team" : "Maria Lopez"}</label><div><textarea id="message-body" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Write a demo message…" required /><button className="primary-button" type="submit" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send message"}</button></div><small>{draft.length}/500 · No real patient information</small></form></section></div>;
}

function IntakeReviewModal({ intakeSubmission, onClose }: { intakeSubmission: IntakeSubmission; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="intake-review-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button><p className="eyebrow">SUBMITTED INTAKE</p><h2 id="intake-review-title">Maria Lopez</h2><p>Submitted through the patient portal on {intakeSubmission.submittedAt}.</p><dl className="review-details"><div><dt>Reason for visit</dt><dd>{intakeSubmission.reasonForVisit}</dd></div><div><dt>Current symptoms</dt><dd>{intakeSubmission.currentSymptoms}</dd></div><div><dt>Medication changes</dt><dd>{intakeSubmission.medicationChanges}</dd></div><div><dt>Allergies</dt><dd>{intakeSubmission.allergies}</dd></div><div><dt>Submission status</dt><dd><span className="review-status">Complete</span></dd></div></dl><p className="demo-disclaimer">Predictable demo content · No real patient data</p><button className="primary-button full" onClick={onClose}>Done</button></div></div>;
}
