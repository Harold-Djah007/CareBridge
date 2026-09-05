import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import { HOSPITAL } from "../utils";
import { HERO_SLIDES, QUICK_ACTIONS, SERVICES, NEWS } from "../publicContent";
import { EcgRibbon } from "../components/LiveMeter";
import { CountStat, HeroCarousel, Reveal, SoftOrbs } from "../components/LiveFX";
import PublicChrome from "../components/PublicChrome";

export default function Landing() {
  return (
    <PublicChrome variant="home">
      <section className="hero hero-home">
        <HeroCarousel slides={HERO_SLIDES} />
        <SoftOrbs />
        <div className="hero-copy">
          <div className="hero-card">
            <span className="eyebrow">{HOSPITAL.campus} · Licensed private hospital</span>
            <h1>Private hospital care on one clinical record.</h1>
            <p className="lead">
              Outpatient clinic, teleconsult, pharmacy, and admissions at {HOSPITAL.name}, {HOSPITAL.city}.
              Book a visit, then sign in to the patient portal for your file, invoices, and receipts.
            </p>
            <div className="hero-actions">
              <Link className="primary-btn cta-pulse" to="/book">Book Appointment <ArrowRight size={18} /></Link>
              <Link className="secondary-btn" to="/doctors">Find a doctor</Link>
            </div>
            <p className="muted hero-phone"><Phone size={16} /> Switchboard {HOSPITAL.phone} · Emergency {HOSPITAL.emergency}</p>
          </div>
        </div>
        <div className="hero-ecg" aria-hidden="true"><EcgRibbon /></div>
      </section>

      <section className="quick-band" aria-label="Quick actions">
        {QUICK_ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="quick-card" to={item.to} key={item.to}>
              <span className="icon-circle"><Icon size={22} /></span>
              <b>{item.title}</b>
              <small>{item.copy}</small>
            </Link>
          );
        })}
      </section>

      <section className="trust-band" aria-label="Hospital figures">
        <CountStat value={4} label="Consultants on staff" />
        <CountStat value={44} label="Ward beds on campus" />
        <CountStat value={8} label="Clinical services" />
        <CountStat value={24} suffix="/7" label="Emergency line" />
      </section>

      <section id="services" className="service-block light-block">
        <div className="section-head">
          <span className="eyebrow">Our services</span>
          <h2>How Ridge Campus looks after you</h2>
          <p className="muted">Each service has a desk on campus and a path in the patient portal. Fees sit on the public tariff before you book.</p>
        </div>
        <div className="icon-service-grid">
          {SERVICES.slice(0, 6).map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal as="article" className="icon-service" delay={i * 70} key={item.id}>
                <span className="icon-circle"><Icon size={26} /></span>
                <h3>{item.title}</h3>
                <p className="muted">{item.copy}</p>
                <Link to={item.to}>Learn more <ArrowRight size={16} /></Link>
              </Reveal>
            );
          })}
        </div>
        <div className="section-actions">
          <Link className="primary-btn" to="/services">All services <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="split-feature">
        <div className="split-photo" style={{ backgroundImage: "url(/imagery/hero-campus.jpg)" }} />
        <div className="split-copy navy-panel">
          <span className="eyebrow">Ridge Campus</span>
          <h2>A brighter future for scheduled care in Accra.</h2>
          <p>CareBridge Medical Centre keeps outpatient, teleconsult, pharmacy, and admissions on one clinical file — so the next clinician is not starting from a blank page.</p>
          <Link className="primary-btn" to="/about">About the hospital</Link>
        </div>
      </section>

      <section className="news-block light-block">
        <div className="section-head">
          <span className="eyebrow">News &amp; notices</span>
          <h2>From the Ridge campus</h2>
        </div>
        <div className="news-grid">
          {NEWS.map((item, i) => (
            <Reveal as={Link} className="news-card" delay={i * 70} key={item.id} to={item.to}>
              <div className="news-thumb" style={{ backgroundImage: `url(${item.image})` }} />
              <div className="news-copy">
                <small>{item.date}</small>
                <h3>{item.title}</h3>
                <p className="muted">{item.copy}</p>
                <span>Read more <ArrowRight size={14} /></span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}
