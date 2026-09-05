import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Building2, CalendarDays, ScrollText, FolderKanban, Receipt, LifeBuoy, Wallet } from "lucide-react";
import { api } from "../../api";
import { HOSPITAL } from "../../utils";
import { OccupancyBars, OpsRadar } from "../../components/LiveMeter";
import Avatar from "../../components/Avatar";
import TileCard, { TileGrid } from "../../components/TileCard";

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
    <div>
      <div className="page-title ops-hero">
        <div>
          <span className="eyebrow">{HOSPITAL.campus} operations</span>
          <h1>Operations</h1>
          <p>Beds, clinic load, support desk, and outbound notices. Paid invoices are under Receipts — operations does not check out for patients.</p>
        </div>
        <OpsRadar occupancy={occupancy} pending={stats.pendingWards} beds={stats.bedsAvailable} />
      </div>
      <div className="kpi-row compact">
        <div className="kpi"><span>Registered patients</span><strong>{stats.patients}</strong><small>{stats.doctors} consultants on staff</small></div>
        <div className="kpi"><span>Clinic book</span><strong>{stats.appointments}</strong><small>{stats.pendingAppointments} awaiting confirmation</small></div>
        <div className="kpi"><span>Open beds</span><strong>{stats.bedsAvailable}</strong><small>~{occupancy}% occupied</small></div>
        <div className="kpi"><span>Support desk</span><strong>{stats.openTickets || 0}</strong><small><Link to="/support">Open the queue</Link></small></div>
      </div>
      <TileGrid label="Operations shortcuts">
        <TileCard to="/admin/users" icon={Users} title="Staff directory" subtitle="Patients and clinicians" />
        <TileCard to="/admin/hospital" icon={Building2} title="Bed board" subtitle={`${stats.bedsAvailable} beds open`} />
        <TileCard to="/admin/appointments" icon={CalendarDays} title="Clinic diary" subtitle="Confirm and schedule" />
        <TileCard to="/admin/reports" icon={ScrollText} title="Reports" subtitle="Revenue and audit" />
        <TileCard to="/admin/cases" icon={FolderKanban} title="Case workflow" subtitle="Files and encounters" />
        <TileCard to="/pay" icon={Receipt} title="Receipts" subtitle="Paid patient receipts" />
        <TileCard to="/billing/tariff" icon={Wallet} title="Tariff" subtitle="Published hospital fees" />
        <TileCard to="/support" icon={LifeBuoy} title="Support desk" subtitle={`${stats.openTickets || 0} open tickets`} />
      </TileGrid>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><div><span className="eyebrow">Live occupancy</span><h3>Beds in use · {occupancy}% campus load</h3></div></div>
        <OccupancyBars items={occItems} />
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
