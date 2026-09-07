import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { api } from "../api";
import { ghs, prettyDate } from "../utils";
import PageHero from "../components/PageHero";

export default function PaymentStatus() {
  const { id } = useParams();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const load = async (refresh = false) => {
    try {
      const result = await api(`/finance/payments/${encodeURIComponent(id)}/status${refresh ? "?refresh=1" : ""}`);
      setPayment(result.payment);
      setError("");
      return result.payment;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    load(true);
    const timer = window.setInterval(async () => {
      if (!active || payment?.status === "paid" || payment?.status === "failed") return;
      await load(true);
    }, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id, payment?.status]);

  const bank = payment?.bankTransfer;
  const Icon = payment?.status === "paid" ? CircleCheck : payment?.status === "failed" ? CircleAlert : busy ? LoaderCircle : CircleAlert;

  return (
    <div>
      <PageHero
        scene="billing"
        eyebrow="Accounts"
        title="Payment status"
        lead="The invoice stays unpaid until CareBridge receives verified payment confirmation."
      />
      <section className="card payment-status-card">
        <div className="payment-status-title">
          <Icon size={30} className={busy && !payment ? "spin" : ""} aria-hidden="true" />
          <div>
            <span className="eyebrow">{payment?.reference || "Payment"}</span>
            <h3>{payment?.status === "paid" ? "Payment verified" : payment?.status === "failed" ? "Payment not completed" : "Awaiting confirmation"}</h3>
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}
        {payment && (
          <>
            <div className="basket-totals">
              <p><span>Amount</span><b>{ghs(payment.amount)}</b></p>
              <p><span>Method</span><b>{payment.method === "momo" ? `Mobile Money · ${payment.network?.toUpperCase()}` : payment.method === "bank" ? "Bank transfer" : payment.method === "card" ? "Card" : payment.method?.toUpperCase()}</b></p>
              <p><span>Created</span><b>{prettyDate(payment.createdAt)}</b></p>
              <p><span>Status</span><b>{payment.status}</b></p>
            </div>
            {payment.method === "momo" && payment.status === "pending" && (
              <p>Approve the Mobile Money request on <b>{payment.phone}</b>. CareBridge checks Flutterwave automatically.</p>
            )}
            {payment.method === "bank" && bank && payment.status === "pending" && (
              <div className="bank-box">
                <p><b>{bank.bank}</b></p>
                <p>Account <b>{bank.account}</b><br />Amount <b>GHS {bank.amount}</b><br />Reference <b>{bank.transferReference || payment.reference}</b><br />Expires {bank.expiration || "after the provider window"}</p>
              </div>
            )}
            {payment.method === "cash" && payment.status === "pending" && <p>Pay at the Ridge Campus accounts desk. Hospital operations must post the cash before a receipt is created.</p>}
            {payment.method === "nhis" && payment.status === "pending" && <p>Your NHIS / insurance claim is waiting for hospital accounts review.</p>}
            <div className="row-actions" style={{ marginTop: 18 }}>
              {payment.status === "paid" && <Link className="primary-btn" to={`/receipts/${payment.id}`}>Open receipt</Link>}
              {payment.status === "pending" && <button type="button" className="secondary-btn" disabled={busy} onClick={() => { setBusy(true); load(true); }}>{busy ? "Checking…" : "Check again"}</button>}
              <Link className="ghost-btn" to="/pay?tab=bills">Shop &amp; pay</Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
