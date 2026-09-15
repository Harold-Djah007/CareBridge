import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardPlus, FlaskConical,
  Image, LoaderCircle, Pill, Search, ShieldCheck, Stethoscope, XCircle,
} from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import Avatar from "../components/Avatar";
import { prettyDate } from "../utils";

const TYPES = [
  { id: "lab", label: "Laboratory", icon: FlaskConical },
  { id: "imaging", label: "Imaging", icon: Image },
  { id: "medication", label: "Medication", icon: Pill },
  { id: "procedure", label: "Procedure", icon: Stethoscope },
];

const STATUS_LABEL = {
  draft: "Draft",
  active: "Ordered",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function typeMeta(type) {
  return TYPES.find((item) => item.id === type) || TYPES[0];
}

function nextActions(order, role) {
  if (order.status === "draft") return role === "nurse" ? [] : ["active", "cancelled"];
  if (order.status === "active") return ["in_progress", "completed", ...(role === "nurse" && order.type === "medication" ? [] : ["cancelled"] )];
  if (order.status === "in_progress") return ["completed", ...(role === "nurse" && order.type === "medication" ? [] : ["cancelled"] )];
  return [];
}

function statusIcon(status) {
  if (status === "completed") return CheckCircle2;
  if (status === "cancelled") return XCircle;
  if (status === "in_progress") return LoaderCircle;
  if (status === "active") return Activity;
  return ClipboardPlus;
}

export default function ClinicalOrders() {
  const { user } = useAuth();
  const { push } = useToast();
  const canOrder = user.role === "doctor" || user.role === "admin";
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [result, setResult] = useState({ text: "", flag: "normal" });
  const [form, setForm] = useState({
    type: "lab",
    title: "",
    code: "",
    codeSystem: "http://loinc.org",
    priority: "routine",
    clinicalReason: "",
    instructions: "",
    specimen: "",
    bodySite: "",
    status: "active",
  });

  const loadPatients = async () => {
    try {
      const rows = await api("/patients");
      setPatients(rows);
      setPatientId((current) => current || rows[0]?.id || "");
    } catch (error) { push(error.message, "error"); }
  };

  const loadOrders = async (id = patientId) => {
    if (!id) return;
    try {
      const rows = await api(`/orders?patientId=${encodeURIComponent(id)}`);
      setOrders(rows);
      setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || "");
    } catch (error) { push(error.message, "error"); }
  };

  useEffect(() => { loadPatients(); }, []);
  useEffect(() => { loadOrders(); }, [patientId]);
  useEffect(() => {
    if (!patientId) return undefined;
    const timer = window.setInterval(() => loadOrders(patientId), 15000);
    return () => window.clearInterval(timer);
  }, [patientId]);

  const selectedPatient = patients.find((patient) => patient.id === patientId);
  const selected = orders.find((order) => order.id === selectedId) || null;

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = filter === "all" || (filter === "open" ? !["completed", "cancelled"].includes(order.status) : order.status === filter);
      const queryMatch = !q || `${order.title} ${order.type} ${order.code} ${order.clinicalReason}`.toLowerCase().includes(q);
      return statusMatch && queryMatch;
    });
  }, [orders, filter, query]);

  const counts = useMemo(() => ({
    open: orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length,
    urgent: orders.filter((order) => !["completed", "cancelled"].includes(order.status) && ["urgent", "stat"].includes(order.priority)).length,
    completed: orders.filter((order) => order.status === "completed").length,
    total: orders.length,
  }), [orders]);

  const createOrder = async (event) => {
    event.preventDefault();
    if (!patientId) return push("Choose a patient first.", "error");
    setBusy("create");
    try {
      const created = await api("/orders", {
        method: "POST",
        body: JSON.stringify({ ...form, patientId }),
      });
      setOrders((rows) => [created, ...rows]);
      setSelectedId(created.id);
      setCreateOpen(false);
      setForm((current) => ({ ...current, title: "", code: "", clinicalReason: "", instructions: "", specimen: "", bodySite: "" }));
      push(`${typeMeta(created.type).label} order placed.`);
    } catch (error) { push(error.message, "error"); } finally { setBusy(""); }
  };

  const updateOrder = async (order, status) => {
    setBusy(order.id);
    try {
      const body = { status };
      if (status === "completed") {
        if (["lab", "imaging"].includes(order.type) && !result.text.trim()) {
          push("Enter the clinical result before completing this order.", "error");
          setBusy("");
          return;
        }
        if (result.text.trim()) {
          body.result = result.text.trim();
          body.resultFlag = result.flag;
        }
      }
      const next = await api(`/orders/${order.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setOrders((rows) => rows.map((row) => row.id === next.id ? next : row));
      setResult({ text: "", flag: "normal" });
      push(status === "completed" ? "Result filed to the clinical record." : `Order moved to ${STATUS_LABEL[status].toLowerCase()}.`);
    } catch (error) { push(error.message, "error"); } finally { setBusy(""); }
  };

  return (
    <div className="cb-order-page">
      <header className="cb-order-head">
        <div>
          <span className="cb-order-kicker"><ShieldCheck size={14} /> Computerized provider order entry</span>
          <h1>Clinical orders</h1>
          <p>Place, execute and result diagnostic and treatment orders without leaving the patient’s clinical workflow.</p>
        </div>
        {canOrder && <button type="button" className="primary-btn" onClick={() => setCreateOpen(true)}><ClipboardPlus size={17} /> New order</button>}
      </header>

      <section className="cb-order-patientbar">
        <div className="cb-order-patient-select">
          {selectedPatient && <Avatar person={selectedPatient} />}
          <label>
            <span>Patient context</span>
            <select value={patientId} onChange={(event) => setPatientId(event.target.value)}>
              {patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.name} · {patient.mrn || "MRN pending"}</option>)}
            </select>
          </label>
        </div>
        <div className="cb-order-signals">
          <span><small>Open</small><b>{counts.open}</b></span>
          <span className={counts.urgent ? "attention" : ""}><small>Urgent / STAT</small><b>{counts.urgent}</b></span>
          <span><small>Completed</small><b>{counts.completed}</b></span>
          <span><small>Total</small><b>{counts.total}</b></span>
        </div>
      </section>

      <div className="cb-order-workspace">
        <section className="cb-order-listpane">
          <div className="cb-order-toolbar">
            <label><Search size={15} /><input aria-label="Search clinical orders" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, code or reason" /></label>
            <div>{["open", "active", "in_progress", "completed", "all"].map((id) => <button type="button" key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{id === "in_progress" ? "In progress" : id[0].toUpperCase() + id.slice(1)}</button>)}</div>
          </div>

          <div className="cb-order-list">
            {visibleOrders.length === 0 && <div className="cb-order-empty"><ClipboardPlus size={24} /><strong>No matching clinical orders</strong><span>{canOrder ? "Place a new order for this patient when clinically indicated." : "New orders will appear here when a prescriber creates them."}</span></div>}
            {visibleOrders.map((order) => {
              const TypeIcon = typeMeta(order.type).icon;
              const StatusIcon = statusIcon(order.status);
              return (
                <button type="button" key={order.id} className={`cb-order-row ${selectedId === order.id ? "selected" : ""}`} onClick={() => { setSelectedId(order.id); setResult({ text: order.result || "", flag: order.resultFlag || "normal" }); }}>
                  <span className={`cb-order-type type-${order.type}`}><TypeIcon size={17} /></span>
                  <span className="cb-order-row-copy"><strong>{order.title}</strong><small>{typeMeta(order.type).label}{order.code ? ` · ${order.code}` : ""} · {prettyDate(order.createdAt)}</small></span>
                  <span className={`cb-order-priority priority-${order.priority}`}>{order.priority}</span>
                  <span className={`cb-order-status status-${order.status}`}><StatusIcon size={13} /> {STATUS_LABEL[order.status]}</span>
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="cb-order-detailpane">
          {!selected && <div className="cb-order-empty detail"><Stethoscope size={26} /><strong>Select an order</strong><span>Clinical details, execution status and results will appear here.</span></div>}
          {selected && (() => {
            const TypeIcon = typeMeta(selected.type).icon;
            const actions = nextActions(selected, user.role);
            return (
              <div className="cb-order-detail">
                <header>
                  <span className={`cb-order-type large type-${selected.type}`}><TypeIcon size={22} /></span>
                  <div><small>{typeMeta(selected.type).label} · {selected.id}</small><h2>{selected.title}</h2><p>{selected.clinicalReason || "No clinical reason entered."}</p></div>
                  <span className={`cb-order-status status-${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
                </header>

                <dl className="cb-order-facts">
                  <div><dt>Priority</dt><dd className={`priority-${selected.priority}`}>{selected.priority.toUpperCase()}</dd></div>
                  <div><dt>Ordered by</dt><dd>{selected.orderedBy?.name || "Clinical staff"}</dd></div>
                  <div><dt>Ordered</dt><dd>{prettyDate(selected.createdAt)}</dd></div>
                  <div><dt>Code</dt><dd>{selected.code || "Not coded"}</dd></div>
                  <div><dt>Coding system</dt><dd>{selected.codeSystem || "—"}</dd></div>
                  <div><dt>{selected.type === "lab" ? "Specimen" : "Body site"}</dt><dd>{selected.type === "lab" ? (selected.specimen || "—") : (selected.bodySite || "—")}</dd></div>
                </dl>

                {selected.instructions && <section className="cb-order-note"><small>INSTRUCTIONS</small><p>{selected.instructions}</p></section>}

                {selected.result && <section className="cb-order-result filed"><div><CheckCircle2 size={18} /><span><small>FILED RESULT</small><b>{selected.resultFlag || "review"}</b></span></div><p>{selected.result}</p>{selected.resultRecordId && <small>Filed to patient record · {selected.resultResourceType || "clinical result"} {selected.resultRecordId}</small>}</section>}

                {!["completed", "cancelled"].includes(selected.status) && (
                  <section className="cb-order-result">
                    <div><FlaskConical size={18} /><span><small>RESULT / COMPLETION</small><b>Clinical execution</b></span></div>
                    <textarea aria-label="Clinical result" rows="5" value={result.text} onChange={(event) => setResult({ ...result, text: event.target.value })} placeholder={selected.type === "lab" ? "Enter final laboratory result before completion" : selected.type === "imaging" ? "Enter imaging impression before completion" : "Add completion/result note when appropriate"} />
                    <label>Interpretation<select value={result.flag} onChange={(event) => setResult({ ...result, flag: event.target.value })}><option value="normal">Normal</option><option value="abnormal">Abnormal</option><option value="critical">Critical</option><option value="review">Review</option></select></label>
                  </section>
                )}

                <footer className="cb-order-actions">
                  {actions.map((status) => <button key={status} type="button" disabled={busy === selected.id} className={status === "completed" ? "primary-btn" : status === "cancelled" ? "danger-btn" : "secondary-btn"} onClick={() => updateOrder(selected, status)}>{status === "active" ? "Sign & order" : status === "in_progress" ? "Start work" : status === "completed" ? "Complete & file result" : "Cancel order"}</button>)}
                </footer>
              </div>
            );
          })()}
        </aside>
      </div>

      {createOpen && (
        <div className="cb-order-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <form className="cb-order-sheet" role="dialog" aria-modal="true" aria-labelledby="new-order-title" onSubmit={createOrder}>
            <header><div><span>New CPOE order</span><h2 id="new-order-title">{selectedPatient?.name || "Choose patient"}</h2><p>Structured clinical order with coding, priority and execution metadata.</p></div><button type="button" aria-label="Close new order" onClick={() => setCreateOpen(false)}>×</button></header>
            <div className="cb-order-form">
              <label>Order type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, codeSystem: event.target.value === "lab" ? "http://loinc.org" : form.codeSystem })}>{TYPES.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}</select></label>
              <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select></label>
              <label className="wide">Order name<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Full blood count" /></label>
              <label>Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="LOINC / local code" /></label>
              <label>Coding system<input value={form.codeSystem} onChange={(event) => setForm({ ...form, codeSystem: event.target.value })} placeholder="http://loinc.org" /></label>
              <label className="wide">Clinical reason<textarea rows="3" value={form.clinicalReason} onChange={(event) => setForm({ ...form, clinicalReason: event.target.value })} placeholder="Why this order is clinically indicated" /></label>
              {form.type === "lab" && <label>Specimen<input value={form.specimen} onChange={(event) => setForm({ ...form, specimen: event.target.value })} placeholder="Whole blood, serum…" /></label>}
              {form.type !== "lab" && <label>Body site<input value={form.bodySite} onChange={(event) => setForm({ ...form, bodySite: event.target.value })} placeholder="Chest, left knee…" /></label>}
              <label className="wide">Instructions<textarea rows="3" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Collection, preparation or execution instructions" /></label>
              <label>Initial state<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Sign & order now</option><option value="draft">Save as draft</option></select></label>
            </div>
            <footer><button type="button" className="secondary-btn" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-btn" disabled={busy === "create"}>{busy === "create" ? "Creating…" : form.status === "draft" ? "Save draft" : "Sign & place order"}</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}
