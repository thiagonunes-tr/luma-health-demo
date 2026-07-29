"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

type Role = "patient" | "staff";
type Toast = { title: string; message: string; tone: "success" | "error" } | null;
type AuthUser = { email: string; name: string; role: Role };
type RefillStatus = "none" | "pending" | "approved" | "rejected";
type DemoAction =
  | "book-appointment"
  | "complete-intake"
  | "request-refill"
  | "approve-refill"
  | "decline-refill";
type DemoState = {
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: RefillStatus;
};
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

const appointments: StaffAppointment[] = [
  { time: "8:30 AM", patient: "Riley Smith", type: "Routine visit", status: "Confirmed" },
  { time: "9:15 AM", patient: "Jordan Lee", type: "Follow-up", status: "Waiting" },
  { time: "10:00 AM", patient: "Alex Carter", type: "First appointment", status: "Confirmed" },
  { time: "11:30 AM", patient: "Priya Shah", type: "Follow-up", status: "Confirmed" },
];

const patientPortalAppointment: StaffAppointment = {
  time: "10:30 AM",
  patient: "Maria Lopez",
  type: "Follow-up · Patient portal",
  status: "New booking",
  fromPatientPortal: true,
};

const navItems = ["Overview", "Appointments", "Forms", "Results", "Messages"];
const navIcons: IconName[] = [
  "home",
  "calendar",
  "clipboard",
  "flask",
  "message",
];

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [showBooking, setShowBooking] = useState(false);
  const [appointmentBooked, setAppointmentBooked] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [refillStatus, setRefillStatus] = useState<RefillStatus>("none");
  const [demoBusy, setDemoBusy] = useState<DemoAction | null>(null);
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
    setIntakeComplete(state.intakeComplete);
    setRefillStatus(state.refillStatus);
  }

  async function performDemoAction(
    action: DemoAction,
    successTitle: string,
    successMessage: string,
  ): Promise<boolean> {
    if (demoBusy) return false;
    setDemoBusy(action);
    try {
      const response = await fetch("/api/demo-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
    const saved = await performDemoAction(
      "book-appointment",
      "Appointment booked",
      "Your appointment is confirmed for July 24 at 10:30 AM.",
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
              {item === "Messages" && <span className="nav-badge">2</span>}
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

        {role === "patient" ? (
          <PatientDashboard
            patientName={displayName.split(/\s+/)[0] || "there"}
            activeNav={activeNav}
            dateLabel={dateLabel}
            appointmentBooked={appointmentBooked}
            intakeComplete={intakeComplete}
            refillStatus={refillStatus}
            busy={demoBusy !== null}
            onBook={() => setShowBooking(true)}
            onCompleteIntake={() => performDemoAction(
              "complete-intake",
              "Form completed",
              "Your answers were saved for your next appointment.",
            )}
            onRequestRefill={requestRefill}
          />
        ) : (
          <StaffDashboard
            staffName={displayName.split(/\s+/)[0] || "there"}
            appointmentBooked={appointmentBooked}
            intakeComplete={intakeComplete}
            refillStatus={refillStatus}
            busy={demoBusy !== null}
            onApproveRefill={approveRefill}
            onDeclineRefill={declineRefill}
          />
        )}

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.slice(0, 4).map((item, index) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><span><Icon name={navIcons[index]} size={19} /></span>{item.split(" ")[0]}</button>)}
        </nav>
      </section>

      {showBooking && <BookingModal busy={demoBusy === "book-appointment"} onClose={() => setShowBooking(false)} onSubmit={bookAppointment} />}
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

function PatientDashboard({ patientName, activeNav, dateLabel, appointmentBooked, intakeComplete, refillStatus, busy, onBook, onCompleteIntake, onRequestRefill }: {
  patientName: string;
  activeNav: string;
  dateLabel: string;
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: RefillStatus;
  busy: boolean;
  onBook: () => void;
  onCompleteIntake: () => void | Promise<unknown>;
  onRequestRefill: () => void | Promise<unknown>;
}) {
  return <div className="page-content">
    <div className="welcome-row">
      <div><p className="eyebrow">PATIENT PORTAL</p><h1>{activeNav === "Overview" ? `Hello, ${patientName}.` : activeNav}</h1><p className="subtitle">{activeNav === "Overview" ? "Here is a summary of your care today." : "Keep track of your health information in one place."}</p></div>
      <button className="primary-button" onClick={onBook}><Icon name="plus" size={17} /> Book appointment</button>
    </div>

    <section className="hero-card">
      <div className="hero-copy">
        <span className="status-pill"><i></i> NEXT APPOINTMENT</span>
        <p className="hero-date">{appointmentBooked ? "July 24" : "Today, July 24"}</p>
        <h2>{appointmentBooked ? "Follow-up appointment" : "Appointment with Dr. Ana Costa"}</h2>
        <p className="doctor"><span className="doctor-avatar">AC</span><span><strong>Dr. Ana Costa</strong><small>Primary Care · Room 204</small></span></p>
      </div>
      <div className="appointment-time">
        <strong>{appointmentBooked ? "10:30 AM" : "2:30 PM"}</strong><span>local time</span>
        <button>View details <Icon name="arrow-right" size={13} /></button>
      </div>
      <div className="hero-decoration" aria-hidden="true"><i></i><b></b><em></em></div>
    </section>

    <div className="section-heading"><div><h2>Quick actions</h2><p>What would you like to do?</p></div></div>
    <section className="quick-grid">
      <QuickCard color="blue" icon="calendar" title="Book an appointment" text="Choose the best date and time" action="Book now" onClick={onBook} />
      <QuickCard color="coral" icon="clipboard" title="Intake form" text={intakeComplete ? "Form submitted successfully" : "Takes about 3 minutes"} action={intakeComplete ? "Completed" : "Complete form"} onClick={onCompleteIntake} done={intakeComplete} disabled={busy || intakeComplete} />
      <QuickCard color="mint" icon="pill" title="Request a refill" text={refillStatus === "approved" ? "Refill approved by the clinic" : refillStatus === "pending" ? "Under staff review" : refillStatus === "rejected" ? "The clinic declined the previous request" : "Request it quickly and securely"} action={refillStatus === "approved" ? "Approved" : refillStatus === "pending" ? "Under review" : refillStatus === "rejected" ? "Request again" : "Request refill"} onClick={onRequestRefill} done={refillStatus === "pending" || refillStatus === "approved"} disabled={busy || refillStatus === "pending" || refillStatus === "approved"} />
    </section>

    <section className="content-grid">
      <div className="panel activity-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest updates</p></div><button>View all</button></div>
        <Activity icon="flask" color="green" title="Result available" text="Complete blood count" time="Today, 9:42 AM" action="View" />
        <Activity icon={refillStatus === "approved" ? "pill" : "clipboard"} color="purple" title={refillStatus === "approved" ? "Refill approved" : "Visit summary"} text={refillStatus === "approved" ? "Losartan 50 mg" : "July 12 appointment"} time={refillStatus === "approved" ? "Now" : "Jul 12, 4:20 PM"} action="Open" />
        <Activity icon="mail" color="orange" title="New message" text="Care team" time="Jul 10, 11:15 AM" action="Reply" />
      </div>
      <aside className="panel care-panel">
        <div className="care-header"><span className="care-mark"><Icon name="heart" size={16} /></span><div><h2>Your care is on track</h2><p>Keep it up, Maria!</p></div></div>
        <div className="progress-ring"><span>75<small>%</small></span></div>
        <div className="care-copy"><strong>3 of 4 tasks completed</strong><p>Complete your form before your next appointment.</p></div>
        <button onClick={onCompleteIntake} disabled={busy || intakeComplete}>{intakeComplete ? "All set" : "Continue task"} <Icon name="arrow-right" size={13} /></button>
      </aside>
    </section>
    <p className="date-note">Demo data · {dateLabel}</p>
  </div>;
}

function StaffDashboard({
  staffName,
  appointmentBooked,
  intakeComplete,
  refillStatus,
  busy,
  onApproveRefill,
  onDeclineRefill,
}: {
  staffName: string;
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: RefillStatus;
  busy: boolean;
  onApproveRefill: () => void | Promise<unknown>;
  onDeclineRefill: () => void | Promise<unknown>;
}) {
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showIntakeReview, setShowIntakeReview] = useState(false);
  const staffAppointments = appointmentBooked
    ? [...appointments.slice(0, 3), patientPortalAppointment, ...appointments.slice(3)]
    : appointments;
  const requestCount =
    2 + Number(refillStatus === "pending") + Number(intakeComplete);

  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">CLINIC DASHBOARD</p><h1>Good morning, {staffName}.</h1><p className="subtitle">Track today&apos;s schedule and requests that need attention.</p></div><button className="secondary-button"><Icon name="search" size={16} /> Search patients</button></div>
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
    {showAppointmentDetails && <AppointmentReviewModal onClose={() => setShowAppointmentDetails(false)} />}
    {showIntakeReview && <IntakeReviewModal onClose={() => setShowIntakeReview(false)} />}
  </div>;
}

function QuickCard({ color, icon, title, text, action, onClick, done = false, disabled = false }: { color: string; icon: IconName; title: string; text: string; action: string; onClick: () => void | Promise<unknown>; done?: boolean; disabled?: boolean }) {
  return <button className="quick-card" onClick={onClick} disabled={disabled}><span className={`quick-icon ${color}`}><Icon name={done ? "check" : icon} size={20} /></span><span><strong>{title}</strong><small>{text}</small><b>{action} <Icon name="arrow-right" size={13} /></b></span></button>;
}

function Activity({ icon, color, title, text, time, action }: { icon: IconName; color: string; title: string; text: string; time: string; action: string }) {
  return <div className="activity-row"><span className={`activity-icon ${color}`}><Icon name={icon} size={15} /></span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time><button>{action}</button></div>;
}

function Metric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: string }) {
  return <div className={`metric-card ${tone}`}><span className="metric-dot"></span><strong>{value}</strong><h3>{label}</h3><p>{detail} <Icon name="arrow-right" size={12} /></p></div>;
}

function BookingModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><Icon name="close" size={18} /></button><p className="eyebrow">NEW APPOINTMENT</p><h2 id="booking-title">Find a time</h2><p>Choose a specialty and the time that works best for you.</p><form onSubmit={onSubmit}><label>Specialty<select defaultValue="Primary Care"><option>Primary Care</option><option>Cardiology</option><option>Dermatology</option></select></label><label>Provider<select defaultValue="Dr. Ana Costa"><option>Dr. Ana Costa</option><option>Dr. John Lima</option></select></label><fieldset><legend>Available times · July 24</legend><div className="time-options"><label><input type="radio" name="time" value="09:00" />9:00 AM</label><label><input type="radio" name="time" value="10:30" defaultChecked />10:30 AM</label><label><input type="radio" name="time" value="15:00" />3:00 PM</label></div></fieldset><button className="primary-button full" type="submit" disabled={busy}>{busy ? "Saving…" : "Confirm appointment"}</button></form></div></div>;
}

function AppointmentReviewModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="appointment-review-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button><p className="eyebrow">PATIENT PORTAL BOOKING</p><h2 id="appointment-review-title">Appointment details</h2><p>This appointment was booked by Maria Lopez and is now part of the clinic schedule.</p><dl className="review-details"><div><dt>Patient</dt><dd>Maria Lopez</dd></div><div><dt>Date and time</dt><dd>July 24 · 10:30 AM</dd></div><div><dt>Provider</dt><dd>Dr. Ana Costa</dd></div><div><dt>Visit type</dt><dd>Primary Care · Follow-up</dd></div><div><dt>Status</dt><dd><span className="review-status">New booking</span></dd></div></dl><button className="primary-button full" onClick={onClose}>Done</button></div></div>;
}

function IntakeReviewModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="intake-review-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button><p className="eyebrow">SUBMITTED INTAKE</p><h2 id="intake-review-title">Maria Lopez</h2><p>Submitted through the patient portal for the July 24 follow-up appointment.</p><dl className="review-details"><div><dt>Reason for visit</dt><dd>Routine follow-up</dd></div><div><dt>Current symptoms</dt><dd>No new symptoms reported</dd></div><div><dt>Medication changes</dt><dd>None</dd></div><div><dt>Allergies</dt><dd>No known drug allergies</dd></div><div><dt>Submission status</dt><dd><span className="review-status">Complete</span></dd></div></dl><p className="demo-disclaimer">Predictable demo content · No real patient data</p><button className="primary-button full" onClick={onClose}>Done</button></div></div>;
}
