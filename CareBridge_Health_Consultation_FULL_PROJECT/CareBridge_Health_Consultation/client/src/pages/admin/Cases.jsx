import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderKanban, Search, Sparkles } from "lucide-react";
import { api } from "../../api";
import { prettyDate } from "../../utils";

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

  const byType = useMemo(() => {
    const counts = {};
    rows.forEach((row) => { counts[row.typeLabel] = (counts[row.typeLabel] || 0) + 1; });
    return counts;
  }, [rows]);

  return (
    <div className="px-page px-case-registry">
      <section className="px-admin-title px-case-title">
        <div><span className="px-kicker"><Sparkles size={14} /> Operational case registry</span><h1>Follow work as a lifecycle, not a spreadsheet.</h1><p>Patient files, encounters, admissions, billing and support cases stay connected to stage, ownership and follow-up history.</p></div>
        <div className="px-admin-title-stat"><span>Cases in view</span><strong>{rows.length}</strong><small>{status === "all" ? "all statuses" : status}</small></div>
      </section>

      <section className="px-case-filterbar">
        <label><Search size={15} /><input value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") load(); }} placeholder="Search name, MRN, property" /></label>
        <div className="px-case-filterset"><span>Type</span><select value={type} onChange={(event) => setFilter("type", event.target.value)}><option value="all">All types</option>{(meta.types || []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        <div className="px-segmented">{["open","closed","all"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setFilter("status", item)}>{item}</button>)}</div>
      </section>

      <section className="px-case-board">
        <header className="px-board-head"><div><span className="px-kicker">Workflow registry</span><h2>{rows.length} case{rows.length === 1 ? "" : "s"}</h2></div><div className="px-case-type-summary">{Object.entries(byType).slice(0,4).map(([label,count]) => <span key={label}><b>{count}</b>{label}</span>)}</div></header>
        <div className="px-case-head"><span>Case</span><span>Type</span><span>Stage</span><span>Owner</span><span>Modified</span><span>Status</span></div>
        <div className="px-case-list">{rows.map((row) => <button type="button" className="px-case-row" key={row.id} onClick={() => navigate(`/admin/cases/${row.id}`)}>
          <div><span className="px-case-icon"><FolderKanban size={16} /></span><span><strong>{row.caseName}</strong><small>{row.externalId}{row.parent ? ` · child of ${row.parent.caseName}` : ""}</small></span></div>
          <span>{row.typeLabel}</span>
          <span><em>{row.stage.replaceAll("_", " ")}</em></span>
          <span>{row.ownerName || "—"}</span>
          <time>{prettyDate(row.lastModified)}</time>
          <span><b className={`status ${row.status === "open" ? "pending" : "completed"}`}>{row.status}</b></span>
        </button>)}{rows.length === 0 && <div className="px-empty"><FolderKanban size={28} /><h3>No cases match this filter</h3><p>Register a patient, book a visit, open a bill or create a support request to create operational cases.</p></div>}</div>
      </section>
    </div>
  );
}
