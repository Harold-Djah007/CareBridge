import React, { useEffect, useState } from "react";
import { Video, MessageCircle, CalendarPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { todayISO } from "../utils";

export default function CareTeam() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [booking, setBooking] = useState(null);
  const [form, setForm] = useState({ date: todayISO(), time: "10:00", reason: "Consultation", mode: "video" });

  useEffect(() => {
    if (user.role === "patient") api("/doctors").then(setPeople);
    else api(`/contacts?userId=${user.id}&role=${user.role}`).then(setPeople);
  }, [user]);

  const book = async (e) => {
    e.preventDefault();
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, doctorId: booking.id, patientId: user.id }) });
    push("Consultation scheduled. Check Email alerts for the confirmation.");
    setBooking(null);
    navigate("/appointments");
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{user.role === "patient" ? "Care team" : "Patients"}</span>
          <h1>{user.role === "patient" ? "Find a doctor" : "People in your care"}</h1>
          <p>{user.role === "patient" ? "Book a visit or start a conversation. Booking emails the patient immediately." : "Message a patient or open a video room."}</p>
        </div>
      </div>
      <div className="people-grid">
        {people.map((p) => (
          <article className="person-card" key={p.id}>
            <div className="appointment-feature" style={{ border: 0, padding: 0, background: "transparent" }}>
              <div className="avatar large">{p.avatar}</div>
              <div className="grow">
                <h3>{p.name}</h3>
                <span className="muted">{p.specialty || p.city || "Patient"}</span>
              </div>
              {p.available === false && <span className="status pending">Away</span>}
            </div>
            <p className="muted">{p.about || "Available through CareBridge."}</p>
            <div className="actions">
              <Link className="secondary-btn" to={`/messages?with=${p.id}`}><MessageCircle size={16} /> Message</Link>
              {user.role === "patient" ? (
                <button className="primary-btn" onClick={() => setBooking(p)}><CalendarPlus size={16} /> Book</button>
              ) : (
                <Link className="primary-btn" to={`/video?with=${p.id}`}><Video size={16} /> Video</Link>
              )}
            </div>
          </article>
        ))}
      </div>

      {booking && (
        <div className="modal-backdrop" onMouseDown={() => setBooking(null)}>
          <form className="modal-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={book}>
            <h2>Book {booking.name}</h2>
            <p className="muted">{booking.specialty}. You will receive an email when this is scheduled.</p>
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
