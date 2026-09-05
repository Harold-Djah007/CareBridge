import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { HeartPulse, Phone, MapPin, Clock, Menu, X, ShieldAlert, Mail } from "lucide-react";
import { HOSPITAL, homeFor } from "../utils";
import { PUBLIC_NAV } from "../publicContent";
import { useAuth } from "../state";

export function UtilBar({ tone = "navy" }) {
  const tel = (n) => `tel:${String(n).replace(/\s/g, "")}`;
  return (
    <div className={`util-bar util-${tone}`}>
      <div className="util-inner">
        <span className="util-place"><MapPin size={13} /> {HOSPITAL.address}</span>
        <a href={tel(HOSPITAL.phone)}><Phone size={13} /> {HOSPITAL.phone}</a>
        <a href={`mailto:${HOSPITAL.email}`}><Mail size={13} /> {HOSPITAL.email}</a>
        <span className="util-hours"><Clock size={13} /> {HOSPITAL.hours}</span>
        <a className="util-emerg" href={tel(HOSPITAL.emergency)}><ShieldAlert size={13} /> Emergency {HOSPITAL.emergency}</a>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate, className = "" }) {
  const { user } = useAuth();
  return (
    <div className={`public-links ${className}`}>
      {PUBLIC_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => isActive ? "on" : ""}
        >
          {item.label}
        </NavLink>
      ))}
      {user
        ? <Link to={homeFor(user)} onClick={onNavigate}>My portal</Link>
        : <Link to="/login" onClick={onNavigate}>Patient portal</Link>}
      <Link className="primary-btn nav-cta" to={user?.role === "patient" ? "/appointments" : "/book"} onClick={onNavigate}>
        Book Appointment
      </Link>
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
          <p>A private hospital in Ridge, Accra. We sit with you through clinic, pharmacy, and a stay if you need one.</p>
        </div>
        <div>
          <h4>Quick links</h4>
          <Link to="/">Home</Link>
          <Link to="/about">About Us</Link>
          <Link to="/services">Our Services</Link>
          <Link to="/doctors">Find a Doctor</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div>
          <h4>Patient care</h4>
          <Link to="/patients">For patients</Link>
          <Link to="/login">Patient portal</Link>
          <Link to="/book">Book Appointment</Link>
          <Link to="/tariff">Hospital tariff</Link>
          <Link to="/help">Health information</Link>
          <Link to="/privacy">Privacy & records</Link>
        </div>
        <div>
          <h4>Contact us</h4>
          <p><MapPin size={14} /> {HOSPITAL.address}</p>
          <p><Phone size={14} /> {HOSPITAL.phone}</p>
          <p><Mail size={14} /> {HOSPITAL.email}</p>
          <p><ShieldAlert size={14} /> Emergency {HOSPITAL.emergency}</p>
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

export function PageBanner({ eyebrow, title, lead, image = "/imagery/hero-campus.jpg", actions }) {
  return (
    <section className="page-banner">
      <div className="page-banner-photo" style={{ backgroundImage: `url(${image})` }} aria-hidden="true" />
      <div className="page-banner-shade" aria-hidden="true" />
      <div className="page-banner-copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
        {actions && <div className="hero-actions">{actions}</div>}
      </div>
    </section>
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
      <UtilBar tone="navy" />
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
