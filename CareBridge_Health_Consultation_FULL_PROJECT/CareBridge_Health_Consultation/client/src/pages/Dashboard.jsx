import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BedDouble, CalendarDays, Check, ClipboardList, Clock3, CreditCard,
  FileHeart, FolderOpen, MessageCircle, PackageCheck, Pill, ShieldCheck, ShoppingBag,
  Stethoscope, Users, Video, WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { firstName, formatDate, formatTime, greeting, isUpcoming, longDate, prettyDate, ghs } from "../utils";
import Avatar from "../components/Avatar";
import DutyToggle from "../components/DutyToggle";
import { photoFor } from "../imagery";

function Stat({ icon: Icon, label, value, hint, to }) {
  const body = (
    <>
      <span className="v5-stat-icon"><Icon size={17} /></span>
      <div><small>{label}</small><strong>{value}</strong><span>{hint}</span></div>
    </>
  );
  return to ? <Link className="v5-stat" to={to}>{body}</Link> : <div className="v5-stat">{body}</div>;
}

function ActionRow({ to, icon: Icon, title, text }) {
  return (
    <Link className="v5-action-row" to={to}>
      <span className="v5-action-icon"><Icon size={17} /></span>
      <span><b>{title}</b><small>{text}</small></span>
      <ArrowRight size={15} />
    </Link>
  );
}

function EmptyRow({ title, text }) {
  return <div className="v5-empty-inline"><strong>{title}</strong><span>{text}</span></div>;
}

