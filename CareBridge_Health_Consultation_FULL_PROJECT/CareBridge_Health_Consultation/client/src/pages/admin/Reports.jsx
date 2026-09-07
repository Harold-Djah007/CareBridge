import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Banknote, FileCheck2, MonitorSmartphone, Receipt, ScrollText, ShieldCheck, TrendingUp } from "lucide-react";
import { api } from "../../api";
import { prettyDate } from "../../utils";
import PageHero from "../../components/PageHero";

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState("reports");
  const [payments, setPayments] = useState([]);

  useEffect(() => { api("/admin/reports").then(setStats); api("/admin/audit").then(setAudit); api("/finance/payments").then(setPayments); }, []);
  const paid = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);
  const gateway = useMemo(() => paid.filter((p) => ["card", "momo", "bank"].includes(p.method)).length, [paid]);

  if (!stats) return <p className="muted">Loading hospital intelligence…</p>;

  return (
    <div className="analytics-os">
      <PageHero scene="reports" eyebrow="Hospital intelligence" title="Analytics & governance" lead="A commercial operations view of revenue, clinical activity, digital care and the audit trail behind every material action." />

      <div className="product-tabbar analytics-tabs">
        {[['reports','Executive view'],['payments','Payments ledger'],['audit','Audit trail']].map(([id,label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === "reports" && <>
        <section className="ops-metric-grid analytics-kpis">
          <article className="ops-metric"><span className="ops-metric-icon green"><Banknote size={17} /></span><div><small>Revenue collected</small><strong>GHS {Number(stats.revenuePaid || 0).toLocaleString()}</strong><em>GHS {Number(stats.revenueDue || 0).toLocaleString()} outstanding</em></div></article>
          <article className="ops-metric"><span className="ops-metric-icon"><Activity size={17} /></span><div><small>Completed visits</small><strong>{stats.completedVisits}</strong><em>{stats.notesThisMonth} signed notes</em></div></article>
          <article className="ops-metric"><span className="ops-metric-icon blue"><MonitorSmartphone size={17} /></span><div><small>Digital care</small><strong>{stats.videoVisits}</strong><em>{stats.campusVisits} campus visits</em></div></article>
          <article className="ops-metric"><span className="ops-metric-icon amber"><FileCheck2 size={17} /></span><div><small>Clinical readiness</small><strong>{stats.intakes}</strong><em>{stats.consents} telehealth consents</em></div></article>
        </section>

        <div className="analytics-layout">
          <section className="product-section analytics-panel">
            <div className="product-section-head"><div><span className="eyebrow">Operational pulse</span><h3>Care delivery mix</h3><p>Current workload signals across hospital services.</p></div><TrendingUp size={18} /></div>
            <div className="analytics-signal-list">
              <div><span><MonitorSmartphone size={15} /><b>Video consultations</b></span><strong>{stats.videoVisits}</strong></div>
              <div><span><Activity size={15} /><b>Campus consultations</b></span><strong>{stats.campusVisits}</strong></div>
              <div><span><Receipt size={15} /><b>Open prescriptions</b></span><strong>{stats.openRx}</strong></div>
              <div><span><ShieldCheck size={15} /><b>Allergy-flagged patients</b></span><strong>{stats.allergies}</strong></div>
            </div>
          </section>
          <section className="product-section analytics-panel governance-panel">
            <div className="product-section-head"><div><span className="eyebrow">Governance</span><h3>Clinical safety signal</h3><p>Critical information operations teams should keep visible.</p></div><ShieldCheck size={18} /></div>
            <div className="governance-callout"><b>{stats.allergies}</b><span>patient record{stats.allergies === 1 ? "" : "s"} currently carry an allergy flag.</span></div>
            <p>Review the clinical record before medication or admission changes. Audit history below records who changed what and when.</p>
          </section>
        </div>
      </>}

      {tab === "payments" && <section className="product-section ledger-panel">
        <div className="product-section-head"><div><span className="eyebrow">Finance</span><h3>Verified payment ledger</h3><p>{paid.length} posted payments · {gateway} verified through online gateway methods.</p></div><Receipt size={18} /></div>
        <div className="directory-table-wrap"><table className="table product-directory-table"><thead><tr><th>Posted</th><th>Receipt</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          {payments.length === 0 && <tr><td colSpan={5}><div className="product-empty-inline"><Receipt size={18} /><span>No posted payments yet.</span></div></td></tr>}
          {payments.map((p) => <tr key={p.id}><td>{prettyDate(p.confirmedAt || p.createdAt)}</td><td><Link to={`/receipts/${p.id}`}><b>{p.receiptNo || p.id}</b></Link></td><td>{p.method}{p.network ? ` · ${p.network}` : ""}</td><td><b>GHS {Number(p.amount || 0).toLocaleString()}</b></td><td><span className={`status ${p.status === "paid" ? "confirmed" : "pending"}`}>{p.status}</span></td></tr>)}
        </tbody></table></div>
      </section>}

      {tab === "audit" && <section className="product-section audit-panel">
        <div className="product-section-head"><div><span className="eyebrow">Governance trail</span><h3>Who changed what</h3><p>Chronological trace of account, clinical and operational activity.</p></div><ScrollText size={18} /></div>
        <div className="audit-timeline">
          {audit.map((row) => <article key={row.id}><span className="audit-dot" /><div className="audit-when"><b>{prettyDate(row.at)}</b><small>{row.actor?.name || row.actorId || "System"}</small></div><div className="audit-body"><strong>{row.action}</strong><p>{row.detail}</p></div></article>)}
          {audit.length === 0 && <div className="product-empty-inline"><ScrollText size={18} /><span>No audit entries yet.</span></div>}
        </div>
      </section>}
    </div>
  );
}
