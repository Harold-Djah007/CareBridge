import React, { useEffect, useState } from "react";
import { BedDouble, Plus, Users, CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../main";

export default function WardBooking(){
  const {user}=useAuth();
  const [wards,setWards]=useState([]);
  const [bookings,setBookings]=useState([]);
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({ward:"General Ward",roomType:"Private Room",date:"2026-09-08",nights:1,notes:""});
  const load=()=>api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then(setBookings);
  useEffect(()=>{api("/wards").then(setWards);load()},[]);
  const submit=async e=>{e.preventDefault();await api("/ward-bookings",{method:"POST",body:JSON.stringify({...form,patientId:user.id})});setOpen(false);load()};
  const update=async(id,status)=>{await api(`/ward-bookings/${id}`,{method:"PATCH",body:JSON.stringify({status})});load()};

  return <div>
    <div className="page-title"><div><span className="eyebrow">Admission planning</span><h1>{user.role==="patient"?"Reserve a ward":"Ward booking requests"}</h1><p>{user.role==="patient"?"Arrange a bed before arriving at the hospital.":"Review and manage incoming patient admission requests."}</p></div>{user.role==="patient"&&<button className="primary-btn" onClick={()=>setOpen(true)}><Plus size={18}/> Reserve a ward</button>}</div>
    {user.role==="patient" && <div className="ward-grid">{wards.map(w=><div className="ward-card" key={w.id}><div className="ward-icon"><BedDouble/></div><div><h3>{w.name}</h3><p>{w.description}</p></div><div className="ward-foot"><span><Users size={16}/>{w.available} beds currently available</span><button onClick={()=>{setForm({...form,ward:w.name});setOpen(true)}}>Choose ward</button></div></div>)}</div>}
    <section className="card top-gap"><div className="card-head"><div><span className="eyebrow">{user.role==="patient"?"Your reservations":"Requests"}</span><h3>{bookings.length} booking{bookings.length===1?"":"s"}</h3></div></div>
      {bookings.map(b=><div className="appointment-row" key={b.id}><div className="date-box"><CalendarDays size={19}/></div><div className="grow"><strong>{user.role==="doctor"?b.patient.name:b.ward}</strong><span>{user.role==="doctor"?`${b.ward} · ${b.roomType}`:b.roomType}</span><small>{b.date} · {b.nights} night{b.nights>1?"s":""}</small></div><span className={`status ${b.status}`}>{b.status}</span>{user.role==="doctor"&&<div className="row-actions"><button className="soft-icon success" onClick={()=>update(b.id,"confirmed")}><CheckCircle2 size={18}/></button><button className="soft-icon danger" onClick={()=>update(b.id,"declined")}><XCircle size={18}/></button></div>}</div>)}
    </section>
    {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><form className="modal-card" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><div className="modal-icon"><BedDouble/></div><h2>Reserve a hospital ward</h2><p>Send your admission request before you arrive.</p><label>Ward<select value={form.ward} onChange={e=>setForm({...form,ward:e.target.value})}>{wards.map(w=><option key={w.id}>{w.name}</option>)}</select></label><label>Room type<select value={form.roomType} onChange={e=>setForm({...form,roomType:e.target.value})}><option>Shared Room</option><option>Private Room</option><option>Premium Private Room</option></select></label><div className="form-grid"><label>Admission date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Nights<input type="number" min="1" max="30" value={form.nights} onChange={e=>setForm({...form,nights:e.target.value})}/></label></div><label>Notes<textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Anything the hospital should prepare for?"/></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-btn">Send reservation</button></div></form></div>}
  </div>
}
