"use client";

import { FormEvent, useMemo, useState } from "react";

type Role = "patient" | "staff";
type Toast = { title: string; message: string } | null;

const appointments = [
  { time: "08:30", patient: "Riley Smith", type: "Consulta de rotina", status: "Confirmada" },
  { time: "09:15", patient: "Maria Lopez", type: "Acompanhamento", status: "Aguardando" },
  { time: "10:00", patient: "Alex Carter", type: "Primeira consulta", status: "Confirmada" },
  { time: "11:30", patient: "Priya Shah", type: "Retorno", status: "Confirmada" },
];

const navItems = ["Visão geral", "Consultas", "Formulários", "Resultados", "Mensagens"];

export default function Home() {
  const [role, setRole] = useState<Role>("patient");
  const [activeNav, setActiveNav] = useState("Visão geral");
  const [showBooking, setShowBooking] = useState(false);
  const [appointmentBooked, setAppointmentBooked] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [refillStatus, setRefillStatus] = useState<"none" | "pending" | "approved">("none");
  const [toast, setToast] = useState<Toast>(null);

  const dateLabel = useMemo(() =>
    new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" })
      .format(new Date(2026, 6, 24)), []);

  function notify(title: string, message: string) {
    setToast({ title, message });
    window.setTimeout(() => setToast(null), 3600);
  }

  function bookAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppointmentBooked(true);
    setShowBooking(false);
    notify("Consulta agendada", "Sua consulta foi confirmada para 24 de julho, às 10:30.");
  }

  function requestRefill() {
    setRefillStatus("pending");
    notify("Solicitação enviada", "A equipe da clínica já pode revisar sua renovação.");
  }

  function approveRefill() {
    setRefillStatus("approved");
    notify("Renovação aprovada", "O paciente receberá a atualização no portal.");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i></i><b></b></span>
          <span>Luma <strong>Saúde</strong></span>
        </div>

        <div className="profile-switcher" aria-label="Trocar perfil de demonstração">
          <button className={role === "patient" ? "active" : ""} onClick={() => setRole("patient")}>Paciente</button>
          <button className={role === "staff" ? "active" : ""} onClick={() => setRole("staff")}>Equipe</button>
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
              {item === "Mensagens" && <span className="nav-badge">2</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <span className="help-icon">?</span>
          <div><strong>Precisa de ajuda?</strong><small>Fale com nossa equipe</small></div>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{role === "patient" ? "ML" : "TN"}</span>
          <div><strong>{role === "patient" ? "Maria Lopez" : "Thiago Nunes"}</strong><small>{role === "patient" ? "Paciente demo" : "Administrador"}</small></div>
          <span className="more">•••</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setActiveNav("Visão geral")} aria-label="Voltar à visão geral">
            <span className="brand-mark small" aria-hidden="true"><i></i><b></b></span>Luma Saúde
          </button>
          <div className="top-actions">
            <button className="icon-button" aria-label="Buscar">⌕</button>
            <button className="icon-button notification" aria-label="Notificações">♢<span></span></button>
            <div className="top-user"><span className="avatar">{role === "patient" ? "ML" : "TN"}</span><div><strong>{role === "patient" ? "Maria Lopez" : "Thiago Nunes"}</strong><small>{role === "patient" ? "Paciente" : "Equipe clínica"}</small></div></div>
          </div>
        </header>

        {role === "patient" ? (
          <PatientDashboard
            activeNav={activeNav}
            dateLabel={dateLabel}
            appointmentBooked={appointmentBooked}
            intakeComplete={intakeComplete}
            refillStatus={refillStatus}
            onBook={() => setShowBooking(true)}
            onCompleteIntake={() => { setIntakeComplete(true); notify("Formulário concluído", "Suas respostas foram salvas para a próxima consulta."); }}
            onRequestRefill={requestRefill}
          />
        ) : (
          <StaffDashboard refillStatus={refillStatus} onApproveRefill={approveRefill} />
        )}

        <nav className="mobile-nav" aria-label="Navegação móvel">
          {navItems.slice(0, 4).map((item, index) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><span>{["⌂", "□", "≡", "＋"][index]}</span>{item.split(" ")[0]}</button>)}
        </nav>
      </section>

      {showBooking && <BookingModal onClose={() => setShowBooking(false)} onSubmit={bookAppointment} />}
      {toast && <div className="toast" role="status"><span>✓</span><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button onClick={() => setToast(null)} aria-label="Fechar">×</button></div>}
    </main>
  );
}

