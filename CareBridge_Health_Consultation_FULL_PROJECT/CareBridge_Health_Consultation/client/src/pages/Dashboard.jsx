import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BedDouble, CalendarDays, Check, ClipboardList, Clock3, CreditCard,
  FileHeart, FolderOpen, HeartPulse, LifeBuoy, MessageCircle, PackageCheck, Pill,
  ShieldCheck, ShoppingBag, Stethoscope, Users, Video, WalletCards,
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
import PageHero, { EmptyPlate } from "../components/PageHero";

function MetricCard({ icon: Icon, label, value, hint, tone = "default", to }) {
  const content = (
    <>
      <span className={`metric-icon tone-${tone}`}><Icon size={18} /></span>
      <div className="metric-copy"><small>{label}</small><strong>{value}</strong><span>{hint}</span></div>
      {to ? <ArrowRight size={16} className="metric-arrow" /> : null}
    </>
  );
  return to ? <Link to={to} className="product-metric-card">{content}</Link> : <div className="product-metric-card">{content}</div>;
}

function QuickAction({ to, icon: Icon, title, text, badge }) {
  return (
    <Link className="product-action-card" to={to}>
      <span className="product-action-icon"><Icon size={19} /></span>
      <span><b>{title}</b><small>{text}</small></span>
      {badge ? <em>{badge}</em> : <ArrowRight size={16} />}
    </Link>
  );
}

