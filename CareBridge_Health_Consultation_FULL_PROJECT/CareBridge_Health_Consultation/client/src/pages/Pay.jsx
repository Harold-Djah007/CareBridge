import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";

const METHODS = [
  { id: "momo", label: "Mobile money", hint: "MTN, Telecel Cash, or AirtelTigo Money to the hospital merchant wallets" },
  { id: "bank", label: "GCB bank transfer", hint: "CareBridge Medical Centre Ltd, Ridge branch — use the payment reference as narration" },
  { id: "nhis", label: "NHIS / insurance", hint: "Claim against the policy number on the patient file" },
  { id: "cash", label: "Cash at cashier", hint: "Ridge Campus accounts desk, ground floor — receipt issued immediately" },
];

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;
const cartKey = (id) => `carebridge-cart-${id}`;

export default function Pay() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(user.role === "patient" ? user.id : "");
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
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(cartKey(user.id))) || []; } catch { return []; }
  });

  const persist = (next) => {
    setCart(next);
    sessionStorage.setItem(cartKey(user.id), JSON.stringify(next));
  };

  const loadBills = async () => {
    const rows = await api(`/billing?userId=${user.id}&role=${user.role}`);
    setInvoices(rows);
    return rows;
  };

  useEffect(() => {
    loadBills();
    api("/finance/accounts").then(setAccounts);
    api("/finance/rates").then((r) => setServices(r.services || []));
    if (user.role === "admin") api("/patients").then(setPatients);
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("tariff-updated", (r) => setServices(r.services || []));
    return () => socket.disconnect();
  }, [user.id, user.role]);

  useEffect(() => {
    const invoiceId = params.get("invoice");
    const addCode = params.get("add");
    if (!invoiceId && !addCode) return;
    let cancelled = false;
    (async () => {
      const rows = await loadBills();
      if (cancelled) return;
      setCart((prev) => {
        let next = prev;
        if (invoiceId) {
          const row = rows.find((r) => r.id === invoiceId && r.status === "due");
          if (row && !next.some((c) => c.kind === "invoice" && c.id === row.id)) {
            next = [...next, { kind: "invoice", id: row.id, item: row.item, amount: row.amount, date: row.date, qty: 1, patientId: row.patientId }];
            push(`${row.item} added to your cart.`);
          }
        }
        sessionStorage.setItem(cartKey(user.id), JSON.stringify(next));
        return next;
      });
      const clean = new URLSearchParams(params);
      clean.delete("invoice");
      clean.delete("add");
      setParams(clean, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [params.get("invoice"), params.get("add")]);

  const addInvoice = (row) => {
    if (cart.some((c) => c.kind === "invoice" && c.id === row.id)) {
      push("That bill is already in your cart.");
      return;
    }
    persist([...cart, { kind: "invoice", id: row.id, item: row.item, amount: row.amount, date: row.date, qty: 1, patientId: row.patientId }]);
    if (user.role === "admin" && row.patientId) setPatientId(row.patientId);
    push("Added to cart");
  };

  const addService = (svc) => {
    const found = cart.find((c) => c.kind === "service" && c.id === svc.id);
    if (found) {
      persist(cart.map((c) => (c.kind === "service" && c.id === svc.id ? { ...c, qty: c.qty + 1, amount: svc.price * (c.qty + 1) } : c)));
    } else {
      persist([...cart, { kind: "service", id: svc.id, item: svc.name, unit: svc.price, amount: svc.price, qty: 1, nhis: svc.nhis }]);
    }
    push(`${svc.name} added to cart`);
  };

  const setQty = (item, qty) => {
    const n = Math.max(1, Number(qty) || 1);
    persist(cart.map((c) => {
      if (c.kind !== "service" || c.id !== item.id) return c;
      return { ...c, qty: n, amount: (c.unit || c.amount / c.qty) * n };
    }));
  };

  const removeItem = (item) => persist(cart.filter((c) => !(c.kind === item.kind && c.id === item.id)));

  const total = useMemo(() => cart.reduce((s, c) => s + Number(c.amount || 0), 0), [cart]);
  const due = invoices.filter((i) => i.status === "due");
  const paid = invoices.filter((i) => i.status === "paid");
  const merchant = accounts?.momo?.[form.network] || accounts?.momo?.mtn;
  const pid = user.role === "patient" ? user.id : (cart.find((c) => c.patientId)?.patientId || patientId);

  const start = async (e) => {
    e.preventDefault();
    if (!cart.length) {
      push("Add unpaid bills or hospital services to the cart first.", "error");
      return;
    }
    if (!pid) {
      push("Choose a patient first.", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await api("/finance/checkout-cart", {
        method: "POST",
        body: JSON.stringify({
          patientId: pid,
          actorId: user.id,
          invoiceIds: cart.filter((c) => c.kind === "invoice").map((c) => c.id),
          services: cart.filter((c) => c.kind === "service").map((c) => ({ id: c.id, qty: c.qty })),
          method,
          ...form,
        }),
      });
      setPayment(r.payment);
      persist([]);
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

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Hospital shop</span>
          <h1>{user.role === "admin" ? "Patient billing cart" : "Pay hospital bills"}</h1>
          <p>Add unpaid invoices and extra services to your cart, then pay once — the same way you check out online. MoMo, GCB, NHIS, or cash.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-btn" to="/billing/tariff">View tariff</Link>
          {user.role === "patient" && <Link className="ghost-btn" to="/pharmacy">Pharmacy & labs</Link>}
        </div>
      </div>
      <div className="dashboard-grid pay-shop">
        <div>
          <section className="card">
            <h3>1. Unpaid bills — add to cart</h3>
            <p className="muted">These are already on your file (visits, pharmacy, labs). Tick them into the cart instead of paying one by one.</p>
            {due.length === 0 && <p className="muted">Nothing outstanding. Add a service from the shop below if you need a new bill.</p>}
            {due.map((i) => {
              const inCart = cart.some((c) => c.kind === "invoice" && c.id === i.id);
              return (
                <div className={`pay-pick ${inCart ? "on" : ""}`} key={i.id}>
                  <span>
                    <b>{i.item}</b>
                    <small>{i.date}{i.patient?.name && user.role !== "patient" ? ` · ${i.patient.name}` : ""}</small>
                  </span>
                  <strong>{ghs(i.amount)}</strong>
                  <button type="button" className={inCart ? "ghost-btn" : "secondary-btn"} disabled={inCart} onClick={() => addInvoice(i)}>
                    {inCart ? "In cart" : "Add to cart"}
                  </button>
                </div>
              );
            })}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>2. Hospital shop — add more items</h3>
            <p className="muted">These are not billed until you check out. Quantity works like a store.</p>
            {user.role === "admin" && (
              <label>Patient
                <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Select patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
                </select>
              </label>
            )}
            {services.map((s) => (
              <div className="pay-pick" key={s.id}>
                <span>
                  <b>{s.name}</b>
                  <small>{s.nhis ? "NHIS eligible" : "Private pay"}</small>
                </span>
                <strong>{ghs(s.price)}</strong>
                <button type="button" className="secondary-btn" onClick={() => addService(s)}><Plus size={14} /> Add to cart</button>
              </div>
            ))}
          </section>

          {paid.length > 0 && (
            <section className="card" style={{ marginTop: 16 }}>
              <h3>Paid receipts</h3>
              <p className="muted">Settled bills. Open to print or save PDF.</p>
              {paid.slice(0, 8).map((i) => (
                <Link key={i.id} className="pay-pick receipt" to={`/receipts/${i.paymentId || i.receiptNo || i.id}`}>
                  <span><b>{i.item}</b><small>Paid · {i.receiptNo || "Receipt"} · {i.method}</small></span>
                  <strong>{ghs(i.amount)}</strong>
                </Link>
              ))}
            </section>
          )}
        </div>

        <section className="card pay-checkout">
          <div className="card-head">
            <div>
              <span className="eyebrow">Your cart</span>
              <h3><ShoppingCart size={16} /> {cart.length ? `${cart.length} item${cart.length === 1 ? "" : "s"}` : "Empty"}</h3>
            </div>
          </div>
          {cart.length === 0 && !payment && (
            <div className="empty compact">
              <ShoppingCart size={32} />
              <h3>Cart is empty</h3>
              <p>Add unpaid bills or shop items on the left, then pay everything here in one checkout.</p>
            </div>
          )}
          {cart.map((c) => (
            <div className="cart-line" key={`${c.kind}-${c.id}`}>
              <div className="grow">
                <b>{c.item}</b>
                <small className="muted">{c.kind === "invoice" ? `Invoice · ${c.date || "on file"}` : "New shop item"}</small>
              </div>
              {c.kind === "service" && (
                <div className="qty-ctrl">
                  <button type="button" className="icon-btn" onClick={() => setQty(c, c.qty - 1)} disabled={c.qty <= 1}><Minus size={14} /></button>
                  <span>{c.qty}</span>
                  <button type="button" className="icon-btn" onClick={() => setQty(c, c.qty + 1)}><Plus size={14} /></button>
                </div>
              )}
              <strong>{ghs(c.amount)}</strong>
              <button type="button" className="icon-btn" title="Remove" onClick={() => removeItem(c)}><Trash2 size={16} /></button>
            </div>
          ))}
          {cart.length > 0 && <p className="cart-total">Total due <b>{ghs(total)}</b></p>}

          {cart.length > 0 && !payment && (
            <form onSubmit={start} className="pay-form">
              <p className="eyebrow">3. Checkout</p>
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
                    <p className="muted">MTN: *170# → Send Money → Mobile Number → {merchant}.</p>
                  </div>
                </>
              )}
              {method === "bank" && accounts && (
                <div className="bank-box">
                  <p><b>{accounts.bank.bank}</b></p>
                  <p>{accounts.bank.accountName}<br />A/C {accounts.bank.accountNumber}<br />{accounts.bank.branch}</p>
                  <label>Account name used for the transfer<input value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} required /></label>
                </div>
              )}
              {method === "nhis" && (
                <label>NHIS / policy number<input value={form.nhisNumber} onChange={(e) => setForm({ ...form, nhisNumber: e.target.value })} required /></label>
              )}
              {method === "cash" && (
                <p className="muted">{accounts?.cashier.desk}. {accounts?.cashier.hours}.</p>
              )}
              <button className="primary-btn" disabled={busy}>{busy ? "Posting…" : method === "cash" ? `Pay ${ghs(total)} cash` : `Checkout ${ghs(total)}`}</button>
            </form>
          )}

          {payment && payment.status === "pending" && (
            <div>
              <p className="eyebrow">Reference {payment.reference}</p>
              <h3>Complete this transfer</h3>
              {payment.method === "momo" && (
                <p>Pay <b>{ghs(payment.amount)}</b> from <b>{payment.phone}</b> to merchant <b>{payment.destination?.number}</b>. Use reference {payment.reference}.</p>
              )}
              {payment.method === "bank" && (
                <p>Transfer <b>{ghs(payment.amount)}</b> to GCB {accounts?.bank.accountNumber}. Narration must be <b>{payment.reference}</b>.</p>
              )}
              {payment.method === "nhis" && (
                <p>Claim for policy <b>{payment.nhisNumber}</b> is lodged. Confirm when NHIS authorises.</p>
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
