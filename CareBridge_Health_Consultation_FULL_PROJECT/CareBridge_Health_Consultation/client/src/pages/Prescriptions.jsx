import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, Hospital, PackageCheck, Pill, Printer, ShieldCheck, ShoppingBag } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../state";
import { formatDate } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";
import PageHero, { EmptyPlate } from "../components/PageHero";

export default function Prescriptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api(`/prescriptions?userId=${user.id}&role=${user.role}`).then(setRows).catch(() => {});
  }, [user.id, user.role]);

  const active = useMemo(() => rows.filter((rx) => rx.status === "active"), [rows]);
  const refill = useMemo(() => rows.filter((rx) => rx.refillRequested), [rows]);
  const isPatient = user.role === "patient";

  return (
    <div className="prescription-workspace">
      <PageHero
        scene="pharmacy"
        eyebrow={user.role === "doctor" ? "Medication management" : "My medicines"}
        title="Prescriptions"
        lead={user.role === "doctor" ? "Review prescriptions you have issued and how patients can fulfil them through CareBridge or Ridge pharmacy." : "See what was prescribed, print a copy, buy medicines online or arrange hospital collection."}
        actions={isPatient ? <Link className="primary-btn" to="/pay?tab=pharmacy"><ShoppingBag size={15} /> Open pharmacy</Link> : null}
      />

      <div className="product-metric-grid prescription-metrics">
        <div className="product-metric-card"><span className="metric-icon tone-violet"><Pill size={18} /></span><div className="metric-copy"><small>Active</small><strong>{active.length}</strong><span>Current prescriptions</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-blue"><FileText size={18} /></span><div className="metric-copy"><small>Total issued</small><strong>{rows.length}</strong><span>On this account</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-amber"><PackageCheck size={18} /></span><div className="metric-copy"><small>Refill requests</small><strong>{refill.length}</strong><span>{isPatient ? "Requested" : "Needs review"}</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-green"><ShieldCheck size={18} /></span><div className="metric-copy"><small>Fulfilment</small><strong>Connected</strong><span>Shop or Ridge pickup</span></div></div>
      </div>

      <section className="product-imagery-strip prescription-visual" style={{ backgroundImage: `url(${IMAGERY.pharmacy})` }}>
        <div><span className="eyebrow">Ridge Campus pharmacy</span><h3>{isPatient ? "From prescription to pickup or payment" : "Medication orders connected to dispensing"}</h3><p>{isPatient ? "CareBridge can move a prescription into Shop & pay, keep medicine quantities together and support hospital collection." : "Patients can print prescriptions, purchase available medicines, or send them to the hospital dispensary."}</p></div>
      </section>

      <section className="product-section prescription-list-section">
        <div className="product-section-head"><div><span className="eyebrow">Medication orders</span><h2>{rows.length} prescription{rows.length === 1 ? "" : "s"}</h2></div><span className="section-hint">Newest orders remain linked to patient and clinician identity</span></div>
        <div className="prescription-product-list">
          {rows.length === 0 && <EmptyPlate scene="pharmacy" icon={Pill} title="No prescriptions yet" hint={user.role === "doctor" ? "Issue one from Messages, the video room, or a chart." : "When a doctor writes a prescription it will appear here."} />}
          {rows.map((rx) => (
            <article className={`prescription-product-card ${rx.status}`} key={rx.id}>
              <div className="prescription-card-head">
                <span className="prescription-card-icon"><Pill size={18} /></span>
                <div className="grow"><span className="eyebrow">{formatDate(rx.date)} · {rx.pharmacy}</span><h3>{rx.drug}</h3><div className="prescription-person">{isPatient ? <><Avatar person={rx.doctor} className="small" /><span>{rx.doctor?.name || "Clinician"}</span></> : <><Avatar person={rx.patient} className="small" /><span>{rx.patient?.name || "Patient"}</span></>}</div></div>
                <span className={`status ${rx.status}`}>{rx.status}</span>
              </div>
              <div className="prescription-lines">{(rx.items || []).map((line, index) => <div key={index}><span><b>{line.drug}</b><small>{line.sig || "As directed"}</small></span><strong>{line.qty}</strong></div>)}</div>
              {rx.notes && <div className="prescription-note"><FileText size={14} /><span>{rx.notes}</span></div>}
              <div className="prescription-card-foot">
                <span className="prescription-source"><CalendarDays size={14} /> {rx.source || "chart"}</span>
                <div className="prescription-actions"><Link className="secondary-btn" to={`/prescriptions/${rx.id}`}><Printer size={15} /> Print / save</Link>{isPatient && <><Link className="primary-btn" to={`/pay?rx=${rx.id}`}><ShoppingBag size={15} /> Buy on CareBridge</Link><Link className="ghost-btn" to={`/pay?rx=${rx.id}&fulfill=hospital`}><Hospital size={15} /> Collect at hospital</Link></>}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {user.role === "doctor" && <div className="ops-footer-assurance"><ShieldCheck size={15} /><span>Issue new prescriptions from a patient chart, secure message or teleconsultation so the order remains connected to clinical context.</span></div>}
    </div>
  );
}
