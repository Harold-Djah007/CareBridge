import React, { useEffect, useState } from "react";
import { CalendarDays, MessageCircle, BedDouble, Clock3, Video, ArrowRight, Activity, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../main";
import { api } from "../api";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [wards, setWards] = useState([]);
  useEffect(() => {
    api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setWards);
  }, [user]);

  const next = appointments.find(a => a.status !== "cancelled");
  return <>
    <section className="welcome">
      <div>
        <span className="eyebrow">{user.role === "doctor" ? "Clinical workspace" : "Your health at a glance"}</span>
        <h1>{user.role === "doctor" ? `Good day, ${user.name.split(" ")[1] || user.name}` : `Hello, ${user.name.split(" ")[0]}`}</h1>
        <p>{user.role === "doctor" ? "Review today's consultations and stay connected to your patients." : "Book care, prepare for appointments, and keep your care team close."}</p>
      </div>
      <div className="welcome-art"><HeartLine/></div>
    </section>

    <div className="stats-grid">
      <StatCard icon={CalendarDays} label={user.role==="doctor"?"Appointments":"Upcoming visits"} value={appointments.length} hint="Scheduled consultations"/>
      <StatCard icon={MessageCircle} label="Care chat" value="Live" hint="Real-time messaging"/>
      <StatCard icon={user.role==="doctor"?UsersRound:BedDouble} label={user.role==="doctor"?"Active patients":"Ward bookings"} value={user.role==="doctor" ? new Set(appointments.map(a=>a.patientId)).size : wards.length} hint={user.role==="doctor"?"Patients on your schedule":"Admission planning"}/>
      <StatCard icon={Activity} label="Care status" value="Ready" hint="Services available"/>
    </div>

    <div className="dashboard-grid">
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Next consultation</span><h3>{next ? `${next.date} · ${next.time}` : "Nothing scheduled"}</h3></div><Clock3 size={20}/></div>
        {next ? <div className="appointment-feature">
          <div className="avatar large-avatar">{user.role==="doctor" ? next.patient.avatar : next.doctor.avatar}</div>
          <div className="grow"><strong>{user.role==="doctor" ? next.patient.name : next.doctor.name}</strong><span>{user.role==="doctor" ? next.reason : next.doctor.specialty}</span><small>{next.mode === "video" ? "Video consultation" : "In-person consultation"}</small></div>
          <Link className="primary-btn" to="/video"><Video size={17}/> Join visit</Link>
        </div> : <p className="muted">No upcoming consultations yet.</p>}
      </section>

      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Quick actions</span><h3>What would you like to do?</h3></div></div>
        <div className="quick-actions">
          <Link to="/appointments"><CalendarDays/><span><b>{user.role==="patient"?"Book consultation":"Manage appointments"}</b><small>Schedule and review visits</small></span><ArrowRight size={18}/></Link>
          <Link to="/messages"><MessageCircle/><span><b>Open messages</b><small>Chat securely with care contacts</small></span><ArrowRight size={18}/></Link>
          <Link to="/wards"><BedDouble/><span><b>{user.role==="patient"?"Reserve a ward":"Review ward bookings"}</b><small>{user.role==="patient"?"Plan your admission":"Manage incoming patients"}</small></span><ArrowRight size={18}/></Link>
        </div>
      </section>
    </div>
  </>;
}
function HeartLine(){ return <svg viewBox="0 0 160 90" aria-hidden="true"><path d="M8 50h28l8-20 15 45 16-55 12 30h22l8-14 10 14h25" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
