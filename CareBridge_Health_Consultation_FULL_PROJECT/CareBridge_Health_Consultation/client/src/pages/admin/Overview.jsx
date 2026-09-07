import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, BedDouble, Building2, CalendarDays, ChevronRight, CircleDollarSign,
  FolderKanban, LifeBuoy, Mail, Receipt, ScrollText, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { api } from "../../api";
import { HOSPITAL } from "../../utils";
import { OccupancyBars, OpsRadar } from "../../components/LiveMeter";
import Avatar from "../../components/Avatar";
import PageHero, { EmptyPlate } from "../../components/PageHero";

function OpsMetric({ icon: Icon, label, value, detail, tone = "default", to }) {
  const node = (
    <>
      <span className={`ops-metric-icon tone-${tone}`}><Icon size={18} /></span>
      <div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
      {to ? <ChevronRight size={17} /> : null}
    </>
  );
  return to ? <Link className="ops-metric-card" to={to}>{node}</Link> : <div className="ops-metric-card">{node}</div>;
}

function OpsAction({ to, icon: Icon, title, detail, badge }) {
  return (
    <Link to={to} className="ops-action-card">
      <span><Icon size={18} /></span>
      <div><b>{title}</b><small>{detail}</small></div>
      {badge ? <em>{badge}</em> : <ChevronRight size={17} />}
    </Link>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [emails, setEmails] = useState([]);
  const [pending, setPending] = useState([]);
  const [wards, setWards] = useState([]);

  const load = () => {
    api("/admin/overview").then(setStats).catch(() => {});
    api("/admin/emails").then((rows) => setEmails(rows.slice(0, 6))).catch(() => {});
    api("/ward-bookings").then((rows) => setPending(rows.filter((ward) => ward.status === "pending"))).catch(() => {});
    api("/wards").then(setWards).catch(() => {});
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const occupancy = stats ? Math.round(((44 - Number(stats.bedsAvailable || 0)) / 44) * 100) : 0;
  const occItems = useMemo(() => wards.map((ward) => ({
    label: ward.name,
    value: Math.max(0, Number(ward.capacity || 0) - Number(ward.available || 0)),
    max: Number(ward.capacity || 1),
  })), [wards]);

  if (!stats) return <div className="product-loading"><Activity className="spin-soft" size={20} /><span>Loading hospital command centre…</span></div>;

  const pressure = occupancy >= 90 ? "critical" : occupancy >= 75 ? "watch" : "stable";
  const pressureLabel = pressure === "critical" ? "Capacity pressure" : pressure === "watch" ? "Watch capacity" : "Hospital stable";

  return (
    <div className="product-dashboard admin-command-dashboard">
      <PageHero
        scene="ops"
        className="admin-command-hero"
        eyebrow={`${HOSPITAL.campus} · hospital command`}
        title="Hospital command centre"
        lead="One live operational picture for capacity, clinics, support, people, cases, notices and finance."
        actions={<OpsRadar occupancy={occupancy} pending={stats.pendingWards} beds={stats.bedsAvailable} />}
      />

      <div className="ops-status-ribbon">
        <div className={`ops-health-state ${pressure}`}><span className="product-live-dot" /><div><small>Operational status</small><b>{pressureLabel}</b></div></div>
        <div><small>Campus occupancy</small><b>{occupancy}%</b></div>
        <div><small>Pending admissions</small><b>{stats.pendingWards || pending.length}</b></div>
        <div><small>Clinic confirmations</small><b>{stats.pendingAppointments || 0}</b></div>
        <div><small>Support queue</small><b>{stats.openTickets || 0}</b></div>
        <span className="ops-updated"><Activity size={13} /> refreshes every 30s</span>
      </div>

      <div className="ops-metric-grid">
        <OpsMetric icon={Users} label="Registered patients" value={stats.patients} detail={`${stats.doctors} consultants on staff`} tone="blue" to="/admin/users" />
        <OpsMetric icon={CalendarDays} label="Clinic book" value={stats.appointments} detail={`${stats.pendingAppointments || 0} awaiting confirmation`} tone="teal" to="/admin/appointments" />
        <OpsMetric icon={BedDouble} label="Beds available" value={stats.bedsAvailable} detail={`${occupancy}% currently occupied`} tone={pressure === "critical" ? "red" : "green"} to="/admin/hospital" />
        <OpsMetric icon={LifeBuoy} label="Open support tickets" value={stats.openTickets || 0} detail="Patient and staff requests" tone="amber" to="/support" />
      </div>

      <div className="ops-command-grid">
        <section className="command-panel occupancy-command-panel">
          <div className="command-panel-head">
            <div><span className="eyebrow">Live capacity</span><h2>Bed occupancy by ward</h2></div>
            <Link className="secondary-btn" to="/admin/hospital"><Building2 size={15} /> Open bed board</Link>
          </div>
          <div className="occupancy-summary">
            <div className="occupancy-dial" style={{ "--occupancy": `${Math.min(100, occupancy)}%` }}><strong>{occupancy}%</strong><span>occupied</span></div>
            <div className="grow"><OccupancyBars items={occItems} /></div>
          </div>
        </section>

        <section className="command-panel ops-priority-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Decision queue</span><h2>Needs operations attention</h2></div><span className="live-state"><i /> Live</span></div>
          <div className="ops-priority-list">
            <Link to="/admin/hospital" className={pending.length ? "attention" : "clear"}><span><BedDouble size={17} /></span><div><b>Admission requests</b><small>{pending.length ? `${pending.length} waiting for a bed decision` : "No pending admissions"}</small></div><em>{pending.length}</em></Link>
            <Link to="/admin/appointments" className={stats.pendingAppointments ? "attention" : "clear"}><span><CalendarDays size={17} /></span><div><b>Clinic confirmations</b><small>{stats.pendingAppointments ? `${stats.pendingAppointments} encounters need action` : "Clinic book is current"}</small></div><em>{stats.pendingAppointments || 0}</em></Link>
            <Link to="/support" className={stats.openTickets ? "attention" : "clear"}><span><LifeBuoy size={17} /></span><div><b>Support queue</b><small>{stats.openTickets ? `${stats.openTickets} requests are open` : "Support queue is clear"}</small></div><em>{stats.openTickets || 0}</em></Link>
          </div>
        </section>
      </div>

      <section className="product-section ops-actions-section">
        <div className="product-section-head"><div><span className="eyebrow">Hospital modules</span><h2>Run the hospital</h2></div><span className="section-hint">Role-safe operational workspaces</span></div>
        <div className="ops-action-grid">
          <OpsAction to="/admin/users" icon={Users} title="People directory" detail="Patients, clinicians and access" />
          <OpsAction to="/admin/hospital" icon={Building2} title="Capacity & beds" detail="Occupancy and admission decisions" badge={pending.length || undefined} />
          <OpsAction to="/admin/appointments" icon={CalendarDays} title="Clinic operations" detail="Schedule and confirmation queue" badge={stats.pendingAppointments || undefined} />
          <OpsAction to="/admin/reports" icon={ScrollText} title="Analytics & audit" detail="Revenue, activity and traceability" />
          <OpsAction to="/admin/cases" icon={FolderKanban} title="Case workflow" detail="Operational files and follow-up" />
          <OpsAction to="/pay" icon={Receipt} title="Finance & receipts" detail="Verified receipts and cash review" />
          <OpsAction to="/billing/tariff" icon={Wallet} title="Tariff manager" detail="Published hospital charges" />
          <OpsAction to="/support" icon={LifeBuoy} title="Support desk" detail="Patient and staff requests" badge={stats.openTickets || undefined} />
        </div>
      </section>

      <div className="ops-lower-grid">
        <section className="command-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Admissions</span><h2>Waiting for a decision</h2></div><Link className="ghost-btn" to="/admin/hospital">View all</Link></div>
          <div className="ops-table-list">
            {pending.length === 0 && <EmptyPlate compact scene="wards" title="No pending admissions" hint="New ward requests will appear here." />}
            {pending.slice(0, 5).map((booking) => (
              <Link to="/admin/hospital" className="ops-table-row" key={booking.id}>
                <Avatar person={booking.patient} />
                <div className="grow"><b>{booking.patient?.name}</b><small>{booking.ward} · {booking.date} · {booking.nights} night{booking.nights === 1 ? "" : "s"}</small></div>
                <span className="status pending">pending</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Communications</span><h2>Recent patient notices</h2></div><Link className="ghost-btn" to="/alerts">Notice log</Link></div>
          <div className="ops-table-list">
            {emails.length === 0 && <EmptyPlate compact scene="messages" title="No outbound notices yet" />}
            {emails.map((email) => (
              <div className="ops-table-row" key={email.id}>
                <span className="ops-row-icon"><Mail size={16} /></span>
                <div className="grow"><b>{email.subject}</b><small>{email.to}</small></div>
                <span className={`status ${email.status}`}>{email.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="ops-footer-assurance"><ShieldCheck size={16} /><span>Operational views are role-protected. Payments are posted only after verified provider or staff confirmation.</span><CircleDollarSign size={16} /></div>
    </div>
  );
}
