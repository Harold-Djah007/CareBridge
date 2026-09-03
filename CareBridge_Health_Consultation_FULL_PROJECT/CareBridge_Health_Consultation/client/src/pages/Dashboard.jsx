import React, { useEffect, useState } from "react";
import { CalendarDays, BedDouble, Video, ArrowRight, Mail, FolderOpen, Wallet, Pill } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../state";
import { api } from "../api";
import { firstName, formatDate, formatTime, greeting, isUpcoming, longDate } from "../utils";
import { CarePath, EcgRibbon, Heartbeat } from "../components/LiveMeter";

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;

function PatientHome({ user, appointments, wards, emails, due }) {
  const next = appointments.find(isUpcoming);
  const admission = wards.find((w) => w.status !== "declined");
  const dueTotal = due.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <>
      <div className="identity-strip">
        <div className="avatar large">{user.avatar}</div>
        <div>
          <span className="eyebrow">Patient record</span>
          <h1 style={{ margin: "4px 0 8px" }}>{greeting(firstName(user.name))}</h1>
          <div className="identity-meta">
            <span>MRN <b>{user.mrn || "Pending"}</b></span>
            <span>DOB <b>{user.dob || "—"}</b></span>
            <span>Blood <b>{user.bloodType || "—"}</b></span>
            <span>Cover <b>{user.insurance || "Self-pay"}</b></span>
          </div>
          <div className="row-actions" style={{ marginTop: 12 }}>
            <Link className="secondary-btn" to="/profile">My details</Link>
            <Link className="ghost-btn" to="/billing/tariff">Hospital tariff</Link>
            <Link className="ghost-btn" to="/pay">{due.length ? `${ghs(dueTotal)} due` : "Receipts"}</Link>
          </div>
        </div>
        <CarePath caption={next ? `Next: ${formatDate(next.date)} · ${formatTime(next.time)}` : admission ? `${admission.ward} · ${admission.status}` : "Book a visit when you are ready"} />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div><span className="eyebrow">Your next visit</span>
              <h3>{next ? `${formatDate(next.date)} at ${formatTime(next.time)}` : "No visit booked"}</h3>
            </div>
          </div>
          {next ? (
            <>
              <div className="appointment-feature">
                <div className="avatar large">{next.doctor.avatar}</div>
                <div className="grow">
                  <strong>{next.doctor.name}</strong>
                  <span className="muted">{next.doctor.specialty} · {next.mode === "video" ? "Video consultation" : "Ridge Campus clinic"}</span>
                  <small className="muted">{next.reason}{next.fee ? ` · ${ghs(next.fee)}` : ""}</small>
                </div>
                <div className="row-actions">
                  <Link className="secondary-btn" to={`/messages?with=${next.doctorId}`}>Message</Link>
                  {next.mode === "video" && <Link className="primary-btn" to={`/video?with=${next.doctorId}`}><Video size={17} /> Join</Link>}
                </div>
              </div>
              <h3 style={{ marginTop: 18 }}>Please bring</h3>
              <ul className="prep-list">
                <li>Ghana Card or other photo ID</li>
                <li>NHIS or insurance card</li>
                <li>A list of medicines you take</li>
                {user.allergies && <li>Allergy note: {user.allergies}</li>}
              </ul>
            </>
          ) : (
            <p className="muted">Book a consultant to schedule a visit. The fee is shown before you confirm and billed to your account.</p>
          )}
        </section>
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Hospital</span><h3>Admissions, pharmacy, notices</h3></div></div>
          {admission ? (
            <div className="appointment-feature">
              <BedDouble />
              <div className="grow">
                <strong>{admission.ward}</strong>
                <span className="muted">{admission.roomType} · arrive {admission.date}{admission.fee ? ` · ${ghs(admission.fee)}` : ""}</span>
              </div>
              <span className={`status ${admission.status}`}>{admission.status}</span>
            </div>
          ) : <p className="muted">No bed reserved. Request a ward before you travel; the nightly rate is on the tariff.</p>}
          <div className="quick-actions" style={{ marginTop: 8 }}>
            <Link to="/pharmacy"><Pill /><span><b>Pharmacy & labs</b><small>Priced items, then pay for a receipt</small></span><ArrowRight size={18} /></Link>
            <Link to="/wards"><BedDouble /><span><b>Request a bed</b><small>General, maternity, paediatric</small></span><ArrowRight size={18} /></Link>
            <Link to="/appointments"><CalendarDays /><span><b>Book a visit</b><small>Video or at Ridge Campus</small></span><ArrowRight size={18} /></Link>
            <Link to="/pay"><Wallet /><span><b>Pay bills</b><small>MoMo, GCB, NHIS, or cash</small></span><ArrowRight size={18} /></Link>
            <Link to="/alerts"><Mail /><span><b>Notifications</b><small>{emails.length} notices on file</small></span><ArrowRight size={18} /></Link>
            <Link to="/records"><FolderOpen /><span><b>Clinical file</b><small>Notes, labs, medicines, bills</small></span><ArrowRight size={18} /></Link>
          </div>
        </section>
      </div>
    </>
  );
}

