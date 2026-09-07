import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileClock, FolderKanban, Link2, Save, Workflow } from "lucide-react";
import { api } from "../../api";
import { useAuth, useToast } from "../../state";
import { prettyDate } from "../../utils";
import PageHero from "../../components/PageHero";

export default function AdminCaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ detail: "", stage: "", close: false });
  const [busy, setBusy] = useState(false);

  const load = () => api(`/cases/${id}`).then((c) => { setRow(c); setForm({ detail: "", stage: c.stage, close: c.status === "closed" }); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const next = await api(`/cases/${id}/forms`, { method: "POST", body: JSON.stringify({ actorId: user.id, form: form.close ? "close" : "followup", detail: form.detail, stage: form.close ? (row.workflow[row.workflow.length - 1] || form.stage) : form.stage }) });
      setRow(next); setForm({ detail: "", stage: next.stage, close: next.status === "closed" }); push(form.close ? "Case closed." : "Follow-up form saved on the case.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  if (error) return <p className="error-box">{error}</p>;
  if (!row) return <p className="muted">Loading case…</p>;
  const props = Object.entries(row.properties || {});
  const stageIndex = (row.workflow || []).indexOf(row.stage);

  const moveStage = async (step) => {
    const next = await api(`/cases/${id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, stage: step }) });
    setRow(next); setForm((f) => ({ ...f, stage: next.stage })); push(`Stage set to ${step.replace("_", " ")}`);
  };

  return (
    <div className="case-detail-os">
      <PageHero scene="cases" eyebrow={`${row.typeLabel} · ${row.externalId}`} title={row.caseName} lead={`Owned by ${row.ownerName || "Unassigned"} · ${row.status} operational case`} actions={<div className="row-actions"><Link className="secondary-btn" to="/admin/cases"><ArrowLeft size={15} /> Case registry</Link>{row.link && <Link className="primary-btn" to={row.link}><Link2 size={15} /> Open linked record</Link>}</div>} />

      <section className="case-command-strip">
        <div><span>Case status</span><b className={`status ${row.status === "open" ? "pending" : "completed"}`}>{row.status}</b></div>
        <div><span>Current stage</span><b>{String(row.stage).replaceAll("_", " ")}</b></div>
        <div><span>Owner</span><b>{row.ownerName || "Unassigned"}</b></div>
        <div><span>Forms filed</span><b>{row.events?.length || 0}</b></div>
      </section>

      <section className="product-section case-workflow-section">
        <div className="product-section-head"><div><span className="eyebrow">Workflow</span><h3>Case progression</h3><p>Move the case through its configured operational stages.</p></div><Workflow size={18} /></div>
        <div className="product-case-flow">
          {(row.workflow || []).map((step, i) => <button type="button" key={step} className={`product-case-step ${i <= stageIndex ? "done" : ""} ${step === row.stage ? "current" : ""}`} onClick={() => moveStage(step)}><span>{i < stageIndex ? <CheckCircle2 size={15} /> : i + 1}</span><b>{step.replaceAll("_", " ")}</b><small>{step === row.stage ? "Current" : i < stageIndex ? "Completed" : "Next"}</small></button>)}
        </div>
      </section>

      <div className="case-detail-layout">
        <section className="product-section case-properties-panel">
          <div className="product-section-head"><div><span className="eyebrow">Case record</span><h3>Properties & relationships</h3><p>Operational fields stored on this case.</p></div><FolderKanban size={18} /></div>
          <div className="case-property-grid">
            {props.map(([k, v]) => <div key={k}><span>{k.replaceAll("_", " ")}</span><b>{String(v || "—")}</b></div>)}
            {props.length === 0 && <div className="product-empty-inline"><FolderKanban size={18} /><span>No properties saved on this case.</span></div>}
          </div>
          {row.parent && <div className="case-relation-block"><span>Parent case</span><Link to={`/admin/cases/${row.parent.id}`}><b>{row.parent.caseName}</b><small>Open parent workflow</small></Link></div>}
          {row.children?.length > 0 && <div className="case-relation-block"><span>Child cases</span>{row.children.map((c) => <button type="button" key={c.id} onClick={() => navigate(`/admin/cases/${c.id}`)}><b>{c.caseName}</b><small>{c.caseType} · {c.stage}</small><em className={`status ${c.status === "open" ? "pending" : "completed"}`}>{c.status}</em></button>)}</div>}
        </section>

        <section className="product-section case-activity-panel">
          <div className="product-section-head"><div><span className="eyebrow">Form history</span><h3>Case activity</h3><p>Registration, follow-up and closure actions.</p></div><FileClock size={18} /></div>
          <div className="case-event-timeline">{(row.events || []).slice().reverse().map((ev) => <article key={ev.id}><i /><div><span><b>{ev.form}</b><small>{prettyDate(ev.at)}</small></span><strong>{ev.actorName}</strong><p>{ev.detail}</p></div></article>)}</div>
          {row.status !== "closed" && <form className="case-followup-form" onSubmit={submit}>
            <div className="case-form-head"><span className="eyebrow">New workflow form</span><h3>Record follow-up</h3></div>
            <label>Move to stage<select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{(row.workflow || []).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
            <label>Operational note<textarea rows="3" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} required placeholder="What changed on this case?" /></label>
            <label className="check-row"><input type="checkbox" checked={form.close} onChange={(e) => setForm({ ...form, close: e.target.checked })} /> Close this case after saving</label>
            <button className="primary-btn" disabled={busy}><Save size={15} /> {busy ? "Saving…" : "Save follow-up"}</button>
          </form>}
        </section>
      </div>
    </div>
  );
}
