import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api";

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
        const result = transactionId
          ? await api("/finance/verify", { method: "POST", body: JSON.stringify({ paymentId, transactionId }) })
          : await api(`/finance/payments/${paymentId}/status?refresh=1`);
        if (cancelled) return;
        if (result.payment?.status === "paid") {
          navigate(`/receipts/${result.payment.id}`, { replace: true });
          return;
        }
        if (result.payment?.status === "failed" || ["cancelled", "failed"].includes(gatewayStatus)) {
          setState({ status: "error", message: "The payment was not completed. No CareBridge receipt has been issued." });
          return;
        }
        setState({ status: "pending", message: "Flutterwave has not confirmed the payment yet. The invoice remains unpaid until verification succeeds." });
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error.message || "Payment verification could not be completed." });
      }
    })();
    return () => { cancelled = true; };
  }, [paymentId, transactionId, gatewayStatus, navigate]);

  const Icon = state.status === "checking" ? LoaderCircle : CircleAlert;
  return (
    <div className="px-page px-payment-callback">
      <section className={`px-callback-stage ${state.status}`}>
        <div className="px-callback-ring"><Icon size={34} className={state.status === "checking" ? "spin-soft" : ""} /></div>
        <span className="px-kicker"><Sparkles size={14} /> Secure payment verification</span>
        <h1>{state.status === "checking" ? "Checking the provider." : state.status === "pending" ? "Payment still pending." : "Payment not verified."}</h1>
        <p>{state.message}</p>
        <div className="px-callback-assurance"><ShieldCheck size={16} /><span>CareBridge never issues a receipt from a browser redirect alone.</span></div>
        <div className="px-callback-actions">{paymentId && state.status === "pending" && <Link className="px-secondary" to={`/payments/${paymentId}`}>Open payment status</Link>}{state.status === "error" && <Link className="px-primary" to="/pay?tab=bills">Return to unpaid bills</Link>}</div>
      </section>
    </div>
  );
}
