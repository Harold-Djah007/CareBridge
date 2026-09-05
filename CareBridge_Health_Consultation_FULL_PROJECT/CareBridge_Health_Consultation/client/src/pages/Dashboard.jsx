import React, { useEffect, useState } from "react";
import { CalendarDays, BedDouble, Video, FolderOpen, Pill, Stethoscope, Check, PackageCheck, ShoppingBag, ClipboardList, LifeBuoy, Users, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketUrl } from "../api";
import { firstName, formatDate, formatTime, greeting, isUpcoming, longDate, prettyDate, ghs } from "../utils";
import { Heartbeat } from "../components/LiveMeter";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import DutyToggle from "../components/DutyToggle";
import { JumpMenu, StatStrip } from "../components/TileCard";
import PageHero, { EmptyPlate } from "../components/PageHero";
import { IMAGERY } from "../imagery";

function PatientHome({ user, appointments, wards, emails, due, doctors }) {
  const next = appointments.find(isUpcoming);
  const admission = wards.find((w) => w.status !== "declined");
  const dueTotal = due.reduce((s, i) => s + Number(i.amount || 0), 0);
  const chosen = doctors.find((d) => d.id === user.preferredDoctorId);

  return (
    <div className="home-stage">
      <PageHero
        scene="home"
        className="identity-hero"
        leading={<Avatar person={user} className="large" />}
        eyebrow="Patient record"
        title={greeting(firstName(user.name))}
        actions={(
          <div className="identity-aside">
            <Link className="secondary-btn" to="/profile">My details</Link>
            {due.length > 0 && <span className="muted">{ghs(dueTotal)} outstanding</span>}
          </div>
        )}
      >
        <div className="identity-meta">
          <span>MRN <b>{user.mrn || "Pending"}</b></span>
          <span>DOB <b>{user.dob || "—"}</b></span>
          <span>Blood <b>{user.bloodType || "—"}</b></span>
          <span>Cover <b>{user.insurance || "Self-pay"}</b></span>
        </div>
      </PageHero>

      <StatStrip items={[
        { label: "Next visit", value: next ? formatTime(next.time) : "None", hint: next ? formatDate(next.date) : "Book from Visits" },
        { label: "Outstanding", value: due.length ? ghs(dueTotal) : "Cleared", hint: due.length ? `${due.length} open bill${due.length === 1 ? "" : "s"}` : "Shop & pay is ready" },
        { label: "Admission", value: admission ? admission.ward : "None", hint: admission ? admission.status : "No bed reserved" },
        { label: "Consultant", value: chosen ? chosen.name.replace("Dr. ", "") : "Choose", hint: chosen ? chosen.specialty : "Find a doctor" },
      ]} />

      <JumpMenu label="Go to" items={[
        { to: "/pay", icon: ShoppingBag, title: "Shop & pay", subtitle: due.length ? `${ghs(dueTotal)} outstanding` : "Bills, medicines, labs" },
        { to: "/prescriptions", icon: ClipboardList, title: "Prescriptions", subtitle: "Print, buy, or collect" },
        { to: "/care", icon: Stethoscope, title: "Doctors", subtitle: chosen ? chosen.name : "Find a consultant" },
        { to: "/appointments", icon: CalendarDays, title: "Visits", subtitle: next ? `${formatDate(next.date)} · ${formatTime(next.time)}` : "Book a visit" },
        { to: "/records", icon: FolderOpen, title: "Clinical file", subtitle: "Notes, labs, medicines" },
        { to: "/support", icon: LifeBuoy, title: "Support", subtitle: emails.length ? `${emails.length} notices` : "Help desk" },
      ]} />

      <div className="dashboard-grid">
        <section className="card home-panel home-feature">
          <div className="home-rail" style={{ backgroundImage: `url(${next?.mode === "video" ? IMAGERY.consult : IMAGERY.clinic})` }} aria-hidden="true" />
          <div className="home-feature-body">
            <div className="card-head">
              <div><span className="eyebrow">Next visit</span>
                <h3>{next ? `${formatDate(next.date)} · ${formatTime(next.time)}` : "No visit booked"}</h3>
              </div>
            </div>
            {next ? (
              <div className="appointment-feature">
                <Avatar person={next.doctor} />
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
            ) : chosen ? (
              <div className="appointment-feature">
                <Avatar person={chosen} />
                <div className="grow">
                  <strong>{chosen.name}</strong>
                  <span className="muted">{chosen.specialty} · your consultant</span>
                  <Presence person={chosen} />
                </div>
                <div className="row-actions">
                  <Link className="primary-btn" to="/appointments">Book</Link>
                </div>
              </div>
            ) : (
              <EmptyPlate scene="clinic" compact title="Choose a consultant, then book." />
            )}
          </div>
        </section>
        <section className="card home-panel home-feature">
          <div className="home-rail" style={{ backgroundImage: `url(${IMAGERY.wards})` }} aria-hidden="true" />
          <div className="home-feature-body">
            <div className="card-head"><div><span className="eyebrow">Admission</span><h3>{admission ? admission.ward : "No bed reserved"}</h3></div></div>
            {admission ? (
              <div className="appointment-feature">
                <BedDouble size={20} />
                <div className="grow">
                  <strong>{admission.roomType}</strong>
                  <span className="muted">Arrive {admission.date}{admission.fee ? ` · ${ghs(admission.fee)}` : ""}</span>
                </div>
                <span className={`status ${admission.status}`}>{admission.status}</span>
              </div>
            ) : <EmptyPlate scene="wards" compact title="No bed reserved" hint="Request a ward before you travel." />}
          </div>
        </section>
      </div>
    </div>
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
    <div className="home-stage">
      <PageHero
        scene="clinic"
        className="welcome doctor-welcome compact"
        extras={<Heartbeat />}
        eyebrow={`${user.department || "Outpatient"} · ${user.clinic || "Consulting room"}`}
        title={greeting(user.name.replace("Dr. ", "").split(" ")[0])}
        lead={`${longDate()} · ${user.shift || "Day clinic"} · ${remaining} remaining${pending > 0 ? ` · ${pending} admission waiting` : ""}`}
        actions={<DutyToggle available={available} disabled={busy} hint={false} onChange={(on) => toggleAvail(on)} />}
      />

      <StatStrip items={[
        { label: "Remaining today", value: remaining, hint: available ? "On duty" : "Marked busy" },
        { label: "On the board", value: today.length, hint: "Confirmed and pending" },
        { label: "Admissions", value: pending, hint: pending ? "Waiting on a bed" : "No pending requests" },
      ]} />

      <JumpMenu label="Clinic pages" items={[
        { to: "/care", icon: Users, title: "Patients", subtitle: "Caseload directory" },
        { to: "/records", icon: FolderOpen, title: "Open chart", subtitle: "Notes and letters" },
        { to: "/prescriptions", icon: Pill, title: "Prescriptions", subtitle: "Issued letters" },
        { to: "/wards", icon: BedDouble, title: "Admissions", subtitle: pending ? `${pending} waiting` : "Ward requests" },
        { to: "/messages", icon: MessageCircle, title: "Inbox", subtitle: "Clinical messages" },
      ]} />

      <section className="home-feature work-wrap">
        <div className="home-rail" style={{ backgroundImage: `url(${IMAGERY.clinic})` }} aria-hidden="true" />
        <div className="clinic-board work-deck">
        {today.length === 0 && <EmptyPlate scene="clinic" title="No patients on your list" hint="Confirmed visits appear here as a clinic board." />}
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
      </section>
    </div>
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
    <div className="home-stage">
      <PageHero
        scene="nurse"
        className="welcome doctor-welcome nurse-welcome compact"
        eyebrow={`${user.department || "Ridge Campus pharmacy"} · ${user.shift || "Day dispensary"}`}
        title={greeting(firstName(user.name.replace("Nurse ", "")))}
        lead={`${longDate()} · ${queued} waiting for prep · ${ready} ready for collection`}
      />
      <StatStrip items={[
        { label: "Queued", value: queued, hint: "Waiting for prep" },
        { label: "Ready", value: ready, hint: "Awaiting collection" },
        { label: "Hospital packs", value: hospital.length, hint: "Collect at Ridge" },
      ]} />
      <JumpMenu label="Dispensary" items={[
        { to: "/pharmacy-stock", icon: Pill, title: "Stock", subtitle: "Cupboard and restock" },
        { to: "/messages", icon: MessageCircle, title: "Messages", subtitle: "Doctors and operations" },
      ]} />
      <div className="filters">
        <button className={filter === "queued" ? "active" : ""} onClick={() => setFilter("queued")}>Queued ({queued})</button>
        <button className={filter === "ready" ? "active" : ""} onClick={() => setFilter("ready")}>Ready ({ready})</button>
        <button className={filter === "collected" ? "active" : ""} onClick={() => setFilter("collected")}>Collected</button>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
      </div>
      <section className="home-feature work-wrap">
        <div className="home-rail" style={{ backgroundImage: `url(${IMAGERY.pharmacy})` }} aria-hidden="true" />
        <div className="clinic-board work-deck">
        {visible.length === 0 && <EmptyPlate scene="pharmacy" title="No hospital pickups" hint="Patients who choose “collect at hospital” appear here." />}
        {visible.map((order) => (
          <div className="work-row" key={order.id}>
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
      </section>
    </div>
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
