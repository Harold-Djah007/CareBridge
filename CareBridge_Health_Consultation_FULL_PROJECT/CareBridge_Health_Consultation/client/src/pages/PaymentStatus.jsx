import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api";
import { ghs, prettyDate } from "../utils";

export default function PaymentStatus() {
  const { id } = useParams();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const requestRef = useRef(null);

  const load = async (refresh = false) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await api(`/finance/payments/${encodeURIComponent(id)}/status${refresh ? "?refresh=1" : ""}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPayment(result.payment);
      setError("");
      return result.payment;
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
      return null;
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    let timer;
    setPayment(null);
    setError("");
    setBusy(true);
    const poll = async () => {
      const result = await load(true);
      if (active && !["paid", "failed"].includes(result?.status)) timer = window.setTimeout(poll, 8000);
    };
    poll();
    return () => { active = false; window.clearTimeout(timer); requestRef.current?.abort(); requestRef.current = null; };
  }, [id]);

  const bank = payment?.bankTransfer;
  const paid = payment?.status === "paid";
  const failed = payment?.status === "failed";
  const Icon = paid ? CircleCheck : failed ? CircleAlert : LoaderCircle;
  const tone = paid ? "success" : failed ? "failure" : "pending";

  return (
    <div className="px-page px-payment-status">
      <section className={`px-verification-hero ${tone}`}>
        <div className="px-verification-icon"><Icon size={36} className={!paid && !failed ? "spin-soft" : ""} /></div>
        <div><span className="px-kicker"><Sparkles size={14} /> Verified checkout</span><h1>{paid ? "Payment verified." : failed ? "Payment not completed." : "Verification in progress."}</h1><p>CareBridge keeps the invoice unpaid until the server receives trusted confirmation from the payment path.</p></div>
        <span className={`px-verification-state ${tone}`}><i /> {payment?.status || (busy ? "checking" : "unknown")}</span>
      </section>

      {error && <div className="px-payment-error"><CircleAlert size={17} /><span>{error}</span></div>}
      {payment && <section className="px-payment-sheet">
        <header><div><span className="px-kicker">Transaction</span><h2>{payment.reference || payment.id}</h2></div><ShieldCheck size={20} /></header>
        <div className="px-payment-facts"><div><span>Amount</span><strong>{ghs(payment.amount)}</strong></div><div><span>Method</span><strong>{payment.method === "momo" ? `Mobile Money · ${payment.network?.toUpperCase()}` : payment.method === "bank" ? "Bank transfer" : payment.method === "card" ? "Card" : payment.method?.toUpperCase()}</strong></div><div><span>Created</span><strong>{prettyDate(payment.createdAt)}</strong></div><div><span>Status</span><strong>{payment.status}</strong></div></div>
        {payment.method === "momo" && payment.status === "pending" && <div className="px-payment-instruction"><strong>Approve on your phone</strong><p>Complete the Mobile Money prompt on <b>{payment.phone}</b>. CareBridge checks Flutterwave automatically.</p></div>}
        {payment.method === "bank" && bank && payment.status === "pending" && <div className="px-bank-transfer"><span className="px-kicker">Bank transfer instructions</span><h3>{bank.bank}</h3><div><span>Account</span><strong>{bank.account}</strong></div><div><span>Amount</span><strong>GHS {bank.amount}</strong></div><div><span>Reference</span><strong>{bank.transferReference || payment.reference}</strong></div><small>Expires {bank.expiration || "after the provider window"}</small></div>}
        {payment.method === "cash" && payment.status === "pending" && <div className="px-payment-instruction"><strong>Cashier review required</strong><p>Pay at the Ridge Campus accounts desk. Operations must post the cash before a receipt is created.</p></div>}
        {payment.method === "nhis" && payment.status === "pending" && <div className="px-payment-instruction"><strong>NHIS review required</strong><p>Your claim is waiting for hospital accounts verification.</p></div>}
        <footer>{paid && <Link className="px-primary" to={`/receipts/${payment.id}`}>Open receipt</Link>}{payment.status === "pending" && <button className="px-secondary" type="button" disabled={busy} onClick={() => { setBusy(true); load(true); }}><RefreshCw size={15} /> {busy ? "Checking…" : "Check again"}</button>}<Link className="px-secondary" to="/pay?tab=bills">Shop & pay</Link></footer>
      </section>}
    </div>
  );
}
