import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Printer, ShoppingBag, Hospital, ArrowLeft } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL, formatDate, rxOrderQty } from "../utils";

export default function PrescriptionPrint() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [rx, setRx] = useState(null);
  const [stock, setStock] = useState([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api(`/prescriptions/${id}`).then(setRx).catch((e) => push(e.message, "error"));
    api("/pharmacy/stock").then(setStock).catch(() => {});
  }, [id]);

  if (!rx) return <p className="muted">Loading prescription…</p>;

  const items = rx.items || [];
  const printRx = () => window.print();

  const fulfill = async (mode) => {
    const lines = items.map((line) => {
      const product = stock.find((p) => p.id === line.stockId) || stock.find((p) => p.name.toLowerCase() === String(line.drug || "").toLowerCase());
      if (!product) return null;
      return { id: product.id, qty: rxOrderQty(line, product) };
    }).filter(Boolean);
    if (!lines.length) {
      push("Those medicines are not on the Ridge shelf.", "error");
      return;
    }
    setBusy(mode);
    try {
      const { order, invoice } = await api("/pharmacy/orders", {
        method: "POST",
        body: JSON.stringify({
          patientId: rx.patientId,
          actorId: user.id,
          prescriptionId: rx.id,
          fulfill: mode,
          items: lines,
        }),
      });
      if (mode === "online") {
        push("Pharmacy billed. Pay to complete the purchase.");
        navigate(`/pay?invoice=${invoice?.id || order.invoiceId}`);
      } else {
        push("Queued at Ridge pharmacy for collection.");
      }
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div className="page-title no-print">
        <div>
          <span className="eyebrow">Prescription</span>
          <h1>{rx.id.toUpperCase()}</h1>
          <p>Print this page or save it as a PDF from your browser print dialog.</p>
        </div>
        <div className="row-actions">
          <Link className="ghost-btn" to="/prescriptions"><ArrowLeft size={16} /> All prescriptions</Link>
          <button type="button" className="secondary-btn" onClick={printRx}><Printer size={16} /> Print / save PDF</button>
          {user.role === "patient" && (
            <>
              <Link className="primary-btn" to={`/pharmacy?rx=${rx.id}`}>
                <ShoppingBag size={16} /> Buy on site
              </Link>
              <button type="button" className="ghost-btn" disabled={!!busy} onClick={() => fulfill("hospital")}>
                <Hospital size={16} /> Collect at hospital
              </button>
            </>
          )}
        </div>
      </div>

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
