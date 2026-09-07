import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderKanban, Layers3, Search, Workflow, CheckCircle2, Clock3 } from "lucide-react";
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

  const setFilter = (key, value) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); };
  const stats = useMemo(() => ({
    shown: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    closed: rows.filter((r) => r.status === "closed").length,
    stages: new Set(rows.map((r) => r.stage)).size,
  }), [rows]);

  return (
    <div className="case-ops-os">
      <PageHero scene="cases" eyebrow="Case operations" title="Workflow registry" lead="Track patient files, encounters, admissions, bills and support work as operational cases with stage, ownership and form history." />

      <section className="ops-metric-grid">
        <article className="ops-metric"><span className="ops-metric-icon"><FolderKanban size={17} /></span><div><small>Cases in view</small><strong>{stats.shown}</strong><em>Current filters</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon amber"><Clock3 size={17} /></span><div><small>Open</small><strong>{stats.open}</strong><em>Needs workflow activity</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon green"><CheckCircle2 size={17} /></span><div><small>Closed</small><strong>{stats.closed}</strong><em>Completed in view</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon blue"><Layers3 size={17} /></span><div><small>Active stages</small><strong>{stats.stages}</strong><em>Workflow positions</em></div></article>
      </section>

      <section className="product-section case-registry-panel">
        <div className="case-registry-toolbar">
          <div className="case-filter-stack">
            <div className="directory-role-tabs compact-tabs"><button className={type === "all" ? "active" : ""} onClick={() => setFilter("type", "all")}>All types</button>{(meta.types || []).map((t) => <button key={t.id} className={type === t.id ? "active" : ""} onClick={() => setFilter("type", t.id)}>{t.label}</button>)}</div>
            <div className="directory-role-tabs compact-tabs">{[["open","Open"],["closed","Closed"],["all","All statuses"]].map(([id,label]) => <button key={id} className={status === id ? "active" : ""} onClick={() => setFilter("status", id)}>{label}</button>)}</div>
          </div>
          <form className="directory-search case-search" onSubmit={(e) => { e.preventDefault(); load(); }}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, MRN, case ID or property" /></form>
        </div>

        <div className="case-registry-head"><span>Case</span><span>Type</span><span>Workflow stage</span><span>Owner</span><span>Last activity</span><span>Status</span></div>
        <div className="case-registry-list">
          {rows.map((c) => <button type="button" className="case-registry-row" key={c.id} onClick={() => navigate(`/admin/cases/${c.id}`)}>
            <span className="case-identity"><i><FolderKanban size={15} /></i><span><b>{c.caseName}</b><small>{c.externalId}{c.parent ? ` · child of ${c.parent.caseName}` : ""}</small></span></span>
            <span><b>{c.typeLabel}</b><small>{c.caseType || "Operational case"}</small></span>
            <span className="case-stage"><Workflow size={14} /><b>{String(c.stage || "—").replaceAll("_", " ")}</b></span>
            <span>{c.ownerName || "Unassigned"}</span>
            <span>{prettyDate(c.lastModified)}</span>
            <span><em className={`status ${c.status === "open" ? "pending" : "completed"}`}>{c.status}</em></span>
          </button>)}
          {rows.length === 0 && <div className="product-empty-inline"><FolderKanban size={18} /><span>No cases match this operational view.</span></div>}
        </div>
      </section>
    </div>
  );
}
