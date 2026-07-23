"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type Role = "patient" | "staff";
type Toast = { title: string; message: string } | null;
type AuthUser = { email: string; name: string; role: Role };
type DemoState = {
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: "none" | "pending" | "approved";
};
type Challenge = {
  id: string;
  destination: string;
  email: string;
  password: string;
};

const appointments = [
  { time: "8:30 AM", patient: "Riley Smith", type: "Routine visit", status: "Confirmed" },
  { time: "9:15 AM", patient: "Maria Lopez", type: "Follow-up", status: "Waiting" },
  { time: "10:00 AM", patient: "Alex Carter", type: "First appointment", status: "Confirmed" },
  { time: "11:30 AM", patient: "Priya Shah", type: "Follow-up", status: "Confirmed" },
];

const navItems = ["Overview", "Appointments", "Forms", "Results", "Messages"];

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
  const [refillStatus, setRefillStatus] = useState<"none" | "pending" | "approved">("none");
  const [toast, setToast] = useState<Toast>(null);

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
      .then(async response => response.ok ? response.json() as Promise<{ state: DemoState }> : null)
      .then(data => {
        if (!active || !data) return;
        setAppointmentBooked(data.state.appointmentBooked);
        setIntakeComplete(data.state.intakeComplete);
        setRefillStatus(data.state.refillStatus);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  async function startLogin(email: string, password: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json() as {
        challengeId?: string;
        destination?: string;
        error?: string;
      };
      if (!response.ok || !data.challengeId || !data.destination) {
        throw new Error(data.error ?? "Sign-in could not be completed.");
      }
      setChallenge({ id: data.challengeId, destination: data.destination, email, password });
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
    setUser(null);
    setChallenge(null);
    setAuthError("");
  }

  function notify(title: string, message: string) {
    setToast({ title, message });
    window.setTimeout(() => setToast(null), 3600);
  }

  function persistDemoState(state: DemoState) {
    void fetch("/api/demo-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => undefined);
  }

  function bookAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppointmentBooked(true);
    persistDemoState({ appointmentBooked: true, intakeComplete, refillStatus });
    setShowBooking(false);
    notify("Appointment booked", "Your appointment is confirmed for July 24 at 10:30 AM.");
  }

  function requestRefill() {
    setRefillStatus("pending");
    persistDemoState({ appointmentBooked, intakeComplete, refillStatus: "pending" });
    notify("Request submitted", "The clinic team can now review your refill request.");
  }

  function approveRefill() {
    setRefillStatus("approved");
    persistDemoState({ appointmentBooked, intakeComplete, refillStatus: "approved" });
    notify("Refill approved", "The patient will see the update in the portal.");
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
      onResend={() => challenge && startLogin(challenge.email, challenge.password)}
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
          <span aria-hidden="true">✓</span>{role === "patient" ? "Patient portal" : "Employee access"}
        </div>

        <nav>
          <p className="nav-label">MENU</p>
          {navItems.map((item, index) => (
            <button
              key={item}
              className={activeNav === item ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(item)}
            >
              <span className="nav-icon" aria-hidden="true">{["⌂", "□", "≡", "＋", "○"][index]}</span>
              {item}
              {item === "Messages" && <span className="nav-badge">2</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <span className="help-icon">?</span>
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
            <button className="icon-button" aria-label="Search">⌕</button>
            <button className="icon-button notification" aria-label="Notifications">♢<span></span></button>
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
            onBook={() => setShowBooking(true)}
            onCompleteIntake={() => {
              setIntakeComplete(true);
              persistDemoState({ appointmentBooked, intakeComplete: true, refillStatus });
              notify("Form completed", "Your answers were saved for your next appointment.");
            }}
            onRequestRefill={requestRefill}
          />
        ) : (
          <StaffDashboard refillStatus={refillStatus} onApproveRefill={approveRefill} />
        )}

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.slice(0, 4).map((item, index) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><span>{["⌂", "□", "≡", "＋"][index]}</span>{item.split(" ")[0]}</button>)}
        </nav>
      </section>

      {showBooking && <BookingModal onClose={() => setShowBooking(false)} onSubmit={bookAppointment} />}
      {toast && <div className="toast" role="status"><span>✓</span><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button onClick={() => setToast(null)} aria-label="Close">×</button></div>}
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
  onLogin: (email: string, password: string) => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  onResend: () => void;
}) {
  const [selectedDemo, setSelectedDemo] = useState<"patient" | "employee">("patient");
  const [code, setCode] = useState("");
  const [copiedCredential, setCopiedCredential] = useState<"email" | "password" | null>(null);
  const credentials = selectedDemo === "patient"
    ? { email: "patient.demo@testrigor-mail.com", password: "PatientDemo!2026", label: "Patient" }
    : { email: "employee.demo@testrigor-mail.com", password: "EmployeeDemo!2026", label: "Employee" };

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onLogin(String(form.get("demo-email") ?? ""), String(form.get("demo-password") ?? ""));
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
      <div className="security-note"><span>✓</span><div><strong>Two-step verification</strong><small>Your password and a one-time email code protect your account.</small></div></div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        {!challenge ? <>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to Luma Health</h2>
          <p className="auth-subtitle">Use a demo account, or sign in as a patient with your own email.</p>
          <div className="account-tabs" role="group" aria-label="Choose a demo account">
            <button type="button" className={selectedDemo === "patient" ? "active" : ""} onClick={() => { setSelectedDemo("patient"); setCopiedCredential(null); }}>Patient</button>
            <button type="button" className={selectedDemo === "employee" ? "active" : ""} onClick={() => { setSelectedDemo("employee"); setCopiedCredential(null); }}>Employee</button>
          </div>
          <form className="auth-form" key={selectedDemo} onSubmit={submitLogin} autoComplete="off">
            <label>Email address<input name="demo-email" type="email" autoComplete="off" placeholder="Enter your email address" required /></label>
            <label>Password<input name="demo-password" type="password" autoComplete="off" placeholder="Enter the demo password" required /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Sending code…" : `Continue as ${credentials.label}`}</button>
          </form>
          <div className="demo-credentials" aria-label={`${credentials.label} demo credentials`}>
            <div className="demo-credentials-heading"><strong>{credentials.label} demo credentials</strong><span>Copy and paste above</span></div>
            <div className="credential-row">
              <div><span>Email</span><code>{credentials.email}</code></div>
              <button type="button" onClick={() => void copyCredential("email", credentials.email)}>{copiedCredential === "email" ? "Copied" : "Copy"}</button>
            </div>
            <div className="credential-row">
              <div><span>Password</span><code>{credentials.password}</code></div>
              <button type="button" onClick={() => void copyCredential("password", credentials.password)}>{copiedCredential === "password" ? "Copied" : "Copy"}</button>
            </div>
            <p>{selectedDemo === "patient" ? "You may replace the demo email with your own. Use the patient demo password; the verification code will be sent to the address entered." : "A real verification code will be sent to the employee demo email after sign-in."}</p>
          </div>
        </> : <>
          <button className="auth-back" type="button" onClick={onBack}>← Back to sign in</button>
          <div className="mail-icon" aria-hidden="true">✉</div>
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

function PatientDashboard({ patientName, activeNav, dateLabel, appointmentBooked, intakeComplete, refillStatus, onBook, onCompleteIntake, onRequestRefill }: {
  patientName: string;
  activeNav: string;
  dateLabel: string;
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: "none" | "pending" | "approved";
  onBook: () => void;
  onCompleteIntake: () => void;
  onRequestRefill: () => void;
}) {
  return <div className="page-content">
    <div className="welcome-row">
      <div><p className="eyebrow">PATIENT PORTAL</p><h1>{activeNav === "Overview" ? `Hello, ${patientName}.` : activeNav}</h1><p className="subtitle">{activeNav === "Overview" ? "Here is a summary of your care today." : "Keep track of your health information in one place."}</p></div>
      <button className="primary-button" onClick={onBook}><span>＋</span> Book appointment</button>
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
        <button>View details <span>→</span></button>
      </div>
      <div className="hero-decoration" aria-hidden="true"><i></i><b></b><em></em></div>
    </section>

    <div className="section-heading"><div><h2>Quick actions</h2><p>What would you like to do?</p></div></div>
    <section className="quick-grid">
      <QuickCard color="blue" icon="□" title="Book an appointment" text="Choose the best date and time" action="Book now" onClick={onBook} />
      <QuickCard color="coral" icon="≡" title="Intake form" text={intakeComplete ? "Form submitted successfully" : "Takes about 3 minutes"} action={intakeComplete ? "Completed" : "Complete form"} onClick={onCompleteIntake} done={intakeComplete} />
      <QuickCard color="mint" icon="↗" title="Request a refill" text={refillStatus === "approved" ? "Refill approved by the clinic" : refillStatus === "pending" ? "Under staff review" : "Request it quickly and securely"} action={refillStatus === "approved" ? "Approved" : refillStatus === "pending" ? "Under review" : "Request refill"} onClick={onRequestRefill} done={refillStatus !== "none"} />
    </section>

    <section className="content-grid">
      <div className="panel activity-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest updates</p></div><button>View all</button></div>
        <Activity icon="✓" color="green" title="Result available" text="Complete blood count" time="Today, 9:42 AM" action="View" />
        <Activity icon="↗" color="purple" title={refillStatus === "approved" ? "Refill approved" : "Visit summary"} text={refillStatus === "approved" ? "Losartan 50 mg" : "July 12 appointment"} time={refillStatus === "approved" ? "Now" : "Jul 12, 4:20 PM"} action="Open" />
        <Activity icon="✉" color="orange" title="New message" text="Care team" time="Jul 10, 11:15 AM" action="Reply" />
      </div>
      <aside className="panel care-panel">
        <div className="care-header"><span className="care-mark">♥</span><div><h2>Your care is on track</h2><p>Keep it up, Maria!</p></div></div>
        <div className="progress-ring"><span>75<small>%</small></span></div>
        <div className="care-copy"><strong>3 of 4 tasks completed</strong><p>Complete your form before your next appointment.</p></div>
        <button onClick={onCompleteIntake}>{intakeComplete ? "All set" : "Continue task"} <span>→</span></button>
      </aside>
    </section>
    <p className="date-note">Demo data · {dateLabel}</p>
  </div>;
}

function StaffDashboard({ refillStatus, onApproveRefill }: { refillStatus: "none" | "pending" | "approved"; onApproveRefill: () => void }) {
  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">CLINIC DASHBOARD</p><h1>Good morning, Thiago.</h1><p className="subtitle">Track today&apos;s schedule and requests that need attention.</p></div><button className="secondary-button">⌕ Search patients</button></div>
    <section className="metric-grid">
      <Metric value="12" label="Appointments today" detail="4 waiting" tone="blue" />
      <Metric value={refillStatus === "pending" ? "3" : "2"} label="Pending refills" detail="Review requests" tone="coral" />
      <Metric value="5" label="Forms received" detail="2 new today" tone="mint" />
    </section>
    <section className="staff-layout">
      <div className="panel schedule-panel">
        <div className="panel-heading"><div><h2>Today&apos;s schedule</h2><p>Friday, July 24</p></div><button>View schedule</button></div>
        {appointments.map(item => <div className="schedule-row" key={item.time}><strong>{item.time}</strong><span className="patient-avatar">{item.patient.split(" ").map(n => n[0]).join("")}</span><div><b>{item.patient}</b><small>{item.type}</small></div><span className={`queue-status ${item.status === "Waiting" ? "waiting" : ""}`}>{item.status}</span><button aria-label={`Open ${item.patient}'s record`}>→</button></div>)}
      </div>
      <div className="panel request-panel">
        <div className="panel-heading"><div><h2>Requests</h2><p>Need your attention</p></div><span className="count-badge">{refillStatus === "pending" ? 3 : 2}</span></div>
        {refillStatus === "pending" && <div className="request-card highlighted"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Refill · Losartan 50 mg</small></div><span>Now</span></div><p>Ongoing medication · Last refill 30 days ago.</p><div className="request-actions"><button className="reject">Decline</button><button className="approve" onClick={onApproveRefill}>Approve</button></div></div>}
        <div className="request-card"><div className="request-top"><span className="patient-avatar lavender">AC</span><div><strong>Alex Carter</strong><small>Intake form</small></div><span>12 min</span></div><button className="text-action">Review form →</button></div>
        <div className="request-card"><div className="request-top"><span className="patient-avatar peach">PS</span><div><strong>Priya Shah</strong><small>Appointment change</small></div><span>28 min</span></div><button className="text-action">Open request →</button></div>
      </div>
    </section>
  </div>;
}

function QuickCard({ color, icon, title, text, action, onClick, done = false }: { color: string; icon: string; title: string; text: string; action: string; onClick: () => void; done?: boolean }) {
  return <button className="quick-card" onClick={onClick}><span className={`quick-icon ${color}`}>{done ? "✓" : icon}</span><span><strong>{title}</strong><small>{text}</small><b>{action} <i>→</i></b></span></button>;
}

function Activity({ icon, color, title, text, time, action }: { icon: string; color: string; title: string; text: string; time: string; action: string }) {
  return <div className="activity-row"><span className={`activity-icon ${color}`}>{icon}</span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time><button>{action}</button></div>;
}

function Metric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: string }) {
  return <div className={`metric-card ${tone}`}><span className="metric-dot"></span><strong>{value}</strong><h3>{label}</h3><p>{detail} <span>→</span></p></div>;
}

function BookingModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">NEW APPOINTMENT</p><h2 id="booking-title">Find a time</h2><p>Choose a specialty and the time that works best for you.</p><form onSubmit={onSubmit}><label>Specialty<select defaultValue="Primary Care"><option>Primary Care</option><option>Cardiology</option><option>Dermatology</option></select></label><label>Provider<select defaultValue="Dr. Ana Costa"><option>Dr. Ana Costa</option><option>Dr. John Lima</option></select></label><fieldset><legend>Available times · July 24</legend><div className="time-options"><label><input type="radio" name="time" value="09:00" />9:00 AM</label><label><input type="radio" name="time" value="10:30" defaultChecked />10:30 AM</label><label><input type="radio" name="time" value="15:00" />3:00 PM</label></div></fieldset><button className="primary-button full" type="submit">Confirm appointment</button></form></div></div>;
}
