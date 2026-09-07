import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, BedDouble, Building2, CalendarDays, FolderKanban,
  LifeBuoy, Mail, Receipt, ScrollText, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { api } from "../../api";
import { HOSPITAL } from "../../utils";
import { OccupancyBars } from "../../components/LiveMeter";
import Avatar from "../../components/Avatar";
import { photoFor } from "../../imagery";

function Stat({ icon: Icon, label, value, hint, to }) {
  const body = <><span className="v5-stat-icon"><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong><span>{hint}</span></div></>;
  return to ? <Link className="v5-stat" to={to}>{body}</Link> : <div className="v5-stat">{body}</div>;
}

function OpsLink({ to, icon: Icon, title, text, badge }) {
  return (
    <Link className="v5-ops-link" to={to}>
      <span><Icon size={17} /></span>
      <div><b>{title}</b><small>{text}</small></div>
      {badge ? <em>{badge}</em> : <ArrowRight size={15} />}
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

  if (!stats) return <div className="v5-loading"><Activity size={19} /><span>Loading hospital operations…</span></div>;

  const pressure = occupancy >= 90 ? "critical" : occupancy >= 75 ? "watch" : "stable";
  const pressureLabel = pressure === "critical" ? "Capacity pressure" : pressure === "watch" ? "Watch capacity" : "Hospital stable";

  return (
    <div className="v5-dashboard v5-admin-home">
      <section className="v5-admin-header">
        <div className="v5-admin-header-copy">
          <span className="v5-kicker">{HOSPITAL.campus} · operations</span>
          <h1>Hospital operations</h1>
          <p>A live working view of capacity, clinics, support, people, cases, notices and finance.</p>
          <div className="v5-admin-status"><span className={`v5-pressure ${pressure}`}><i /> {pressureLabel}</span><span><Activity size={13} /> refreshes every 30s</span></div>
        </div>
        <div className="v5-admin-header-photo" style={{ backgroundImage: `url(${photoFor("ops")})` }} aria-hidden="true" />
      </section>

      <div className="v5-stat-row">
        <Stat icon={Users} label="Patients" value={stats.patients} hint={`${stats.doctors} consultants`} to="/admin/users" />
        <Stat icon={CalendarDays} label="Clinic book" value={stats.appointments} hint={`${stats.pendingAppointments || 0} awaiting action`} to="/admin/appointments" />
        <Stat icon={BedDouble} label="Beds available" value={stats.bedsAvailable} hint={`${occupancy}% occupied`} to="/admin/hospital" />
        <Stat icon={LifeBuoy} label="Support queue" value={stats.openTickets || 0} hint="Patient and staff requests" to="/support" />
      </div>

      <div className="v5-ops-grid">
        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Capacity</small><h2>Bed occupancy by ward</h2></div><Link className="secondary-btn" to="/admin/hospital"><Building2 size={14} /> Bed board</Link></div>
          <div className="v5-panel-body v5-occupancy-body">
            <div className={`v5-occupancy-score ${pressure}`}><strong>{occupancy}%</strong><span>occupied</span></div>
            <div className="v5-occupancy-bars"><OccupancyBars items={occItems} /></div>
          </div>
        </section>

        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Decision queue</small><h2>Needs attention</h2></div><span className="v5-live-chip"><i /> Live</span></div>
          <div className="v5-panel-body v5-decision-list">
            <Link to="/admin/hospital"><span><BedDouble size={16} /></span><div><b>Admission requests</b><small>{pending.length ? `${pending.length} waiting for a bed decision` : "No pending admissions"}</small></div><em>{pending.length}</em></Link>
            <Link to="/admin/appointments"><span><CalendarDays size={16} /></span><div><b>Clinic confirmations</b><small>{stats.pendingAppointments ? `${stats.pendingAppointments} encounters need action` : "Clinic book is current"}</small></div><em>{stats.pendingAppointments || 0}</em></Link>
            <Link to="/support"><span><LifeBuoy size={16} /></span><div><b>Support queue</b><small>{stats.openTickets ? `${stats.openTickets} requests are open` : "Support queue is clear"}</small></div><em>{stats.openTickets || 0}</em></Link>
          </div>
        </section>
      </div>

      <section className="v5-panel">
        <div className="v5-panel-head"><div><small>Hospital modules</small><h2>Operational workspaces</h2></div><span className="v5-panel-note">Role-protected</span></div>
        <div className="v5-panel-body v5-ops-links">
          <OpsLink to="/admin/users" icon={Users} title="People" text="Patients, clinicians and access" />
          <OpsLink to="/admin/hospital" icon={Building2} title="Capacity & beds" text="Occupancy and admissions" badge={pending.length || undefined} />
          <OpsLink to="/admin/appointments" icon={CalendarDays} title="Clinic operations" text="Schedule and confirmations" badge={stats.pendingAppointments || undefined} />
          <OpsLink to="/admin/reports" icon={ScrollText} title="Analytics & audit" text="Revenue, activity and traceability" />
          <OpsLink to="/admin/cases" icon={FolderKanban} title="Case workflow" text="Operational files and follow-up" />
          <OpsLink to="/pay" icon={Receipt} title="Finance & receipts" text="Verified receipts and manual review" />
          <OpsLink to="/billing/tariff" icon={Wallet} title="Tariff manager" text="Published hospital charges" />
          <OpsLink to="/support" icon={LifeBuoy} title="Support desk" text="Patient and staff requests" badge={stats.openTickets || undefined} />
        </div>
      </section>

      <div className="v5-ops-grid">
        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Admissions</small><h2>Waiting for a decision</h2></div><Link className="ghost-btn" to="/admin/hospital">View all</Link></div>
          <div className="v5-panel-body v5-ops-list">
            {pending.length === 0 && <div className="v5-empty-inline"><strong>No pending admissions</strong><span>New ward requests will appear here.</span></div>}
            {pending.slice(0, 5).map((booking) => (
              <Link to="/admin/hospital" key={booking.id}><Avatar person={booking.patient} className="small" /><div><b>{booking.patient?.name || "Patient"}</b><small>{booking.ward} · {booking.date} · {booking.nights} night{booking.nights === 1 ? "" : "s"}</small></div><span className="status pending">pending</span></Link>
            ))}
          </div>
        </section>

        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Communications</small><h2>Recent patient notices</h2></div><Link className="ghost-btn" to="/alerts">Notice log</Link></div>
          <div className="v5-panel-body v5-ops-list">
            {emails.length === 0 && <div className="v5-empty-inline"><strong>No outbound notices yet</strong><span>Hospital communications will appear here.</span></div>}
            {emails.map((email) => (
              <div key={email.id}><span className="v5-list-icon"><Mail size={15} /></span><div><b>{email.subject}</b><small>{email.to}</small></div><span className={`status ${email.status}`}>{email.status}</span></div>
            ))}
          </div>
        </section>
      </div>

      <div className="v5-assurance"><ShieldCheck size={15} /><span>Operational views are role-protected. Payments are posted only after verified provider or authorised staff confirmation.</span></div>
    </div>
  );
}
