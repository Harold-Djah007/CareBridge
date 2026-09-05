import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer, ShoppingBag, Hospital, ArrowLeft } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL, formatDate } from "../utils";
import PageHero from "../components/PageHero";

export default function PrescriptionPrint() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const [rx, setRx] = useState(null);

  useEffect(() => {
    api(`/prescriptions/${id}`).then(setRx).catch((e) => push(e.message, "error"));
  }, [id]);

  if (!rx) return <p className="muted">Loading prescription…</p>;

  const items = rx.items || [];
  const printRx = () => window.print();

  return (
    <div>
      <PageHero
        className="no-print"
        scene="pharmacy"
        eyebrow="Prescription"
        title={rx.id.toUpperCase()}
        lead="Print this page or save it as a PDF from your browser print dialog."
        actions={(
          <div className="row-actions">
            <Link className="ghost-btn" to="/prescriptions"><ArrowLeft size={16} /> All prescriptions</Link>
            <button type="button" className="secondary-btn" onClick={printRx}><Printer size={16} /> Print / save PDF</button>
            {user.role === "patient" && (
              <>
                <Link className="primary-btn" to={`/pay?rx=${rx.id}`}>
                  <ShoppingBag size={16} /> Buy on site
                </Link>
                <Link className="ghost-btn" to={`/pay?rx=${rx.id}&fulfill=hospital`}>
                  <Hospital size={16} /> Collect at hospital
                </Link>
              </>
            )}
          </div>
        )}
      />

      <article className="card rx-sheet">
        <header className="rx-sheet-head">
          <div>
            <strong>{HOSPITAL.name}</strong>
            <span>{HOSPITAL.campus}, {HOSPITAL.city}</span>
            <span>{HOSPITAL.phone}</span>
          </div>
          <div className="rx-mark">Rx</div>
        </header>
        <div className="rx-meta">
          <div><span>Patient</span><b>{rx.patient?.name || "—"}</b><small>{rx.patient?.mrn ? `MRN ${rx.patient.mrn}` : ""}</small></div>
          <div><span>Prescriber</span><b>{rx.doctor?.name || "—"}</b><small>{rx.doctor?.specialty || "Consultant"}</small></div>
          <div><span>Date</span><b>{formatDate(rx.date)}</b><small>{rx.id}</small></div>
        </div>
        <table className="table">
          <thead><tr><th>Medicine</th><th>Directions</th><th>Qty</th></tr></thead>
          <tbody>
            {items.map((line, i) => (
              <tr key={i}>
                <td><b>{line.drug}</b></td>
                <td>{line.sig || "As directed"}</td>
                <td>{line.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rx.notes && <p><b>Notes.</b> {rx.notes}</p>}
        <p className="muted">Dispense at {rx.pharmacy}. Refills remaining: {rx.refills || 0}. This is a hospital prescription from {HOSPITAL.name}.</p>
        <footer className="rx-sign">
          <div>
            <em />
            <span>Prescriber signature</span>
          </div>
          <div>
            <em />
            <span>Pharmacy stamp</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
