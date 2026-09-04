import React, { useEffect, useMemo, useState } from "react";
import { Video, MessageCircle, CalendarPlus, Search } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { todayISO, ghs, consultQuote } from "../utils";
import Avatar from "../components/Avatar";

export default function CareTeam() {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [people, setPeople] = useState([]);
  const [booking, setBooking] = useState(null);
  const [specialty, setSpecialty] = useState("all");
  const [query, setQuery] = useState(params.get("q") || "");
  const [form, setForm] = useState({ date: todayISO(), time: "10:00", reason: "Consultation", mode: "video" });
  const [rates, setRates] = useState(null);

  useEffect(() => {
    if (user.role === "patient") api("/doctors").then(setPeople);
    else api(`/contacts?userId=${user.id}&role=${user.role}`).then(setPeople);
    api("/finance/rates").then(setRates);
  }, [user]);

  const specialties = useMemo(
    () => ["all", ...Array.from(new Set(people.map((p) => p.specialty).filter(Boolean)))],
    [people]
  );

  const visible = people.filter((p) => {
    const hay = `${p.name} ${p.specialty || ""} ${p.city || ""}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (user.role === "patient" && specialty !== "all" && p.specialty !== specialty) return false;
    return true;
  });

  const choose = async (doctor) => {
    if (user.role !== "patient") return;
    try {
      const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ preferredDoctorId: doctor.id }) });
      updateUser({ ...user, ...next });
      push(`${doctor.name} is now your chosen consultant. Book a time when you are ready.`);
    } catch (err) {
      push(err.message, "error");
    }
  };

  const book = async (e) => {
    e.preventDefault();
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
          <h1>{user.role === "patient" ? "Choose your doctor" : "Patients under your care"}</h1>
          <p>{user.role === "patient" ? "Browse Ridge Campus consultants, add the one you need, then book a time. Nobody is assigned for you." : "Open the chart, message, or start a teleconsult."}</p>
        </div>
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
          <div className="search-box" style={{ maxWidth: 360, marginBottom: 16 }}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or specialty" />
          </div>
        </>
      )}
      <div className="people-grid">
        {visible.map((p) => (
          <article className={`person-card ${user.preferredDoctorId === p.id ? "chosen" : ""}`} key={p.id}>
            <div className="appointment-feature" style={{ border: 0, padding: 0, background: "transparent" }}>
              <Avatar person={p} className="large" />
              <div className="grow">
                <h3>{p.name}</h3>
                <span className="muted">{p.specialty || p.city || "Patient"}{user.role === "patient" && p.specialty && rates ? ` · from ${ghs(consultQuote(rates, p.specialty, "video"))}` : ""}</span>
              </div>
              {user.preferredDoctorId === p.id && <span className="status confirmed">Your doctor</span>}
              {p.available === false && <span className="status pending">Away</span>}
            </div>
            <p className="muted">{p.about || "Available through CareBridge."}</p>
            <div className="actions">
              <Link className="secondary-btn" to={`/messages?with=${p.id}`}><MessageCircle size={16} /> Message</Link>
              {user.role === "patient" ? (
                <>
                  <button className="secondary-btn" type="button" onClick={() => choose(p)}>
                    {user.preferredDoctorId === p.id ? "Added to your file" : "Add this doctor"}
                  </button>
                  <button className="primary-btn" type="button" onClick={() => setBooking(p)}><CalendarPlus size={16} /> Book</button>
                </>
              ) : (
                <>
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
