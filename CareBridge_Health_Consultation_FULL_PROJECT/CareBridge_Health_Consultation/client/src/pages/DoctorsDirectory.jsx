import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../api";
import { CONSULTANTS, HOSPITAL } from "../utils";
import { Reveal } from "../components/LiveFX";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

const seed = CONSULTANTS.map((d) => ({
  ...d,
  available: true,
  department: d.specialty,
}));

export default function DoctorsDirectory() {
  const [doctors, setDoctors] = useState(seed);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    api("/doctors")
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) setDoctors(rows);
      })
      .catch(() => {});
  }, []);

  const specialties = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialty || d.department).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [doctors]);

  const visible = doctors.filter((d) => {
    const spec = d.specialty || d.department || "";
    const hay = `${d.name} ${spec}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (specialty !== "all" && spec !== specialty) return false;
    if (status === "available" && d.available === false) return false;
    if (status === "busy" && d.available !== false) return false;
    return true;
  });

  return (
    <PublicChrome>
      <PageBanner
        eyebrow="Find a Doctor"
        title="Consultants at Ridge Campus"
        lead="A public directory of CareBridge consultants. Booking still requires a patient file — sign in or register to confirm a slot."
        image="/imagery/clinic.jpg"
      />
      <div className="doctor-filter">
        <label className="doctor-search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or specialty" />
        </label>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Specialty">
          {specialties.map((s) => <option key={s} value={s}>{s === "all" ? "All specialties" : s}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">Any status</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
        </select>
      </div>
      <div className="hospital-inner">
        <div className="doctor-grid">
          {visible.map((doc, i) => (
            <Reveal as="article" className="doctor-card" delay={i * 60} key={doc.id}>
              <img src={doc.photo || `/portraits/${doc.id}.jpg`} alt="" width="280" height="280" />
              <div>
                <h3>{doc.name}</h3>
                <span className="eyebrow">{doc.specialty || doc.department}</span>
                <p className="muted">{doc.about || doc.clinic || HOSPITAL.campus}</p>
                <small className={`duty-flag ${doc.available === false ? "busy" : "open"}`}>
                  {doc.available === false ? "Busy" : "Available"}
                </small>
                <Link className="primary-btn" to="/login">View profile / book</Link>
              </div>
            </Reveal>
          ))}
        </div>
        {visible.length === 0 && <p className="muted">No consultants match those filters.</p>}
        <div className="section-actions">
          <Link className="primary-btn" to="/register">Register to book</Link>
          <Link className="secondary-btn" to="/login">Patient portal</Link>
        </div>
      </div>
    </PublicChrome>
  );
}
