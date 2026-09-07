import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BedDouble, CalendarDays, Check, ClipboardList, Clock3, CreditCard,
  FileHeart, FolderOpen, HeartPulse, LifeBuoy, MessageCircle, PackageCheck, Pill,
  ShieldCheck, ShoppingBag, Sparkles, Stethoscope, Users, Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { firstName, formatDate, formatTime, greeting, isUpcoming, longDate, prettyDate, ghs } from "../utils";
import { Heartbeat } from "../components/LiveMeter";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import DutyToggle from "../components/DutyToggle";
import { EmptyPlate } from "../components/PageHero";

function ActionTile({ to, icon: Icon, title, text, badge, tone = "default" }) {
  return (
    <Link className={`cbv6-action-tile tone-${tone}`} to={to}>
      <span><Icon size={20} /></span>
      <div><strong>{title}</strong><small>{text}</small></div>
      {badge ? <em>{badge}</em> : <ArrowRight size={16} />}
    </Link>
  );
}

function Signal({ label, value, detail, tone = "default" }) {
  return <div className={`cbv6-signal tone-${tone}`}><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>;
}

function PatientHome({ user, appointments, wards, emails, due, doctors }) {
  const next = appointments.filter(isUpcoming).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const admission = wards.find((w) => w.status !== "declined");
  const dueTotal = due.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const chosen = doctors.find((doctor) => doctor.id === user.preferredDoctorId);
  const nextAction = due.length ? { title: "Review your hospital balance", copy: `${ghs(dueTotal)} is outstanding across ${due.length} item${due.length === 1 ? "" : "s"}.`, to: "/pay", cta: "Review & pay", icon: CreditCard } : next ? { title: "Your next consultation is ready", copy: `${formatDate(next.date)} at ${formatTime(next.time)} with ${next.doctor?.name || "your clinician"}.`, to: next.mode === "video" ? `/video?with=${next.doctorId}` : "/appointments", cta: next.mode === "video" ? "Open consultation" : "View appointment", icon: CalendarDays } : { title: "Your care plan is open", copy: "Book a clinician when you need care. Your record and care team stay connected.", to: "/appointments", cta: "Book care", icon: Stethoscope };
  const NextIcon = nextAction.icon;

  return (
    <div className="cbv6-home cbv6-patient-home">
      <section className="cbv6-patient-welcome">
        <div className="cbv6-patient-welcome-copy">
          <span className="cbv6-kicker"><Sparkles size={14} /> Personal care space</span>
          <h1>{greeting(firstName(user.name))}</h1>
          <p>Everything important about your care, in one calm place.</p>
          <div className="cbv6-patient-identity">
            <span>MRN <b>{user.mrn || "Pending"}</b></span>
            <span>Blood <b>{user.bloodType || "—"}</b></span>
            <span>Cover <b>{user.insurance || "Self-pay"}</b></span>
          </div>
        </div>
        <div className="cbv6-patient-portrait">
          <div className="cbv6-patient-photo" />
          <div className="cbv6-patient-avatar"><Avatar person={user} className="large" /><span><b>{user.name}</b><small>Ridge Campus patient</small></span></div>
        </div>
      </section>

      <section className="cbv6-care-focus">
        <div className="cbv6-care-focus-icon"><NextIcon size={25} /></div>
        <div><small>Recommended next step</small><h2>{nextAction.title}</h2><p>{nextAction.copy}</p></div>
        <Link className="primary-btn" to={nextAction.to}>{nextAction.cta}<ArrowRight size={16} /></Link>
      </section>

      <div className="cbv6-patient-signal-row">
        <Signal label="Next visit" value={next ? formatTime(next.time) : "No visit"} detail={next ? formatDate(next.date) : "Book when you need care"} tone="blue" />
        <Signal label="Account" value={due.length ? ghs(dueTotal) : "Clear"} detail={due.length ? `${due.length} item${due.length === 1 ? "" : "s"} due` : "No unpaid charges"} tone={due.length ? "amber" : "green"} />
        <Signal label="Admission" value={admission ? admission.ward : "None"} detail={admission ? admission.status : "No active bed request"} tone="violet" />
        <Signal label="Care team" value={chosen ? chosen.name.replace("Dr. ", "") : "Choose"} detail={chosen?.specialty || "Select a preferred clinician"} tone="teal" />
      </div>

      <div className="cbv6-patient-grid">
        <section className="cbv6-panel cbv6-care-stream">
          <header><div><small>Your care stream</small><h2>What is happening around you</h2></div><span className="cbv6-live-chip"><i /> Live</span></header>
          <div className="cbv6-stream-list">
            <Link to="/appointments" className={next ? "is-current" : ""}><span><CalendarDays size={18} /></span><div><strong>Consultation</strong><small>{next ? `${formatDate(next.date)} · ${formatTime(next.time)} · ${next.doctor?.name || "Clinician"}` : "No upcoming appointment"}</small></div><ArrowRight size={16} /></Link>
            <Link to="/records"><span><FileHeart size={18} /></span><div><strong>Health record</strong><small>Vitals, notes, labs and clinical history</small></div><ArrowRight size={16} /></Link>
            <Link to="/prescriptions"><span><ClipboardList size={18} /></span><div><strong>Prescriptions</strong><small>Medication orders and pharmacy fulfilment</small></div><ArrowRight size={16} /></Link>
            <Link to="/wards" className={admission ? "is-current" : ""}><span><BedDouble size={18} /></span><div><strong>Admission</strong><small>{admission ? `${admission.ward} · ${admission.status}` : "No current reservation"}</small></div><ArrowRight size={16} /></Link>
            <Link to="/pay" className={due.length ? "needs-attention" : ""}><span><CreditCard size={18} /></span><div><strong>Hospital account</strong><small>{due.length ? `${ghs(dueTotal)} outstanding` : "No unpaid charges"}</small></div><ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="cbv6-panel cbv6-next-clinician">
          <header><div><small>Your clinician</small><h2>{next ? "Upcoming consultation" : "Care relationship"}</h2></div></header>
          {next ? (
            <div className="cbv6-clinician-card">
              <Avatar person={next.doctor} className="large" />
              <div><h3>{next.doctor?.name}</h3><p>{next.doctor?.specialty}</p><span><Clock3 size={14} /> {formatDate(next.date)} · {formatTime(next.time)}</span></div>
              <div><Link className="secondary-btn" to={`/messages?with=${next.doctorId}`}>Message</Link>{next.mode === "video" && <Link className="primary-btn" to={`/video?with=${next.doctorId}`}><Video size={15} /> Join</Link>}</div>
            </div>
          ) : chosen ? (
            <div className="cbv6-clinician-card"><Avatar person={chosen} className="large" /><div><h3>{chosen.name}</h3><p>{chosen.specialty}</p><Presence person={chosen} /></div><Link className="primary-btn" to="/appointments">Book visit</Link></div>
          ) : <EmptyPlate compact scene="clinic" title="Build your care team" hint="Choose a preferred clinician for faster access." />}
        </section>
      </div>

      <section className="cbv6-patient-actions">
        <ActionTile to="/appointments" icon={CalendarDays} title="Book care" text="In-person or video consultation" tone="blue" />
        <ActionTile to="/records" icon={FolderOpen} title="Health record" text="Your complete clinical timeline" tone="teal" />
        <ActionTile to="/messages" icon={MessageCircle} title="Messages" text="Secure care-team communication" badge={emails.length || undefined} tone="violet" />
        <ActionTile to="/pay" icon={ShoppingBag} title="Shop & pay" text="Bills, medicines and services" badge={due.length || undefined} tone="amber" />
        <ActionTile to="/support" icon={LifeBuoy} title="Hospital support" text="Get help from operations" tone="green" />
      </section>
    </div>
  );
}

