import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Banknote, Building2, CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { api, socketOptions, socketUrl } from "../api";
import { HOSPITAL, ghs, prettyDate } from "../utils";
import { useAuth, useToast } from "../state";
import PublicChrome from "../components/PublicChrome";
import PageHero from "../components/PageHero";

function MapEditor({ title, note, values, onChange, extra }) {
  return <section className="product-section tariff-editor"><div className="product-section-head"><div><span className="eyebrow">Pricing block</span><h3>{title}</h3>{note && <p>{note}</p>}</div></div><div className="tariff-editor-extra">{extra}</div><div className="directory-table-wrap"><table className="table product-directory-table tariff-table"><thead><tr><th>Item</th><th>Fee (GHS)</th></tr></thead><tbody>{Object.entries(values || {}).map(([name, fee]) => <tr key={name}><td><b>{name}</b></td><td><input className="stock-input" type="number" min="0" value={fee} onChange={(e) => onChange({ ...values, [name]: e.target.value })} /></td></tr>)}</tbody></table></div></section>;
}

function RowsEditor({ title, rows, fields, onChange }) {
  const setRow = (i, patch) => onChange(rows.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  return <section className="product-section tariff-editor"><div className="product-section-head"><div><span className="eyebrow">Published price list</span><h3>{title}</h3></div></div><div className="directory-table-wrap"><table className="table product-directory-table tariff-table"><thead><tr>{fields.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{fields.map((f) => <td key={f.key}>{f.type === "check" ? <input type="checkbox" checked={Boolean(row[f.key])} onChange={(e) => setRow(i, { [f.key]: e.target.checked })} /> : <input className={f.type === "number" ? "stock-input" : ""} type={f.type || "text"} min={f.type === "number" ? 0 : undefined} value={row[f.key] ?? ""} onChange={(e) => setRow(i, { [f.key]: e.target.value })} />}</td>)}</tr>)}</tbody></table></div></section>;
}

function ReadTable({ title, columns, rows }) {
  return <section className="product-section tariff-read-panel"><div className="product-section-head"><div><span className="eyebrow">Published tariff</span><h3>{title}</h3></div></div><div className="directory-table-wrap"><table className="table product-directory-table tariff-table"><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows}</tbody></table></div></section>;
}

