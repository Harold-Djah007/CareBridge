import React, { useEffect, useState } from "react";
import { Users, CalendarDays, BedDouble, Mail, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import StatCard from "../../components/StatCard";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [emails, setEmails] = useState([]);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    api("/admin/overview").then(setStats);
    api("/admin/emails").then((e) => setEmails(e.slice(0, 5)));
    api("/ward-bookings").then((rows) => setPending(rows.filter((w) => w.status === "pending")));
  }, []);

  if (!stats) return <p className="muted">Loading hospital overview…</p>;

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Hospital overview</h1>
          <p>People, visits, beds, and every patient email alert from one console.</p>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard icon={Users} label="Patients" value={stats.patients} hint={`${stats.doctors} doctors`} />
        <StatCard icon={CalendarDays} label="Appointments" value={stats.appointments} hint={`${stats.pendingAppointments} pending`} />
        <StatCard icon={BedDouble} label="Ward requests" value={stats.wardBookings} hint={`${stats.pendingWards} awaiting acceptance`} />
        <StatCard icon={Activity} label="Open beds" value={stats.bedsAvailable} hint="Across all wards" />
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Admissions</span><h3>Pending ward requests</h3></div><Link to="/admin/hospital" className="ghost-btn">Manage</Link></div>
          {pending.length === 0 && <p className="muted">No pending admissions.</p>}
          {pending.map((b) => (
            <div className="appointment-row" key={b.id}>
              <div className="avatar">{b.patient?.avatar}</div>
              <div className="grow"><strong>{b.patient?.name}</strong><span className="muted">{b.ward} · {b.date}</span></div>
              <span className="status pending">pending</span>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Patient emails</span><h3>Latest alerts</h3></div><Link to="/alerts" className="ghost-btn"><Mail size={16} /> Full log</Link></div>
          {emails.length === 0 && <p className="muted">No emails sent yet.</p>}
          {emails.map((e) => (
            <div className="appointment-row" key={e.id}>
              <div className="grow"><strong>{e.subject}</strong><span className="muted">{e.to}</span></div>
              <span className={`status ${e.status}`}>{e.status}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
