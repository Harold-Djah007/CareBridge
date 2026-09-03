import React, { useEffect, useState } from "react";
import { CalendarDays, MessageCircle, BedDouble, Clock3, Video, ArrowRight, Activity, UsersRound, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../main";
import { api } from "../api";
import StatCard from "../components/StatCard";
import { firstName, formatDate, formatTime, isUpcoming } from "../utils";

export default function Dashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [wards, setWards] = useState([]);
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setWards);
    if (user.role === "patient") api(`/emails/${user.id}`).then(setEmails);
  }, [user]);

  const next = appointments.find(isUpcoming);
  const pendingWards = wards.filter((w) => w.status === "pending").length;

  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">{user.role === "doctor" ? "Clinical workspace" : "Your health at a glance"}</span>
          <h1>{user.role === "doctor" ? `Good day, ${user.name.replace("Dr. ", "").split(" ")[0]}` : `Hello, ${firstName(user.name)}`}</h1>
          <p>{user.role === "doctor" ? "Review consultations, accept ward requests, and keep patients informed." : "Book care, join video visits, and get email alerts when anything is confirmed."}</p>
        </div>
        <div className="welcome-art">
          <svg viewBox="0 0 160 90" aria-hidden="true"><path d="M8 50h28l8-20 15 45 16-55 12 30h22l8-14 10 14h25" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
        </div>
      </section>

      <div className="stats-grid">
        <StatCard icon={CalendarDays} label={user.role === "doctor" ? "Appointments" : "Upcoming visits"} value={appointments.filter(isUpcoming).length} hint="On your schedule" />
        <StatCard icon={MessageCircle} label="Care chat" value="Live" hint="Instant messaging" />
        <StatCard icon={user.role === "doctor" ? UsersRound : BedDouble} label={user.role === "doctor" ? "Patients" : "Ward bookings"} value={user.role === "doctor" ? new Set(appointments.map((a) => a.patientId)).size : wards.length} hint={user.role === "doctor" ? "On your list" : `${pendingWards} pending`} />
        <StatCard icon={user.role === "patient" ? Mail : Activity} label={user.role === "patient" ? "Email alerts" : "Care status"} value={user.role === "patient" ? emails.length : "Ready"} hint={user.role === "patient" ? "Sent to your inbox" : "Services available"} />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Next consultation</span><h3>{next ? `${formatDate(next.date)} · ${formatTime(next.time)}` : "Nothing scheduled"}</h3></div><Clock3 size={20} /></div>
          {next ? (
            <div className="appointment-feature">
              <div className="avatar large">{user.role === "doctor" ? next.patient.avatar : next.doctor.avatar}</div>
              <div className="grow">
                <strong>{user.role === "doctor" ? next.patient.name : next.doctor.name}</strong>
                <span className="muted">{user.role === "doctor" ? next.reason : next.doctor.specialty}</span>
                <small className="muted">{next.mode === "video" ? "Video consultation" : "In-person consultation"}</small>
              </div>
              <div className="row-actions">
                <Link className="secondary-btn" to={`/messages?with=${user.role === "doctor" ? next.patientId : next.doctorId}`}>Message</Link>
                {next.mode === "video" && <Link className="primary-btn" to={`/video?with=${user.role === "doctor" ? next.patientId : next.doctorId}`}><Video size={17} /> Join visit</Link>}
              </div>
            </div>
          ) : <p className="muted">No upcoming consultations yet.</p>}
        </section>

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Quick actions</span><h3>What would you like to do?</h3></div></div>
          <div className="quick-actions">
            <Link to="/appointments"><CalendarDays /><span><b>{user.role === "patient" ? "Book consultation" : "Manage appointments"}</b><small>Schedule and review visits</small></span><ArrowRight size={18} /></Link>
            <Link to="/messages"><MessageCircle /><span><b>Open messages</b><small>Chat securely with care contacts</small></span><ArrowRight size={18} /></Link>
            <Link to="/wards"><BedDouble /><span><b>{user.role === "patient" ? "Reserve a ward" : "Review ward bookings"}</b><small>{user.role === "patient" ? "Plan admission before you arrive" : "Accept or decline requests"}</small></span><ArrowRight size={18} /></Link>
            {user.role === "patient" && <Link to="/alerts"><Mail /><span><b>Email alerts</b><small>See scheduled-visit and ward emails</small></span><ArrowRight size={18} /></Link>}
          </div>
        </section>
      </div>
    </>
  );
}
