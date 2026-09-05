import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

  const load = () => {
    api(`/cases/${id}`).then((c) => {
      setRow(c);
      setForm({ detail: "", stage: c.stage, close: c.status === "closed" });
    }).catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await api(`/cases/${id}/forms`, {
        method: "POST",
        body: JSON.stringify({
          actorId: user.id,
          form: form.close ? "close" : "followup",
          detail: form.detail,
          stage: form.close ? (row.workflow[row.workflow.length - 1] || form.stage) : form.stage,
        }),
      });
      setRow(next);
      setForm({ detail: "", stage: next.stage, close: next.status === "closed" });
      push(form.close ? "Case closed." : "Follow-up form saved on the case.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="error-box">{error}</p>;
  if (!row) return <p className="muted">Loading case…</p>;

  const props = Object.entries(row.properties || {});
  const stageIndex = (row.workflow || []).indexOf(row.stage);

  return (
    <div>
      <PageHero
        scene="cases"
        eyebrow={`Case detail · ${row.typeLabel}`}
        title={row.caseName}
        lead={`Case ID ${row.externalId} · Owner ${row.ownerName || "—"} · ${row.status}`}
        actions={(
          <div className="row-actions">
            <Link className="ghost-btn" to="/admin/cases">Back to case list</Link>
            {row.link && <Link className="secondary-btn" to={row.link}>Open hospital record</Link>}
          </div>
        )}
      />

      <section className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Workflow</span>
        <div className="case-flow">
          {(row.workflow || []).map((step, i) => (
            <button
              type="button"
              key={step}
              className={`case-step ${i <= stageIndex ? "done" : ""} ${step === row.stage ? "current" : ""}`}
              onClick={async () => {
                const next = await api(`/cases/${id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, stage: step }) });
                setRow(next);
                setForm((f) => ({ ...f, stage: next.stage }));
                push(`Stage set to ${step.replace("_", " ")}`);
              }}
            >
              <em>{i + 1}</em>
              {step.replace("_", " ")}
            </button>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Case properties</h3>
          <table className="table">
            <tbody>
              {props.length === 0 && <tr><td className="muted">No properties saved on this case.</td></tr>}
              {props.map(([k, v]) => (
                <tr key={k}><th style={{ width: 160, textTransform: "capitalize" }}>{k.replaceAll("_", " ")}</th><td>{String(v || "—")}</td></tr>
              ))}
            </tbody>
          </table>
          {row.parent && (
            <p style={{ marginTop: 12 }}>
              Parent case: <Link to={`/admin/cases/${row.parent.id}`}><b>{row.parent.caseName}</b></Link>
            </p>
          )}
          {row.children?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3>Child cases</h3>
              {row.children.map((c) => (
                <button type="button" key={c.id} className="pay-pick" onClick={() => navigate(`/admin/cases/${c.id}`)}>
                  <span><b>{c.caseName}</b><small>{c.caseType} · {c.stage}</small></span>
                  <strong className={`status ${c.status === "open" ? "pending" : "completed"}`}>{c.status}</strong>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h3>Forms on this case</h3>
          <p className="muted">Registration opened the case. Follow-up forms update properties and stage. Close ends the workflow.</p>
          {(row.events || []).slice().reverse().map((ev) => (
            <article className="ticket-msg" key={ev.id}>
              <b>{ev.form} · {ev.actorName}</b>
              <small>{prettyDate(ev.at)}</small>
              <p>{ev.detail}</p>
            </article>
          ))}
          {row.status !== "closed" && (
            <form className="pay-form" onSubmit={submit} style={{ marginTop: 16 }}>
              <h3>Follow-up form</h3>
              <label>Move to stage
                <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                  {(row.workflow || []).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </label>
              <label>Notes<textarea rows="3" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} required placeholder="What changed on this case?" /></label>
              <label className="check-row">
                <input type="checkbox" checked={form.close} onChange={(e) => setForm({ ...form, close: e.target.checked })} />
                Close this case
              </label>
              <button className="primary-btn" disabled={busy}>{busy ? "Saving…" : "Save form"}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
