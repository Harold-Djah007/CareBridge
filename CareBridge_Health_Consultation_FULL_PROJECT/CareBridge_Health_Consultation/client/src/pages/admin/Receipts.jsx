import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, CheckCircle2, Clock3, Receipt, Search, ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { ghs, prettyDate } from "../../utils";
import PageHero from "../../components/PageHero";
import Avatar from "../../components/Avatar";
import { useAuth, useToast } from "../../state";

function receiptKey(row) { return row.paymentId || row.receiptNo || row.id; }
function haystack(row) { return [row.patient?.name, row.patient?.mrn, row.receiptNo, row.paymentId, row.item, row.method, row.id, row.reference].filter(Boolean).join(" ").toLowerCase(); }

export default function AdminReceipts() {
  const { user } = useAuth();
  const { push } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("paid");
  const [busyId, setBusyId] = useState("");

  const reload = () => { api("/billing?role=admin").then(setInvoices).catch(() => {}); api("/finance/payments").then(setPayments).catch(() => {}); };
  useEffect(() => { reload(); }, []);

  const confirmManual = async (payment) => { setBusyId(payment.id); try { await api("/finance/confirm", { method: "POST", body: JSON.stringify({ paymentId: payment.id, actorId: user.id }) }); push("Offline payment posted and receipt issued."); reload(); } catch (error) { push(error.message, "error"); } finally { setBusyId(""); } };

  const paid = useMemo(() => {
    const fromPayments = (payments || []).filter((p) => p.status === "paid").map((p) => { const inv = invoices.find((i) => i.id === p.invoiceId || (p.invoiceIds || []).includes(i.id)); return { id: p.id, paymentId: p.id, receiptNo: p.receiptNo, reference: p.reference, item: inv?.item || (p.invoiceIds?.length > 1 ? `${p.invoiceIds.length} billed items` : "Hospital payment"), amount: p.amount, method: inv?.method || p.method, date: p.confirmedAt || p.createdAt, patient: p.patient || inv?.patient }; });
    const seen = new Set(fromPayments.map((r) => r.receiptNo || r.paymentId));
    const fromInvoices = invoices.filter((i) => i.status === "paid").filter((i) => !seen.has(i.receiptNo) && !seen.has(i.paymentId) && !fromPayments.some((r) => r.paymentId === i.paymentId || r.id === i.id)).map((i) => ({ id: i.id, paymentId: i.paymentId || i.receiptNo || i.id, receiptNo: i.receiptNo || i.paymentId || i.id, item: i.item, amount: i.amount, method: i.method, date: i.paidAt || i.date, patient: i.patient }));
    return [...fromPayments, ...fromInvoices].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [invoices, payments]);

  const pendingManual = payments.filter((p) => p.status === "pending" && ["cash", "nhis"].includes(p.method));
  const due = invoices.filter((i) => i.status === "due");
  const q = query.trim().toLowerCase();
  const visible = q ? paid.filter((row) => haystack(row).includes(q)) : paid;
  const dueVisible = q ? due.filter((row) => haystack(row).includes(q)) : due;
  const collected = paid.reduce((n, p) => n + Number(p.amount || 0), 0);
  const outstanding = due.reduce((n, p) => n + Number(p.amount || 0), 0);

  return <div className="finance-os">
    <PageHero scene="billing" eyebrow="Hospital finance" title="Finance & receipts" lead="Verified receipts, outstanding invoices and manual cash/NHIS review in one operations ledger." actions={<Link className="secondary-btn" to="/billing/tariff">Tariff manager</Link>} />

    <section className="ops-metric-grid finance-kpis">
      <article className="ops-metric"><span className="ops-metric-icon green"><Banknote size={17} /></span><div><small>Collected</small><strong>{ghs(collected)}</strong><em>{paid.length} posted receipts</em></div></article>
      <article className="ops-metric"><span className="ops-metric-icon amber"><Clock3 size={17} /></span><div><small>Outstanding</small><strong>{ghs(outstanding)}</strong><em>{due.length} unpaid invoices</em></div></article>
      <article className="ops-metric"><span className="ops-metric-icon blue"><ShieldCheck size={17} /></span><div><small>Manual review</small><strong>{pendingManual.length}</strong><em>Cash / NHIS checks</em></div></article>
      <article className="ops-metric"><span className="ops-metric-icon"><Receipt size={17} /></span><div><small>Receipt ledger</small><strong>{paid.length}</strong><em>Verified payment history</em></div></article>
    </section>

    <section className="product-section finance-console">
      <div className="finance-toolbar"><div className="directory-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient, MRN, receipt or reference" /></div><div className="directory-role-tabs">{[["paid",`Paid ${paid.length}`],["review",`Manual review ${pendingManual.length}`],["due",`Outstanding ${due.length}`]].map(([id,label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div></div>

      {view === "paid" && <div className="directory-table-wrap"><table className="table product-directory-table finance-table"><thead><tr><th>Patient</th><th>Receipt</th><th>Item</th><th>Amount</th><th>Method</th><th>Posted</th><th /></tr></thead><tbody>{visible.map((row) => <tr key={receiptKey(row)}><td><div className="directory-person"><Avatar person={row.patient || { name: "Patient" }} className="small" /><span><b>{row.patient?.name || "Patient"}</b><small>{row.patient?.mrn || "—"}</small></span></div></td><td><b>{row.receiptNo}</b></td><td>{row.item}</td><td><b>{ghs(row.amount)}</b></td><td>{row.method || "—"}</td><td>{row.date?.length > 12 ? prettyDate(row.date) : row.date || "—"}</td><td><Link className="secondary-btn" to={`/receipts/${encodeURIComponent(receiptKey(row))}`}>Open receipt</Link></td></tr>)}{visible.length === 0 && <tr><td colSpan={7}><div className="product-empty-inline"><Receipt size={18} /><span>{q ? "No receipts match that search." : "No paid receipts posted yet."}</span></div></td></tr>}</tbody></table></div>}

      {view === "review" && <div className="directory-table-wrap"><table className="table product-directory-table finance-table"><thead><tr><th>Patient</th><th>Reference</th><th>Method</th><th>Amount</th><th>Created</th><th>Verification</th></tr></thead><tbody>{pendingManual.map((payment) => <tr key={payment.id}><td><div className="directory-person"><Avatar person={payment.patient || { name: "Patient" }} className="small" /><span><b>{payment.patient?.name || "Patient"}</b><small>{payment.patient?.mrn || "—"}</small></span></div></td><td>{payment.reference}</td><td>{payment.method === "nhis" ? `NHIS · ${payment.nhisNumber || "policy"}` : "Cash"}</td><td><b>{ghs(payment.amount)}</b></td><td>{prettyDate(payment.createdAt)}</td><td><button className="primary-btn" type="button" disabled={busyId === payment.id} onClick={() => confirmManual(payment)}>{busyId === payment.id ? "Posting…" : "Verify & post"}</button></td></tr>)}{pendingManual.length === 0 && <tr><td colSpan={6}><div className="product-empty-inline"><CheckCircle2 size={18} /><span>No manual payments await verification.</span></div></td></tr>}</tbody></table></div>}

      {view === "due" && <div className="directory-table-wrap"><table className="table product-directory-table finance-table"><thead><tr><th>Patient</th><th>Invoice</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>{dueVisible.map((row) => <tr key={row.id}><td><div className="directory-person"><Avatar person={row.patient || { name: "Patient" }} className="small" /><span><b>{row.patient?.name || "Patient"}</b><small>{row.patient?.mrn || "—"}</small></span></div></td><td>{row.item}</td><td><b>{ghs(row.amount)}</b></td><td>{row.date}</td><td><span className="status pending">due</span></td></tr>)}{dueVisible.length === 0 && <tr><td colSpan={5}><div className="product-empty-inline"><CheckCircle2 size={18} /><span>{q ? "No due invoices match that search." : "Nothing outstanding."}</span></div></td></tr>}</tbody></table></div>}
      <div className="finance-assurance"><ShieldCheck size={14} /><span>Online receipts are posted only after gateway verification. Cash and NHIS require an operations review.</span></div>
    </section>
  </div>;
}
