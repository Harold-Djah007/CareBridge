import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, Hospital, PackageCheck, Pill, Printer, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../state";
import { formatDate } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";

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
    <div className="px-page px-prescriptions">
      <section className="px-med-hero">
        <div className="px-med-copy"><span className="px-kicker"><Sparkles size={14} /> {user.role === "doctor" ? "Medication management" : "My medicines"}</span><h1>{isPatient ? "From prescription to medicine, without the paper chase." : "Medication orders that stay connected to care."}</h1><p>{isPatient ? "Review what was prescribed, understand how to take it, print a copy or move it straight into pharmacy fulfilment." : "See issued prescriptions, refill requests and fulfilment pathways in one medication workspace."}</p>{isPatient && <Link className="px-primary" to="/pay?tab=pharmacy"><ShoppingBag size={16} /> Open pharmacy</Link>}</div>
        <div className="px-med-photo" style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(6,22,29,.55)),url(${IMAGERY.pharmacy})` }}><div><span>Active prescriptions</span><strong>{active.length}</strong><small>{refill.length} refill request{refill.length === 1 ? "" : "s"}</small></div></div>
      </section>

      <section className="px-signal-grid">
        <article><span><Pill size={17} /></span><div><small>Active</small><strong>{active.length}</strong></div></article>
        <article><span><FileText size={17} /></span><div><small>Total issued</small><strong>{rows.length}</strong></div></article>
        <article><span><PackageCheck size={17} /></span><div><small>Refill requests</small><strong>{refill.length}</strong></div></article>
        <article><span><ShieldCheck size={17} /></span><div><small>Fulfilment</small><strong>Live</strong></div></article>
      </section>

      <section className="px-med-ledger">
        <header className="px-board-head"><div><span className="px-kicker">Medication orders</span><h2>{rows.length} prescription{rows.length === 1 ? "" : "s"}</h2></div><span className="px-board-note">Newest orders first</span></header>
        <div className="px-med-list">
          {rows.length === 0 && <div className="px-empty"><Pill size={28} /><h3>No prescriptions yet</h3><p>{user.role === "doctor" ? "Issue one from Messages, Video, or a patient chart." : "When a clinician writes a prescription it will appear here."}</p></div>}
          {rows.map((rx) => <article className={`px-med-card ${rx.status}`} key={rx.id}>
            <div className="px-med-card-head"><span className="px-med-icon"><Pill size={19} /></span><div className="grow"><span className="px-kicker">{formatDate(rx.date)} · {rx.pharmacy}</span><h3>{rx.drug}</h3><div className="px-med-person">{isPatient ? <><Avatar person={rx.doctor} className="small" /><span>{rx.doctor?.name || "Clinician"}</span></> : <><Avatar person={rx.patient} className="small" /><span>{rx.patient?.name || "Patient"}</span></>}</div></div><span className={`status ${rx.status}`}>{rx.status}</span></div>
            <div className="px-med-lines">{(rx.items || []).map((line, index) => <div key={index}><span><strong>{line.drug}</strong><small>{line.sig || "As directed"}</small></span><b>{line.qty}</b></div>)}</div>
            {rx.notes && <div className="px-med-note"><FileText size={14} /><span>{rx.notes}</span></div>}
            <footer><span><CalendarDays size={14} /> {rx.source || "chart"}</span><div><Link to={`/prescriptions/${rx.id}`}><Printer size={15} /> Print</Link>{isPatient && <><Link className="strong" to={`/pay?rx=${rx.id}`}><ShoppingBag size={15} /> Buy</Link><Link to={`/pay?rx=${rx.id}&fulfill=hospital`}><Hospital size={15} /> Hospital pickup</Link></>}</div></footer>
          </article>)}
        </div>
      </section>

      <div className="px-med-assurance"><ShieldCheck size={16} /><span>{isPatient ? "Medication orders remain linked to the prescribing clinician and your CareBridge record." : "Issue prescriptions from the patient chart, secure message or teleconsultation so clinical context remains attached."}</span></div>
    </div>
  );
}