function PatientHome({ user, appointments, wards, due, doctors }) {
  const next = appointments.filter(isUpcoming).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const admission = wards.find((w) => w.status !== "declined" && w.status !== "cancelled");
  const dueTotal = due.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const chosen = doctors.find((doctor) => doctor.id === user.preferredDoctorId);

  const nextAction = due.length
    ? { icon: CreditCard, title: "Hospital bill needs attention", text: `${ghs(dueTotal)} is outstanding across ${due.length} bill${due.length === 1 ? "" : "s"}.`, to: "/pay", label: "Review & pay" }
    : next
      ? { icon: CalendarDays, title: "Your next appointment is booked", text: `${formatDate(next.date)} at ${formatTime(next.time)} with ${next.doctor?.name || "your clinician"}.`, to: next.mode === "video" ? `/video?with=${next.doctorId}` : "/appointments", label: next.mode === "video" ? "Open video room" : "View appointment" }
      : { icon: Stethoscope, title: "No visit is scheduled", text: "Book a consultation when you need care. Your record stays available here.", to: "/appointments", label: "Book care" };
  const NextIcon = nextAction.icon;

  return (
    <div className="v5-dashboard v5-patient-home">
      <section className="v5-welcome">
        <div className="v5-welcome-copy">
          <span className="v5-kicker">My health · {user.mrn || "Patient account"}</span>
          <h1>{greeting(firstName(user.name))}</h1>
          <p>See what matters now, manage upcoming care, keep your health record close, and pay hospital charges from one place.</p>
          <div className="v5-welcome-actions">
            <Link className="primary-btn" to="/appointments"><CalendarDays size={16} /> Book an appointment</Link>
            <Link className="secondary-btn" to="/messages"><MessageCircle size={16} /> Message care team</Link>
          </div>
        </div>
        <div className="v5-welcome-photo" style={{ backgroundImage: `url(${photoFor("home")})` }} aria-hidden="true" />
      </section>

      <div className="v5-stat-row">
        <Stat icon={CalendarDays} label="Next visit" value={next ? formatTime(next.time) : "Not booked"} hint={next ? formatDate(next.date) : "Schedule care when needed"} to="/appointments" />
        <Stat icon={WalletCards} label="Balance" value={ghs(dueTotal)} hint={due.length ? `${due.length} bill${due.length === 1 ? "" : "s"} outstanding` : "Nothing outstanding"} to="/pay" />
        <Stat icon={BedDouble} label="Admission" value={admission ? admission.ward : "None"} hint={admission ? admission.status : "No active bed request"} to="/wards" />
        <Stat icon={Stethoscope} label="Care team" value={chosen ? chosen.name.replace("Dr. ", "") : "Choose doctor"} hint={chosen?.specialty || "Add a preferred clinician"} to="/care" />
      </div>

      <div className="v5-grid-2">
        <section className="v5-panel v5-attention-panel">
          <div className="v5-panel-head"><div><small>What to do next</small><h2>Your next best action</h2></div><span className="v5-live-chip"><i /> Updated live</span></div>
          <div className="v5-panel-body v5-attention-body">
            <span className="v5-attention-icon"><NextIcon size={24} /></span>
            <div><h2>{nextAction.title}</h2><p>{nextAction.text}</p></div>
            <Link className="primary-btn" to={nextAction.to}>{nextAction.label}<ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Quick access</small><h2>My care</h2></div></div>
          <div className="v5-panel-body v5-action-list">
            <ActionRow to="/records" icon={FolderOpen} title="Health record" text="Vitals, notes, labs and history" />
            <ActionRow to="/prescriptions" icon={ClipboardList} title="Prescriptions" text="Medicines and fulfilment" />
            <ActionRow to="/pay" icon={ShoppingBag} title="Shop & pay" text="Bills, medicines and services" />
            <ActionRow to="/support" icon={ShieldCheck} title="Patient support" text="Get help from the hospital" />
          </div>
        </section>
      </div>

      <div className="v5-grid-2 v5-patient-lower">
        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Upcoming care</small><h2>{next ? "Next consultation" : "No upcoming visit"}</h2></div><Link className="ghost-btn" to="/appointments">All appointments</Link></div>
          <div className="v5-panel-body">
            {next ? (
              <div className="v5-patient-card">
                <Avatar person={next.doctor} className="large" />
                <div>
                  <h2>{next.doctor?.name || "Clinician"}</h2>
                  <p>{next.doctor?.specialty || "Consultation"} · {next.reason || "Visit"}</p>
                  <div className="v5-patient-meta"><span><Clock3 size={12} /> {formatDate(next.date)} · {formatTime(next.time)}</span><span>{next.mode === "video" ? "Video" : "Ridge Campus"}</span></div>
                </div>
                <div className="v5-patient-actions">
                  <Link className="secondary-btn" to={`/messages?with=${next.doctorId}`}>Message</Link>
                  {next.mode === "video" && <Link className="primary-btn" to={`/video?with=${next.doctorId}`}><Video size={15} /> Join</Link>}
                </div>
              </div>
            ) : <EmptyRow title="You are all caught up" text="Book a new appointment whenever you need care." />}
          </div>
        </section>

        <section className="v5-panel v5-account-panel">
          <div className="v5-panel-head"><div><small>Account</small><h2>{due.length ? "Payment required" : "All clear"}</h2></div><ShieldCheck size={18} /></div>
          <div className="v5-panel-body"><strong className="v5-balance">{ghs(dueTotal)}</strong><p>{due.length ? "Online payments are verified before CareBridge issues a receipt." : "There are no unpaid hospital charges on your account."}</p><Link className="secondary-btn" to="/pay">Open Shop & pay</Link></div>
        </section>
      </div>
    </div>
  );
}

