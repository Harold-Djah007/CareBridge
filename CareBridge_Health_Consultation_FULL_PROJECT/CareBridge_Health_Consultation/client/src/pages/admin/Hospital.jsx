import React, { useEffect, useMemo, useState } from "react";
import { BedDouble, Building2, CheckCircle2, ClipboardCheck, Gauge, Users, XCircle } from "lucide-react";
import { api } from "../../api";
import { useToast } from "../../state";
import { OccupancyBars } from "../../components/LiveMeter";
import Avatar from "../../components/Avatar";
import PageHero from "../../components/PageHero";

export default function AdminHospital() {
  const { push } = useToast();
  const [wards, setWards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = () => { api("/wards").then(setWards); api("/ward-bookings").then(setBookings); };
  useEffect(() => { load(); }, []);

  const decide = async (id, status) => {
    await api(`/ward-bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    push(status === "confirmed" ? "Ward accepted. Patient emailed." : "Request declined. Patient emailed.");
    load();
  };

  const saveWard = async (e) => {
    e.preventDefault();
    await api(`/wards/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) });
    push("Ward updated"); setEdit(null); load();
  };

  const capacity = useMemo(() => wards.reduce((n, w) => n + Number(w.capacity || 0), 0), [wards]);
  const available = useMemo(() => wards.reduce((n, w) => n + Number(w.available || 0), 0), [wards]);
  const occupied = Math.max(0, capacity - available);
  const occupancy = capacity ? Math.round((occupied / capacity) * 100) : 0;
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  return (
    <div className="capacity-os">
      <PageHero scene="wards" eyebrow="Capacity command" title="Beds & admissions" lead="A live operational bed board for occupancy, pending reservations and ward capacity decisions across Ridge Campus." />

      <section className="ops-metric-grid">
        <article className="ops-metric"><span className="ops-metric-icon"><BedDouble size={17} /></span><div><small>Total beds</small><strong>{capacity}</strong><em>{wards.length} wards reporting</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon green"><Gauge size={17} /></span><div><small>Available now</small><strong>{available}</strong><em>{occupancy}% campus occupancy</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon amber"><ClipboardCheck size={17} /></span><div><small>Awaiting decision</small><strong>{pending.length}</strong><em>Admission requests</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon blue"><Users size={17} /></span><div><small>Confirmed reservations</small><strong>{confirmed.length}</strong><em>Incoming patients</em></div></article>
      </section>

      <div className="capacity-layout">
        <section className="product-section occupancy-command">
          <div className="product-section-head"><div><span className="eyebrow">Live occupancy</span><h3>Campus capacity picture</h3><p>Occupied beds against licensed capacity by ward.</p></div><span className={`capacity-score ${occupancy > 85 ? "critical" : occupancy > 70 ? "watch" : "good"}`}><b>{occupancy}%</b><small>occupied</small></span></div>
          <OccupancyBars items={wards.map((w) => ({ label: w.name, value: Math.max(0, Number(w.capacity || 0) - Number(w.available || 0)), max: Number(w.capacity || 1) }))} />
        </section>

        <section className="product-section admission-queue">
          <div className="product-section-head"><div><span className="eyebrow">Decision queue</span><h3>Pending admissions</h3><p>Review reservation requests before arrival.</p></div><span className="queue-count">{pending.length}</span></div>
          <div className="admission-request-list">
            {pending.map((b) => <article className="admission-request" key={b.id}>
              <Avatar person={b.patient || { name: "Patient" }} className="small" />
              <div><b>{b.patient?.name || "Patient"}</b><small>{b.ward} · {b.roomType}</small><em>{b.date} · {b.nights} night{Number(b.nights) === 1 ? "" : "s"}</em></div>
              <div className="admission-actions"><button className="soft-icon success" title="Accept" onClick={() => decide(b.id, "confirmed")}><CheckCircle2 size={17} /></button><button className="soft-icon danger" title="Decline" onClick={() => decide(b.id, "declined")}><XCircle size={17} /></button></div>
            </article>)}
            {pending.length === 0 && <div className="product-empty-inline"><ClipboardCheck size={18} /><span>No admission decisions are waiting.</span></div>}
          </div>
        </section>
      </div>

      <section className="product-section ward-control-section">
        <div className="product-section-head"><div><span className="eyebrow">Ward control</span><h3>Capacity by service</h3><p>Keep the bed inventory accurate for patients and hospital operations.</p></div></div>
        <div className="ward-control-grid">
          {wards.map((w) => {
            const used = Math.max(0, Number(w.capacity || 0) - Number(w.available || 0));
            const pct = Number(w.capacity) ? Math.round((used / Number(w.capacity)) * 100) : 0;
            return <article className="ward-control-card" key={w.id}>
              <div className="ward-control-top"><span className="ward-control-icon"><Building2 size={17} /></span><div><h3>{w.name}</h3><p>{w.description}</p></div><span className={`status ${Number(w.available) > 0 ? "confirmed" : "cancelled"}`}>{w.available} free</span></div>
              <div className="ward-capacity-line"><span><b>{used}</b> occupied</span><span><b>{w.capacity}</b> capacity</span><span><b>{pct}%</b> load</span></div>
              <div className="capacity-track"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <button className="secondary-btn" onClick={() => setEdit({ ...w })}>Manage capacity</button>
            </article>;
          })}
        </div>
      </section>

      {edit && <div className="modal-backdrop" onMouseDown={() => setEdit(null)}><form className="modal-card product-form-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={saveWard}>
        <span className="eyebrow">Ward inventory</span><h2>Edit {edit.name}</h2>
        <label>Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
        <div className="form-grid"><label>Available beds<input type="number" min="0" value={edit.available} onChange={(e) => setEdit({ ...edit, available: e.target.value })} /></label><label>Licensed capacity<input type="number" min="0" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></label></div>
        <label>Description<textarea rows="3" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEdit(null)}>Cancel</button><button className="primary-btn">Save ward</button></div>
      </form></div>}
    </div>
  );
}
