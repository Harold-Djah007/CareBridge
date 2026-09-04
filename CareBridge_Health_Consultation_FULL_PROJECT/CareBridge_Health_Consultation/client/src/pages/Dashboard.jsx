import React, { useEffect, useState } from "react";
import { CalendarDays, BedDouble, Video, ArrowRight, Mail, FolderOpen, Wallet, Pill, Stethoscope, Check, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketUrl } from "../api";
import { firstName, formatDate, formatTime, greeting, isUpcoming, longDate, prettyDate, ghs } from "../utils";
import { CarePath, EcgRibbon, Heartbeat } from "../components/LiveMeter";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import DutyToggle from "../components/DutyToggle";

function PatientHome({ user, appointments, wards, emails, due, doctors }) {
  const next = appointments.find(isUpcoming);
  const admission = wards.find((w) => w.status !== "declined");
  const dueTotal = due.reduce((s, i) => s + Number(i.amount || 0), 0);
  const chosen = doctors.find((d) => d.id === user.preferredDoctorId);

  return (
    <>
      <div className="identity-strip">
        <Avatar person={user} className="large" />
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
        <CarePath caption={next ? `Next: ${formatDate(next.date)} · ${formatTime(next.time)}` : admission ? `${admission.ward} · ${admission.status}` : "Choose a doctor, then book a visit"} />
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
                <Avatar person={next.doctor} className="large" />
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
          ) : chosen ? (
            <>
              <div className="appointment-feature">
                <Avatar person={chosen} className="large" />
                <div className="grow">
                  <strong>{chosen.name}</strong>
                  <span className="muted">{chosen.specialty} · your chosen consultant</span>
                  <Presence person={chosen} />
                  <small className="muted">{chosen.available === false ? "Busy right now — you can still message them." : "Available — book a time when you are ready."}</small>
                </div>
                <div className="row-actions">
                  <Link className="secondary-btn" to="/care">Change</Link>
                  <Link className="primary-btn" to="/appointments">Book a visit</Link>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="muted">Browse Ridge Campus consultants and add the doctor you need. No doctor is selected for you.</p>
              <div className="row-actions" style={{ marginTop: 12 }}>
                <Link className="primary-btn" to="/care">View doctors</Link>
                <Link className="secondary-btn" to="/appointments">Request a visit</Link>
              </div>
            </>
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
            <Link to="/care"><Stethoscope /><span><b>Find a doctor</b><small>Photos, specialty, available or busy</small></span><ArrowRight size={18} /></Link>
            <Link to="/prescriptions"><Pill /><span><b>Prescriptions</b><small>Print, buy on site, or collect at Ridge</small></span><ArrowRight size={18} /></Link>
            <Link to="/pharmacy"><Pill /><span><b>Pharmacy & labs</b><small>Live stock by category — in or out</small></span><ArrowRight size={18} /></Link>
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
  const { updateUser } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const today = appointments
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const nextId = today.find(isUpcoming)?.id;
  const pending = wards.filter((w) => w.status === "pending").length;
  const remaining = today.filter(isUpcoming).length;
  const available = user.available !== false;

  const toggleAvail = async (nextAvail) => {
    const availableNext = typeof nextAvail === "boolean" ? nextAvail : !available;
    if (availableNext === available) return;
    setBusy(true);
    try {
      const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ available: availableNext }) });
      updateUser({ ...user, ...next });
      push(availableNext ? "Patients now see you as available." : "Patients now see you as busy.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

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
        <DutyToggle available={available} disabled={busy} onChange={(on) => toggleAvail(on)} />
        <Heartbeat />
      </section>

      <div className="clinic-board" style={{ marginTop: 16 }}>
        {today.length === 0 && <div className="empty"><h3>No patients on your list</h3></div>}
        {today.map((a) => (
          <div className={`clinic-row ${a.id === nextId ? "next" : ""}`} key={a.id}>
            <div className="time">{formatTime(a.time)}<div className="muted" style={{ fontSize: 11 }}>{formatDate(a.date)}</div></div>
            <Avatar person={a.patient} />
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

function NurseBoard({ user }) {
  const { push } = useToast();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("queued");

  const load = () => api(`/pharmacy/orders?userId=${user.id}&role=nurse`).then(setOrders).catch(() => {});

  useEffect(() => {
    load();
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    socket.on("pharmacy-order", (order) => {
      setOrders((rows) => {
        const rest = rows.filter((r) => r.id !== order.id);
        return [order, ...rest];
      });
    });
    return () => socket.disconnect();
  }, [user.id]);

  const mark = async (order, status) => {
    try {
      const next = await api(`/pharmacy/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actorId: user.id, status }),
      });
      setOrders((rows) => rows.map((r) => (r.id === next.id ? next : r)));
      push(status === "ready" ? "Patient notified — pack is ready." : "Marked collected.");
    } catch (err) {
      push(err.message, "error");
    }
  };

  const hospital = orders.filter((o) => o.fulfill === "hospital");
  const visible = hospital.filter((o) => (filter === "all" ? true : o.status === filter));
  const queued = hospital.filter((o) => o.status === "queued").length;
  const ready = hospital.filter((o) => o.status === "ready").length;

  return (
    <>
      <section className="welcome doctor-welcome nurse-welcome">
        <div>
          <span className="eyebrow">{user.department || "Ridge Campus pharmacy"} · {user.shift || "Day dispensary"}</span>
          <h1>{greeting(firstName(user.name.replace("Nurse ", "")))}</h1>
          <p>{longDate()} · {queued} waiting for prep · {ready} ready for collection</p>
        </div>
      </section>
      <div className="filters" style={{ marginTop: 16 }}>
        <button className={filter === "queued" ? "active" : ""} onClick={() => setFilter("queued")}>Queued ({queued})</button>
        <button className={filter === "ready" ? "active" : ""} onClick={() => setFilter("ready")}>Ready ({ready})</button>
        <button className={filter === "collected" ? "active" : ""} onClick={() => setFilter("collected")}>Collected</button>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
      </div>
      <div className="clinic-board">
        {visible.length === 0 && <div className="empty"><h3>No hospital pickups in this list</h3><p>Patients who choose “collect at hospital” appear here.</p></div>}
        {visible.map((order) => (
          <div className="clinic-row" key={order.id}>
            <Avatar person={order.patient} />
            <div className="grow">
              <strong>{order.patient?.name || "Patient"}</strong>
              <div className="muted">{order.items?.map((i) => `${i.name} ×${i.qty}`).join(", ")}</div>
              <small className="muted">{prettyDate(order.createdAt)} · {ghs(order.amount)} · {order.id}</small>
            </div>
            <span className={`status ${order.status}`}>{order.status}</span>
            <div className="row-actions">
              {order.status === "queued" && (
                <button className="primary-btn" type="button" onClick={() => mark(order, "ready")}>
                  <Check size={16} /> Mark ready
                </button>
              )}
              {order.status === "ready" && (
                <button className="secondary-btn" type="button" onClick={() => mark(order, "collected")}>
                  <PackageCheck size={16} /> Collected
                </button>
              )}
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
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (user.role === "nurse") return;
    api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setWards);
    if (user.role === "patient") {
      api(`/emails/${user.id}`).then(setEmails);
      api(`/billing?userId=${user.id}&role=${user.role}`).then((rows) => setDue(rows.filter((i) => i.status === "due")));
      api("/doctors").then(setDoctors);
    }
  }, [user]);

  if (user.role === "doctor") return <DoctorBoard user={user} appointments={appointments} wards={wards} />;
  if (user.role === "nurse") return <NurseBoard user={user} />;
  return <PatientHome user={user} appointments={appointments} wards={wards} emails={emails} due={due} doctors={doctors} />;
}