function DoctorHome({ user, appointments, wards }) {
  const { updateUser } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const queue = useMemo(() => appointments.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [appointments]);
  const next = queue.find(isUpcoming);
  const remaining = queue.filter(isUpcoming).length;
  const pendingAdmissions = wards.filter((w) => w.status === "pending").length;
  const available = user.available !== false;

  const toggleAvailability = async (value) => {
    if (value === available) return;
    setBusy(true);
    try {
      const updated = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ available: value }) });
      updateUser({ ...user, ...updated });
      push(value ? "You are visible as available." : "You are now marked busy.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  return (
    <div className="v5-dashboard v5-doctor-home">
      <section className="v5-clinician-header">
        <div>
          <span className="v5-kicker">{user.department || "Outpatient"} · {user.clinic || "Clinical service"}</span>
          <h1>{greeting(user.name.replace("Dr. ", "").split(" ")[0])}</h1>
          <p>{longDate()} · {remaining} upcoming encounter{remaining === 1 ? "" : "s"} in your queue.</p>
        </div>
        <div className="v5-clinic-pulse" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        <DutyToggle available={available} disabled={busy} hint={false} onChange={toggleAvailability} />
      </section>

      <div className="v5-stat-row">
        <Stat icon={Users} label="Remaining" value={remaining} hint={available ? "Accepting consultations" : "Marked busy"} />
        <Stat icon={CalendarDays} label="Clinic list" value={queue.length} hint="Scheduled encounters" to="/appointments" />
        <Stat icon={BedDouble} label="Admissions" value={pendingAdmissions} hint={pendingAdmissions ? "Awaiting review" : "No pending requests"} to="/wards" />
        <Stat icon={MessageCircle} label="Clinical inbox" value="Open" hint="Patients and hospital team" to="/messages" />
      </div>

      <div className="v5-clinical-grid">
        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Now</small><h2>{next ? "Next patient" : "Queue complete"}</h2></div><span className={`v5-duty-state ${available ? "on" : "off"}`}><i /> {available ? "On duty" : "Busy"}</span></div>
          <div className="v5-panel-body">
            {next ? (
              <div className="v5-patient-card">
                <Avatar person={next.patient} className="large" />
                <div><h2>{next.patient?.name || "Patient"}</h2><p>{next.reason || "Consultation"}</p><div className="v5-patient-meta"><span>{formatTime(next.time)}</span><span>{next.mode === "video" ? "Teleconsult" : "In person"}</span><span>{next.status}</span></div></div>
                <div className="v5-patient-actions"><Link className="secondary-btn" to={`/records/${next.patientId}`}><FolderOpen size={15} /> Chart</Link><Link className="secondary-btn" to={`/messages?with=${next.patientId}`}>Message</Link>{next.mode === "video" && <Link className="primary-btn" to={`/video?with=${next.patientId}`}><Video size={15} /> Start</Link>}</div>
              </div>
            ) : <EmptyRow title="No patient waiting" text="Your next scheduled encounter will appear here." />}
          </div>
        </section>

        <section className="v5-panel">
          <div className="v5-panel-head"><div><small>Clinical tools</small><h2>Worklist</h2></div></div>
          <div className="v5-panel-body v5-action-list"><ActionRow to="/care" icon={Users} title="Caseload" text="Find patients and relationships" /><ActionRow to="/records" icon={FileHeart} title="Patient charts" text="Notes, labs, vitals and plans" /><ActionRow to="/prescriptions" icon={Pill} title="Prescriptions" text="Issue and review medication" /><ActionRow to="/video" icon={Video} title="Teleconsult" text="Open a secure consultation" /></div>
        </section>
      </div>

      <section className="v5-panel">
        <div className="v5-panel-head"><div><small>Clinic queue</small><h2>Today’s encounters</h2></div><Link className="secondary-btn" to="/appointments">Full schedule</Link></div>
        <div className="v5-queue">
          <div className="v5-queue-head"><span>Time</span><span>Patient</span><span>Visit</span><span>Status</span><span>Actions</span></div>
          {queue.length === 0 && <EmptyRow title="No patients scheduled" text="Your clinic list is currently clear." />}
          {queue.map((appointment) => (
            <div className={`v5-queue-row ${appointment.id === next?.id ? "is-next" : ""}`} key={appointment.id}>
              <div><b>{formatTime(appointment.time)}</b><small className="muted" style={{ display: "block" }}>{formatDate(appointment.date)}</small></div>
              <div className="v5-person"><Avatar person={appointment.patient} className="small" /><span><b>{appointment.patient?.name || "Patient"}</b><small>{appointment.patient?.mrn || "Patient record"}</small></span></div>
              <div><b>{appointment.reason || "Consultation"}</b><small className="muted" style={{ display: "block" }}>{appointment.mode === "video" ? "Teleconsult" : "In person"}</small></div>
              <span className={`status ${appointment.status}`}>{appointment.status}</span>
              <div className="v5-row-actions"><Link className="ghost-btn" to={`/records/${appointment.patientId}`}>Chart</Link><Link className="ghost-btn" to={`/messages?with=${appointment.patientId}`}>Message</Link>{appointment.mode === "video" && appointment.status !== "cancelled" && <Link className="primary-btn" to={`/video?with=${appointment.patientId}`}>Call</Link>}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OrderCard({ order, onMark }) {
  return (
    <article className="v5-order-card">
      <div className="v5-order-head"><Avatar person={order.patient} className="small" /><div><b>{order.patient?.name || "Patient"}</b><small>{order.id}</small></div><span className={`status ${order.status}`}>{order.status}</span></div>
      <div className="v5-order-items">{order.items?.map((item) => <span key={`${order.id}-${item.id || item.name}`}><b>{item.name}</b><em>×{item.qty}</em></span>)}</div>
      <div className="v5-order-foot"><small>{prettyDate(order.createdAt)} · {ghs(order.amount)}</small>{order.status === "queued" && <button className="primary-btn" type="button" onClick={() => onMark(order, "ready")}><Check size={14} /> Ready</button>}{order.status === "ready" && <button className="secondary-btn" type="button" onClick={() => onMark(order, "collected")}><PackageCheck size={14} /> Collected</button>}</div>
    </article>
  );
}

function NurseHome({ user }) {
  const { push } = useToast();
  const [orders, setOrders] = useState([]);
  const load = () => api(`/pharmacy/orders?userId=${user.id}&role=nurse`).then(setOrders).catch(() => {});

  useEffect(() => {
    load();
    const socket = io(socketUrl, socketOptions());
    socket.emit("join-user", user.id);
    socket.on("pharmacy-order", (order) => setOrders((rows) => [order, ...rows.filter((row) => row.id !== order.id)]));
    return () => socket.disconnect();
  }, [user.id]);

  const mark = async (order, status) => {
    try {
      const next = await api(`/pharmacy/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, status }) });
      setOrders((rows) => rows.map((row) => row.id === next.id ? next : row));
      push(status === "ready" ? "Patient notified — order is ready." : "Order marked collected.");
    } catch (err) { push(err.message, "error"); }
  };

  const hospital = orders.filter((order) => order.fulfill === "hospital");
  const queued = hospital.filter((order) => order.status === "queued");
  const ready = hospital.filter((order) => order.status === "ready");
  const collected = hospital.filter((order) => order.status === "collected");

  const lane = (title, Icon, rows, empty, actionTone) => (
    <section className={`v5-lane ${actionTone}`}>
      <header><span><Icon size={16} /> {title}</span><b>{rows.length}</b></header>
      <div className="v5-lane-stack">{rows.length ? rows.map((order) => <OrderCard key={order.id} order={order} onMark={mark} />) : <EmptyRow title={empty} text="New activity will appear here live." />}</div>
    </section>
  );

  return (
    <div className="v5-dashboard v5-nurse-home">
      <section className="v5-clinician-header v5-nurse-header">
        <div><span className="v5-kicker">{user.department || "Ridge Campus pharmacy"}</span><h1>{greeting(firstName(user.name.replace("Nurse ", "")))}</h1><p>{user.shift || "Day dispensary"} · Live medication preparation and pickup workflow.</p></div>
        <div className="v5-dispensary-signal" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <Link className="primary-btn" to="/pharmacy-stock"><Pill size={15} /> Inventory</Link>
      </section>

      <div className="v5-stat-row"><Stat icon={ClipboardList} label="To prepare" value={queued.length} hint="Queued hospital pickups" /><Stat icon={PackageCheck} label="Ready" value={ready.length} hint="Waiting for collection" /><Stat icon={ShoppingBag} label="Collected" value={collected.length} hint="Processed orders" /><Stat icon={Pill} label="Inventory" value="Live" hint="Current dispensary stock" to="/pharmacy-stock" /></div>

      <section className="v5-panel">
        <div className="v5-panel-head"><div><small>Live dispensary</small><h2>Medication fulfilment board</h2></div><Link className="secondary-btn" to="/messages"><MessageCircle size={14} /> Clinical messages</Link></div>
        <div className="v5-panel-body"><div className="v5-dispensary">{lane("To prepare", ClipboardList, queued, "Queue is clear", "queued")}{lane("Ready", PackageCheck, ready, "Nothing waiting", "ready")}{lane("Collected", ShieldCheck, collected.slice(0, 10), "No collected orders", "collected")}</div></div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [wards, setWards] = useState([]);
  const [due, setDue] = useState([]);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (user.role === "nurse") return;
    api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments).catch(() => {});
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setWards).catch(() => {});
    if (user.role === "patient") {
      api(`/billing?userId=${user.id}&role=${user.role}`).then((rows) => setDue(rows.filter((row) => row.status === "due"))).catch(() => {});
      api("/doctors").then(setDoctors).catch(() => {});
    }
  }, [user.id, user.role]);

  if (user.role === "doctor") return <DoctorHome user={user} appointments={appointments} wards={wards} />;
  if (user.role === "nurse") return <NurseHome user={user} />;
  return <PatientHome user={user} appointments={appointments} wards={wards} due={due} doctors={doctors} />;
}
