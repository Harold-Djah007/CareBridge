import React, { useEffect, useMemo, useState } from "react";
import { BedDouble, Building2, CheckCircle2, Edit3, LogOut, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../../api";
import { useAuth, useToast } from "../../state";
import { OccupancyBars } from "../../components/LiveMeter";
import Avatar from "../../components/Avatar";

export default function AdminHospital() {
  const { user } = useAuth();
  const { push } = useToast();
  const [wards, setWards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = () => Promise.all([
    api("/wards").then(setWards),
    api("/ward-bookings").then(setBookings),
  ]);

  useEffect(() => {
    load();
    const socket = io(socketUrl, socketOptions());
    socket.emit("join-user", user.id);
    socket.on("ward-capacity", load);
    return () => socket.disconnect();
  }, [user.id]);

  const totalCapacity = useMemo(() => wards.reduce((sum, ward) => sum + Number(ward.capacity || 0), 0), [wards]);
  const totalAvailable = useMemo(() => wards.reduce((sum, ward) => sum + Number(ward.available || 0), 0), [wards]);
  const occupied = Math.max(0, totalCapacity - totalAvailable);
  const occupancy = totalCapacity ? Math.round((occupied / totalCapacity) * 100) : 0;
  const pending = bookings.filter((booking) => booking.status === "pending");
  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const pressure = occupancy >= 90 ? "critical" : occupancy >= 75 ? "watch" : "stable";

  const decide = async (id, status) => {
    try {
      await api(`/ward-bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      push(
        status === "confirmed"
          ? "Admission accepted and patient notified."
          : status === "discharged"
            ? "Patient discharged. One bed has been restored to live availability."
            : "Admission request declined, patient notified, and the held bed released."
      );
      await load();
    } catch (error) {
      push(error.message, "error");
    }
  };

  const saveWard = async (event) => {
    event.preventDefault();
    await api(`/wards/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) });
    push("Ward capacity updated");
    setEdit(null);
    load();
  };

  return (
    <div className="px-page px-bed-command">
      <section className="px-admin-title px-bed-title">
        <div><span className="px-kicker"><Sparkles size={14} /> Capacity command</span><h1>See pressure before it becomes a bed problem.</h1><p>Ward occupancy, held reservations and live bed availability are combined into one decision workspace.</p></div>
        <div className={`px-bed-gauge ${pressure}`}><span>Campus occupancy</span><strong>{occupancy}%</strong><small>{totalAvailable} beds free</small><i /></div>
      </section>

      <section className="px-signal-grid">
        <article><span><BedDouble size={17} /></span><div><small>Available beds</small><strong>{totalAvailable}</strong></div></article>
        <article><span><Building2 size={17} /></span><div><small>Held / occupied</small><strong>{occupied}</strong></div></article>
        <article><span><ShieldCheck size={17} /></span><div><small>Pending decisions</small><strong>{pending.length}</strong></div></article>
        <article><span><CheckCircle2 size={17} /></span><div><small>Confirmed</small><strong>{confirmed.length}</strong></div></article>
      </section>

      <section className="px-bed-map">
        <header className="px-board-head"><div><span className="px-kicker">Live capacity</span><h2>Ward pressure map</h2></div><span className={`px-capacity-state ${pressure}`}><i /> {pressure === "critical" ? "Critical pressure" : pressure === "watch" ? "Capacity watch" : "Stable"}</span></header>
        <div className="px-bed-map-body"><div className="px-bed-bars"><OccupancyBars items={wards.map((ward) => ({ label: ward.name, value: Math.max(0, Number(ward.capacity || 0) - Number(ward.available || 0)), max: Number(ward.capacity || 1) }))} /></div><div className="px-bed-ward-grid">{wards.map((ward) => {
          const used = Math.max(0, Number(ward.capacity || 0) - Number(ward.available || 0));
          const ratio = Number(ward.capacity || 0) ? Math.round((used / Number(ward.capacity || 1)) * 100) : 0;
          const tone = ratio >= 90 ? "critical" : ratio >= 75 ? "watch" : "stable";
          return <article className={`px-bed-ward ${tone}`} key={ward.id}><header><span><Building2 size={16} /></span><div><h3>{ward.name}</h3><p>{ward.description || "Hospital ward"}</p></div><button type="button" aria-label={`Edit ${ward.name} capacity`} onClick={() => setEdit({ ...ward })}><Edit3 size={15} /></button></header><div className="px-bed-numbers"><span><strong>{ward.available}</strong><small>free</small></span><span><strong>{used}</strong><small>held / occupied</small></span><span><strong>{ward.capacity}</strong><small>capacity</small></span></div><div className="px-bed-meter"><i style={{ width: `${Math.min(100, ratio)}%` }} /></div><footer>{ratio}% committed</footer></article>;
        })}</div></div>
      </section>

      <section className="px-admission-ledger px-bed-decisions">
        <header className="px-board-head"><div><span className="px-kicker">Admission decisions</span><h2>{pending.length} waiting for action</h2></div><span className="px-board-note">A bed is held as soon as a patient sends a reservation</span></header>
        <div className="px-admission-list">{bookings.slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1)).map((booking) => <article className={`px-admission-row ${booking.status}`} key={booking.id}><div className="px-admission-who"><Avatar person={booking.patient} /><div><h3>{booking.patient?.name || "Patient"}</h3><p>{booking.ward} · {booking.roomType}</p></div></div><div className="px-admission-meta"><span>{booking.date}</span><span>{booking.nights} night{Number(booking.nights) === 1 ? "" : "s"}</span></div><div className="px-admission-notes">{booking.notes || "No preparation notes"}</div><div className="px-admission-state"><span className={`status ${booking.status}`}>{booking.status}</span>{booking.capacityHeld && <small>1 bed held</small>}</div><div className="px-admission-actions">{booking.status === "pending" && <><button className="approve" type="button" onClick={() => decide(booking.id, "confirmed")}><CheckCircle2 size={15} /> Accept</button><button className="decline" type="button" onClick={() => decide(booking.id, "declined")}><XCircle size={15} /> Decline & release</button></>}{booking.status === "confirmed" && <button className="release" type="button" onClick={() => decide(booking.id, "discharged")}><LogOut size={15} /> Discharge & restore bed</button>}</div></article>)}{bookings.length === 0 && <div className="px-empty"><BedDouble size={28} /><h3>No admission requests</h3></div>}</div>
      </section>

      {edit && <div className="px-modal-backdrop" onMouseDown={() => setEdit(null)}><form className="px-booking-sheet" role="dialog" aria-modal="true" aria-labelledby="ward-capacity-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={saveWard}><header><span className="px-sheet-icon"><Building2 size={20} /></span><div><span className="px-kicker">Ward configuration</span><h2 id="ward-capacity-title">{edit.name}</h2><p>Keep operational capacity accurate for admissions and the patient booking experience.</p></div><button type="button" aria-label="Close ward capacity editor" onClick={() => setEdit(null)}><XCircle size={20} /></button></header><div className="px-sheet-body"><label>Ward name<input value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></label><div className="px-form-grid"><label>Available beds<input type="number" min="0" max={edit.capacity || undefined} value={edit.available} onChange={(event) => setEdit({ ...edit, available: event.target.value })} /></label><label>Total capacity<input type="number" min="0" value={edit.capacity} onChange={(event) => setEdit({ ...edit, capacity: event.target.value })} /></label></div><label>Description<textarea rows="4" value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></label></div><footer><button className="px-secondary" type="button" onClick={() => setEdit(null)}>Cancel</button><button className="px-primary">Save capacity</button></footer></form></div>}
    </div>
  );
}
