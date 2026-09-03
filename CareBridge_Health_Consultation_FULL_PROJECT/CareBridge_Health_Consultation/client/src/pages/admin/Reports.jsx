import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  if (!stats) return <p className="muted">Loading hospital reports…</p>;

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Governance</span>
          <h1>Reports & audit</h1>
          <p>Revenue, clinical volume, and a trail of who changed what.</p>
        </div>
      </div>
      <div className="filters">
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>Reports</button>
        <button className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}>Payments</button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit log</button>
      </div>
      {tab === "reports" && (
        <>
          <div className="kpi-row">
            <div className="kpi"><span>Collected</span><strong>GHS {stats.revenuePaid.toLocaleString()}</strong><small>GHS {stats.revenueDue.toLocaleString()} outstanding</small></div>
            <div className="kpi"><span>Open prescriptions</span><strong>{stats.openRx}</strong><small>{stats.notesThisMonth} signed notes on file</small></div>
            <div className="kpi"><span>Video vs campus</span><strong>{stats.videoVisits}</strong><small>{stats.campusVisits} face-to-face</small></div>
            <div className="kpi"><span>Completed visits</span><strong>{stats.completedVisits}</strong><small>{stats.intakes} pre-visit forms · {stats.consents} telehealth consents</small></div>
          </div>
          <section className="card">
            <p className="muted">{stats.allergies} patients have an allergy flag. Open a chart from Staff directory or the bed board before you change a medicine.</p>
          </section>
        </>
      )}
      {tab === "payments" && (
        <section className="card" style={{ overflow: "auto" }}>
          <table className="table">
            <thead><tr><th>When</th><th>Receipt</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={5} className="muted">No posted payments yet.</td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{prettyDate(p.confirmedAt || p.createdAt)}</td>
                  <td><Link to={`/receipts/${p.id}`}>{p.receiptNo}</Link></td>
                  <td>{p.method}{p.network ? ` · ${p.network}` : ""}</td>
                  <td>GHS {Number(p.amount).toLocaleString()}</td>
                  <td><span className={`status ${p.status === "paid" ? "confirmed" : "pending"}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "audit" && (
        <section className="card" style={{ overflow: "auto" }}>
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}>
                  <td>{prettyDate(row.at)}</td>
                  <td>{row.actor?.name || row.actorId || "System"}</td>
                  <td>{row.action}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