function DoctorBoard({ user, appointments, wards }) {
  const today = appointments
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const nextId = today.find(isUpcoming)?.id;
  const pending = wards.filter((w) => w.status === "pending").length;
  const remaining = today.filter(isUpcoming).length;

  return (
    <>
      <section className="welcome doctor-welcome">
        <EcgRibbon />
        <div>
          <span className="eyebrow">{user.department || "Outpatient"} · {user.clinic || "Consulting room"}</span>
          <h1>{greeting(user.name.replace("Dr. ", "").split(" ")[0])}</h1>
          <p>{longDate()} · {user.shift || "Day clinic"} · {remaining} patient{remaining === 1 ? "" : "s"} remaining</p>
          {pending > 0 && <p style={{ marginTop: 10 }}>{pending} admission request{pending > 1 ? "s" : ""} waiting</p>}
        </div>
        <Heartbeat />
      </section>

      <div className="clinic-board" style={{ marginTop: 16 }}>
        {today.length === 0 && <div className="empty"><h3>No patients on your list</h3></div>}
        {today.map((a) => (
          <div className={`clinic-row ${a.id === nextId ? "next" : ""}`} key={a.id}>
            <div className="time">{formatTime(a.time)}<div className="muted" style={{ fontSize: 11 }}>{formatDate(a.date)}</div></div>
            <div>
              <strong>{a.patient?.name}</strong>
              <div className="muted">{a.reason} · {a.mode === "video" ? "Teleconsult" : "Room visit"}{a.fee ? ` · ${ghs(a.fee)}` : ""}</div>
            </div>
            <div className="row-actions">
              <span className={`status ${a.status}`}>{a.status}</span>
              <Link className="ghost-btn" to={`/records/${a.patientId}`}>Chart</Link>
              <Link className="ghost-btn" to={`/messages?with=${a.patientId}`}>Note</Link>
              {a.mode === "video" && a.status !== "cancelled" && <Link className="primary-btn" to={`/video?with=${a.patientId}`}><Video size={16} /> Call</Link>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [wards, setWards] = useState([]);
  const [emails, setEmails] = useState([]);
  const [due, setDue] = useState([]);

  useEffect(() => {
    api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setWards);
    if (user.role === "patient") {
      api(`/emails/${user.id}`).then(setEmails);
      api(`/billing?userId=${user.id}&role=${user.role}`).then((rows) => setDue(rows.filter((i) => i.status === "due")));
    }
  }, [user]);

  if (user.role === "doctor") return <DoctorBoard user={user} appointments={appointments} wards={wards} />;
  return <PatientHome user={user} appointments={appointments} wards={wards} emails={emails} due={due} />;
}