function PatientHome({ user, appointments, wards, emails, due, doctors }) {
  const next = appointments.filter(isUpcoming).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const admission = wards.find((w) => w.status !== "declined");
  const dueTotal = due.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const chosen = doctors.find((doctor) => doctor.id === user.preferredDoctorId);
  const attention = due.length
    ? { icon: CreditCard, title: `${ghs(dueTotal)} needs attention`, text: `${due.length} unpaid hospital bill${due.length === 1 ? "" : "s"} can be settled securely in Shop & pay.`, to: "/pay", action: "Review bills" }
    : next
      ? { icon: CalendarDays, title: `Your next visit is ${formatDate(next.date)}`, text: `${formatTime(next.time)} with ${next.doctor?.name || "your clinician"} · ${next.mode === "video" ? "Video consultation" : "Ridge Campus"}.`, to: next.mode === "video" ? `/video?with=${next.doctorId}` : "/appointments", action: next.mode === "video" ? "Open consult room" : "View appointment" }
      : { icon: Stethoscope, title: "No upcoming visit", text: "Book a clinician when you need care. Your records and care team stay connected here.", to: "/appointments", action: "Book a visit" };
  const AttentionIcon = attention.icon;

  return (
    <div className="product-dashboard patient-dashboard">
      <PageHero
        scene="home"
        className="patient-command-hero"
        leading={<Avatar person={user} className="large" />}
        eyebrow="My care workspace"
        title={greeting(firstName(user.name))}
        lead="A single place for appointments, clinical records, prescriptions, admissions and hospital payments."
        actions={(
          <div className="product-hero-actions">
            <Link className="secondary-btn" to="/messages"><MessageCircle size={16} /> Message care team</Link>
            <Link className="primary-btn" to="/appointments"><CalendarDays size={16} /> Book care</Link>
          </div>
        )}
      >
        <div className="identity-meta product-identity-meta">
          <span>MRN <b>{user.mrn || "Pending"}</b></span>
          <span>Blood <b>{user.bloodType || "—"}</b></span>
          <span>Cover <b>{user.insurance || "Self-pay"}</b></span>
          <span>Campus <b>Ridge</b></span>
        </div>
      </PageHero>

      <div className="product-metric-grid">
        <MetricCard icon={CalendarDays} label="Next appointment" value={next ? formatTime(next.time) : "No visit"} hint={next ? `${formatDate(next.date)} · ${next.doctor?.name || "Clinician"}` : "Book when you need care"} tone="blue" to="/appointments" />
        <MetricCard icon={WalletCards} label="Open balance" value={due.length ? ghs(dueTotal) : "GHS 0"} hint={due.length ? `${due.length} bill${due.length === 1 ? "" : "s"} outstanding` : "Account is clear"} tone={due.length ? "amber" : "green"} to="/pay" />
        <MetricCard icon={BedDouble} label="Admission" value={admission ? admission.ward : "None"} hint={admission ? `${admission.status} · ${admission.date}` : "No bed reservation"} tone="violet" to="/wards" />
        <MetricCard icon={Stethoscope} label="Primary clinician" value={chosen ? chosen.name.replace("Dr. ", "") : "Not selected"} hint={chosen ? chosen.specialty : "Choose your care team"} tone="teal" to="/care" />
      </div>

      <div className="patient-command-grid">
        <section className="command-panel command-priority">
          <div className="command-panel-head">
            <div><span className="eyebrow">Next best action</span><h2>What needs your attention</h2></div>
            <span className="live-state"><i /> Updated live</span>
          </div>
          <div className="priority-content">
            <span className="priority-icon"><AttentionIcon size={26} /></span>
            <div><h3>{attention.title}</h3><p>{attention.text}</p></div>
          </div>
          <Link className="primary-btn priority-action" to={attention.to}>{attention.action}<ArrowRight size={17} /></Link>
        </section>

        <section className="command-panel care-journey-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Care journey</span><h2>Your current pathway</h2></div></div>
          <div className="care-timeline">
            <div className={`care-timeline-row ${next ? "active" : ""}`}><span><CalendarDays size={16} /></span><div><b>Consultation</b><small>{next ? `${formatDate(next.date)} · ${formatTime(next.time)}` : "No upcoming appointment"}</small></div><Link to="/appointments">Open</Link></div>
            <div className="care-timeline-row"><span><FileHeart size={16} /></span><div><b>Clinical record</b><small>Vitals, notes, labs and care history</small></div><Link to="/records">Open</Link></div>
            <div className={`care-timeline-row ${admission ? "active" : ""}`}><span><BedDouble size={16} /></span><div><b>Admission</b><small>{admission ? `${admission.ward} · ${admission.status}` : "No current reservation"}</small></div><Link to="/wards">Open</Link></div>
            <div className={`care-timeline-row ${due.length ? "attention" : ""}`}><span><CreditCard size={16} /></span><div><b>Account</b><small>{due.length ? `${ghs(dueTotal)} outstanding` : "No unpaid bills"}</small></div><Link to="/pay">Open</Link></div>
          </div>
        </section>
      </div>

      <section className="product-section">
        <div className="product-section-head"><div><span className="eyebrow">Fast access</span><h2>Care tools</h2></div><span className="section-hint">Everything stays linked to your patient record</span></div>
        <div className="product-action-grid">
          <QuickAction to="/records" icon={FolderOpen} title="Clinical record" text="Vitals, notes, labs and history" />
          <QuickAction to="/prescriptions" icon={ClipboardList} title="Prescriptions" text="Print, buy or collect medicines" />
          <QuickAction to="/messages" icon={MessageCircle} title="Messages" text="Secure chat with your care team" badge={emails.length || undefined} />
          <QuickAction to="/pay" icon={ShoppingBag} title="Shop & pay" text="Bills, medicines and services" badge={due.length || undefined} />
          <QuickAction to="/wards" icon={BedDouble} title="Admissions" text="Reserve and track a hospital bed" />
          <QuickAction to="/support" icon={LifeBuoy} title="Patient support" text="Get help from the hospital" />
        </div>
      </section>

      <div className="patient-detail-grid">
        <section className="command-panel consultation-card">
          <div className="command-panel-head"><div><span className="eyebrow">Upcoming care</span><h2>{next ? "Next consultation" : "Care team"}</h2></div></div>
          {next ? (
            <div className="consultation-profile">
              <Avatar person={next.doctor} className="large" />
              <div className="grow"><h3>{next.doctor?.name}</h3><p>{next.doctor?.specialty} · {next.reason || "Consultation"}</p><span className="consult-time"><Clock3 size={15} /> {formatDate(next.date)} · {formatTime(next.time)}</span></div>
              <div className="consult-actions"><Link className="secondary-btn" to={`/messages?with=${next.doctorId}`}>Message</Link>{next.mode === "video" && <Link className="primary-btn" to={`/video?with=${next.doctorId}`}><Video size={16} /> Join</Link>}</div>
            </div>
          ) : chosen ? (
            <div className="consultation-profile"><Avatar person={chosen} className="large" /><div className="grow"><h3>{chosen.name}</h3><p>{chosen.specialty}</p><Presence person={chosen} /></div><Link className="primary-btn" to="/appointments">Book visit</Link></div>
          ) : <EmptyPlate compact scene="clinic" title="Choose a clinician" hint="Add a preferred doctor to build your care team." />}
        </section>

        <section className="command-panel account-health-card">
          <div className="command-panel-head"><div><span className="eyebrow">Account health</span><h2>{due.length ? "Payment required" : "All clear"}</h2></div><ShieldCheck size={19} /></div>
          <strong className="account-balance">{ghs(dueTotal)}</strong>
          <p>{due.length ? `${due.length} open bill${due.length === 1 ? "" : "s"}. CareBridge verifies online payments before issuing a receipt.` : "There are no outstanding hospital charges on your account."}</p>
          <Link className="secondary-btn full" to="/pay">Open Shop & pay</Link>
        </section>
      </div>
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
    <div className="product-dashboard doctor-dashboard">
      <PageHero
        scene="clinic"
        className="doctor-command-hero"
        extras={<Heartbeat />}
        eyebrow={`${user.department || "Outpatient"} · ${user.clinic || "Consulting room"}`}
        title={greeting(user.name.replace("Dr. ", "").split(" ")[0])}
        lead={`${longDate()} · ${user.shift || "Day clinic"}. Your clinical queue, patient records and teleconsults are organised here.`}
        actions={<DutyToggle available={available} disabled={busy} hint={false} onChange={toggleAvail} />}
      />

      <div className="product-metric-grid doctor-metrics">
        <MetricCard icon={Users} label="Patients remaining" value={remaining} hint={available ? "Accepting consultations" : "Marked busy"} tone="blue" />
        <MetricCard icon={CalendarDays} label="Clinic list" value={today.length} hint="Scheduled encounters" tone="teal" to="/appointments" />
        <MetricCard icon={BedDouble} label="Admissions waiting" value={pending} hint={pending ? "Needs review" : "No pending requests"} tone={pending ? "amber" : "green"} to="/wards" />
        <MetricCard icon={MessageCircle} label="Clinical inbox" value="Open" hint="Patients and hospital team" tone="violet" to="/messages" />
      </div>

      <div className="clinical-command-grid">
        <section className="command-panel active-patient-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Next patient</span><h2>{next ? formatTime(next.time) : "Queue complete"}</h2></div><span className={`live-state ${available ? "" : "paused"}`}><i /> {available ? "On duty" : "Busy"}</span></div>
          {next ? (
            <div className="active-patient">
              <Avatar person={next.patient} className="large" />
              <div className="active-patient-copy"><h2>{next.patient?.name}</h2><p>{next.reason || "Consultation"}</p><div className="active-patient-meta"><span>{next.mode === "video" ? "Teleconsult" : "Ridge Campus"}</span><span>{formatDate(next.date)}</span><span className={`status ${next.status}`}>{next.status}</span></div></div>
              <div className="active-patient-actions"><Link className="secondary-btn" to={`/records/${next.patientId}`}><FolderOpen size={16} /> Open chart</Link><Link className="secondary-btn" to={`/messages?with=${next.patientId}`}><MessageCircle size={16} /> Message</Link>{next.mode === "video" && <Link className="primary-btn" to={`/video?with=${next.patientId}`}><Video size={16} /> Start consult</Link>}</div>
            </div>
          ) : <EmptyPlate compact scene="clinic" title="No upcoming patient" hint="Your next scheduled encounter will appear here." />}
        </section>

        <section className="command-panel doctor-tools-panel">
          <div className="command-panel-head"><div><span className="eyebrow">Clinical tools</span><h2>Work without leaving context</h2></div></div>
          <div className="doctor-tool-list">
            <QuickAction to="/care" icon={Users} title="Caseload" text="Find and open patient records" />
            <QuickAction to="/records" icon={FileHeart} title="Clinical record" text="Vitals, notes, labs and plans" />
            <QuickAction to="/prescriptions" icon={Pill} title="Prescriptions" text="Issue and review medicines" />
            <QuickAction to="/video" icon={Video} title="Teleconsult room" text="Start a secure consultation" />
          </div>
        </section>
      </div>

      <section className="product-section clinic-queue-section">
        <div className="product-section-head"><div><span className="eyebrow">Clinic queue</span><h2>Today’s encounters</h2></div><Link className="secondary-btn" to="/appointments">Full schedule</Link></div>
        <div className="clinic-queue-table">
          <div className="clinic-queue-head"><span>Time</span><span>Patient</span><span>Visit</span><span>Status</span><span>Actions</span></div>
          {today.length === 0 && <EmptyPlate compact scene="schedule" title="No patients on the clinic list" />}
          {today.map((appointment) => (
            <div className={`clinic-queue-row ${appointment.id === next?.id ? "next" : ""}`} key={appointment.id}>
              <div className="queue-time"><b>{formatTime(appointment.time)}</b><small>{formatDate(appointment.date)}</small></div>
              <div className="queue-person"><Avatar person={appointment.patient} /><span><b>{appointment.patient?.name}</b><small>{appointment.patient?.mrn || "Patient"}</small></span></div>
              <div className="queue-visit"><b>{appointment.reason || "Consultation"}</b><small>{appointment.mode === "video" ? "Teleconsult" : "In person"}</small></div>
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
    <article className={`dispense-card status-${order.status}`}>
      <div className="dispense-card-head"><Avatar person={order.patient} /><div className="grow"><b>{order.patient?.name || "Patient"}</b><small>{order.id}</small></div><span className={`status ${order.status}`}>{order.status}</span></div>
      <div className="dispense-items">{order.items?.map((item) => <span key={`${order.id}-${item.id || item.name}`}><b>{item.name}</b><em>×{item.qty}</em></span>)}</div>
      <div className="dispense-card-foot"><small>{prettyDate(order.createdAt)} · {ghs(order.amount)}</small>{order.status === "queued" && <button className="primary-btn" type="button" onClick={() => onMark(order, "ready")}><Check size={15} /> Ready</button>}{order.status === "ready" && <button className="secondary-btn" type="button" onClick={() => onMark(order, "collected")}><PackageCheck size={15} /> Collected</button>}</div>
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
    <div className="product-dashboard nurse-dashboard">
      <PageHero
        scene="nurse"
        className="nurse-command-hero"
        eyebrow={`${user.department || "Ridge Campus pharmacy"} · ${user.shift || "Day dispensary"}`}
        title={greeting(firstName(user.name.replace("Nurse ", "")))}
        lead="A live dispensing board for medication preparation, patient pickup and stock control."
        actions={<Link className="primary-btn" to="/pharmacy-stock"><Pill size={16} /> Open stock control</Link>}
      />

      <div className="product-metric-grid nurse-metrics">
        <MetricCard icon={ClipboardList} label="Waiting to prepare" value={queued.length} hint="Queued hospital pickups" tone={queued.length ? "amber" : "green"} />
        <MetricCard icon={PackageCheck} label="Ready for pickup" value={ready.length} hint="Patients can collect" tone="teal" />
        <MetricCard icon={ShoppingBag} label="Processed" value={collected.length} hint="Collected orders" tone="blue" />
        <MetricCard icon={Pill} label="Stock control" value="Live" hint="Cupboard inventory" tone="violet" to="/pharmacy-stock" />
      </div>

      <section className="product-section dispensary-section">
        <div className="product-section-head"><div><span className="eyebrow">Live dispensary</span><h2>Medication fulfilment board</h2></div><div className="section-actions"><span className="live-state"><i /> Socket connected</span><Link className="secondary-btn" to="/messages"><MessageCircle size={15} /> Clinical messages</Link></div></div>
        <div className="dispensary-board">
          <section className="dispensary-column queued-column"><header><span><ClipboardList size={17} /> To prepare</span><b>{queued.length}</b></header><div className="dispensary-stack">{queued.length ? queued.map((order) => <DispensingCard key={order.id} order={order} onMark={mark} />) : <EmptyPlate compact scene="pharmacy" title="Queue is clear" hint="New hospital pickups will appear here." />}</div></section>
          <section className="dispensary-column ready-column"><header><span><PackageCheck size={17} /> Ready</span><b>{ready.length}</b></header><div className="dispensary-stack">{ready.length ? ready.map((order) => <DispensingCard key={order.id} order={order} onMark={mark} />) : <EmptyPlate compact scene="pharmacy" title="Nothing waiting for collection" />}</div></section>
          <section className="dispensary-column collected-column"><header><span><ShieldCheck size={17} /> Collected</span><b>{collected.length}</b></header><div className="dispensary-stack">{collected.length ? collected.slice(0, 8).map((order) => <DispensingCard key={order.id} order={order} onMark={mark} />) : <EmptyPlate compact scene="pharmacy" title="No collected orders yet" />}</div></section>
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
