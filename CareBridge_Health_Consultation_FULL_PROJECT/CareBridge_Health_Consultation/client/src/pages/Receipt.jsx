import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Download, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api";
import { HOSPITAL, prettyDate } from "../utils";
import { useAuth } from "../state";

const ghs = (value) => `GHS ${Number(value || 0).toLocaleString()}`;

export default function Receipt() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api(`/receipts/${id}`).then(setData).catch((err) => { setData(null); setError(err.message); });
  }, [id]);

  if (error) return <div className="px-empty"><ShieldCheck size={28} /><h3>{error}</h3></div>;
  if (!data) return <div className="px-empty"><ShieldCheck size={28} /><h3>Loading receipt…</h3></div>;

  const { payment, invoice, patient, hospital, lines } = data;
  const receiptLines = lines || invoice?.lines || [{ name: invoice?.item, lineTotal: payment.amount }];

  return (
    <div className="px-page px-receipt-page">
      <section className="px-receipt-actions no-print"><div><span className="px-kicker"><Sparkles size={14} /> Official payment record</span><h1>{payment.receiptNo}</h1><p>Verified settlement on the CareBridge patient account.</p></div><div><Link className="px-secondary" to="/pay">{user?.role === "admin" ? "Back to finance" : "Back to Shop & Pay"}</Link><button className="px-primary" type="button" onClick={() => window.print()}><Download size={16} /> Print / save PDF</button></div></section>

      <section className="px-receipt-document">
        <header><div className="px-receipt-brand"><span><ShieldCheck size={21} /></span><div><strong>{HOSPITAL.name}</strong><small>{HOSPITAL.campus}, {HOSPITAL.city}</small></div></div><div className="px-receipt-number"><span>Official receipt</span><strong>{payment.receiptNo}</strong><small>Reference {payment.reference}</small></div></header>
        <div className="px-receipt-verified"><CheckCircle2 size={19} /><div><strong>Payment verified</strong><span>{prettyDate(payment.confirmedAt || payment.createdAt)}</span></div></div>
        <div className="px-receipt-party"><div><span>Received from</span><strong>{patient.name}</strong><small>MRN {patient.mrn || "—"} · {patient.email}</small><small>{patient.phone || ""}</small></div><div><span>Payment method</span><strong>{invoice?.method || payment.method}</strong><small>{hospital?.bank ? `${hospital.bank.bank} / hospital settlement` : "CareBridge verified settlement"}</small></div></div>
        <div className="px-receipt-lines"><div className="px-receipt-line-head"><span>Description</span><span>Amount</span></div>{receiptLines.map((line, index) => <div className="px-receipt-line" key={index}><span>{line.name}{line.qty ? ` × ${line.qty}` : ""}</span><strong>{ghs(line.lineTotal || payment.amount)}</strong></div>)}<div className="px-receipt-total"><span>Total paid</span><strong>{ghs(payment.amount)}</strong></div></div>
        <footer><div><strong>{HOSPITAL.campus}</strong><span>Tel {HOSPITAL.phone}</span><span>CareBridge Medical Centre Ltd</span></div><div><ShieldCheck size={16} /><span>Keep this document for NHIS, employer and insurance claims. It is the official payment record on the patient file.</span></div></footer>
      </section>
    </div>
  );
}
