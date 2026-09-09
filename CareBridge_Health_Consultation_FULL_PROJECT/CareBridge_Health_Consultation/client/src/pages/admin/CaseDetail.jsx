import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileClock, FolderKanban, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../../api";
import { useAuth, useToast } from "../../state";
import { prettyDate } from "../../utils";

export default function AdminCaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ detail: "", stage: "", close: false });
  const [busy, setBusy] = useState(false);

  const load = () => {
    api(`/cases/${id}`).then((next) => {
      setRow(next);
      setForm({ detail: "", stage: next.stage, close: next.status === "closed" });
    }).catch((err) => setError(err.message));
  };
  useEffect(() => { load(); }, [id]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const next = await api(`/cases/${id}/forms`, { method: "POST", body: JSON.stringify({ actorId: user.id, form: form.close ? "close" : "followup", detail: form.detail, stage: form.close ? (row.workflow[row.workflow.length - 1] || form.stage) : form.stage }) });
      setRow(next);
      setForm({ detail: "", stage: next.stage, close: next.status === "closed" });
      push(form.close ? "Case closed." : "Follow-up saved.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  if (error) return <div className="px-empty"><FolderKanban size={28} /><h3>{error}</h3></div>;
  if (!row) return <div className="px-empty"><FileClock size={28} /><h3>Loading case…</h3></div>;

  const props = Object.entries(row.properties || {});
  const stageIndex = (row.workflow || []).indexOf(row.stage);

  const jumpStage = async (step) => {
    const next = await api(`/cases/${id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, stage: step }) });
    setRow(next);
    setForm((current) => ({ ...current, stage: next.stage }));
    push(`Stage set to ${step.replaceAll("_", " ")}`);
  };

  return (
    <div className="px-page px-case-detail">
      <section className="px-case-detail-hero">
        <button className="px-back" type="button" onClick={() => navigate("/admin/cases")}><ArrowLeft size={16} /> Case registry</button>
        <div className="px-case-detail-copy"><span className="px-kicker"><Sparkles size={14} /> {row.typeLabel}</span><h1>{row.caseName}</h1><p>Case {row.externalId} · owned by {row.ownerName || "Unassigned"}</p></div>
        <div className="px-case-detail-state"><span>Status</span><strong className={`status ${row.status === "open" ? "pending" : "completed"}`}>{row.status}</strong><small>Current stage · {row.stage.replaceAll("_", " ")}</small>{row.link && <Link to={row.link}>Open hospital record</Link>}</div>
      </section>

      <section className="px-case-flow-board">
        <header><div><span className="px-kicker">Lifecycle</span><h2>Workflow progression</h2></div><span className="px-case-progress">{Math.max(0, stageIndex + 1)} / {(row.workflow || []).length} stages</span></header>
        <div className="px-case-flow">{(row.workflow || []).map((step, index) => <button type="button" key={step} className={`${index <= stageIndex ? "done" : ""} ${step === row.stage ? "current" : ""}`} onClick={() => jumpStage(step)}><span>{index < stageIndex ? <CheckCircle2 size={15} /> : index + 1}</span><strong>{step.replaceAll("_", " ")}</strong><i /></button>)}</div>
      </section>

      <div className="px-case-detail-grid">
        <section className="px-case-facts">
          <header><span className="px-kicker">Case properties</span><h2>Operational context</h2></header>
          <div className="px-property-grid">{props.map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><strong>{String(value || "—")}</strong></div>)}{props.length === 0 && <div className="px-empty compact"><FolderKanban size={24} /><h3>No properties saved</h3></div>}</div>
          {row.parent && <div className="px-case-relation"><span>Parent case</span><Link to={`/admin/cases/${row.parent.id}`}>{row.parent.caseName}</Link></div>}
          {row.children?.length > 0 && <div className="px-case-children"><span className="px-kicker">Child cases</span>{row.children.map((child) => <button key={child.id} type="button" onClick={() => navigate(`/admin/cases/${child.id}`)}><span><strong>{child.caseName}</strong><small>{child.caseType} · {child.stage}</small></span><b className={`status ${child.status === "open" ? "pending" : "completed"}`}>{child.status}</b></button>)}</div>}
          <div className="px-case-assurance"><ShieldCheck size={16} /><span>Case changes are attributed to authenticated CareBridge operators.</span></div>
        </section>

        <section className="px-case-activity">
          <header><span className="px-kicker">Form history</span><h2>Lifecycle activity</h2><p>Registration, follow-up and close events remain attached to this case.</p></header>
          <div className="px-case-events">{(row.events || []).slice().reverse().map((event) => <article key={event.id}><span className="px-case-event-dot" /><div><strong>{event.form}</strong><small>{event.actorName} · {prettyDate(event.at)}</small><p>{event.detail}</p></div></article>)}{!row.events?.length && <div className="px-empty compact"><FileClock size={24} /><h3>No form history yet</h3></div>}</div>
          {row.status !== "closed" && <form className="px-case-followup" onSubmit={submit}><span className="px-kicker">New follow-up</span><label>Move to stage<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{(row.workflow || []).map((step) => <option key={step} value={step}>{step.replaceAll("_", " ")}</option>)}</select></label><label>What changed?<textarea rows="4" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} required /></label><label className="px-case-close"><input type="checkbox" checked={form.close} onChange={(event) => setForm({ ...form, close: event.target.checked })} /><span>Close this case after saving</span></label><button className="px-primary" disabled={busy}>{busy ? "Saving…" : "Save follow-up"}</button></form>}
        </section>
      </div>
    </div>
  );
}
