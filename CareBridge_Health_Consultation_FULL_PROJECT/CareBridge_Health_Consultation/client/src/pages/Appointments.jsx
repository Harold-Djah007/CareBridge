import React, { useEffect, useState } from "react";
import { CalendarDays, Video, Clock, CheckCircle2, XCircle, Plus, Stethoscope } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../main";

export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doctorId:"d1", date:"2026-09-06", time:"09:00", reason:"", mode:"video" });

  const load = () => api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
  useEffect(()=>{ load(); api("/doctors").then(setDoctors); },[]);

  const submit = async e => {
    e.preventDefault();
    await api("/appointments",{method:"POST", body:JSON.stringify({...form, patientId:user.id})});
    setOpen(false); setForm({...form, reason:""}); load();
  };
  const update = async (id,status) => { await api(`/appointments/${id}`,{method:"PATCH",body:JSON.stringify({status})}); load(); };

  return <div>
    <div className="page-title">
      <div><span className="eyebrow">Appointments</span><h1>{user.role==="patient"?"Your consultations":"Consultation schedule"}</h1><p>{user.role==="patient"?"Book, review and join appointments with your doctors.":"Review patient bookings and manage consultation status."}</p></div>
      {user.role==="patient" && <button className="primary-btn" onClick={()=>setOpen(true)}><Plus size={18}/> Book appointment</button>}
    </div>

    <div className="list-card">
      {appointments.length===0 ? <div className="empty"><CalendarDays size={38}/><h3>No appointments yet</h3><p>Your appointments will appear here.</p></div> :
      appointments.map(a=><div className="appointment-row" key={a.id}>
        <div className="date-box"><span>{new Date(a.date+"T00:00").toLocaleDateString(undefined,{month:"short"})}</span><b>{new Date(a.date+"T00:00").getDate()}</b></div>
        <div className="avatar">{user.role==="doctor"?a.patient.avatar:a.doctor.avatar}</div>
        <div className="grow"><strong>{user.role==="doctor"?a.patient.name:a.doctor.name}</strong><span>{user.role==="doctor"?a.reason:a.doctor.specialty}</span><small><Clock size={14}/>{a.time} · {a.mode==="video"?"Video":"In person"}</small></div>
        <span className={`status ${a.status}`}>{a.status}</span>
        {user.role==="doctor" && <div className="row-actions">
          <button className="soft-icon success" title="Complete" onClick={()=>update(a.id,"completed")}><CheckCircle2 size={18}/></button>
          <button className="soft-icon danger" title="Cancel" onClick={()=>update(a.id,"cancelled")}><XCircle size={18}/></button>
        </div>}
      </div>)}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><form className="modal-card" onMouseDown={e=>e.stopPropagation()} onSubmit={submit}>
      <div className="modal-icon"><Stethoscope/></div><h2>Book a consultation</h2><p>Choose your doctor and a convenient consultation time.</p>
      <label>Doctor<select value={form.doctorId} onChange={e=>setForm({...form,doctorId:e.target.value})}>{doctors.map(d=><option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}</select></label>
      <div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Time<input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label></div>
      <label>Consultation type<select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}><option value="video">Video consultation</option><option value="in-person">In-person consultation</option></select></label>
      <label>Reason for visit<textarea rows="3" placeholder="Briefly describe what you need help with" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-btn">Confirm appointment</button></div>
    </form></div>}
  </div>;
}