export default function Tariff() {
  const { user } = useAuth();
  const { push } = useToast();
  const [rates, setRates] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = user && (user.role === "doctor" || user.role === "admin");

  useEffect(() => {
    api("/finance/rates").then((r) => { setRates(r); setDraft(r); });
    const socket = io(socketUrl, socketOptions());
    socket.on("tariff-updated", (payload) => { setRates(payload); if (!canEdit) setDraft(payload); });
    socket.on("pharmacy-stock", (pharmacy) => { setRates((r) => r ? { ...r, pharmacy } : r); setDraft((d) => d && !canEdit ? { ...d, pharmacy } : d); });
    return () => socket.disconnect();
  }, [canEdit]);

  if (!rates || !draft) return <p className="muted">Loading hospital tariff…</p>;

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const next = await api("/finance/rates", { method: "PATCH", body: JSON.stringify({ actorId: user.id, consults: draft.consults, campusSurcharge: draft.campusSurcharge, consultNote: draft.consultNote, wards: draft.wards, rooms: draft.rooms, wardNote: draft.wardNote, labs: draft.labs, services: draft.services, pharmacy: (draft.pharmacy || []).map((p) => ({ id: p.id, price: p.price, nhis: p.nhis })) }) });
      setRates(next); setDraft(next); push("Hospital tariff published. Patients see these fees now.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  const body = <div className="tariff-os">
    {user ? <PageHero scene="billing" eyebrow={`${HOSPITAL.campus} · finance`} title={canEdit ? "Tariff manager" : "Hospital tariff"} lead={`Published Ghana-cedi pricing for consultations, admissions, laboratory, pharmacy and hospital services.${rates.updatedAt ? ` Last published ${prettyDate(rates.updatedAt)}${rates.updatedBy ? ` by ${rates.updatedBy}` : ""}.` : ""}`} actions={<>{user.role === "patient" && <Link className="primary-btn" to="/pay">Shop & pay</Link>}{canEdit && <button className="primary-btn" type="submit" form="tariff-form" disabled={busy}>{busy ? "Publishing…" : "Publish tariff"}</button>}</>} /> : <div className="page-title"><div><span className="eyebrow">{HOSPITAL.campus} accounts</span><h1>Hospital tariff</h1><p>Published fees in Ghana cedis.</p></div></div>}

    <section className="ops-metric-grid tariff-kpis">
      <article className="ops-metric"><span className="ops-metric-icon"><Banknote size={17} /></span><div><small>Currency</small><strong>GHS</strong><em>Published hospital pricing</em></div></article>
      <article className="ops-metric"><span className="ops-metric-icon green"><CreditCard size={17} /></span><div><small>Digital settlement</small><strong>MoMo</strong><em>Card / mobile money / bank</em></div></article>
      <article className="ops-metric"><span className="ops-metric-icon blue"><ShieldCheck size={17} /></span><div><small>Coverage</small><strong>NHIS</strong><em>Eligible items flagged</em></div></article>
      <article className="ops-metric"><span className="ops-metric-icon amber"><Building2 size={17} /></span><div><small>Campus surcharge</small><strong>{ghs(rates.campusSurcharge || 0)}</strong><em>In-person consultation</em></div></article>
    </section>

    <section className="settlement-console product-section">
      <div className="product-section-head"><div><span className="eyebrow">Settlement rails</span><h3>Hospital payment accounts</h3><p>Official routes for paying a CareBridge bill.</p></div><Landmark size={18} /></div>
      <div className="settlement-grid">
        <article><span className="settlement-icon"><CreditCard size={17} /></span><div><small>Mobile money</small><b>{rates.accounts.momo.name}</b><p>Merchant {rates.accounts.momo.merchantId}<br />MTN {rates.accounts.momo.mtn}<br />Telecel {rates.accounts.momo.telecel}<br />AirtelTigo {rates.accounts.momo.at}</p></div></article>
        <article><span className="settlement-icon"><Landmark size={17} /></span><div><small>Bank transfer</small><b>{rates.accounts.bank.bank}</b><p>{rates.accounts.bank.accountName}<br />A/C {rates.accounts.bank.accountNumber}<br />{rates.accounts.bank.branch}<br />SWIFT {rates.accounts.bank.swift}</p></div></article>
        <article><span className="settlement-icon"><Building2 size={17} /></span><div><small>Campus cashier</small><b>{rates.accounts.cashier.desk}</b><p>{rates.accounts.cashier.hours}<br />NHIS claims use the policy number on the patient file.</p></div></article>
      </div>
    </section>

    {canEdit ? <form id="tariff-form" className="tariff-editor-stack" onSubmit={save}>
      <div className="tariff-grid"><MapEditor title="Consultations" note={draft.consultNote} values={draft.consults} onChange={(consults) => setDraft({ ...draft, consults })} extra={<><label>Campus surcharge<input className="stock-input" type="number" min="0" value={draft.campusSurcharge} onChange={(e) => setDraft({ ...draft, campusSurcharge: e.target.value })} /></label><label>Pricing note<textarea rows="2" value={draft.consultNote} onChange={(e) => setDraft({ ...draft, consultNote: e.target.value })} /></label></>} /><MapEditor title="Wards · nightly" note={draft.wardNote} values={draft.wards} onChange={(wards) => setDraft({ ...draft, wards })} extra={<label>Pricing note<textarea rows="2" value={draft.wardNote} onChange={(e) => setDraft({ ...draft, wardNote: e.target.value })} /></label>} /></div>
      <div className="tariff-grid"><MapEditor title="Room supplements" values={draft.rooms} onChange={(rooms) => setDraft({ ...draft, rooms })} /><RowsEditor title="Laboratory" rows={draft.labs} onChange={(labs) => setDraft({ ...draft, labs })} fields={[{ key: "name", label: "Test" },{ key: "specimen", label: "Specimen" },{ key: "price", label: "Fee", type: "number" },{ key: "nhis", label: "NHIS", type: "check" }]} /></div>
      <div className="tariff-grid"><RowsEditor title="Hospital services" rows={draft.services} onChange={(services) => setDraft({ ...draft, services })} fields={[{ key: "name", label: "Service" },{ key: "price", label: "Fee", type: "number" },{ key: "nhis", label: "NHIS", type: "check" }]} /><RowsEditor title="Pharmacy prices" rows={draft.pharmacy} onChange={(pharmacy) => setDraft({ ...draft, pharmacy })} fields={[{ key: "name", label: "Medicine" },{ key: "pack", label: "Pack" },{ key: "price", label: "Fee", type: "number" },{ key: "nhis", label: "NHIS", type: "check" }]} /></div>
      <div className="tariff-publish-bar"><div><ShieldCheck size={15} /><span><b>Publishing updates live pricing</b><small>Patients and checkout see the new tariff immediately.</small></span></div><div><button type="button" className="secondary-btn" onClick={() => setDraft(rates)}>Revert changes</button><button className="primary-btn" disabled={busy}>{busy ? "Publishing…" : "Publish tariff"}</button></div></div>
    </form> : <div className="tariff-reader-stack">
      <div className="tariff-grid"><ReadTable title="Consultations" columns={["Specialty","Video","Campus"]} rows={Object.entries(rates.consults).map(([name, fee]) => <tr key={name}><td><b>{name}</b></td><td>{ghs(fee)}</td><td>{ghs(Number(fee) + Number(rates.campusSurcharge || 0))}</td></tr>)} /><ReadTable title="Inpatient · nightly" columns={["Ward / room","Fee"]} rows={<>{Object.entries(rates.wards).map(([name, fee]) => <tr key={name}><td><b>{name}</b></td><td>{ghs(fee)}</td></tr>)}{Object.entries(rates.rooms).map(([name, fee]) => <tr key={`room-${name}`}><td>{name} supplement</td><td>{fee ? ghs(fee) : "Included"}</td></tr>)}</>} /></div>
      <div className="tariff-grid"><ReadTable title="Laboratory" columns={["Test","NHIS","Fee"]} rows={rates.labs.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.nhis ? "Yes" : "No"}</td><td>{ghs(r.price)}</td></tr>)} /><ReadTable title="Pharmacy & services" columns={["Item","NHIS","Fee"]} rows={<>{rates.pharmacy.map((r) => <tr key={r.id}><td><b>{r.name}</b><small className="tariff-pack">{r.pack}</small></td><td>{r.nhis ? "Yes" : "No"}</td><td>{ghs(r.price)}</td></tr>)}{rates.services.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.nhis ? "Yes" : "No"}</td><td>{ghs(r.price)}</td></tr>)}</>} /></div>
    </div>}
  </div>;

  if (user) return body;
  return <PublicChrome><div className="hospital-inner">{body}</div></PublicChrome>;
}
