import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { SERVICES, WHY_RIDGE } from "../publicContent";
import { Reveal } from "../components/LiveFX";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

export default function Services() {
  return (
    <PublicChrome>
      <PageBanner
        eyebrow="Our Services"
        title="Clinical services at Ridge Campus"
        lead="Telemedicine, outpatient clinic, pharmacy, admissions, records, and specialty lists — each with a desk on campus and a path in the patient portal."
        image="/imagery/clinic.jpg"
        actions={<Link className="primary-btn" to="/book">Book Appointment</Link>}
      />
      <div className="hospital-inner">
        <div className="photo-service-grid">
          {SERVICES.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal as="article" className="photo-service" delay={i * 60} key={item.id} id={item.id}>
                <div className="service-photo" style={{ backgroundImage: `url(${item.image})` }} />
                <div className="service-copy">
                  <span className="icon-circle sm"><Icon size={18} /></span>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.copy}</p>
                  <Link to={item.to}>Continue <ArrowRight size={16} /></Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
      <section className="why-block">
        <div className="section-head">
          <span className="eyebrow">Why Ridge</span>
          <h2>Why choose CareBridge?</h2>
        </div>
        <div className="why-grid">
          {WHY_RIDGE.map((item, i) => (
            <Reveal className="why-card" delay={i * 70} key={item.title}>
              <span className="icon-circle"><Check size={22} /></span>
              <h3>{item.title}</h3>
              <p className="muted">{item.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}
