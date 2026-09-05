import React, { useEffect, useState } from "react";
import { BedDouble, Plus, Users, CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { todayISO, ghs, wardQuote } from "../utils";
import { OccupancyBars } from "../components/LiveMeter";
import PageHero from "../components/PageHero";

export default function WardBooking() {
  const { user } = useAuth();
  const { push } = useToast();
  const [wards, setWards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ward: "General Ward", roomType: "Private Room", date: todayISO(), nights: 1, notes: "" });
  const [rates, setRates] = useState(null);

  const load = () => api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setBookings);
  useEffect(() => {
    api("/wards").then((list) => {
      setWards(list);
      if (list[0]) setForm((f) => ({ ...f, ward: list[0].name }));
    });
    api("/finance/rates").then(setRates);
    load();
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api("/ward-bookings", { method: "POST", body: JSON.stringify({ ...form, patientId: user.id }) });
    setOpen(false);
    push("Reservation sent. You will get an email when it is accepted.");
    load();
  };

  const update = async (id, status) => {
    await api(`/ward-bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    push(status === "confirmed" ? "Ward accepted. The patient has been emailed." : "Ward request updated.");
    load();
    api("/wards").then(setWards);
  };

  return (
    <div>
      <PageHero
        scene="wards"
        eyebrow={user.role === "patient" ? "Admissions" : "Bed requests"}
        title={user.role === "patient" ? "Admissions" : "Bed queue"}
        lead={user.role === "patient" ? "Nightly ward rates plus room supplement are billed when admissions accept the bed. Pay by MoMo, GCB, NHIS, or cash." : "Accept or decline incoming requests. Occupancy updates automatically."}
        actions={user.role === "patient" ? <button className="primary-btn" onClick={() => setOpen(true)}><Plus size={18} /> Reserve a ward</button> : null}
      />
      {user.role !== "patient" && (
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="card-head"><div><span className="eyebrow">Live occupancy</span><h3>Beds currently occupied</h3></div></div>
          <OccupancyBars items={wards.map((w) => ({
            label: w.name,
            value: Math.max(0, Number(w.capacity || 0) - Number(w.available || 0)),
            max: Number(w.capacity || 1),
          }))} />
        </section>
      )}

      {user.role === "patient" && (
        <div className="ward-grid">
          {wards.map((w) => (
            <div className="ward-card" key={w.id}>
              <div className="ward-icon"><BedDouble /></div>
              <h3>{w.name}</h3>
              <p className="muted">{w.description}</p>
              {rates?.wards?.[w.name] != null && <p><b>{ghs(rates.wards[w.name])}</b> <span className="muted">per night</span></p>}
              <div className="capacity"><span style={{ width: `${Math.min(100, (w.available / (w.capacity || 1)) * 100)}%` }} /></div>
              <div className="ward-foot">
                <span className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}><Users size={16} />{w.available} of {w.capacity} beds free</span>
                <button className="ghost-btn" onClick={() => { setForm({ ...form, ward: w.name }); setOpen(true); }}>Choose ward</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card top-gap">
        <div className="card-head"><div><span className="eyebrow">{user.role === "patient" ? "Your reservations" : "Requests"}</span><h3>{bookings.length} booking{bookings.length === 1 ? "" : "s"}</h3></div></div>
        {bookings.length === 0 && <p className="muted">No ward reservations yet.</p>}
        {bookings.map((b) => (
          <div className="appointment-row" key={b.id}>
            <div className="date-box"><CalendarDays size={19} /></div>
            <div className="grow">
              <strong>{user.role === "patient" ? b.ward : b.patient?.name}</strong>
              <span className="muted">{user.role === "patient" ? b.roomType : `${b.ward} · ${b.roomType}`}</span>
              <small className="muted">{b.date} · {b.nights} night{b.nights > 1 ? "s" : ""}{b.fee ? ` · ${ghs(b.fee)}` : ""}{b.notes ? ` · ${b.notes}` : ""}</small>
            </div>
            <span className={`status ${b.status}`}>{b.status}</span>
            {user.role === "patient" && b.invoiceStatus === "due" && b.invoiceId && (
              <Link className="ghost-btn" to={`/pay?invoice=${b.invoiceId}`}>Pay</Link>
            )}
            {user.role !== "patient" && b.status === "pending" && (
              <div className="row-actions">
                <button className="soft-icon success" title="Accept" onClick={() => update(b.id, "confirmed")}><CheckCircle2 size={18} /></button>
                <button className="soft-icon danger" title="Decline" onClick={() => update(b.id, "declined")}><XCircle size={18} /></button>
              </div>
            )}
          </div>
        ))}
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal-card" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-icon"><BedDouble /></div>
            <h2>Reserve a hospital ward</h2>
            <p className="muted">We email you when staff accept this request.</p>
            <label>Ward
              <select value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })}>
                {wards.map((w) => <option key={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label>Room type
              <select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
                <option>Shared Room</option>
                <option>Private Room</option>
                <option>Premium Private Room</option>
              </select>
            </label>
            <div className="form-grid">
              <label>Admission date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
              <label>Nights<input type="number" min="1" max="30" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} /></label>
            </div>
            <label>Notes<textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the hospital should prepare for?" /></label>
            {wardQuote(rates, form.ward, form.roomType, form.nights) != null && (
              <p><b>Estimated fee: {ghs(wardQuote(rates, form.ward, form.roomType, form.nights))}</b><span className="muted"> — billed when the bed is accepted</span></p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary-btn">Send reservation</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