function DoctorBoard({ user, appointments, wards }) {
  const { updateUser } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const today = useMemo(() => appointments.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [appointments]);
  const next = today.find(isUpcoming);
  const pending = wards.filter((w) => w.status === "pending").length;
  const remaining = today.filter(isUpcoming).length;
  const available = user.available !== false;

  const toggleAvail = async (nextAvailable) => {
    const value = typeof nextAvailable === "boolean" ? nextAvailable : !available;
    if (value === available) return;
    setBusy(true);
    try {
      const updated = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ available: value }) });
      updateUser({ ...user, ...updated });
      push(value ? "Patients now see you as available." : "Patients now see you as busy.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  return (
    <div className="cbv6-home cbv6-doctor-home">
      <header className="cbv6-clinical-header">
        <div><span className="cbv6-kicker"><HeartPulse size={14} /> {user.department || "Outpatient"} · {longDate()}</span><h1>{greeting(user.name.replace("Dr. ", "").split(" ")[0])}</h1><p>Your clinic, active patient and clinical tools are arranged around the encounter.</p></div>
        <div className="cbv6-clinical-live"><Heartbeat /><DutyToggle available={available} disabled={busy} hint={false} onChange={toggleAvail} /></div>
      </header>

      <div className="cbv6-clinical-ribbon">
        <Signal label="Remaining" value={remaining} detail="patients today" tone="blue" />
        <Signal label="Clinic list" value={today.length} detail="scheduled encounters" tone="teal" />
        <Signal label="Admissions" value={pending} detail={pending ? "waiting for review" : "none waiting"} tone={pending ? "amber" : "green"} />
        <Signal label="Availability" value={available ? "Open" : "Busy"} detail="patient directory" tone={available ? "green" : "violet"} />
      </div>

      <div className="cbv6-clinical-layout">
        <section className="cbv6-panel cbv6-active-encounter">
          <header><div><small>Active encounter</small><h2>{next ? `Next at ${formatTime(next.time)}` : "Clinic queue complete"}</h2></div><span className={`cbv6-live-chip ${available ? "" : "is-paused"}`}><i /> {available ? "On duty" : "Busy"}</span></header>
          {next ? (
            <div className="cbv6-encounter-body">
              <div className="cbv6-patient-banner"><Avatar person={next.patient} className="large" /><div><h2>{next.patient?.name}</h2><p>{next.patient?.mrn || "Patient"} · {next.reason || "Consultation"}</p><div><span>{next.mode === "video" ? "Teleconsult" : "Ridge Campus"}</span><span>{formatDate(next.date)}</span><span className={`status ${next.status}`}>{next.status}</span></div></div></div>
              <div className="cbv6-encounter-actions"><Link to={`/records/${next.patientId}`}><FolderOpen size={18} /><span><b>Open chart</b><small>History, vitals and notes</small></span></Link><Link to={`/messages?with=${next.patientId}`}><MessageCircle size={18} /><span><b>Message</b><small>Secure patient communication</small></span></Link>{next.mode === "video" && <Link to={`/video?with=${next.patientId}`} className="is-primary"><Video size={18} /><span><b>Start call</b><small>Enter teleconsult room</small></span></Link>}</div>
            </div>
          ) : <EmptyPlate compact scene="clinic" title="No upcoming patient" hint="Your next encounter will appear here." />}
        </section>

        <aside className="cbv6-panel cbv6-clinical-toolbox">
          <header><div><small>Clinical toolbox</small><h2>Work in context</h2></div></header>
          <ActionTile to="/care" icon={Users} title="Caseload" text="Find your patients" tone="blue" />
          <ActionTile to="/records" icon={FileHeart} title="Patient charts" text="Clinical documentation" tone="teal" />
          <ActionTile to="/prescriptions" icon={Pill} title="Prescribe" text="Medication orders" tone="violet" />
          <ActionTile to="/video" icon={Video} title="Teleconsult" text="Secure consultation room" tone="green" />
        </aside>
      </div>

      <section className="cbv6-panel cbv6-clinic-board">
        <header><div><small>Today’s clinic</small><h2>Encounter board</h2></div><Link className="secondary-btn" to="/appointments">Full schedule</Link></header>
        <div className="cbv6-clinic-table">
          <div className="cbv6-clinic-head"><span>Time</span><span>Patient</span><span>Visit</span><span>Status</span><span>Actions</span></div>
          {today.length === 0 && <EmptyPlate compact scene="schedule" title="No patients scheduled" />}
          {today.map((appointment) => (
            <div className={`cbv6-clinic-row ${appointment.id === next?.id ? "is-next" : ""}`} key={appointment.id}>
              <div><b>{formatTime(appointment.time)}</b><small>{formatDate(appointment.date)}</small></div>
              <div className="cbv6-clinic-person"><Avatar person={appointment.patient} /><span><b>{appointment.patient?.name}</b><small>{appointment.patient?.mrn || "Patient"}</small></span></div>
              <div><b>{appointment.reason || "Consultation"}</b><small>{appointment.mode === "video" ? "Teleconsult" : "In person"}</small></div>
              <span className={`status ${appointment.status}`}>{appointment.status}</span>
              <div className="row-actions"><Link className="ghost-btn" to={`/records/${appointment.patientId}`}>Chart</Link><Link className="ghost-btn" to={`/messages?with=${appointment.patientId}`}>Message</Link>{appointment.mode === "video" && appointment.status !== "cancelled" && <Link className="primary-btn" to={`/video?with=${appointment.patientId}`}>Call</Link>}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DispensingCard({ order, onMark }) {
  return (
    <article className={`cbv6-dispense-card status-${order.status}`}>
      <header><Avatar person={order.patient} /><div><b>{order.patient?.name || "Patient"}</b><small>{order.id}</small></div><span className={`status ${order.status}`}>{order.status}</span></header>
      <div className="cbv6-dispense-items">{order.items?.map((item) => <span key={`${order.id}-${item.id || item.name}`}><b>{item.name}</b><em>×{item.qty}</em></span>)}</div>
      <footer><small>{prettyDate(order.createdAt)} · {ghs(order.amount)}</small>{order.status === "queued" && <button className="primary-btn" type="button" onClick={() => onMark(order, "ready")}><Check size={15} /> Ready</button>}{order.status === "ready" && <button className="secondary-btn" type="button" onClick={() => onMark(order, "collected")}><PackageCheck size={15} /> Collected</button>}</footer>
    </article>
  );
}

function NurseBoard({ user }) {
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
      push(status === "ready" ? "Patient notified — pack is ready." : "Order marked collected.");
    } catch (err) { push(err.message, "error"); }
  };

  const hospital = orders.filter((order) => order.fulfill === "hospital");
  const queued = hospital.filter((order) => order.status === "queued");
  const ready = hospital.filter((order) => order.status === "ready");
  const collected = hospital.filter((order) => order.status === "collected");

  return (
    <div className="cbv6-home cbv6-nurse-home">
      <header className="cbv6-dispensary-header">
        <div><span className="cbv6-kicker"><ClipboardList size={14} /> {user.department || "Ridge Campus pharmacy"}</span><h1>Dispensary command</h1><p>{user.shift || "Day shift"} · live preparation, pickup and inventory flow.</p></div>
        <Link className="primary-btn" to="/pharmacy-stock"><Pill size={16} /> Inventory control</Link>
      </header>

      <div className="cbv6-dispensary-status">
        <div className={queued.length ? "needs-attention" : ""}><span><ClipboardList size={19} /></span><div><small>To prepare</small><b>{queued.length}</b></div></div>
        <div><span><PackageCheck size={19} /></span><div><small>Ready for pickup</small><b>{ready.length}</b></div></div>
        <div><span><ShieldCheck size={19} /></span><div><small>Collected</small><b>{collected.length}</b></div></div>
        <div className="cbv6-socket-state"><i /><span>Live dispensing feed</span></div>
      </div>

      <section className="cbv6-dispensary-board">
        <div className="cbv6-dispensary-lane lane-queued"><header><span>01</span><div><small>Queue</small><h2>Prepare</h2></div><b>{queued.length}</b></header><div>{queued.length ? queued.map((order) => <DispensingCard key={order.id} order={order} onMark={mark} />) : <EmptyPlate compact scene="pharmacy" title="Queue is clear" hint="New hospital pickups appear here." />}</div></div>
        <div className="cbv6-dispensary-lane lane-ready"><header><span>02</span><div><small>Handover</small><h2>Ready</h2></div><b>{ready.length}</b></header><div>{ready.length ? ready.map((order) => <DispensingCard key={order.id} order={order} onMark={mark} />) : <EmptyPlate compact scene="pharmacy" title="Nothing waiting for collection" />}</div></div>
        <div className="cbv6-dispensary-lane lane-collected"><header><span>03</span><div><small>Completed</small><h2>Collected</h2></div><b>{collected.length}</b></header><div>{collected.length ? collected.slice(0, 10).map((order) => <DispensingCard key={order.id} order={order} onMark={mark} />) : <EmptyPlate compact scene="pharmacy" title="No completed handovers yet" />}</div></div>
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
    api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments).catch(() => {});
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setWards).catch(() => {});
    if (user.role === "patient") {
      api(`/emails/${user.id}`).then(setEmails).catch(() => {});
      api(`/billing?userId=${user.id}&role=${user.role}`).then((rows) => setDue(rows.filter((row) => row.status === "due"))).catch(() => {});
      api("/doctors").then(setDoctors).catch(() => {});
    }
  }, [user.id, user.role]);

  if (user.role === "doctor") return <DoctorBoard user={user} appointments={appointments} wards={wards} />;
  if (user.role === "nurse") return <NurseBoard user={user} />;
  return <PatientHome user={user} appointments={appointments} wards={wards} emails={emails} due={due} doctors={doctors} />;
}
