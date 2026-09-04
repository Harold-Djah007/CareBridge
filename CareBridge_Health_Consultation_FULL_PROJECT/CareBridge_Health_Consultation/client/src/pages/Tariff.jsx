import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { HOSPITAL, ghs, prettyDate } from "../utils";
import { useAuth, useToast } from "../state";

function MapEditor({ title, note, values, onChange, extra }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {note && <p className="muted">{note}</p>}
      {extra}
      <table className="table">
        <thead><tr><th>Item</th><th>Fee (GHS)</th></tr></thead>
        <tbody>
          {Object.entries(values || {}).map(([name, fee]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>
                <input
                  className="stock-input"
                  type="number"
                  min="0"
                  value={fee}
                  onChange={(e) => onChange({ ...values, [name]: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RowsEditor({ title, rows, fields, onChange }) {
  const setRow = (i, patch) => onChange(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  return (
    <section className="card">
      <h3>{title}</h3>
      <table className="table">
        <thead>
          <tr>
            {fields.map((f) => <th key={f.key}>{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {fields.map((f) => (
                <td key={f.key}>
                  {f.type === "check" ? (
                    <input type="checkbox" checked={Boolean(row[f.key])} onChange={(e) => setRow(i, { [f.key]: e.target.checked })} />
                  ) : (
                    <input
                      className={f.type === "number" ? "stock-input" : ""}
                      type={f.type || "text"}
                      min={f.type === "number" ? 0 : undefined}
                      value={row[f.key] ?? ""}
                      onChange={(e) => setRow(i, { [f.key]: f.type === "number" ? e.target.value : e.target.value })}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
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
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("tariff-updated", (payload) => {
      setRates(payload);
      if (!canEdit) setDraft(payload);
    });
    socket.on("pharmacy-stock", (pharmacy) => {
      setRates((r) => (r ? { ...r, pharmacy } : r));
      setDraft((d) => (d && !canEdit ? { ...d, pharmacy } : d));
    });
    return () => socket.disconnect();
  }, [canEdit]);

  if (!rates || !draft) return <p className="muted">Loading hospital tariff…</p>;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await api("/finance/rates", {
        method: "PATCH",
        body: JSON.stringify({
          actorId: user.id,
          consults: draft.consults,
          campusSurcharge: draft.campusSurcharge,
          consultNote: draft.consultNote,
          wards: draft.wards,
          rooms: draft.rooms,
          wardNote: draft.wardNote,
          labs: draft.labs,
          services: draft.services,
          pharmacy: (draft.pharmacy || []).map((p) => ({ id: p.id, price: p.price, nhis: p.nhis })),
        }),
      });
      setRates(next);
      setDraft(next);
      push("Hospital tariff published. Patients see these fees now.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={user ? "" : "landing"}>
      {!user && (
        <nav className="public-nav">
          <Link to="/" className="brand"><b>{HOSPITAL.short}</b></Link>
          <div className="links">
            <Link to="/login">Sign in</Link>
            <Link className="primary-btn" to="/register">Register</Link>
          </div>
        </nav>
      )}
      <div className="page-title">
        <div>
          <span className="eyebrow">{HOSPITAL.campus} accounts</span>
          <h1>Hospital tariff</h1>
          <p>Published fees in Ghana cedis. Pay by MTN / Telecel / AirtelTigo MoMo, GCB bank transfer, NHIS, or cash at the Ridge cashier. A numbered receipt is issued for every settled bill.</p>
          {rates.updatedAt && <p className="muted">Last updated {prettyDate(rates.updatedAt)}{rates.updatedBy ? ` by ${rates.updatedBy}` : ""}.</p>}
        </div>
        {user?.role === "patient" && <Link className="primary-btn" to="/pay">Shop & pay</Link>}
        {canEdit && <button className="primary-btn" type="submit" form="tariff-form" disabled={busy}>{busy ? "Saving…" : "Publish tariff"}</button>}
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Settlement accounts</h3>
        <div className="tariff-accounts">
          <div>
            <span className="eyebrow">Mobile money</span>
            <p><b>{rates.accounts.momo.name}</b><br />Merchant {rates.accounts.momo.merchantId}<br />MTN {rates.accounts.momo.mtn}<br />Telecel {rates.accounts.momo.telecel}<br />AirtelTigo {rates.accounts.momo.at}</p>
          </div>
          <div>
            <span className="eyebrow">Bank</span>
            <p><b>{rates.accounts.bank.bank}</b><br />{rates.accounts.bank.accountName}<br />A/C {rates.accounts.bank.accountNumber}<br />{rates.accounts.bank.branch}<br />SWIFT {rates.accounts.bank.swift}</p>
          </div>
          <div>
            <span className="eyebrow">Cashier</span>
            <p>{rates.accounts.cashier.desk}<br />{rates.accounts.cashier.hours}<br />NHIS claims use the policy number on the patient file.</p>
          </div>
        </div>
      </section>

      {canEdit ? (
        <form id="tariff-form" onSubmit={save}>
          <div className="dashboard-grid">
            <MapEditor
              title="Consultations"
              note={draft.consultNote}
              values={draft.consults}
              onChange={(consults) => setDraft({ ...draft, consults })}
              extra={(
                <>
                  <label>Campus surcharge
                    <input className="stock-input" type="number" min="0" value={draft.campusSurcharge} onChange={(e) => setDraft({ ...draft, campusSurcharge: e.target.value })} />
                  </label>
                  <label>Note<textarea rows="2" value={draft.consultNote} onChange={(e) => setDraft({ ...draft, consultNote: e.target.value })} /></label>
                </>
              )}
            />
            <MapEditor
              title="Wards (per night)"
              note={draft.wardNote}
              values={draft.wards}
              onChange={(wards) => setDraft({ ...draft, wards })}
              extra={<label>Note<textarea rows="2" value={draft.wardNote} onChange={(e) => setDraft({ ...draft, wardNote: e.target.value })} /></label>}
            />
          </div>
          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <MapEditor title="Room supplements" values={draft.rooms} onChange={(rooms) => setDraft({ ...draft, rooms })} />
            <RowsEditor
              title="Laboratory"
              rows={draft.labs}
              onChange={(labs) => setDraft({ ...draft, labs })}
              fields={[
                { key: "name", label: "Test" },
                { key: "specimen", label: "Specimen" },
                { key: "price", label: "Fee", type: "number" },
                { key: "nhis", label: "NHIS", type: "check" },
              ]}
            />
          </div>
          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <RowsEditor
              title="Hospital services"
              rows={draft.services}
              onChange={(services) => setDraft({ ...draft, services })}
              fields={[
                { key: "name", label: "Service" },
                { key: "price", label: "Fee", type: "number" },
                { key: "nhis", label: "NHIS", type: "check" },
              ]}
            />
            <RowsEditor
              title="Pharmacy prices"
              rows={draft.pharmacy}
              onChange={(pharmacy) => setDraft({ ...draft, pharmacy })}
              fields={[
                { key: "name", label: "Medicine" },
                { key: "pack", label: "Pack" },
                { key: "price", label: "Fee", type: "number" },
                { key: "nhis", label: "NHIS", type: "check" },
              ]}
            />
          </div>
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="primary-btn" disabled={busy}>{busy ? "Saving…" : "Publish tariff"}</button>
            <button type="button" className="secondary-btn" onClick={() => setDraft(rates)}>Revert</button>
          </div>
        </form>
      ) : (
        <>
          <div className="dashboard-grid">
            <section className="card">
              <h3>Consultations</h3>
              <p className="muted">{rates.consultNote}</p>
              <table className="table">
                <thead><tr><th>Specialty</th><th>Video</th><th>Campus</th></tr></thead>
                <tbody>
                  {Object.entries(rates.consults).map(([name, fee]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{ghs(fee)}</td>
                      <td>{ghs(Number(fee) + Number(rates.campusSurcharge || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h3>Inpatient (per night)</h3>
              <p className="muted">{rates.wardNote}</p>
              <table className="table">
                <thead><tr><th>Ward</th><th>Nightly</th></tr></thead>
                <tbody>
                  {Object.entries(rates.wards).map(([name, fee]) => (
                    <tr key={name}><td>{name}</td><td>{ghs(fee)}</td></tr>
                  ))}
                </tbody>
              </table>
              <table className="table">
                <thead><tr><th>Room supplement</th><th>Per night</th></tr></thead>
                <tbody>
                  {Object.entries(rates.rooms).map(([name, fee]) => (
                    <tr key={name}><td>{name}</td><td>{fee ? ghs(fee) : "Included"}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <section className="card">
              <h3>Laboratory</h3>
              <table className="table">
                <thead><tr><th>Test</th><th>NHIS</th><th>Fee</th></tr></thead>
                <tbody>
                  {rates.labs.map((row) => (
                    <tr key={row.id}><td>{row.name}</td><td>{row.nhis ? "Yes" : "No"}</td><td>{ghs(row.price)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h3>Pharmacy & other services</h3>
              <table className="table">
                <thead><tr><th>Item</th><th>NHIS</th><th>Fee</th></tr></thead>
                <tbody>
                  {rates.pharmacy.map((row) => (
                    <tr key={row.id}><td>{row.name} ({row.pack})</td><td>{row.nhis ? "Yes" : "No"}</td><td>{ghs(row.price)}</td></tr>
                  ))}
                  {rates.services.map((row) => (
                    <tr key={row.id}><td>{row.name}</td><td>{row.nhis ? "Yes" : "No"}</td><td>{ghs(row.price)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
