import React, { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarPlus, MessageCircle, Search, Sparkles, Stethoscope, UserPlus, Users, Video, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { consultQuote, ghs, todayISO } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";

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
  const isPatient = user.role === "patient";

  useEffect(() => {
    if (isPatient) api("/doctors").then(setPeople);
    else api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => setPeople(list.filter((person) => person.role === "patient")));
    api("/finance/rates").then(setRates).catch(() => {});
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
    if (isPatient && specialty !== "all" && person.specialty !== specialty) return false;
    if (isPatient && status === "available" && person.available === false) return false;
    if (isPatient && status === "busy" && person.available !== false) return false;
    return true;
  });

  const choose = async (doctor, thenMessage) => {
    if (!isPatient) return;
    try {
      const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ preferredDoctorId: doctor.id, careTeamIds: [...new Set([...(user.careTeamIds || []), doctor.id])] }) });
      updateUser({ ...user, ...next });
      push(`${doctor.name} is now on your care team.`);
      if (thenMessage || fromMessages) navigate(`/messages?with=${doctor.id}`);
    } catch (err) { push(err.message, "error"); }
  };

  const book = async (event) => {
    event.preventDefault();
    if (booking.available === false) return push(`${booking.name} is currently busy.`, "error");
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, doctorId: booking.id, patientId: user.id }) });
    push("Consultation scheduled and added to your account.");
    setBooking(null);
    navigate("/appointments");
  };

  return (
    <div className="px-page px-care-network">
      <section className="px-care-hero">
        <div className="px-care-copy"><span className="px-kicker"><Sparkles size={14} /> {isPatient ? "Connected care" : "Clinical caseload"}</span><h1>{isPatient ? "Build a care team that feels personal." : "Your patients, one clinical network."}</h1><p>{isPatient ? "Discover clinicians by specialty and availability, then message, book or start video care without losing context." : "Move from patient identity to chart, message or consultation without switching mental models."}</p>{fromMessages && <Link className="px-secondary" to="/messages">Back to messages</Link>}</div>
        <div className="px-care-photo" style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(3,18,24,.45)),url(${IMAGERY.clinic})` }}><div><span>{isPatient ? "Available now" : "Caseload"}</span><strong>{isPatient ? availableCount : people.length}</strong><small>{isPatient ? "clinicians" : "patients"}</small></div></div>
      </section>

      <section className="px-care-filterbar">
        <label><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isPatient ? "Search doctor or specialty" : "Search patient"} /></label>
        {isPatient && <><div className="px-segmented">{[["all","All"],["available","Available"],["busy","Busy"]].map(([id,label]) => <button key={id} type="button" className={status === id ? "active" : ""} onClick={() => setStatus(id)}>{label}</button>)}</div><select value={specialty} onChange={(e) => setSpecialty(e.target.value)}><option value="all">All specialties</option>{specialties.filter((item) => item !== "all").map((item) => <option key={item}>{item}</option>)}</select></>}
      </section>

      <section className="px-network-grid">
        {visible.map((person) => <article className={`px-network-card ${onTeam(person.id) ? "selected" : ""} ${person.available === false ? "busy" : ""}`} key={person.id}>
          <header><div className="px-network-avatar"><Avatar person={person} className="large" />{isPatient && <i className={person.available === false ? "busy" : "online"} />}</div><div className="grow"><h2>{person.name}</h2><p>{person.specialty || person.city || "Patient"}</p>{isPatient && <Presence person={person} />}</div>{onTeam(person.id) && <span className="px-team-chip"><BadgeCheck size={13} /> Your team</span>}</header>
          <div className="px-network-about">{person.about || (isPatient ? "Available through CareBridge for connected hospital care." : "Open the patient record for active plans, observations and care history.")}</div>
          <div className="px-network-statline">{isPatient ? <><span><strong>{person.available === false ? "Busy" : "Available"}</strong><small>Live status</small></span><span><strong>{rates ? ghs(consultQuote(rates, person.specialty, "video") || 0) : "—"}</strong><small>Video from</small></span></> : <><span><strong>{person.mrn || "Patient"}</strong><small>Record</small></span><span><strong>{person.city || "Ridge"}</strong><small>Location</small></span></>}</div>
          <footer>{isPatient ? <><button className="px-primary" type="button" onClick={() => choose(person, true)}><UserPlus size={15} /> {onTeam(person.id) ? "Message" : "Add & message"}</button><button className="px-secondary" type="button" disabled={person.available === false} onClick={() => setBooking(person)}><CalendarPlus size={15} /> Book</button></> : <><Link to={`/records/${person.id}`}><Stethoscope size={15} /> Chart</Link><Link to={`/messages?with=${person.id}`}><MessageCircle size={15} /> Message</Link><Link className="strong" to={`/video?with=${person.id}`}><Video size={15} /> Video</Link></>}</footer>
        </article>)}
        {visible.length === 0 && <div className="px-empty px-network-empty"><Users size={30} /><h3>{isPatient ? "No clinicians match" : "No patients match"}</h3><p>Try a broader search or filter.</p></div>}
      </section>

      {booking && <div className="px-modal-backdrop" onMouseDown={() => setBooking(null)}><form className="px-booking-sheet px-care-sheet" onMouseDown={(e) => e.stopPropagation()} onSubmit={book}>
        <header><span className="px-sheet-icon"><Stethoscope size={20} /></span><div><span className="px-kicker">New consultation</span><h2>Book {booking.name}</h2><p>{booking.specialty || "Consultant"} · estimated {ghs(consultQuote(rates, booking.specialty, form.mode) || 0)}</p></div><button type="button" onClick={() => setBooking(null)}><XCircle size={20} /></button></header>
        <div className="px-sheet-body"><div className="px-form-grid"><label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></label></div><label>Consultation type<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option value="video">Video consultation</option><option value="in-person">In-person consultation</option></select></label><label>Reason<textarea rows="4" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label></div>
        <footer><button className="px-secondary" type="button" onClick={() => setBooking(null)}>Cancel</button><button className="px-primary">Schedule visit</button></footer>
      </form></div>}
    </div>
  );
}
