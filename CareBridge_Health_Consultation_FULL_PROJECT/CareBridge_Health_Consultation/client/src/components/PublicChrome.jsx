import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HeartPulse, Phone, MapPin, Clock, Menu, X, ShieldAlert, Mail } from "lucide-react";
import { HOSPITAL } from "../utils";

const CLINICAL = [
  { href: "/#services", label: "Clinical services" },
  { href: "/#consultants", label: "Find a doctor" },
  { to: "/tariff", label: "Tariff" },
  { href: "/#teleconsult", label: "Teleconsult" },
  { href: "/#admissions", label: "Admissions" },
  { href: "/#contact", label: "Contact" },
];

export function UtilBar({ tone = "dark" }) {
  const tel = (n) => `tel:${String(n).replace(/\s/g, "")}`;
  return (
    <div className={`util-bar util-${tone}`}>
      <div className="util-inner">
        <span className="util-place"><MapPin size={13} /> {HOSPITAL.address}</span>
        <span className="util-hours"><Clock size={13} /> Clinic {HOSPITAL.hours}</span>
        <a href={tel(HOSPITAL.phone)}><Phone size={13} /> Switchboard {HOSPITAL.phone}</a>
        <a className="util-emerg" href={tel(HOSPITAL.emergency)}><ShieldAlert size={13} /> Emergency {HOSPITAL.emergency}</a>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate, className = "" }) {
  return (
    <div className={`public-links ${className}`}>
      {CLINICAL.map((item) => (
        item.to
          ? <Link key={item.label} to={item.to} onClick={onNavigate}>{item.label}</Link>
          : <a key={item.label} href={item.href} onClick={onNavigate}>{item.label}</a>
      ))}
      <Link to="/login" onClick={onNavigate}>Patient portal</Link>
      <Link to="/login?role=doctor" onClick={onNavigate}>Clinician</Link>
      <Link to="/login?role=admin" onClick={onNavigate}>Operations</Link>
      <Link className="primary-btn nav-cta" to="/register" onClick={onNavigate}>Book a consultation</Link>
    </div>
  );
}

export function HospitalFooter() {
  return (
    <footer className="hospital-foot">
      <div className="foot-grid">
        <div className="foot-brand">
          <div className="brand">
            <div className="brand-mark live"><HeartPulse size={20} /></div>
            <div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div>
          </div>
          <p>Licensed private hospital. Outpatient, teleconsult, pharmacy, records, and admissions on one clinical file.</p>
        </div>
        <div>
          <h4>Clinical services</h4>
          <a href="/#teleconsult">Telemedicine</a>
          <a href="/#services">Outpatient clinic</a>
          <a href="/#services">Pharmacy</a>
          <a href="/#admissions">Admissions</a>
          <a href="/#services">Records office</a>
        </div>
        <div>
          <h4>For patients</h4>
          <Link to="/login">Patient portal</Link>
          <Link to="/register">Register / book</Link>
          <Link to="/tariff">Hospital tariff</Link>
          <Link to="/help">Help & contact</Link>
          <Link to="/privacy">Privacy & records</Link>
        </div>
        <div>
          <h4>Staff entry</h4>
          <Link to="/login?role=doctor">Clinician</Link>
          <Link to="/login?role=nurse">Nurse / pharmacy</Link>
          <Link to="/login?role=admin">Hospital operations</Link>
          <h4 className="foot-sub">Emergency</h4>
          <p><b>{HOSPITAL.emergency}</b><br />{HOSPITAL.emergencyHours} · Ridge casualty</p>
        </div>
        <div>
          <h4>Contact</h4>
          <p><MapPin size={14} /> {HOSPITAL.address}</p>
          <p><Phone size={14} /> {HOSPITAL.phone}</p>
          <p><Mail size={14} /> {HOSPITAL.email}</p>
          <p><Clock size={14} /> Visiting {HOSPITAL.visiting}</p>
        </div>
      </div>
      <div className="foot-legal">
        <span>© {new Date().getFullYear()} {HOSPITAL.name}. Ridge Campus, Accra.</span>
        <span>Access-controlled records · Not a substitute for 24-hour emergency services.</span>
      </div>
    </footer>
  );
}

export default function PublicChrome({ variant = "page", children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const home = variant === "home";
  const close = () => setOpen(false);

  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, location.pathname]);

  return (
    <div className={`hospital-site ${home ? "landing landing-home" : "landing hospital-page"}`}>
      <UtilBar tone={home ? "dark" : "teal"} />
      <header className={`public-nav hospital-nav ${home ? "nav-home" : "nav-page"} ${open ? "nav-open" : ""}`}>
        <Link to="/" className="brand" onClick={close}>
          <div className="brand-mark live"><HeartPulse size={22} /></div>
          <div>
            <b>{HOSPITAL.name}</b>
            <span>{HOSPITAL.campus}, {HOSPITAL.city}</span>
          </div>
        </Link>
        <button
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <NavLinks className={open ? "open" : ""} onNavigate={close} />
      </header>
      <div key={location.pathname} className="hospital-body">{children}</div>
      <HospitalFooter />
    </div>
  );
}
