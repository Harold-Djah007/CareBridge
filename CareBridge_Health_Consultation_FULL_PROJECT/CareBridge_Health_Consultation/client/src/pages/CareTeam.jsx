import React, { useEffect, useMemo, useState } from "react";
import { Video, MessageCircle, CalendarPlus, Search, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { todayISO, ghs, consultQuote } from "../utils";
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

  useEffect(() => {
    if (user.role === "patient") api("/doctors").then(setPeople);
    else api(`/contacts?userId=${user.id}&role=${user.role}`).then(setPeople);
    api("/finance/rates").then(setRates);
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("doctor-status", (p) => {
      setPeople((list) => list.map((d) => (d.id === p.id ? { ...d, available: p.available, photo: p.photo || d.photo } : d)));
    });
    return () => socket.disconnect();
  }, [user]);

  const specialties = useMemo(
    () => ["all", ...Array.from(new Set(people.map((p) => p.specialty).filter(Boolean)))],
    [people]
  );

  const onTeam = (id) => (user.careTeamIds || []).includes(id) || user.preferredDoctorId === id;

  const visible = people.filter((p) => {
    const hay = `${p.name} ${p.specialty || ""} ${p.city || ""}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (user.role === "patient" && specialty !== "all" && p.specialty !== specialty) return false;
    if (user.role === "patient" && status === "available" && p.available === false) return false;
    if (user.role === "patient" && status === "busy" && p.available !== false) return false;
    return true;
  });

  const choose = async (doctor, thenMessage) => {
    if (user.role !== "patient") return;
    try {
      const next = await api(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          preferredDoctorId: doctor.id,
          careTeamIds: [...new Set([...(user.careTeamIds || []), doctor.id])],
        }),
      });
      updateUser({ ...user, ...next });
      push(`${doctor.name} is now on your care team.`);
      if (thenMessage || fromMessages) navigate(`/messages?with=${doctor.id}`);
    } catch (err) {
      push(err.message, "error");
    }
  };

  const book = async (e) => {
    e.preventDefault();
    if (booking.available === false) {
      push(`${booking.name} is marked busy and is not taking new visits right now.`, "error");
      return;
    }
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, doctorId: booking.id, patientId: user.id }) });
    push("Consultation scheduled and billed. Pay from Pay bills for a receipt.");
    setBooking(null);
    navigate("/appointments");
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{user.role === "patient" ? "Hospital directory" : "Caseload"}</span>
          <h1>{user.role === "patient" ? (fromMessages ? "Add a doctor to your chats" : "Doctors at Ridge Campus") : "Patients under your care"}</h1>
          <p>{user.role === "patient"
            ? "Photos, specialty, and live available/busy status. Add the consultant you need — nobody is assigned for you."
            : "Open the chart, message, or start a teleconsult."}</p>
        </div>
        {user.role === "patient" && fromMessages && <Link className="ghost-btn" to="/messages">Back to messages</Link>}
      </div>
      {user.role === "patient" && (
        <>
          <div className="filters">
            {specialties.map((s) => (
              <button key={s} className={specialty === s ? "active" : ""} onClick={() => setSpecialty(s)}>
                {s === "all" ? "All specialties" : s}
              </button>
            ))}
          </div>
          <div className="filters">
            {[
              ["all", "Everyone"],
              ["available", "Available now"],
              ["busy", "Busy"],
            ].map(([id, label]) => (
              <button key={id} className={status === id ? "active" : ""} onClick={() => setStatus(id)}>{label}</button>
            ))}
          </div>
          <div className="search-box" style={{ maxWidth: 360, marginBottom: 16 }}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or specialty" />
          </div>
        </>
      )}
      <div className="people-grid">
        {visible.map((p) => (
          <article className={`person-card ${onTeam(p.id) ? "chosen" : ""} ${p.available === false ? "busy" : ""}`} key={p.id}>
            <div className="appointment-feature" style={{ border: 0, padding: 0, background: "transparent" }}>
              <Avatar person={p} className="large" />
              <div className="grow">
                <h3>{p.name}</h3>
                <span className="muted">{p.specialty || p.city || "Patient"}{user.role === "patient" && p.specialty && rates ? ` · from ${ghs(consultQuote(rates, p.specialty, "video"))}` : ""}</span>
                {user.role === "patient" && <Presence person={p} />}
              </div>
              {onTeam(p.id) && <span className="status confirmed">On your team</span>}
            </div>
            <p className="muted">{p.about || "Available through CareBridge."}</p>
            {p.available === false && user.role === "patient" && (
              <p className="muted">Busy — not taking new visits. You can still add them and leave a message.</p>
            )}
            <div className="actions">
              {user.role === "patient" ? (
                <>
                  <button className="primary-btn" type="button" onClick={() => choose(p, true)}>
                    <UserPlus size={16} /> {onTeam(p.id) ? "Open chat" : "Add & message"}
                  </button>
                  <button className="secondary-btn" type="button" disabled={p.available === false} onClick={() => setBooking(p)}>
                    <CalendarPlus size={16} /> {p.available === false ? "Busy" : "Book"}
                  </button>
                </>
              ) : (
                <>
                  <Link className="secondary-btn" to={`/messages?with=${p.id}`}><MessageCircle size={16} /> Message</Link>
                  <Link className="secondary-btn" to={`/records/${p.id}`}>Chart</Link>
                  <Link className="primary-btn" to={`/video?with=${p.id}`}><Video size={16} /> Video</Link>
                </>
              )}
            </div>
          </article>
        ))}
        {visible.length === 0 && <div className="empty"><h3>No consultants match that search</h3></div>}
      </div>

      {booking && (
        <div className="modal-backdrop" onMouseDown={() => setBooking(null)}>
          <form className="modal-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={book}>
            <h2>Book {booking.name}</h2>
            <p className="muted">{booking.specialty}. Fee {ghs(consultQuote(rates, booking.specialty, form.mode) || 0)} — billed when you confirm.</p>
            <div className="form-grid">
              <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
              <label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></label>
            </div>
            <label>Type
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="video">Video</option>
                <option value="in-person">In person</option>
              </select>
            </label>
            <label>Reason<textarea rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setBooking(null)}>Cancel</button>
              <button className="primary-btn">Schedule visit</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
