import React, { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, Clock3, MonitorSmartphone, Search, Stethoscope, XCircle } from "lucide-react";
import { api } from "../../api";
import { useToast } from "../../state";
import { formatDate, formatTime } from "../../utils";
import Avatar from "../../components/Avatar";
import PageHero from "../../components/PageHero";

export default function AdminSchedule() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");

  const load = () => api("/appointments").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const update = async (id, status) => {
    await api(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    toast?.push(`Appointment ${status}. Patient emailed.`);
    load();
  };

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((a) => a.status === "pending").length,
    confirmed: rows.filter((a) => a.status === "confirmed").length,
    video: rows.filter((a) => a.mode === "video" && !["cancelled", "completed"].includes(a.status)).length,
  }), [rows]);

  const visible = useMemo(() => rows.filter((a) => {
    if (filter === "active" && ["completed", "cancelled"].includes(a.status)) return false;
    if (filter !== "active" && filter !== "all" && a.status !== filter) return false;
    const hay = `${a.patient?.name || ""} ${a.doctor?.name || ""} ${a.reason || ""} ${a.mode || ""}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [rows, filter, query]);

  return (
    <div className="clinic-ops-os">
      <PageHero scene="schedule" eyebrow="Clinic operations" title="Encounter control board" lead="Run the daily hospital diary from one queue: confirm arrivals, track teleconsults, complete encounters and resolve cancellations." />

      <section className="ops-metric-grid">
        <article className="ops-metric"><span className="ops-metric-icon"><CalendarCheck2 size={17} /></span><div><small>Scheduled</small><strong>{stats.total}</strong><em>All encounters</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon amber"><Clock3 size={17} /></span><div><small>Awaiting confirmation</small><strong>{stats.pending}</strong><em>Needs operations action</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon green"><CheckCircle2 size={17} /></span><div><small>Confirmed</small><strong>{stats.confirmed}</strong><em>Ready for clinic</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon blue"><MonitorSmartphone size={17} /></span><div><small>Teleconsults</small><strong>{stats.video}</strong><em>Active video visits</em></div></article>
      </section>

      <section className="product-section clinic-operations-panel">
        <div className="clinic-controlbar">
          <div className="directory-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient, clinician or reason" /></div>
          <div className="directory-role-tabs">
            {[['active','Active'],['pending','Pending'],['confirmed','Confirmed'],['completed','Completed'],['cancelled','Cancelled'],['all','All']].map(([id,label]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
        </div>

        <div className="clinic-board">
          <div className="clinic-board-head"><span>Time</span><span>Patient</span><span>Clinician</span><span>Encounter</span><span>Status</span><span>Operations</span></div>
          {visible.map((a) => <article className={`clinic-board-row status-${a.status}`} key={a.id}>
            <div className="clinic-time"><b>{formatTime(a.time)}</b><small>{formatDate(a.date)}</small></div>
            <div className="clinic-person"><Avatar person={a.patient || { name: "Patient" }} className="small" /><span><b>{a.patient?.name || "Patient"}</b><small>{a.reason || "Consultation"}</small></span></div>
            <div className="clinic-person"><Avatar person={a.doctor || { name: "Clinician" }} className="small" /><span><b>{a.doctor?.name || "Unassigned"}</b><small>{a.doctor?.specialty || "Clinical service"}</small></span></div>
            <div className="encounter-mode">{a.mode === "video" ? <MonitorSmartphone size={15} /> : <Stethoscope size={15} />}<span><b>{a.mode === "video" ? "Video" : "On campus"}</b><small>{a.invoiceStatus === "paid" ? "Paid" : a.invoiceStatus || "Billing pending"}</small></span></div>
            <div><span className={`status ${a.status}`}>{a.status}</span></div>
            <div className="clinic-actions">
              {a.status === "pending" && <button className="soft-icon success" title="Confirm" onClick={() => update(a.id, "confirmed")}><CheckCircle2 size={17} /></button>}
              {!["completed", "cancelled"].includes(a.status) && <button className="secondary-btn" onClick={() => update(a.id, "completed")}>Complete</button>}
              {a.status !== "cancelled" && <button className="soft-icon danger" title="Cancel" onClick={() => update(a.id, "cancelled")}><XCircle size={17} /></button>}
            </div>
          </article>)}
          {visible.length === 0 && <div className="product-empty-inline"><CalendarCheck2 size={18} /><span>No encounters match this operational view.</span></div>}
        </div>
      </section>
    </div>
  );
}
