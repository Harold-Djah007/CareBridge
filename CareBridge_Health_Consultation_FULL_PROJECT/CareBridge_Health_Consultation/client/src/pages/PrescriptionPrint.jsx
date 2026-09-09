import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileCheck2, Hospital, Pill, Printer, ShieldCheck, ShoppingBag } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL, formatDate } from "../utils";
import PageHero from "../components/PageHero";

export default function PrescriptionPrint() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const [rx, setRx] = useState(null);

  useEffect(() => { api(`/prescriptions/${id}`).then(setRx).catch((error) => push(error.message, "error")); }, [id]);

  if (!rx) return <div className="product-loading"><Pill className="spin-soft" size={20} /><span>Preparing prescription…</span></div>;

  const items = rx.items || [];
  const printRx = () => window.print();

  return (
    <div className="rx-document-workspace">
      <PageHero
        className="no-print"
        scene="pharmacy"
        eyebrow="Medication document"
        title="Prescription document"
        lead="A hospital prescription linked to the CareBridge patient record, prescriber identity and fulfilment workflow."
        actions={<div className="row-actions"><Link className="ghost-btn" to="/prescriptions"><ArrowLeft size={16} /> Prescriptions</Link><button type="button" className="secondary-btn" onClick={printRx}><Printer size={16} /> Print / save PDF</button>{user.role === "patient" && <Link className="primary-btn" to={`/pay?rx=${rx.id}`}><ShoppingBag size={16} /> Fulfil prescription</Link>}</div>}
      />

      <div className="rx-document-layout">
        <article className="rx-document-sheet">
          <header className="rx-document-head">
            <div><span className="rx-hospital-mark"><FileCheck2 size={20} /></span><div><strong>{HOSPITAL.name}</strong><small>{HOSPITAL.campus}, {HOSPITAL.city}</small><small>{HOSPITAL.phone}</small></div></div>
            <div className="rx-document-id"><span>Prescription</span><b>{rx.id.toUpperCase()}</b><small>{formatDate(rx.date)}</small></div>
          </header>

          <section className="rx-document-patient">
            <div><span>Patient</span><strong>{rx.patient?.name || "—"}</strong><small>{rx.patient?.mrn ? `MRN ${rx.patient.mrn}` : "Medical record number pending"}</small></div>
            <div><span>Prescriber</span><strong>{rx.doctor?.name || "—"}</strong><small>{rx.doctor?.specialty || "Consultant"}</small></div>
            <div><span>Dispense</span><strong>{rx.pharmacy || "Ridge Campus pharmacy"}</strong><small>{rx.refills || 0} refill{Number(rx.refills || 0) === 1 ? "" : "s"} remaining</small></div>
          </section>

          <section className="rx-document-order">
            <div className="rx-watermark">℞</div>
            <div className="rx-order-head"><span>Medication order</span><small>{items.length} item{items.length === 1 ? "" : "s"}</small></div>
            {items.map((line, index) => (
              <div className="rx-order-line" key={`${line.drug}-${index}`}><span className="rx-order-index">{String(index + 1).padStart(2, "0")}</span><div className="grow"><strong>{line.drug}</strong><p>{line.sig || "Take as directed by your clinician."}</p></div><div className="rx-order-qty"><span>Qty</span><b>{line.qty}</b></div></div>
            ))}
          </section>

          {rx.notes && <section className="rx-document-notes"><span>Clinical notes</span><p>{rx.notes}</p></section>}

          <footer className="rx-document-signatures"><div><i /><span>Prescriber signature</span><small>{rx.doctor?.name || "Authorised prescriber"}</small></div><div><i /><span>Pharmacy verification</span><small>{rx.pharmacy || "Dispensing pharmacy"}</small></div></footer>
        </article>

        <aside className="rx-document-actions no-print">
          <div className="rx-document-status"><span className="rx-status-icon"><ShieldCheck size={18} /></span><div><span className="eyebrow">Record linked</span><h3>Protected medication order</h3><p>This document stays connected to the authenticated patient and clinician record inside CareBridge.</p></div></div>
          <div className="rx-document-facts"><div><span>Status</span><b>{rx.status || "active"}</b></div><div><span>Source</span><b>{rx.source || "clinical record"}</b></div><div><span>Issued</span><b>{formatDate(rx.date)}</b></div><div><span>Refills</span><b>{rx.refills || 0}</b></div></div>
          {user.role === "patient" && <div className="rx-fulfilment-panel"><span className="eyebrow">Fulfilment</span><h3>Choose how to receive your medicines</h3><Link className="primary-btn full" to={`/pay?rx=${rx.id}`}><ShoppingBag size={16} /> Buy on CareBridge</Link><Link className="secondary-btn full" to={`/pay?rx=${rx.id}&fulfill=hospital`}><Hospital size={16} /> Collect at hospital</Link></div>}
          <button type="button" className="secondary-btn full" onClick={printRx}><Printer size={16} /> Print or save document</button>
        </aside>
      </div>
    </div>
  );
}
