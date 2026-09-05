import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Building2, CalendarDays, ScrollText, FolderKanban, Receipt, LifeBuoy, Wallet } from "lucide-react";
import { api } from "../../api";
import { HOSPITAL } from "../../utils";
import { OccupancyBars, OpsRadar } from "../../components/LiveMeter";
import Avatar from "../../components/Avatar";
import { JumpMenu } from "../../components/TileCard";
import PageHero from "../../components/PageHero";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [emails, setEmails] = useState([]);
  const [pending, setPending] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    api("/admin/overview").then(setStats);
    api("/admin/emails").then((e) => setEmails(e.slice(0, 6)));
    api("/ward-bookings").then((rows) => setPending(rows.filter((w) => w.status === "pending")));
    api("/wards").then(setWards);
  }, []);

  if (!stats) return <p className="muted">Loading operations board…</p>;
  const occupancy = Math.round(((44 - Number(stats.bedsAvailable || 0)) / 44) * 100);
  const occItems = wards.map((w) => ({
    label: w.name,
    value: Math.max(0, Number(w.capacity || 0) - Number(w.available || 0)),
    max: Number(w.capacity || 1),
  }));

  return (
    <div className="home-stage">
      <PageHero
        scene="ops"
        className="ops-hero"
        eyebrow={`${HOSPITAL.campus} operations`}
        title="Operations"
        lead="Beds, clinic load, support desk, and outbound notices. Paid invoices are under Receipts — operations does not check out for patients."
        actions={<OpsRadar occupancy={occupancy} pending={stats.pendingWards} beds={stats.bedsAvailable} />}
      />
      <div className="kpi-row compact">
        <div className="kpi"><span>Registered patients</span><strong>{stats.patients}</strong><small>{stats.doctors} consultants on staff</small></div>
        <div className="kpi"><span>Clinic book</span><strong>{stats.appointments}</strong><small>{stats.pendingAppointments} awaiting confirmation</small></div>
        <div className="kpi"><span>Open beds</span><strong>{stats.bedsAvailable}</strong><small>~{occupancy}% occupied</small></div>
        <div className="kpi"><span>Support desk</span><strong>{stats.openTickets || 0}</strong><small><Link to="/support">Open the queue</Link></small></div>
      </div>
      <JumpMenu label="Operations pages" items={[
        { to: "/admin/users", icon: Users, title: "Staff directory", subtitle: "Patients and clinicians" },
        { to: "/admin/hospital", icon: Building2, title: "Bed board", subtitle: `${stats.bedsAvailable} beds open` },
        { to: "/admin/appointments", icon: CalendarDays, title: "Clinic diary", subtitle: "Confirm and schedule" },
        { to: "/admin/reports", icon: ScrollText, title: "Reports", subtitle: "Revenue and audit" },
        { to: "/admin/cases", icon: FolderKanban, title: "Cases", subtitle: "Files and encounters" },
        { to: "/pay", icon: Receipt, title: "Receipts", subtitle: "Paid patient receipts" },
        { to: "/billing/tariff", icon: Wallet, title: "Tariff", subtitle: "Published fees" },
        { to: "/support", icon: LifeBuoy, title: "Support desk", subtitle: `${stats.openTickets || 0} open` },
      ]} />
      <section className="card home-feature" style={{ marginBottom: 16 }}>
        <div className="home-rail" style={{ backgroundImage: "url(/imagery/wards.jpg)" }} aria-hidden="true" />
        <div className="home-feature-body">
          <div className="card-head"><div><span className="eyebrow">Live occupancy</span><h3>Beds in use · {occupancy}%</h3></div></div>
          <OccupancyBars items={occItems} />
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Bed board</span><h3>Waiting for a decision</h3></div><Link to="/admin/hospital" className="ghost-btn">Open bed board</Link></div>
          {pending.length === 0 && <p className="muted">No pending admissions.</p>}
          {pending.map((b) => (
            <div className="appointment-row" key={b.id}>
              <Avatar person={b.patient} />
              <div className="grow"><strong>{b.patient?.name}</strong><span className="muted">{b.ward} · {b.date} · {b.nights} nights</span></div>
              <span className="status pending">pending</span>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Notices</span><h3>Last emails to patients</h3></div><Link to="/alerts" className="ghost-btn">Full log</Link></div>
          {emails.length === 0 && <p className="muted">No outbound notices yet.</p>}
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