function PatientDashboard({ activeNav, dateLabel, appointmentBooked, intakeComplete, refillStatus, onBook, onCompleteIntake, onRequestRefill }: {
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
      <div><p className="eyebrow">PORTAL DO PACIENTE</p><h1>{activeNav === "Visão geral" ? "Olá, Maria." : activeNav}</h1><p className="subtitle">{activeNav === "Visão geral" ? "Aqui está um resumo dos seus cuidados hoje." : "Acompanhe suas informações de saúde em um só lugar."}</p></div>
      <button className="primary-button" onClick={onBook}><span>＋</span> Agendar consulta</button>
    </div>

    <section className="hero-card">
      <div className="hero-copy">
        <span className="status-pill"><i></i> PRÓXIMA CONSULTA</span>
        <p className="hero-date">{appointmentBooked ? "24 de julho" : "Hoje, 24 de julho"}</p>
        <h2>{appointmentBooked ? "Consulta de acompanhamento" : "Consulta com Dra. Ana Costa"}</h2>
        <p className="doctor"><span className="doctor-avatar">AC</span><span><strong>Dra. Ana Costa</strong><small>Clínica Geral · Sala 204</small></span></p>
      </div>
      <div className="appointment-time">
        <strong>{appointmentBooked ? "10:30" : "14:30"}</strong><span>horário local</span>
        <button>Ver detalhes <span>→</span></button>
      </div>
      <div className="hero-decoration" aria-hidden="true"><i></i><b></b><em></em></div>
    </section>

    <div className="section-heading"><div><h2>Ações rápidas</h2><p>O que você gostaria de fazer?</p></div></div>
    <section className="quick-grid">
      <QuickCard color="blue" icon="□" title="Agendar consulta" text="Escolha o melhor dia e horário" action="Agendar agora" onClick={onBook} />
      <QuickCard color="coral" icon="≡" title="Formulário de admissão" text={intakeComplete ? "Formulário enviado com sucesso" : "Leva cerca de 3 minutos"} action={intakeComplete ? "Concluído" : "Preencher formulário"} onClick={onCompleteIntake} done={intakeComplete} />
      <QuickCard color="mint" icon="↗" title="Renovar medicamento" text={refillStatus === "approved" ? "Renovação aprovada pela clínica" : refillStatus === "pending" ? "Em análise pela equipe" : "Solicite de forma rápida e segura"} action={refillStatus === "approved" ? "Aprovada" : refillStatus === "pending" ? "Em análise" : "Solicitar renovação"} onClick={onRequestRefill} done={refillStatus !== "none"} />
    </section>

    <section className="content-grid">
      <div className="panel activity-panel">
        <div className="panel-heading"><div><h2>Atividade recente</h2><p>Suas últimas atualizações</p></div><button>Ver todas</button></div>
        <Activity icon="✓" color="green" title="Resultado disponível" text="Hemograma completo" time="Hoje, 09:42" action="Visualizar" />
        <Activity icon="↗" color="purple" title={refillStatus === "approved" ? "Renovação aprovada" : "Resumo da consulta"} text={refillStatus === "approved" ? "Losartana 50 mg" : "Consulta de 12 de julho"} time={refillStatus === "approved" ? "Agora" : "12 jul, 16:20"} action="Abrir" />
        <Activity icon="✉" color="orange" title="Nova mensagem" text="Equipe de atendimento" time="10 jul, 11:15" action="Responder" />
      </div>
      <aside className="panel care-panel">
        <div className="care-header"><span className="care-mark">♥</span><div><h2>Seu cuidado em dia</h2><p>Continue assim, Maria!</p></div></div>
        <div className="progress-ring"><span>75<small>%</small></span></div>
        <div className="care-copy"><strong>3 de 4 tarefas concluídas</strong><p>Complete seu formulário antes da próxima consulta.</p></div>
        <button onClick={onCompleteIntake}>{intakeComplete ? "Tudo pronto" : "Continuar tarefa"} <span>→</span></button>
      </aside>
    </section>
    <p className="date-note">Dados de demonstração · {dateLabel}</p>
  </div>;
}

function StaffDashboard({ refillStatus, onApproveRefill }: { refillStatus: "none" | "pending" | "approved"; onApproveRefill: () => void }) {
  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">PAINEL DA CLÍNICA</p><h1>Bom dia, Thiago.</h1><p className="subtitle">Acompanhe a agenda e as solicitações que precisam de atenção.</p></div><button className="secondary-button">⌕ Buscar paciente</button></div>
    <section className="metric-grid">
      <Metric value="12" label="Consultas hoje" detail="4 aguardando" tone="blue" />
      <Metric value={refillStatus === "pending" ? "3" : "2"} label="Renovações pendentes" detail="Revisar solicitações" tone="coral" />
      <Metric value="5" label="Formulários recebidos" detail="2 novos hoje" tone="mint" />
    </section>
    <section className="staff-layout">
      <div className="panel schedule-panel">
        <div className="panel-heading"><div><h2>Agenda de hoje</h2><p>Quinta-feira, 24 de julho</p></div><button>Ver agenda</button></div>
        {appointments.map(item => <div className="schedule-row" key={item.time}><strong>{item.time}</strong><span className="patient-avatar">{item.patient.split(" ").map(n => n[0]).join("")}</span><div><b>{item.patient}</b><small>{item.type}</small></div><span className={`queue-status ${item.status === "Aguardando" ? "waiting" : ""}`}>{item.status}</span><button aria-label={`Abrir prontuário de ${item.patient}`}>→</button></div>)}
      </div>
      <div className="panel request-panel">
        <div className="panel-heading"><div><h2>Solicitações</h2><p>Precisam da sua atenção</p></div><span className="count-badge">{refillStatus === "pending" ? 3 : 2}</span></div>
        {refillStatus === "pending" && <div className="request-card highlighted"><div className="request-top"><span className="patient-avatar">ML</span><div><strong>Maria Lopez</strong><small>Renovação · Losartana 50 mg</small></div><span>Agora</span></div><p>Uso contínuo · Última renovação há 30 dias.</p><div className="request-actions"><button className="reject">Recusar</button><button className="approve" onClick={onApproveRefill}>Aprovar</button></div></div>}
        <div className="request-card"><div className="request-top"><span className="patient-avatar lavender">AC</span><div><strong>Alex Carter</strong><small>Formulário de admissão</small></div><span>12 min</span></div><button className="text-action">Revisar formulário →</button></div>
        <div className="request-card"><div className="request-top"><span className="patient-avatar peach">PS</span><div><strong>Priya Shah</strong><small>Alteração de consulta</small></div><span>28 min</span></div><button className="text-action">Abrir solicitação →</button></div>
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button><p className="eyebrow">NOVA CONSULTA</p><h2 id="booking-title">Encontre um horário</h2><p>Escolha a especialidade e o melhor horário para você.</p><form onSubmit={onSubmit}><label>Especialidade<select defaultValue="Clínica Geral"><option>Clínica Geral</option><option>Cardiologia</option><option>Dermatologia</option></select></label><label>Profissional<select defaultValue="Dra. Ana Costa"><option>Dra. Ana Costa</option><option>Dr. João Lima</option></select></label><fieldset><legend>Horários disponíveis · 24 de julho</legend><div className="time-options"><label><input type="radio" name="time" value="09:00" />09:00</label><label><input type="radio" name="time" value="10:30" defaultChecked />10:30</label><label><input type="radio" name="time" value="15:00" />15:00</label></div></fieldset><button className="primary-button full" type="submit">Confirmar agendamento</button></form></div></div>;
}
