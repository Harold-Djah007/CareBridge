import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, FolderKanban } from "lucide-react";
import { api } from "../../api";
import { prettyDate } from "../../utils";
import PageHero from "../../components/PageHero";

export default function AdminCases() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ types: [] });
  const type = params.get("type") || "all";
  const status = params.get("status") || "open";
  const [q, setQ] = useState(params.get("q") || "");

  const load = () => {
    const qs = new URLSearchParams();
    if (type !== "all") qs.set("type", type);
    if (status !== "all") qs.set("status", status);
    if (q.trim()) qs.set("q", q.trim());
    api(`/cases?${qs.toString()}`).then(setRows);
  };

  useEffect(() => { api("/cases/meta").then(setMeta); }, []);
  useEffect(() => { load(); }, [type, status]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHero
        scene="cases"
        eyebrow="Case management"
        title="Case workflow"
        lead="CommCare-style case list. Each patient file, encounter, admission, bill, and support ticket is a case with properties, a stage, and a form history. Open a row for the case detail."
      />

      <div className="filters">
        <button className={type === "all" ? "active" : ""} onClick={() => setFilter("type", "all")}>All types</button>
        {(meta.types || []).map((t) => (
          <button key={t.id} className={type === t.id ? "active" : ""} onClick={() => setFilter("type", t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="filters">
        <button className={status === "open" ? "active" : ""} onClick={() => setFilter("status", "open")}>Open</button>
        <button className={status === "closed" ? "active" : ""} onClick={() => setFilter("status", "closed")}>Closed</button>
        <button className={status === "all" ? "active" : ""} onClick={() => setFilter("status", "all")}>All statuses</button>
        <form className="search-box" style={{ marginLeft: "auto", maxWidth: 280 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, MRN, property" />
        </form>
      </div>

      <section className="card" style={{ overflow: "auto" }}>
        <div className="card-head">
          <div>
            <span className="eyebrow">Case list</span>
            <h3><FolderKanban size={16} /> {rows.length} cases{status !== "all" ? ` · ${status}` : ""}</h3>
          </div>
        </div>
        <table className="table case-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Case ID</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Last modified</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="muted">No cases in this filter. Register a patient, book a visit, or open a bill to create one.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="case-row" onClick={() => navigate(`/admin/cases/${c.id}`)}>
                <td>
                  <b>{c.caseName}</b>
                  {c.parent && <small className="muted" style={{ display: "block" }}>Child of {c.parent.caseName}</small>}
                </td>
                <td>{c.typeLabel}</td>
                <td><code>{c.externalId}</code></td>
                <td><span className="stage-pill">{c.stage.replace("_", " ")}</span></td>
                <td>{c.ownerName || "—"}</td>
                <td>{prettyDate(c.lastModified)}</td>
                <td><span className={`status ${c.status === "open" ? "pending" : "completed"}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
