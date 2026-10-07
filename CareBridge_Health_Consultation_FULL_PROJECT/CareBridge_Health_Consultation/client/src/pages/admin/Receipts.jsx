import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Landmark, Search, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { api } from "../../api";
import { ghs, prettyDate } from "../../utils";
import { useAuth, useToast } from "../../state";
import Avatar from "../../components/Avatar";

function receiptKey(row) {
  return row.paymentId || row.receiptNo || row.id;
}

function haystack(row) {
  return [row.patient?.name, row.patient?.mrn, row.receiptNo, row.paymentId, row.item, row.method, row.id, row.reference].filter(Boolean).join(" ").toLowerCase();
}

export default function AdminReceipts() {
  const { user } = useAuth();
  const { push } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("settled");
  const [busyId, setBusyId] = useState("");

  const reload = () => {
    api("/billing?role=admin").then(setInvoices).catch(() => {});
    api("/finance/payments").then(setPayments).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const confirmManual = async (payment) => {
    setBusyId(payment.id);
    try {
      await api("/finance/confirm", { method: "POST", body: JSON.stringify({ paymentId: payment.id, actorId: user.id }) });
      push("Offline payment posted and receipt issued.");
      reload();
    } catch (error) { push(error.message, "error"); } finally { setBusyId(""); }
  };

  const paid = useMemo(() => {
    const fromPayments = (payments || []).filter((payment) => payment.status === "paid").map((payment) => {
      const invoice = invoices.find((item) => item.id === payment.invoiceId || (payment.invoiceIds || []).includes(item.id));
      return { id: payment.id, paymentId: payment.id, receiptNo: payment.receiptNo, reference: payment.reference, item: invoice?.item || (payment.invoiceIds?.length > 1 ? `${payment.invoiceIds.length} billed items` : "Hospital payment"), amount: payment.amount, method: invoice?.method || payment.method, date: payment.confirmedAt || payment.createdAt, patient: payment.patient || invoice?.patient };
    });
    const seen = new Set(fromPayments.map((row) => row.receiptNo || row.paymentId));
    const fromInvoices = invoices.filter((invoice) => invoice.status === "paid").filter((invoice) => !seen.has(invoice.receiptNo) && !seen.has(invoice.paymentId) && !fromPayments.some((row) => row.paymentId === invoice.paymentId || row.id === invoice.id)).map((invoice) => ({ id: invoice.id, paymentId: invoice.paymentId || invoice.receiptNo || invoice.id, receiptNo: invoice.receiptNo || invoice.paymentId || invoice.id, item: invoice.item, amount: invoice.amount, method: invoice.method, date: invoice.paidAt || invoice.date, patient: invoice.patient }));
    return [...fromPayments, ...fromInvoices].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [invoices, payments]);

  const pendingManual = payments.filter((payment) => payment.status === "pending" && ["cash", "nhis"].includes(payment.method));
  const due = invoices.filter((invoice) => invoice.status === "due");
  const collected = paid.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const outstanding = due.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const q = query.trim().toLowerCase();
  const visiblePaid = q ? paid.filter((row) => haystack(row).includes(q)) : paid;
  const visibleDue = q ? due.filter((row) => haystack(row).includes(q)) : due;

  return (
    <div className="px-page px-finance-console">
      <section className="px-admin-title px-finance-title">
        <div><span className="px-kicker"><Sparkles size={14} /> Revenue operations</span><h1>Finance should feel verified, not improvised.</h1><p>Settled receipts, manual-review payments and outstanding patient balances are separated into one controlled accounts workspace.</p></div>
        <div className="px-admin-title-stat"><span>Collected</span><strong>{ghs(collected)}</strong><small>{ghs(outstanding)} outstanding</small></div>
      </section>

      <section className="px-signal-grid">
        <article><span><WalletCards size={17} /></span><div><small>Paid receipts</small><strong>{paid.length}</strong></div></article>
        <article><span><CreditCard size={17} /></span><div><small>Manual review</small><strong>{pendingManual.length}</strong></div></article>
        <article><span><Landmark size={17} /></span><div><small>Due invoices</small><strong>{due.length}</strong></div></article>
        <article><span><ShieldCheck size={17} /></span><div><small>Verification</small><strong>Protected</strong></div></article>
      </section>

      <section className="px-finance-board">
        <header className="px-finance-toolbar"><div><span className="px-kicker">Accounts ledger</span><h2>{view === "settled" ? `${visiblePaid.length} settled` : view === "review" ? `${pendingManual.length} awaiting review` : `${visibleDue.length} outstanding`}</h2></div><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, MRN, receipt or reference" /></label><div className="px-segmented"><button type="button" className={view === "settled" ? "active" : ""} onClick={() => setView("settled")}>Settled</button><button type="button" className={view === "review" ? "active" : ""} onClick={() => setView("review")}>Review</button><button type="button" className={view === "due" ? "active" : ""} onClick={() => setView("due")}>Outstanding</button></div></header>

        {view === "settled" && <div className="px-finance-list">{visiblePaid.map((row) => <article className="px-finance-row" key={receiptKey(row)}><div className="px-finance-person"><Avatar person={row.patient} /><span><strong>{row.patient?.name || "Patient"}</strong><small>{row.patient?.mrn || "—"}</small></span></div><div><span>Receipt</span><strong>{row.receiptNo || row.paymentId}</strong></div><div><span>Item</span><strong>{row.item}</strong></div><div><span>Method</span><strong>{row.method || "—"}</strong></div><div className="money"><span>Amount</span><strong>{ghs(row.amount)}</strong></div><time>{row.date?.length > 12 ? prettyDate(row.date) : row.date || "—"}</time><Link to={`/receipts/${encodeURIComponent(receiptKey(row))}`}>Open receipt</Link></article>)}{visiblePaid.length === 0 && <div className="px-empty"><CreditCard size={28} /><h3>No settled receipts match</h3></div>}</div>}

        {view === "review" && <div className="px-finance-list">{pendingManual.map((payment) => <article className="px-finance-row review" key={payment.id}><div className="px-finance-person"><Avatar person={payment.patient} /><span><strong>{payment.patient?.name || "Patient"}</strong><small>{payment.patient?.mrn || "—"}</small></span></div><div><span>Reference</span><strong>{payment.reference}</strong></div><div><span>Method</span><strong>{payment.method === "nhis" ? `NHIS · ${payment.nhisNumber || "policy"}` : "Cash"}</strong></div><div><span>Created</span><strong>{prettyDate(payment.createdAt)}</strong></div><div className="money"><span>Amount</span><strong>{ghs(payment.amount)}</strong></div><span className="status pending">pending</span><button type="button" disabled={busyId === payment.id} onClick={() => confirmManual(payment)}>{busyId === payment.id ? "Posting…" : "Verify & post"}</button></article>)}{pendingManual.length === 0 && <div className="px-empty"><ShieldCheck size={28} /><h3>Manual review queue is clear</h3></div>}</div>}

        {view === "due" && <div className="px-finance-list">{visibleDue.map((row) => <article className="px-finance-row due" key={row.id}><div className="px-finance-person"><Avatar person={row.patient} /><span><strong>{row.patient?.name || "Patient"}</strong><small>{row.patient?.mrn || "—"}</small></span></div><div><span>Invoice</span><strong>{row.id}</strong></div><div><span>Item</span><strong>{row.item}</strong></div><div><span>Date</span><strong>{row.date}</strong></div><div className="money"><span>Amount due</span><strong>{ghs(row.amount)}</strong></div><span className="status pending">due</span><small>Patient settles in Shop & Pay</small></article>)}{visibleDue.length === 0 && <div className="px-empty"><ShieldCheck size={28} /><h3>Nothing outstanding in this view</h3></div>}</div>}
      </section>

      <div className="px-finance-assurance"><ShieldCheck size={16} /><span>Cash and NHIS are posted only after operations verification. Online receipts are created only after provider confirmation.</span><Link to="/billing/tariff">Open tariff</Link></div>
    </div>
  );
}
