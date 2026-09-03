import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToast } from "../state";

const METHODS = [
  { id: "momo", label: "Mobile money", hint: "MTN, Telecel Cash, or AirtelTigo Money to the hospital merchant wallets" },
  { id: "bank", label: "GCB bank transfer", hint: "CareBridge Medical Centre Ltd, Ridge branch — use the payment reference as narration" },
  { id: "nhis", label: "NHIS / insurance", hint: "Claim against the policy number on the patient file" },
  { id: "cash", label: "Cash at cashier", hint: "Ridge Campus accounts desk, ground floor — receipt issued immediately" },
];

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;

export default function Pay() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invoiceId = params.get("invoice");
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [method, setMethod] = useState("momo");
  const [form, setForm] = useState({ network: "mtn", phone: user.phone || "", payerName: user.name, nhisNumber: user.insurance || "" });
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/billing?userId=${user.id}&role=${user.role}`).then((rows) => {
      setInvoices(rows);
      setInvoice(rows.find((r) => r.id === invoiceId) || rows.find((r) => r.status === "due") || null);
    });
    api("/finance/accounts").then(setAccounts);
  }, [user.id, user.role, invoiceId]);

  const start = async (e) => {
    e.preventDefault();
    if (!invoice) return;
    if (invoice.status === "paid") {
      push("This bill is already paid.");
      return;
    }
    setBusy(true);
    try {
      const r = await api("/finance/checkout", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, method, actorId: user.id, ...form }),
      });
      setPayment(r.payment);
      if (r.payment.status === "paid") {
        push("Cash posted. Receipt issued.");
        navigate(`/receipts/${r.payment.id}`);
      }
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api("/finance/confirm", { method: "POST", body: JSON.stringify({ paymentId: payment.id, actorId: user.id }) });
      push("Accounts posted the payment and emailed the receipt.");
      navigate(`/receipts/${r.payment.id}`);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const due = invoices.filter((i) => i.status === "due");
  const paid = invoices.filter((i) => i.status === "paid");
  const merchant = accounts?.momo?.[form.network] || accounts?.momo?.mtn;

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Hospital accounts</span>
          <h1>{user.role === "admin" ? "Patient billing" : "Pay a hospital bill"}</h1>
          <p>Amounts post to CareBridge Medical Centre Ltd. MoMo wallets and GCB Ridge are the live settlement accounts for this campus. Every paid bill issues a numbered receipt.</p>
        </div>
        <Link className="secondary-btn" to="/billing/tariff">View tariff</Link>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <h3>Outstanding</h3>
          {due.length === 0 && <p className="muted">No unpaid invoices.</p>}
          {due.map((i) => (
            <button type="button" key={i.id} className={`pay-pick ${invoice?.id === i.id ? "on" : ""}`} onClick={() => { setInvoice(i); setPayment(null); }}>
              <span>
                <b>{i.item}</b>
                <small>{i.date}{i.patient?.name && user.role !== "patient" ? ` · ${i.patient.name}` : ""}</small>
              </span>
              <strong>{ghs(i.amount)}</strong>
            </button>
          ))}
          {paid.length > 0 && (
            <>
              <h3 style={{ marginTop: 18 }}>Receipts</h3>
              {paid.slice(0, 8).map((i) => (
                <Link key={i.id} className="pay-pick" to={`/receipts/${i.paymentId || i.receiptNo || i.id}`}>
                  <span><b>{i.item}</b><small>{i.receiptNo || "Receipt"} · {i.method}</small></span>
                  <strong>{ghs(i.amount)}</strong>
                </Link>
              ))}
            </>
          )}
        </section>
        <section className="card">
          {!invoice && <p className="muted">Select a bill to settle.</p>}
          {invoice && invoice.status === "paid" && !payment && (
            <p>This invoice is already paid. <Link to={`/receipts/${invoice.paymentId || invoice.receiptNo || invoice.id}`}><b>Open receipt</b></Link></p>
          )}
          {invoice && invoice.status === "due" && !payment && (
            <form onSubmit={start} className="pay-form">
              <p><b>{invoice.item}</b><br /><span className="muted">Amount due {ghs(invoice.amount)}</span></p>
              {METHODS.map((m) => (
                <label className="check-row" key={m.id}>
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <span><b>{m.label}</b><small className="muted"> — {m.hint}</small></span>
                </label>
              ))}
              {method === "momo" && (
                <>
                  <label>Network
                    <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}>
                      <option value="mtn">MTN MoMo</option>
                      <option value="telecel">Telecel Cash</option>
                      <option value="at">AirtelTigo Money</option>
                    </select>
                  </label>
                  <label>Payer MoMo number<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label>
                  <div className="bank-box">
                    <p><b>Send to hospital merchant</b></p>
                    <p>{accounts?.momo.name}<br />Merchant ID {accounts?.momo.merchantId}<br />{form.network.toUpperCase()} {merchant}</p>
                    <p className="muted">MTN: *170# → Send Money → Mobile Number → {merchant}. Telecel: *110#. AirtelTigo: *110#.</p>
                  </div>
                </>
              )}
              {method === "bank" && accounts && (
                <div className="bank-box">
                  <p><b>{accounts.bank.bank}</b></p>
                  <p>{accounts.bank.accountName}<br />A/C {accounts.bank.accountNumber}<br />{accounts.bank.branch}<br />Sort {accounts.bank.sortCode} · SWIFT {accounts.bank.swift}</p>
                  <label>Account name used for the transfer<input value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} required /></label>
                </div>
              )}
              {method === "nhis" && (
                <label>NHIS / policy number<input value={form.nhisNumber} onChange={(e) => setForm({ ...form, nhisNumber: e.target.value })} required /></label>
              )}
              {method === "cash" && (
                <p className="muted">{accounts?.cashier.desk}. {accounts?.cashier.hours}. The cashier posts this bill and prints the same receipt number.</p>
              )}
              <button className="primary-btn" disabled={busy}>{busy ? "Posting…" : method === "cash" ? "Record cash and issue receipt" : "Generate payment reference"}</button>
            </form>
          )}
          {payment && payment.status === "pending" && (
            <div>
              <p className="eyebrow">Reference {payment.reference}</p>
              <h3>Complete this transfer</h3>
              {payment.method === "momo" && (
                <p>Pay <b>{ghs(payment.amount)}</b> from <b>{payment.phone}</b> to merchant <b>{payment.destination?.number}</b> ({(payment.network || "mtn").toUpperCase()}). Use reference {payment.reference}.</p>
              )}
              {payment.method === "bank" && (
                <p>Transfer <b>{ghs(payment.amount)}</b> to GCB {accounts?.bank.accountNumber}. Narration must be <b>{payment.reference}</b>.</p>
              )}
              {payment.method === "nhis" && (
                <p>Claim for policy <b>{payment.nhisNumber}</b> is lodged against this encounter. Confirm when NHIS authorises so accounts can close the bill.</p>
              )}
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="primary-btn" type="button" disabled={busy} onClick={confirm}>Payment sent — issue receipt</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
