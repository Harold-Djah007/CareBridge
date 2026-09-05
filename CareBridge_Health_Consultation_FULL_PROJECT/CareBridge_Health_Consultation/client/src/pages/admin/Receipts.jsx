import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../../api";
import { ghs, prettyDate } from "../../utils";

function receiptKey(row) {
  return row.paymentId || row.receiptNo || row.id;
}

function haystack(row) {
  return [
    row.patient?.name, row.patient?.mrn, row.receiptNo, row.paymentId,
    row.item, row.method, row.id, row.reference,
  ].filter(Boolean).join(" ").toLowerCase();
}

export default function AdminReceipts() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api("/billing?role=admin").then(setInvoices).catch(() => {});
    api("/finance/payments").then(setPayments).catch(() => {});
  }, []);

  const paid = useMemo(() => {
    const fromPayments = (payments || [])
      .filter((p) => p.status === "paid")
      .map((p) => {
        const inv = invoices.find((i) => i.id === p.invoiceId || (p.invoiceIds || []).includes(i.id));
        return {
          id: p.id,
          paymentId: p.id,
          receiptNo: p.receiptNo,
          reference: p.reference,
          item: inv?.item || (p.invoiceIds?.length > 1 ? `${p.invoiceIds.length} billed items` : "Hospital payment"),
          amount: p.amount,
          method: inv?.method || p.method,
          date: p.confirmedAt || p.createdAt,
          patient: p.patient || inv?.patient,
        };
      });
    const seen = new Set(fromPayments.map((r) => r.receiptNo || r.paymentId));
    const fromInvoices = invoices
      .filter((i) => i.status === "paid")
      .filter((i) => !seen.has(i.receiptNo) && !seen.has(i.paymentId) && !fromPayments.some((r) => r.paymentId === i.paymentId || r.id === i.id))
      .map((i) => ({
        id: i.id,
        paymentId: i.paymentId || i.receiptNo || i.id,
        receiptNo: i.receiptNo || i.paymentId || i.id,
        item: i.item,
        amount: i.amount,
        method: i.method,
        date: i.paidAt || i.date,
        patient: i.patient,
      }));
    return [...fromPayments, ...fromInvoices].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [invoices, payments]);

  const due = invoices.filter((i) => i.status === "due");
  const q = query.trim().toLowerCase();
  const visible = q ? paid.filter((row) => haystack(row).includes(q)) : paid;
  const dueVisible = q ? due.filter((row) => haystack(row).includes(q)) : due;

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Accounts</span>
          <h1>Receipts</h1>
          <p>Search and open paid patient receipts. Operations reviews accounts only — patients complete payment in Shop &amp; pay.</p>
        </div>
        <Link className="secondary-btn" to="/billing/tariff">Hospital tariff</Link>
      </div>

      <label className="search-box receipt-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient, MRN, or receipt number"
          aria-label="Search receipts"
        />
      </label>

      <section className="card receipt-ledger">
        <div className="card-head">
          <div>
            <span className="eyebrow">Settled</span>
            <h3>Paid receipts</h3>
          </div>
          <small className="muted">{visible.length} on file</small>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Receipt</th>
              <th>Item</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Posted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="muted">{q ? "No receipts match that search." : "No paid receipts posted yet."}</td></tr>
            )}
            {visible.map((row) => (
              <tr key={receiptKey(row)}>
                <td>
                  <b>{row.patient?.name || "Patient"}</b>
                  <small className="muted" style={{ display: "block" }}>{row.patient?.mrn || "—"}</small>
                </td>
                <td>{row.receiptNo}</td>
                <td>{row.item}</td>
                <td>{ghs(row.amount)}</td>
                <td>{row.method || "—"}</td>
                <td>{row.date?.length > 12 ? prettyDate(row.date) : row.date || "—"}</td>
                <td><Link className="ghost-btn" to={`/receipts/${encodeURIComponent(receiptKey(row))}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card due-readonly">
        <div className="card-head">
          <div>
            <span className="eyebrow">Outstanding</span>
            <h3>Due invoices</h3>
          </div>
          <small className="muted">Read-only · patients settle in Shop &amp; pay</small>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Item</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dueVisible.length === 0 && (
              <tr><td colSpan={5} className="muted">{q ? "No due invoices match that search." : "Nothing outstanding."}</td></tr>
            )}
            {dueVisible.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.patient?.name || "Patient"}</b>
                  <small className="muted" style={{ display: "block" }}>{row.patient?.mrn || "—"}</small>
                </td>
                <td>{row.item}</td>
                <td>{ghs(row.amount)}</td>
                <td>{row.date}</td>
                <td><span className="status pending">due</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
