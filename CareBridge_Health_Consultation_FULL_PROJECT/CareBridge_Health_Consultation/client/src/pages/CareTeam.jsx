import React, { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarPlus, MessageCircle, Search, Stethoscope, UserPlus, Users, Video } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { todayISO, ghs, consultQuote } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import PageHero, { EmptyPlate } from "../components/PageHero";

export default function CareTeam() {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromMessages = params.get("from") === "messages";
  const [people, setPeople] = useState([]);
  const [booking, setBooking] = useState(null);
  const [specialty, setSpecialty] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState(params.get("q") || "");
  const [form, setForm] = useState({ date: todayISO(), time: "10:00", reason: "Consultation", mode: "video" });
  const [rates, setRates] = useState(null);

  useEffect(() => {
    if (user.role === "patient") api("/doctors").then(setPeople);
    else api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => setPeople(list.filter((person) => person.role === "patient")));
    api("/finance/rates").then(setRates);
    const socket = io(socketUrl, socketOptions());
    socket.on("doctor-status", (payload) => setPeople((list) => list.map((person) => person.id === payload.id ? { ...person, available: payload.available, photo: payload.photo || person.photo } : person)));
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  const specialties = useMemo(() => ["all", ...Array.from(new Set(people.map((person) => person.specialty).filter(Boolean)))], [people]);
  const onTeam = (id) => (user.careTeamIds || []).includes(id) || user.preferredDoctorId === id;
  const availableCount = people.filter((person) => person.available !== false).length;
  const visible = people.filter((person) => {
    const haystack = `${person.name} ${person.specialty || ""} ${person.city || ""}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (user.role === "patient" && specialty !== "all" && person.specialty !== specialty) return false;
    if (user.role === "patient" && status === "available" && person.available === false) return false;
    if (user.role === "patient" && status === "busy" && person.available !== false) return false;
    return true;
  });

  const choose = async (doctor, thenMessage) => {
    if (user.role !== "patient") return;
    try {
      const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ preferredDoctorId: doctor.id, careTeamIds: [...new Set([...(user.careTeamIds || []), doctor.id])] }) });
      updateUser({ ...user, ...next });
      push(`${doctor.name} is now on your care team.`);
      if (thenMessage || fromMessages) navigate(`/messages?with=${doctor.id}`);
    } catch (err) { push(err.message, "error"); }
  };

  const book = async (event) => {
    event.preventDefault();
    if (booking.available === false) return push(`${booking.name} is marked busy and is not taking new visits right now.`, "error");
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, doctorId: booking.id, patientId: user.id }) });
    push("Consultation scheduled and billed. Pay from Shop & pay for a receipt.");
    setBooking(null);
    navigate("/appointments");
  };

  const isPatient = user.role === "patient";

  return (
    <div className="care-team-workspace">
      <PageHero
        scene="care"
        eyebrow={isPatient ? "Care network" : "Clinical caseload"}
        title={isPatient ? (fromMessages ? "Add a clinician" : "Find your care team") : "Patient caseload"}
        lead={isPatient ? "Find clinicians by specialty and live availability, then add them to your care team, message or book directly." : "Search your patients and move directly into charts, messages or teleconsultation."}
        actions={isPatient && fromMessages ? <Link className="secondary-btn" to="/messages">Back to messages</Link> : null}
      />

      <section className="product-imagery-strip care-team-visual" style={{ backgroundImage: `url(${IMAGERY.clinic})` }}>
        <div><span className="eyebrow">Connected care</span><h3>{isPatient ? `${availableCount} clinicians available now` : `${people.length} patients in your care network`}</h3><p>{isPatient ? "Choose who you want to work with. Availability, messaging, appointments and video are connected." : "Keep patient context close to clinical action with direct links into the chart and consultation tools."}</p></div>
      </section>

      <div className="care-team-toolbar">
        <label className="care-team-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isPatient ? "Search clinician or specialty" : "Search patient"} /></label>
        {isPatient && <div className="filters care-team-status-filter">{[["all","All"],["available","Available"],["busy","Busy"]].map(([id,label]) => <button key={id} className={status === id ? "active" : ""} onClick={() => setStatus(id)}>{label}</button>)}</div>}
      </div>

      {isPatient && <div className="care-specialty-chips">{specialties.map((item) => <button key={item} className={specialty === item ? "active" : ""} onClick={() => setSpecialty(item)}>{item === "all" ? "All specialties" : item}</button>)}</div>}

      <section className="product-section care-directory-section">
        <div className="product-section-head"><div><span className="eyebrow">{isPatient ? "Hospital clinicians" : "Patients"}</span><h2>{visible.length} match{visible.length === 1 ? "" : "es"}</h2></div>{isPatient && <span className="section-hint">Green status = currently available</span>}</div>
        <div className="care-person-grid">
          {visible.map((person) => (
            <article className={`care-person-card ${onTeam(person.id) ? "chosen" : ""} ${person.available === false ? "busy" : ""}`} key={person.id}>
              <div className="care-person-top"><Avatar person={person} className="large" /><div className="grow"><h3>{person.name}</h3><p>{person.specialty || person.city || "Patient"}{isPatient && person.specialty && rates ? ` · from ${ghs(consultQuote(rates, person.specialty, "video"))}` : ""}</p>{isPatient && <Presence person={person} />}</div>{onTeam(person.id) && <span className="team-badge"><BadgeCheck size={14} /> On your team</span>}</div>
              <div className="care-person-about">{person.about || (isPatient ? "Available through CareBridge for connected hospital care." : "Open the patient chart for clinical history and active plans.")}</div>
              <div className="care-person-actions">
                {isPatient ? <><button className="primary-btn" type="button" onClick={() => choose(person, true)}><UserPlus size={15} /> {onTeam(person.id) ? "Message" : "Add & message"}</button><button className="secondary-btn" type="button" disabled={person.available === false} onClick={() => setBooking(person)}><CalendarPlus size={15} /> {person.available === false ? "Busy" : "Book"}</button></> : <><Link className="secondary-btn" to={`/records/${person.id}`}><Stethoscope size={15} /> Chart</Link><Link className="secondary-btn" to={`/messages?with=${person.id}`}><MessageCircle size={15} /> Message</Link><Link className="primary-btn" to={`/video?with=${person.id}`}><Video size={15} /> Video</Link></>}
              </div>
            </article>
          ))}
          {visible.length === 0 && <EmptyPlate scene="care" icon={Users} title={isPatient ? "No clinicians match your search" : "No patients match your search"} />}
        </div>
      </section>

      {booking && (
        <div className="modal-backdrop" onMouseDown={() => setBooking(null)}>
          <form className="modal-card" onMouseDown={(event) => event.stopPropagation()} onSubmit={book}>
            <div className="modal-icon"><Stethoscope /></div><span className="eyebrow">New consultation</span><h2>Book {booking.name}</h2>
            <p className="muted">{booking.specialty}. Estimated fee {ghs(consultQuote(rates, booking.specialty, form.mode) || 0)} — billed when you confirm.</p>
            <div className="form-grid"><label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label>Time<input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required /></label></div>
            <label>Type<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="video">Video</option><option value="in-person">In person</option></select></label>
            <label>Reason<textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setBooking(null)}>Cancel</button><button className="primary-btn">Schedule visit</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
