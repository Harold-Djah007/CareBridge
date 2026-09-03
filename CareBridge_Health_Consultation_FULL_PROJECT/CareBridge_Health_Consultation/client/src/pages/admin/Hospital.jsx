import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../api";
import { useToast } from "../../state";
import { OccupancyBars } from "../../components/LiveMeter";

export default function AdminHospital() {
  const { push } = useToast();
  const [wards, setWards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = () => {
    api("/wards").then(setWards);
    api("/ward-bookings").then(setBookings);
  };
  useEffect(load, []);

  const decide = async (id, status) => {
    await api(`/ward-bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    push(status === "confirmed" ? "Ward accepted. Patient emailed." : "Request declined. Patient emailed.");
    load();
  };

  const saveWard = async (e) => {
    e.preventDefault();
    await api(`/wards/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) });
    push("Ward updated");
    setEdit(null);
    load();
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Admissions</span>
          <h1>Hospital wards</h1>
          <p>Accept beds, decline requests, and keep availability accurate.</p>
        </div>
      </div>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><div><span className="eyebrow">Live occupancy</span><h3>Campus bed load</h3></div></div>
        <OccupancyBars items={wards.map((w) => ({
          label: w.name,
          value: Math.max(0, Number(w.capacity || 0) - Number(w.available || 0)),
          max: Number(w.capacity || 1),
        }))} />
      </section>
      <div className="ward-grid">
        {wards.map((w) => (
          <div className="ward-card" key={w.id}>
            <h3>{w.name}</h3>
            <p className="muted">{w.description}</p>
            <p><b>{w.available}</b> / {w.capacity} beds free</p>
            <button className="secondary-btn" onClick={() => setEdit({ ...w })}>Edit ward</button>
          </div>
        ))}
      </div>
      <section className="card top-gap">
        <h3>Reservation requests</h3>
        {bookings.map((b) => (
          <div className="appointment-row" key={b.id}>
            <div className="grow">
              <strong>{b.patient?.name}</strong>
              <span className="muted">{b.ward} · {b.roomType} · {b.date} · {b.nights} nights</span>
            </div>
            <span className={`status ${b.status}`}>{b.status}</span>
            {b.status === "pending" && (
              <div className="row-actions">
                <button className="soft-icon success" onClick={() => decide(b.id, "confirmed")}><CheckCircle2 size={18} /></button>
                <button className="soft-icon danger" onClick={() => decide(b.id, "declined")}><XCircle size={18} /></button>
              </div>
            )}
          </div>
        ))}
      </section>
      {edit && (
        <div className="modal-backdrop" onMouseDown={() => setEdit(null)}>
          <form className="modal-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={saveWard}>
            <h2>Edit {edit.name}</h2>
            <label>Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <div className="form-grid">
              <label>Available<input type="number" value={edit.available} onChange={(e) => setEdit({ ...edit, available: e.target.value })} /></label>
              <label>Capacity<input type="number" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></label>
            </div>
            <label>Description<textarea rows="3" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setEdit(null)}>Cancel</button>
              <button className="primary-btn">Save ward</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
