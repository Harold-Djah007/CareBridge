import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { api } from "../api";
import PageHero from "../components/PageHero";

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "checking", message: "Verifying your payment with Flutterwave…" });
  const paymentId = params.get("paymentId");
  const transactionId = params.get("transaction_id") || params.get("transactionId");
  const gatewayStatus = String(params.get("status") || "").toLowerCase();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!paymentId) {
        setState({ status: "error", message: "This payment callback is missing its CareBridge payment reference." });
        return;
      }
      try {
        let result;
        if (transactionId) {
          result = await api("/finance/verify", {
            method: "POST",
            body: JSON.stringify({ paymentId, transactionId }),
          });
        } else {
          result = await api(`/finance/payments/${paymentId}/status?refresh=1`);
        }
        if (cancelled) return;
        if (result.payment?.status === "paid") {
          navigate(`/receipts/${result.payment.id}`, { replace: true });
          return;
        }
        if (result.payment?.status === "failed" || ["cancelled", "failed"].includes(gatewayStatus)) {
          setState({ status: "error", message: "The payment was not completed. No CareBridge receipt has been issued." });
          return;
        }
        setState({ status: "pending", message: "Flutterwave has not confirmed the payment yet. CareBridge will keep the invoice unpaid until verification succeeds." });
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error.message || "Payment verification could not be completed." });
      }
    })();
    return () => { cancelled = true; };
  }, [paymentId, transactionId, gatewayStatus, navigate]);

  const Icon = state.status === "checking" ? LoaderCircle : state.status === "pending" ? CircleAlert : CircleAlert;
  return (
    <div>
      <PageHero
        scene="shop"
        eyebrow="Secure checkout"
        title="Payment verification"
        lead="CareBridge never trusts a browser redirect by itself. The server verifies the transaction with Flutterwave before a receipt is issued."
      />
      <section className="card payment-callback-card">
        <Icon size={28} className={state.status === "checking" ? "spin" : ""} aria-hidden="true" />
        <div>
          <h3>{state.status === "checking" ? "Checking payment" : state.status === "pending" ? "Payment still pending" : "Payment not verified"}</h3>
          <p className="muted">{state.message}</p>
          <div className="row-actions" style={{ marginTop: 16 }}>
            {paymentId && state.status === "pending" && <Link className="secondary-btn" to="/pay?tab=bills">Open Shop & pay</Link>}
            {state.status === "error" && <Link className="primary-btn" to="/pay?tab=bills">Return to unpaid bills</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
