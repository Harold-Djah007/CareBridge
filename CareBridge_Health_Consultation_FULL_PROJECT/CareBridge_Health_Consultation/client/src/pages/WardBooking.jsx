import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BedDouble, Building2, CalendarDays, CheckCircle2, DoorOpen, Hotel,
  Plus, ShieldCheck, Sparkles, Users, XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs, todayISO, wardQuote } from "../utils";
import { IMAGERY } from "../imagery";
import { OccupancyBars } from "../components/LiveMeter";
import Avatar from "../components/Avatar";

export default function WardBooking() {
  const { user } = useAuth();
  const { push } = useToast();
  const [wards, setWards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState(null);
  const [form, setForm] = useState({ ward: "General Ward", roomType: "Private Room", date: todayISO(), nights: 1, notes: "" });

  const isPatient = user.role === "patient";
  const load = () => api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setBookings);

  useEffect(() => {
    api("/wards").then((list) => {
      setWards(list);
      if (list[0]) setForm((current) => ({ ...current, ward: list[0].name }));
    });
    api("/finance/rates").then(setRates).catch(() => {});
    load();
    const socket = io(socketUrl, socketOptions());
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  const pending = bookings.filter((booking) => booking.status === "pending");
  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const capacity = useMemo(() => wards.reduce((sum, ward) => sum + Number(ward.capacity || 0), 0), [wards]);
  const available = useMemo(() => wards.reduce((sum, ward) => sum + Number(ward.available || 0), 0), [wards]);
  const occupancy = capacity ? Math.round(((capacity - available) / capacity) * 100) : 0;
  const occupancyTone = occupancy >= 90 ? "critical" : occupancy >= 75 ? "watch" : "stable";

  const submit = async (event) => {
    event.preventDefault();
    await api("/ward-bookings", { method: "POST", body: JSON.stringify({ ...form, patientId: user.id }) });
    setOpen(false);
    push("Admission request sent to hospital operations.");
    load();
  };

  const update = async (id, status) => {
    await api(`/ward-bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    push(status === "confirmed" ? "Admission accepted and patient notified." : "Admission request updated.");
    load();
    api("/wards").then(setWards);
  };

  const openWard = (ward) => {
    setForm((current) => ({ ...current, ward: ward.name }));
    setOpen(true);
  };

  return (
    <div className="px-page px-admissions">
      <section className="px-admission-hero" style={{ backgroundImage: `linear-gradient(110deg, rgba(7,24,31,.94) 0%, rgba(7,24,31,.78) 48%, rgba(7,24,31,.18) 100%), url(${IMAGERY.wards})` }}>
        <div className="px-admission-copy">
          <span className="px-kicker"><Sparkles size={14} /> {isPatient ? "Admission planning" : "Hospital capacity"}</span>
          <h1>{isPatient ? "Arrive knowing your bed plan." : "Make bed decisions with live context."}</h1>
          <p>{isPatient ? "Explore current availability, reserve before travelling and follow the hospital decision in real time." : "Capacity, pending requests and ward pressure are combined into one operational admissions board."}</p>
          {isPatient && <button className="px-primary light" type="button" onClick={() => setOpen(true)}><Plus size={17} /> Reserve a bed</button>}
        </div>
        <div className={`px-capacity-orb ${occupancyTone}`}>
          <span>Campus occupancy</span>
          <strong>{occupancy}%</strong>
          <small>{available} beds available</small>
        </div>
      </section>

      <section className="px-signal-grid px-admission-signals">
        <article><span><BedDouble size={17} /></span><div><small>Available</small><strong>{available}</strong></div></article>
        <article><span><Hotel size={17} /></span><div><small>Occupied</small><strong>{Math.max(0, capacity - available)}</strong></div></article>
        <article><span><CalendarDays size={17} /></span><div><small>{isPatient ? "Pending" : "Decision queue"}</small><strong>{pending.length}</strong></div></article>
        <article><span><CheckCircle2 size={17} /></span><div><small>Confirmed</small><strong>{confirmed.length}</strong></div></article>
      </section>

      {!isPatient && <section className="px-capacity-board">
        <header><div><span className="px-kicker">Live ward capacity</span><h2>Occupancy by ward</h2></div><span className={`px-capacity-state ${occupancyTone}`}><i /> {occupancyTone === "critical" ? "Critical pressure" : occupancyTone === "watch" ? "Watch capacity" : "Stable"}</span></header>
        <div className="px-capacity-layout"><div className="px-capacity-score"><strong>{occupancy}%</strong><span>campus occupied</span></div><div className="grow"><OccupancyBars items={wards.map((ward) => ({ label: ward.name, value: Math.max(0, Number(ward.capacity || 0) - Number(ward.available || 0)), max: Number(ward.capacity || 1) }))} /></div></div>
      </section>}

      {isPatient && <section className="px-ward-market">
        <header className="px-board-head"><div><span className="px-kicker">Choose your setting</span><h2>Ward options</h2></div><span className="px-board-note">Availability comes from the live bed board</span></header>
        <div className="px-ward-grid">
          {wards.map((ward) => {
            const free = Number(ward.available || 0);
            const percentFree = ward.capacity ? Math.round((free / Number(ward.capacity || 1)) * 100) : 0;
            return <article className={`px-ward-card ${free <= 0 ? "full" : ""}`} key={ward.id}>
              <div className="px-ward-photo" style={{ backgroundImage: `url(${IMAGERY.wards})` }}><span>{free > 0 ? `${free} available` : "Full"}</span></div>
              <div className="px-ward-body"><div className="px-ward-title"><span><DoorOpen size={18} /></span><div><h3>{ward.name}</h3><p>{ward.description || "Hospital ward"}</p></div></div><div className="px-ward-meter"><span><i style={{ width: `${percentFree}%` }} /></span><small>{free} of {ward.capacity} beds free</small></div><div className="px-ward-foot"><div>{rates?.wards?.[ward.name] != null ? <><strong>{ghs(rates.wards[ward.name])}</strong><small> / night</small></> : <small>Tariff on request</small>}</div><button type="button" disabled={free <= 0} onClick={() => openWard(ward)}>Select <ArrowRight size={15} /></button></div></div>
            </article>;
          })}
        </div>
      </section>}

      <section className="px-admission-ledger">
        <header className="px-board-head"><div><span className="px-kicker">{isPatient ? "My admission journey" : "Decision queue"}</span><h2>{isPatient ? "Reservations" : "Requests requiring action"}</h2></div><span className="px-board-note">{bookings.length} total</span></header>
        <div className="px-admission-list">
          {bookings.length === 0 && <div className="px-empty"><BedDouble size={28} /><h3>{isPatient ? "No reservations yet" : "Queue is clear"}</h3><p>{isPatient ? "Choose a ward above when you need an admission." : "New admission requests will appear here."}</p></div>}
          {bookings.slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1)).map((booking) => <article className={`px-admission-row ${booking.status}`} key={booking.id}>
            <div className="px-admission-who">{isPatient ? <span className="px-admission-icon"><Building2 size={18} /></span> : <Avatar person={booking.patient} />}<div><h3>{isPatient ? booking.ward : booking.patient?.name}</h3><p>{isPatient ? booking.roomType : `${booking.ward} · ${booking.roomType}`}</p></div></div>
            <div className="px-admission-meta"><span><CalendarDays size={14} /> {booking.date}</span><span><Users size={14} /> {booking.nights} night{booking.nights === 1 ? "" : "s"}</span>{booking.fee ? <strong>{ghs(booking.fee)}</strong> : null}</div>
            <div className="px-admission-notes">{booking.notes || "No preparation notes"}</div>
            <div className="px-admission-state"><span className={`status ${booking.status}`}>{booking.status}</span>{booking.invoiceStatus === "due" && <small>Payment due</small>}</div>
            <div className="px-admission-actions">
              {isPatient && booking.invoiceStatus === "due" && booking.invoiceId && <Link to={`/pay?invoice=${booking.invoiceId}`}>Pay now</Link>}
              {!isPatient && booking.status === "pending" && <><button className="approve" type="button" onClick={() => update(booking.id, "confirmed")}><CheckCircle2 size={15} /> Accept</button><button className="decline" type="button" onClick={() => update(booking.id, "declined")}><XCircle size={15} /> Decline</button></>}
            </div>
          </article>)}
        </div>
      </section>

      {open && <div className="px-modal-backdrop" onMouseDown={() => setOpen(false)}><form className="px-booking-sheet px-admission-sheet" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header><span className="px-sheet-icon"><BedDouble size={20} /></span><div><span className="px-kicker">Admission request</span><h2>Reserve hospital care</h2><p>Choose your setting and arrival plan. Operations confirms the bed before the reservation becomes final.</p></div><button type="button" onClick={() => setOpen(false)}><XCircle size={20} /></button></header>
        <div className="px-sheet-body"><label>Ward<select value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })}>{wards.map((ward) => <option key={ward.id}>{ward.name}</option>)}</select></label><label>Room type<select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}><option>Shared Room</option><option>Private Room</option><option>Premium Private Room</option></select></label><div className="px-form-grid"><label>Admission date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label>Nights<input type="number" min="1" max="30" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} /></label></div><label>Preparation notes<textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Accessibility, mobility, equipment or other preparation notes" /></label>{wardQuote(rates, form.ward, form.roomType, form.nights) != null && <div className="px-quote"><span><ShieldCheck size={16} /> Estimated admission</span><strong>{ghs(wardQuote(rates, form.ward, form.roomType, form.nights))}</strong></div>}</div>
        <footer><button className="px-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="px-primary"><span>Send request</span><ArrowRight size={16} /></button></footer>
      </form></div>}
    </div>
  );
}
