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
  const [params, setParams] = useSearchParams();
  const invoiceId = params.get("invoice");
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(user.role === "patient" ? user.id : "");
  const [invoice, setInvoice] = useState(null);
  const prefs = user.paymentPrefs || {};
  const [method, setMethod] = useState(prefs.method || "momo");
  const [form, setForm] = useState({
    network: prefs.momoNetwork || "mtn",
    phone: prefs.momoNumber || user.phone || "",
    payerName: user.name,
    nhisNumber: prefs.nhisNumber || user.insurance || "",
  });
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadBills = async (selectId) => {
    const rows = await api(`/billing?userId=${user.id}&role=${user.role}`);
    setInvoices(rows);
    const dueRows = rows.filter((r) => r.status === "due");
    const wantedId = selectId || invoiceId;
    const next = dueRows.find((r) => r.id === wantedId) || dueRows[0] || null;
    setInvoice(next);
    return { rows, next };
  };

  useEffect(() => {
    loadBills();
    api("/finance/accounts").then(setAccounts);
    api("/finance/rates").then((r) => setServices(r.services || []));
    if (user.role === "admin") api("/patients").then(setPatients);
  }, [user.id, user.role, invoiceId]);

  const pickBill = (row) => {
    setInvoice(row);
    setPayment(null);
    const next = new URLSearchParams(params);
    next.set("invoice", row.id);
    setParams(next, { replace: true });
  };

  const start = async (e) => {
    e.preventDefault();
    if (!invoice || invoice.status !== "due") {
      push("Choose an unpaid bill on the left, or open a new one below.", "error");
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

  const raiseBill = async (serviceId) => {
    const pid = user.role === "patient" ? user.id : patientId;
    if (!pid) {
      push("Choose a patient first.", "error");
      return;
    }
    setBusy(true);
    try {
      const inv = await api("/finance/services/order", {
        method: "POST",
        body: JSON.stringify({ patientId: pid, actorId: user.id, serviceId }),
      });
      push("Bill opened. Complete payment on the right.");
      await loadBills(inv.id);
      setPayment(null);
      const next = new URLSearchParams(params);
      next.set("invoice", inv.id);
      setParams(next, { replace: true });
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
          <p>Select an unpaid invoice to settle it by MoMo, GCB, NHIS, or cash. Paid rows open a receipt — they are not bills. If nothing is due, open a tariff item below and pay it here.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-btn" to="/billing/tariff">View tariff</Link>
          {user.role === "patient" && <Link className="ghost-btn" to="/pharmacy">Pharmacy & labs</Link>}
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <h3>Outstanding — click to pay</h3>
          {due.length === 0 && (
            <p className="muted">No unpaid invoices. Open a published service below, or bill medicines from Pharmacy, then return here to pay.</p>
          )}
          {due.map((i) => (
            <button type="button" key={i.id} className={`pay-pick ${invoice?.id === i.id ? "on" : ""}`} onClick={() => pickBill(i)}>
              <span>
                <b>{i.item}</b>
                <small>{i.date}{i.patient?.name && user.role !== "patient" ? ` · ${i.patient.name}` : ""} · Pay now</small>
              </span>
              <strong>{ghs(i.amount)}</strong>
            </button>
          ))}

          <div className="raise-bill">
            <h3>Open a new bill</h3>
            <p className="muted">This creates an unpaid invoice and loads checkout on the right. Receipts are only issued after payment.</p>
            {user.role === "admin" && (
              <label>Patient
                <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Select patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
                </select>
              </label>
            )}
            <div className="raise-list">
              {services.map((s) => (
                <button type="button" key={s.id} className="ghost-btn" disabled={busy} onClick={() => raiseBill(s.id)}>
                  {s.name} · {ghs(s.price)}
                </button>
              ))}
            </div>
          </div>

          {paid.length > 0 && (
            <>
              <h3 style={{ marginTop: 18 }}>Paid receipts</h3>
              <p className="muted">These are settled. Open a receipt to print or save PDF — they cannot be paid again.</p>
              {paid.slice(0, 8).map((i) => (
                <Link key={i.id} className="pay-pick receipt" to={`/receipts/${i.paymentId || i.receiptNo || i.id}`}>
                  <span><b>{i.item}</b><small>Paid · {i.receiptNo || "Receipt"} · {i.method}</small></span>
                  <strong>{ghs(i.amount)}</strong>
                </Link>
              ))}
            </>
          )}
        </section>
        <section className="card pay-checkout">
          {!invoice && (
            <div className="empty">
              <h3>No bill selected</h3>
              <p>Pick an outstanding invoice, or open a new bill from the tariff list. Checkout for MoMo, bank, NHIS, and cash appears here.</p>
            </div>
          )}
          {invoice && invoice.status === "due" && !payment && (
            <form onSubmit={start} className="pay-form">
              <p className="eyebrow">Checkout</p>
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
