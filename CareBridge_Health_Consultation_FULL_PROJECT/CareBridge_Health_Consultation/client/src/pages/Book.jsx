import React, { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Phone, Mail, Check } from "lucide-react";
import { CONSULTANTS, HOSPITAL, homeFor } from "../utils";
import { useAuth } from "../state";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

const STEPS = ["Patient details", "Appointment details", "Confirmation"];

export default function Book() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "General Medicine",
    doctorId: "",
    date: "",
    mode: "campus",
    reason: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const docs = useMemo(
    () => CONSULTANTS.filter((d) => !form.specialty || d.specialty === form.specialty),
    [form.specialty]
  );
  const chosen = CONSULTANTS.find((d) => d.id === form.doctorId);

  if (user?.role === "patient") return <Navigate to="/appointments" replace />;
  if (user) return <Navigate to={homeFor(user)} replace />;

  const next = (e) => {
    e.preventDefault();
    setStep((s) => Math.min(2, s + 1));
  };

  return (
    <PublicChrome>
      <PageBanner
        eyebrow="Book Appointment"
        title="Request a clinic or teleconsult slot"
        lead="New patients open a file first. Established patients sign in and book from Appointments."
        image="/imagery/clinic.jpg"
      />
      <div className="hospital-inner book-layout">
        <div>
          <ol className="stepper" aria-label="Booking steps">
            {STEPS.map((label, i) => (
              <li key={label} className={i === step ? "on" : i < step ? "done" : ""}>
                <em>{i + 1}</em>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <form className={`book-form step-${step}`} onSubmit={next}>
            {step === 0 && (
              <div className="step-pane">
                <h2>Patient details</h2>
                <label>Full name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
                <label>Email<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></label>
                <label>Phone<input value={form.phone} onChange={(e) => set("phone", e.target.value)} required /></label>
                <button className="primary-btn" type="submit">Continue <ArrowRight size={16} /></button>
              </div>
            )}
            {step === 1 && (
              <div className="step-pane">
                <h2>Appointment details</h2>
                <label>Specialty
                  <select value={form.specialty} onChange={(e) => set("specialty", e.target.value)}>
                    <option>General Medicine</option>
                    <option>Cardiology</option>
                    <option>Pediatrics</option>
                    <option>Orthopedics</option>
                  </select>
                </label>
                <label>Preferred consultant
                  <select value={form.doctorId} onChange={(e) => set("doctorId", e.target.value)}>
                    <option value="">First available</option>
                    {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <div className="form-grid">
                  <label>Preferred date<input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required /></label>
                  <label>Mode
                    <select value={form.mode} onChange={(e) => set("mode", e.target.value)}>
                      <option value="campus">Ridge Campus clinic</option>
                      <option value="video">Teleconsult</option>
                    </select>
                  </label>
                </div>
                <label>Reason for visit<textarea rows="3" value={form.reason} onChange={(e) => set("reason", e.target.value)} required /></label>
                <div className="row-actions">
                  <button type="button" className="secondary-btn" onClick={() => setStep(0)}>Back</button>
                  <button className="primary-btn" type="submit">Review <ArrowRight size={16} /></button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="step-pane">
                <h2>Confirmation</h2>
                <p className="muted">We will hold this intent until you open a patient file. Sign in if you already have an MRN, or register to finish the booking.</p>
                <ul className="confirm-list">
                  <li><b>Patient</b> {form.name} · {form.email} · {form.phone}</li>
                  <li><b>Visit</b> {form.specialty} · {form.mode === "video" ? "Teleconsult" : "Campus"} · {form.date || "date TBC"}</li>
                  <li><b>Consultant</b> {chosen?.name || "First available"}</li>
                  <li><b>Reason</b> {form.reason}</li>
                </ul>
                <div className="row-actions">
                  <button type="button" className="secondary-btn" onClick={() => setStep(1)}>Back</button>
                  <Link
                    className="primary-btn"
                    to={`/register?intent=${encodeURIComponent(JSON.stringify({ name: form.name, email: form.email, phone: form.phone }))}`}
                  >
                    Create a patient file
                  </Link>
                  <Link className="secondary-btn" to="/login">I already have an account</Link>
                </div>
              </div>
            )}
          </form>
        </div>
        <aside className="help-aside">
          <div className="help-photo" style={{ backgroundImage: "url(/imagery/clinic.jpg)" }} />
          <div className="help-copy">
            <h3>Need help?</h3>
            <p className="muted">The switchboard books clinic slots during clinic hours. For a life-threatening emergency call {HOSPITAL.emergency}.</p>
            <p><Phone size={16} /> {HOSPITAL.phone}</p>
            <p><Mail size={16} /> {HOSPITAL.email}</p>
            <p><Check size={16} /> Clinic {HOSPITAL.hours}</p>
          </div>
        </aside>
      </div>
    </PublicChrome>
  );
}
