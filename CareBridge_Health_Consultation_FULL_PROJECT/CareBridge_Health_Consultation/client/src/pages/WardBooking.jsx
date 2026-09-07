import React, { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, CheckCircle2, DoorOpen, Hotel, Plus, ShieldCheck, Users, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { todayISO, ghs, wardQuote } from "../utils";
import { IMAGERY } from "../imagery";
import { OccupancyBars } from "../components/LiveMeter";
import Avatar from "../components/Avatar";
import PageHero, { EmptyPlate } from "../components/PageHero";

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
      if (list[0]) setForm((current) => ({ ...current, ward: list[0].name }));
    });
    api("/finance/rates").then(setRates);
    load();
    const socket = io(socketUrl, socketOptions());
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  const submit = async (event) => {
    event.preventDefault();
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

  const isPatient = user.role === "patient";
  const pending = bookings.filter((booking) => booking.status === "pending");
  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const capacity = useMemo(() => wards.reduce((sum, ward) => sum + Number(ward.capacity || 0), 0), [wards]);
  const available = useMemo(() => wards.reduce((sum, ward) => sum + Number(ward.available || 0), 0), [wards]);
  const occupancy = capacity ? Math.round(((capacity - available) / capacity) * 100) : 0;

  const openWard = (ward) => {
    setForm((current) => ({ ...current, ward: ward.name }));
    setOpen(true);
  };

  return (
    <div className="admissions-workspace">
      <PageHero
        scene="wards"
        eyebrow={isPatient ? "Patient admissions" : "Hospital bed management"}
        title={isPatient ? "Admissions & ward booking" : "Admissions queue"}
        lead={isPatient ? "See live ward availability, reserve before arrival and track the hospital’s decision." : "Review incoming reservations against live capacity and make bed decisions from one workspace."}
        actions={isPatient ? <button className="primary-btn" onClick={() => setOpen(true)}><Plus size={17} /> Reserve a bed</button> : null}
      />

      <div className="product-metric-grid admissions-metrics">
        <div className="product-metric-card"><span className="metric-icon tone-green"><BedDouble size={18} /></span><div className="metric-copy"><small>Beds available</small><strong>{available}</strong><span>Across {wards.length} wards</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-blue"><Hotel size={18} /></span><div className="metric-copy"><small>Occupancy</small><strong>{occupancy}%</strong><span>{capacity - available} of {capacity || 0} beds in use</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-amber"><CalendarDays size={18} /></span><div className="metric-copy"><small>{isPatient ? "Pending request" : "Pending decisions"}</small><strong>{pending.length}</strong><span>{pending.length ? "Needs action" : "Queue clear"}</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-teal"><CheckCircle2 size={18} /></span><div className="metric-copy"><small>Confirmed</small><strong>{confirmed.length}</strong><span>{isPatient ? "Accepted reservations" : "Accepted bookings"}</span></div></div>
      </div>

      <section className="product-imagery-strip admissions-visual" style={{ backgroundImage: `url(${IMAGERY.wards})` }}>
        <div><span className="eyebrow">Ridge Campus admissions</span><h3>{available} beds currently available</h3><p>{isPatient ? "Reserve before travelling. The hospital confirms availability before your admission is final." : "Capacity and reservation status are linked so operations can make decisions with current information."}</p></div>
      </section>

      {!isPatient && (
        <section className="command-panel bed-capacity-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Live capacity</span><h2>Ward occupancy</h2></div><span className="live-state"><i /> Current</span></div>
          <div className="bed-capacity-layout"><div className="bed-capacity-score"><strong>{occupancy}%</strong><span>campus occupancy</span></div><div className="grow"><OccupancyBars items={wards.map((ward) => ({ label: ward.name, value: Math.max(0, Number(ward.capacity || 0) - Number(ward.available || 0)), max: Number(ward.capacity || 1) }))} /></div></div>
        </section>
      )}

      {isPatient && (
        <section className="product-section ward-choice-section">
          <div className="product-section-head"><div><span className="eyebrow">Choose a ward</span><h2>Available admission options</h2></div><span className="section-hint">Availability updates from the hospital bed board</span></div>
          <div className="ward-product-grid">
            {wards.map((ward) => {
              const percentFree = ward.capacity ? Math.round((Number(ward.available || 0) / Number(ward.capacity || 1)) * 100) : 0;
              return (
                <article className="ward-product-card" key={ward.id}>
                  <div className="ward-product-photo" style={{ backgroundImage: `url(${IMAGERY.wards})` }}><span>{ward.available > 0 ? `${ward.available} beds free` : "Currently full"}</span></div>
                  <div className="ward-product-body">
                    <div className="ward-product-title"><span className="ward-product-icon"><DoorOpen size={18} /></span><div><h3>{ward.name}</h3><p>{ward.description}</p></div></div>
                    <div className="ward-product-capacity"><span><i style={{ width: `${percentFree}%` }} /></span><small>{ward.available} of {ward.capacity} beds available</small></div>
                    <div className="ward-product-foot"><div>{rates?.wards?.[ward.name] != null ? <><strong>{ghs(rates.wards[ward.name])}</strong><small> / night</small></> : <small>Tariff on request</small>}</div><button className="secondary-btn" type="button" disabled={Number(ward.available || 0) <= 0} onClick={() => openWard(ward)}>Choose ward</button></div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="product-section admission-queue-section">
        <div className="product-section-head"><div><span className="eyebrow">{isPatient ? "My reservations" : "Decision queue"}</span><h2>{bookings.length} admission request{bookings.length === 1 ? "" : "s"}</h2></div>{!isPatient && <span className="section-hint">Pending requests appear first</span>}</div>
        <div className="admission-product-list">
          {bookings.length === 0 && <EmptyPlate scene="wards" icon={BedDouble} title={isPatient ? "No ward reservations yet" : "No admission requests"} hint={isPatient ? "Choose a ward above when you need an admission." : "New patient requests will appear here."} />}
          {bookings.slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1)).map((booking) => (
            <article className={`admission-product-row ${booking.status}`} key={booking.id}>
              <div className="admission-person">{isPatient ? <span className="admission-ward-icon"><BedDouble size={19} /></span> : <Avatar person={booking.patient} />}<div><h3>{isPatient ? booking.ward : booking.patient?.name}</h3><p>{isPatient ? booking.roomType : `${booking.ward} · ${booking.roomType}`}</p></div></div>
              <div className="admission-detail"><span><CalendarDays size={14} /> {booking.date}</span><span><Users size={14} /> {booking.nights} night{booking.nights === 1 ? "" : "s"}</span>{booking.fee ? <strong>{ghs(booking.fee)}</strong> : null}</div>
              <div className="admission-note"><small>{booking.notes || "No preparation notes"}</small></div>
              <div className="admission-status"><span className={`status ${booking.status}`}>{booking.status}</span>{booking.invoiceStatus === "due" && <small>Payment due</small>}</div>
              <div className="admission-actions">
                {isPatient && booking.invoiceStatus === "due" && booking.invoiceId && <Link className="secondary-btn" to={`/pay?invoice=${booking.invoiceId}`}>Pay</Link>}
                {!isPatient && booking.status === "pending" && <><button className="secondary-btn success" title="Accept" onClick={() => update(booking.id, "confirmed")}><CheckCircle2 size={16} /> Accept</button><button className="ghost-btn danger" title="Decline" onClick={() => update(booking.id, "declined")}><XCircle size={16} /> Decline</button></>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal-card product-admission-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-icon"><BedDouble /></div>
            <span className="eyebrow">Admission request</span>
            <h2>Reserve a hospital ward</h2>
            <p className="muted">Choose the bed type and arrival date. The hospital confirms capacity before the reservation becomes final.</p>
            <label>Ward<select value={form.ward} onChange={(event) => setForm({ ...form, ward: event.target.value })}>{wards.map((ward) => <option key={ward.id}>{ward.name}</option>)}</select></label>
            <label>Room type<select value={form.roomType} onChange={(event) => setForm({ ...form, roomType: event.target.value })}><option>Shared Room</option><option>Private Room</option><option>Premium Private Room</option></select></label>
            <div className="form-grid"><label>Admission date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label>Nights<input type="number" min="1" max="30" value={form.nights} onChange={(event) => setForm({ ...form, nights: event.target.value })} /></label></div>
            <label>Preparation notes<textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Accessibility, mobility, equipment or other preparation notes" /></label>
            {wardQuote(rates, form.ward, form.roomType, form.nights) != null && <div className="booking-quote"><span>Estimated admission fee</span><strong>{ghs(wardQuote(rates, form.ward, form.roomType, form.nights))}</strong><small>Billed after the hospital accepts the bed request</small></div>}
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button><button className="primary-btn"><ShieldCheck size={16} /> Send reservation</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
