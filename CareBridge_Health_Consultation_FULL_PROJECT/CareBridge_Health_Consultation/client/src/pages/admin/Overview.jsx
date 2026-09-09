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
import { EmptyPlate } from "../../components/PageHero";

function OpsTile({ icon: Icon, label, value, detail, tone = "default", to }) {
  const node = <><span className={`cbv6-ops-tile-icon tone-${tone}`}><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>{to && <ChevronRight size={16} />}</>;
  return to ? <Link className="cbv6-ops-tile" to={to}>{node}</Link> : <div className="cbv6-ops-tile">{node}</div>;
}

function OpsModule({ to, icon: Icon, title, text, badge }) {
  return <Link className="cbv6-ops-module" to={to}><span><Icon size={19} /></span><div><strong>{title}</strong><small>{text}</small></div>{badge ? <em>{badge}</em> : <ChevronRight size={16} />}</Link>;
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
  const occItems = useMemo(() => wards.map((ward) => ({ label: ward.name, value: Math.max(0, Number(ward.capacity || 0) - Number(ward.available || 0)), max: Number(ward.capacity || 1) })), [wards]);

  if (!stats) return <div className="product-loading"><Activity className="spin-soft" size={20} /><span>Loading hospital command centre…</span></div>;

  const pressure = occupancy >= 90 ? "critical" : occupancy >= 75 ? "watch" : "stable";
  const pressureLabel = pressure === "critical" ? "Capacity pressure" : pressure === "watch" ? "Capacity watch" : "Hospital stable";

  return (
    <div className="cbv6-admin-home">
      <header className="cbv6-warroom-header">
        <div><span>RIDGE CAMPUS · LIVE OPERATIONS</span><h1>Hospital command</h1><p>A single decision surface for capacity, clinics, people, support and finance.</p></div>
        <div className="cbv6-warroom-radar"><OpsRadar occupancy={occupancy} pending={stats.pendingWards} beds={stats.bedsAvailable} /></div>
      </header>

      <section className={`cbv6-operational-state state-${pressure}`}>
        <div><i /><span><small>Operational state</small><strong>{pressureLabel}</strong></span></div>
        <div><small>Occupancy</small><b>{occupancy}%</b></div>
        <div><small>Pending admissions</small><b>{stats.pendingWards || pending.length}</b></div>
        <div><small>Clinic confirmations</small><b>{stats.pendingAppointments || 0}</b></div>
        <div><small>Support queue</small><b>{stats.openTickets || 0}</b></div>
        <span><Activity size={13} /> refreshes every 30s</span>
      </section>

      <div className="cbv6-ops-overview-grid">
        <section className="cbv6-panel cbv6-capacity-command">
          <header><div><small>Capacity engine</small><h2>Bed occupancy</h2></div><Link className="secondary-btn" to="/admin/hospital"><Building2 size={15} /> Open bed board</Link></header>
          <div className="cbv6-capacity-body">
            <div className={`cbv6-occupancy-gauge gauge-${pressure}`} style={{ "--level": `${Math.min(100, occupancy)}%` }}><div><strong>{occupancy}%</strong><span>occupied</span></div></div>
            <div className="cbv6-capacity-bars"><OccupancyBars items={occItems} /></div>
          </div>
        </section>

        <section className="cbv6-panel cbv6-decision-queue">
          <header><div><small>Decision queue</small><h2>Needs attention</h2></div><span className="cbv6-live-chip"><i /> Live</span></header>
          <Link to="/admin/hospital" className={pending.length ? "needs-attention" : ""}><span><BedDouble size={18} /></span><div><strong>Admission requests</strong><small>{pending.length ? `${pending.length} waiting for a bed decision` : "No pending admissions"}</small></div><em>{pending.length}</em></Link>
          <Link to="/admin/appointments" className={stats.pendingAppointments ? "needs-attention" : ""}><span><CalendarDays size={18} /></span><div><strong>Clinic confirmations</strong><small>{stats.pendingAppointments ? `${stats.pendingAppointments} encounters need action` : "Clinic book is current"}</small></div><em>{stats.pendingAppointments || 0}</em></Link>
          <Link to="/support" className={stats.openTickets ? "needs-attention" : ""}><span><LifeBuoy size={18} /></span><div><strong>Support queue</strong><small>{stats.openTickets ? `${stats.openTickets} requests are open` : "Support queue is clear"}</small></div><em>{stats.openTickets || 0}</em></Link>
        </section>
      </div>

      <div className="cbv6-ops-tile-row">
        <OpsTile icon={Users} label="Registered patients" value={stats.patients} detail={`${stats.doctors} consultants`} tone="blue" to="/admin/users" />
        <OpsTile icon={CalendarDays} label="Clinic book" value={stats.appointments} detail={`${stats.pendingAppointments || 0} pending`} tone="teal" to="/admin/appointments" />
        <OpsTile icon={BedDouble} label="Beds available" value={stats.bedsAvailable} detail={`${occupancy}% occupied`} tone={pressure === "critical" ? "red" : "green"} to="/admin/hospital" />
        <OpsTile icon={LifeBuoy} label="Support" value={stats.openTickets || 0} detail="open requests" tone="amber" to="/support" />
      </div>

      <section className="cbv6-ops-modules">
        <header><div><small>Hospital operating system</small><h2>Command modules</h2></div><span>Role-protected workspaces</span></header>
        <div>
          <OpsModule to="/admin/users" icon={Users} title="People" text="Patients, clinicians and access" />
          <OpsModule to="/admin/hospital" icon={Building2} title="Capacity & beds" text="Occupancy and admission decisions" badge={pending.length || undefined} />
          <OpsModule to="/admin/appointments" icon={CalendarDays} title="Clinic operations" text="Schedule and confirmation queue" badge={stats.pendingAppointments || undefined} />
          <OpsModule to="/admin/reports" icon={ScrollText} title="Analytics & audit" text="Revenue, activity and traceability" />
          <OpsModule to="/admin/cases" icon={FolderKanban} title="Case workflow" text="Operational files and follow-up" />
          <OpsModule to="/pay" icon={Receipt} title="Finance & receipts" text="Verified receipts and cash review" />
          <OpsModule to="/billing/tariff" icon={Wallet} title="Tariff manager" text="Published hospital charges" />
          <OpsModule to="/support" icon={LifeBuoy} title="Support desk" text="Patient and staff requests" badge={stats.openTickets || undefined} />
        </div>
      </section>

      <div className="cbv6-ops-lower-grid">
        <section className="cbv6-panel">
          <header><div><small>Admissions</small><h2>Waiting for a decision</h2></div><Link className="ghost-btn" to="/admin/hospital">View all</Link></header>
          <div className="cbv6-ops-list">
            {pending.length === 0 && <EmptyPlate compact scene="wards" title="No pending admissions" hint="New ward requests will appear here." />}
            {pending.slice(0, 5).map((booking) => <Link to="/admin/hospital" key={booking.id}><Avatar person={booking.patient} /><div><strong>{booking.patient?.name}</strong><small>{booking.ward} · {booking.date} · {booking.nights} night{booking.nights === 1 ? "" : "s"}</small></div><span className="status pending">pending</span><ChevronRight size={16} /></Link>)}
          </div>
        </section>

        <section className="cbv6-panel">
          <header><div><small>Communications</small><h2>Recent patient notices</h2></div><Link className="ghost-btn" to="/alerts">Notice log</Link></header>
          <div className="cbv6-ops-list">
            {emails.length === 0 && <EmptyPlate compact scene="messages" title="No outbound notices yet" />}
            {emails.map((email) => <div key={email.id}><span className="cbv6-ops-row-icon"><Mail size={16} /></span><div><strong>{email.subject}</strong><small>{email.to}</small></div><span className={`status ${email.status}`}>{email.status}</span></div>)}
          </div>
        </section>
      </div>

      <footer className="cbv6-ops-assurance"><ShieldCheck size={16} /><span>Operational views are role-protected. Payments post only after verified provider or staff confirmation.</span><CircleDollarSign size={16} /></footer>
    </div>
  );
}
