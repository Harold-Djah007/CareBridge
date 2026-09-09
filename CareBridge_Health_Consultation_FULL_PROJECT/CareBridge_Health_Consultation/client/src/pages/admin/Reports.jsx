import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, CreditCard, FileClock, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../../api";
import { prettyDate } from "../../utils";

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState("reports");
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api("/admin/reports").then(setStats);
    api("/admin/audit").then(setAudit);
    api("/finance/payments").then(setPayments);
  }, []);

  const paid = useMemo(() => payments.filter((payment) => payment.status === "paid"), [payments]);
  const pending = useMemo(() => payments.filter((payment) => payment.status !== "paid"), [payments]);
  if (!stats) return <div className="px-empty"><Activity size={28} /><h3>Loading hospital intelligence…</h3></div>;

  return (
    <div className="px-page px-intelligence">
      <section className="px-admin-title px-report-title">
        <div><span className="px-kicker"><Sparkles size={14} /> Intelligence & governance</span><h1>Turn hospital activity into a decision surface.</h1><p>Revenue, visit mix, medication activity and audit events are organised for operational review rather than buried in tables.</p></div>
        <div className="px-admin-title-stat"><span>Collected</span><strong>GHS {Number(stats.revenuePaid || 0).toLocaleString()}</strong><small>GHS {Number(stats.revenueDue || 0).toLocaleString()} outstanding</small></div>
      </section>

      <section className="px-report-tabs"><button type="button" className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}><BarChart3 size={16} /> Intelligence</button><button type="button" className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}><CreditCard size={16} /> Payments</button><button type="button" className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><FileClock size={16} /> Audit trail</button></section>

      {tab === "reports" && <>
        <section className="px-report-metrics">
          <article className="primary"><span>Revenue collected</span><strong>GHS {Number(stats.revenuePaid || 0).toLocaleString()}</strong><small>{Number(stats.revenueDue || 0).toLocaleString()} still due</small><i /></article>
          <article><span>Open prescriptions</span><strong>{stats.openRx}</strong><small>{stats.notesThisMonth} signed notes this month</small></article>
          <article><span>Video consultations</span><strong>{stats.videoVisits}</strong><small>{stats.campusVisits} campus visits</small></article>
          <article><span>Completed visits</span><strong>{stats.completedVisits}</strong><small>{stats.intakes} intakes · {stats.consents} telehealth consents</small></article>
        </section>
        <section className="px-insight-grid"><article><header><span className="px-kicker">Clinical signal</span><ShieldCheck size={17} /></header><strong>{stats.allergies}</strong><h3>patients carry an allergy flag</h3><p>Keep allergy visibility in the clinical record and medication workflows before treatment decisions.</p></article><article><header><span className="px-kicker">Payment health</span><CreditCard size={17} /></header><strong>{paid.length}</strong><h3>verified payments posted</h3><p>{pending.length} payment{pending.length === 1 ? "" : "s"} remain pending or awaiting review.</p></article><article><header><span className="px-kicker">Care mix</span><BarChart3 size={17} /></header><strong>{Number(stats.videoVisits || 0) + Number(stats.campusVisits || 0)}</strong><h3>tracked encounter modes</h3><p>Video and campus volumes remain visible together for service planning.</p></article></section>
      </>}

      {tab === "payments" && <section className="px-report-ledger"><header className="px-board-head"><div><span className="px-kicker">Payment ledger</span><h2>{payments.length} transactions</h2></div><span className="px-board-note">Provider-verified and manually reviewed payments</span></header><div className="px-report-row-head"><span>When</span><span>Receipt</span><span>Method</span><span>Amount</span><span>Status</span></div><div>{payments.map((payment) => <article className="px-report-row" key={payment.id}><time>{prettyDate(payment.confirmedAt || payment.createdAt)}</time><Link to={`/receipts/${payment.id}`}>{payment.receiptNo || payment.id}</Link><span>{payment.method}{payment.network ? ` · ${payment.network}` : ""}</span><strong>GHS {Number(payment.amount || 0).toLocaleString()}</strong><span className={`status ${payment.status === "paid" ? "confirmed" : "pending"}`}>{payment.status}</span></article>)}{payments.length === 0 && <div className="px-empty"><CreditCard size={28} /><h3>No payments posted</h3></div>}</div></section>}

      {tab === "audit" && <section className="px-audit-stream"><header className="px-board-head"><div><span className="px-kicker">Governance trail</span><h2>{audit.length} recorded events</h2></div><span className="px-board-note">Who changed what, and when</span></header><div>{audit.map((row) => <article className="px-audit-row" key={row.id}><time>{prettyDate(row.at)}</time><span className="px-audit-dot" /><div><strong>{row.action}</strong><p>{row.detail}</p></div><span>{row.actor?.name || row.actorId || "System"}</span></article>)}{audit.length === 0 && <div className="px-empty"><FileClock size={28} /><h3>No audit events</h3></div>}</div></section>}
    </div>
  );
}
