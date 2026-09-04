import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { HOSPITAL, prettyDate } from "../utils";

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;

export default function Receipt() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api(`/receipts/${id}`).then(setData).catch((e) => { setData(null); setError(e.message); });
  }, [id]);

  if (error) return <p className="error-box">{error}</p>;
  if (!data) return <p className="muted">Loading receipt…</p>;

  const { payment, invoice, patient, hospital, lines } = data;
  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Official receipt</span>
          <h1>{payment.receiptNo}</h1>
          <p>{HOSPITAL.name} · {HOSPITAL.campus}, {HOSPITAL.city}</p>
        </div>
        <div className="row-actions">
          <Link className="ghost-btn" to="/pay">Back to billing</Link>
          <button className="secondary-btn" type="button" onClick={() => window.print()}>Print / save PDF</button>
        </div>
      </div>
      <section className="card receipt-sheet">
        <div className="receipt-head">
          <div>
            <b>{HOSPITAL.name}</b>
            <p>{HOSPITAL.campus}, {HOSPITAL.city}<br />Tel {HOSPITAL.phone}<br />TIN / accounts: CareBridge Medical Centre Ltd</p>
          </div>
          <div>
            <span className="eyebrow">Receipt</span>
            <strong>{payment.receiptNo}</strong>
            <p className="muted">Ref {payment.reference}</p>
          </div>
        </div>
        <hr />
        <p>Received from <b>{patient.name}</b><br />MRN {patient.mrn || "—"} · {patient.email}<br />{patient.phone || ""}</p>
        <table className="table">
          <thead><tr><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            {(lines || invoice?.lines || [{ name: invoice?.item, lineTotal: payment.amount }]).map((line, i) => (
              <tr key={i}><td>{line.name}{line.qty ? ` × ${line.qty}` : ""}</td><td>{ghs(line.lineTotal || payment.amount)}</td></tr>
            ))}
            <tr><td><b>Total paid</b></td><td><b>{ghs(payment.amount)}</b></td></tr>
          </tbody>
        </table>
        <p>Method: {invoice?.method || payment.method}<br />Posted: {prettyDate(payment.confirmedAt || payment.createdAt)}</p>
        {hospital?.bank && (
          <p className="muted">Settled to {hospital.bank.bank} {hospital.bank.accountNumber} or hospital MoMo merchant {hospital.momo?.merchantId}.</p>
        )}
        <p className="muted">Keep this receipt for NHIS, employer, and insurance claims. It is the official record of payment on the patient file.</p>
      </section>
    </div>
  );
}
