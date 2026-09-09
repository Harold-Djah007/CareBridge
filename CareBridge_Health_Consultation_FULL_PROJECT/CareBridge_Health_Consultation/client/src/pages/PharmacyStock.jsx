import React, { useEffect, useMemo, useState } from "react";
import { Archive, Boxes, PackageCheck, PackageX, Plus, RotateCcw, Search, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs } from "../utils";

const blank = { name: "", sku: "", pack: "30 tablets", form: "Tablet", category: "Vitamins", price: 20, qty: 12, nhis: true, available: true };

function AvailabilityToggle({ on, disabled, onChange }) {
  return <div className={`px-stock-toggle ${on ? "on" : "off"}`}><button type="button" className={on ? "active" : ""} disabled={disabled} onClick={() => onChange(true)}>In</button><button type="button" className={!on ? "active" : ""} disabled={disabled} onClick={() => onChange(false)}>Out</button></div>;
}

export default function PharmacyStock() {
  const { user } = useAuth();
  const { push } = useToast();
  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = () => api("/pharmacy/stock?manage=1").then(setStock);
  useEffect(() => {
    load();
    api("/pharmacy/categories").then(setCategories).catch(() => {});
    const socket = io(socketUrl, socketOptions());
    socket.on("pharmacy-stock", load);
    return () => socket.disconnect();
  }, []);

  const cats = useMemo(() => [...new Set([...(categories || []), ...stock.map((row) => row.category).filter(Boolean)])], [categories, stock]);
  const active = stock.filter((row) => !row.archived);
  const inCount = active.filter((row) => row.inStock).length;
  const outCount = active.filter((row) => !row.inStock).length;
  const lowCount = active.filter((row) => Number(row.qty || 0) > 0 && Number(row.qty || 0) <= 5).length;
  const archivedCount = stock.filter((row) => row.archived).length;
  const visible = stock.filter((row) => {
    if (filter === "archived" && !row.archived) return false;
    if (filter !== "archived" && row.archived) return false;
    if (filter === "in" && !row.inStock) return false;
    if (filter === "out" && row.inStock) return false;
    const q = query.trim().toLowerCase();
    return !q || `${row.name} ${row.sku || ""} ${row.category || ""} ${row.form || ""}`.toLowerCase().includes(q);
  });

  const saveRow = async (row, patch, ok) => {
    setBusy(row.id);
    try {
      await api(`/pharmacy/stock/${row.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, ...patch }) });
      push(ok || `${row.name} updated`);
      load();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const addSku = async (event) => {
    event.preventDefault();
    setBusy("new");
    try {
      await api("/pharmacy/stock", { method: "POST", body: JSON.stringify({ actorId: user.id, ...form, qty: form.available === false ? 0 : form.qty, available: form.available !== false }) });
      push(`${form.name} added to inventory`);
      setForm(blank);
      setOpen(false);
      load();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const toggleShelf = (row, available) => {
    if (!available) return saveRow(row, { available: false }, `${row.name} marked out of stock.`);
    if (Number(row.qty) > 0) return saveRow(row, { available: true }, `${row.name} marked in stock.`);
    const raw = window.prompt(`How many packs of ${row.name} should go back on the shelf?`, "10");
    if (raw === null) return;
    const qty = Math.max(0, Number(raw));
    if (!qty) return push("Enter a quantity above 0.", "error");
    saveRow(row, { available: true, qty }, `${row.name} restocked.`);
  };

  const archive = async (row) => {
    if (!window.confirm(`Archive ${row.name}? Patients will no longer see it.`)) return;
    setBusy(row.id);
    try {
      await api(`/pharmacy/stock/${row.id}?actorId=${user.id}`, { method: "DELETE" });
      push(`${row.name} archived.`);
      load();
    } catch {
      try {
        await api(`/pharmacy/stock/${row.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, archived: true, available: false }) });
        push(`${row.name} archived.`);
        load();
      } catch (err) { push(err.message, "error"); }
    } finally { setBusy(""); }
  };

  return (
    <div className="px-page px-stock-console">
      <section className="px-stock-hero">
        <div><span className="px-kicker"><Sparkles size={14} /> Dispensary inventory</span><h1>Know what is on the shelf before the queue asks.</h1><p>Live stock, low-level risk, patient visibility and restocking are controlled from one operational console.</p><button className="px-primary" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Add medicine</button></div>
        <div className="px-stock-radar"><span>Active SKUs</span><strong>{active.length}</strong><small>{lowCount} low stock · {outCount} unavailable</small><i /></div>
      </section>

      <section className="px-signal-grid">
        <article><span><PackageCheck size={17} /></span><div><small>In stock</small><strong>{inCount}</strong></div></article>
        <article><span><PackageX size={17} /></span><div><small>Out</small><strong>{outCount}</strong></div></article>
        <article><span><Boxes size={17} /></span><div><small>Low stock</small><strong>{lowCount}</strong></div></article>
        <article><span><Archive size={17} /></span><div><small>Archived</small><strong>{archivedCount}</strong></div></article>
      </section>

      <section className="px-stock-board">
        <header className="px-stock-toolbar"><div><span className="px-kicker">Inventory ledger</span><h2>{visible.length} medicine{visible.length === 1 ? "" : "s"}</h2></div><label><Search size={15} /><input aria-label="Search inventory" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU, name or category" /></label><div className="px-segmented">{[["all","Active"],["in","In stock"],["out","Out"],["archived","Archived"]].map(([id,label]) => <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div></header>
        <div className="px-stock-head"><span>Medicine</span><span>Category</span><span>Price</span><span>Qty</span><span>Availability</span><span>NHIS</span><span>Actions</span></div>
        <div className="px-stock-list">
          {visible.map((row) => {
            const on = !row.archived && row.inStock;
            const qty = Number(row.qty || 0);
            const low = !row.archived && qty <= 5;
            return <article className={`px-stock-row ${row.archived ? "archived" : low ? "low" : ""}`} key={`${row.id}-${row.qty}-${row.inStock}-${row.archived}`}>
              <div className="px-stock-product"><span className="px-stock-product-icon"><Boxes size={17} /></span><div><input aria-label={`Medicine name ${row.name}`} defaultValue={row.name} disabled={busy === row.id} onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== row.name) saveRow(row, { name }); }} /><small>{row.sku || "No SKU"} · {row.form || "Medicine"} · {row.pack || "Pack"}</small></div></div>
              <div><select aria-label={`Category ${row.name}`} value={row.category} disabled={busy === row.id} onChange={(e) => saveRow(row, { category: e.target.value })}>{(cats.includes(row.category) ? cats : [row.category, ...cats]).map((category) => <option key={category}>{category}</option>)}</select></div>
              <div><input aria-label={`Price ${row.name}`} className="px-stock-number" type="number" min="0" defaultValue={row.price} disabled={busy === row.id} onBlur={(e) => { const price = Number(e.target.value); if (price !== Number(row.price)) saveRow(row, { price }); }} /><small>{ghs(row.price)}</small></div>
              <div><input aria-label={`Quantity ${row.name}`} className="px-stock-number" type="number" min="0" defaultValue={row.qty} disabled={busy === row.id} onBlur={(e) => { const nextQty = Number(e.target.value); if (nextQty !== Number(row.qty)) saveRow(row, { qty: nextQty }); }} />{low && <em>{qty === 0 ? "Empty" : `Low · ${qty}`}</em>}</div>
              <div>{row.archived ? <span className="status cancelled">archived</span> : <AvailabilityToggle on={on} disabled={busy === row.id} onChange={(available) => toggleShelf(row, available)} />}</div>
              <div><label className="px-stock-check"><input type="checkbox" checked={row.nhis} disabled={busy === row.id} onChange={(e) => saveRow(row, { nhis: e.target.checked })} /><span>{row.nhis ? "Eligible" : "No"}</span></label></div>
              <div className="px-stock-actions">{row.archived ? <button type="button" disabled={busy === row.id} onClick={() => saveRow(row, { archived: false, available: true }, `${row.name} restored.`)}><RotateCcw size={14} /> Restore</button> : <><button type="button" disabled={busy === row.id} onClick={() => { const raw = window.prompt(`Restock ${row.name} by how many packs?`, "10"); const amount = Math.max(0, Number(raw)); if (amount) saveRow(row, { restock: amount }, `Restocked ${row.name} by ${amount}.`); }}><Plus size={14} /> Restock</button><button className="danger" type="button" aria-label={`Archive ${row.name}`} disabled={busy === row.id} onClick={() => archive(row)}><Archive size={14} /></button></>}</div>
            </article>;
          })}
          {visible.length === 0 && <div className="px-empty"><Boxes size={28} /><h3>No inventory matches this view</h3></div>}
        </div>
      </section>

      <div className="px-stock-trust"><ShieldCheck size={16} /><span>Inventory changes are restricted to authorised pharmacy and operations roles and flow to the patient storefront.</span></div>

      {open && <div className="px-modal-backdrop" onMouseDown={() => setOpen(false)}><form className="px-booking-sheet" role="dialog" aria-modal="true" aria-labelledby="add-medicine-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={addSku}><header><span className="px-sheet-icon"><Boxes size={20} /></span><div><span className="px-kicker">New inventory item</span><h2 id="add-medicine-title">Add medicine</h2><p>Create the SKU exactly as patients should see it in Shop & Pay.</p></div><button type="button" aria-label="Close add medicine" onClick={() => setOpen(false)}><XCircle size={20} /></button></header><div className="px-sheet-body"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><div className="px-form-grid"><label>SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><label>Form<input value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} /></label></div><div className="px-form-grid"><label>Pack<input value={form.pack} onChange={(e) => setForm({ ...form, pack: e.target.value })} /></label><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{(cats.length ? cats : ["Vitamins"]).map((category) => <option key={category}>{category}</option>)}</select></label></div><div className="px-form-grid"><label>Price GHS<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label>Quantity<input type="number" min="0" value={form.qty} disabled={form.available === false} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></label></div><label className="px-stock-check"><input type="checkbox" checked={form.nhis} onChange={(e) => setForm({ ...form, nhis: e.target.checked })} /><span>NHIS eligible</span></label><div className="px-quote"><span>Patient shop preview</span><strong>{ghs(form.price)}</strong></div></div><footer><button className="px-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="px-primary" disabled={busy === "new"}>{busy === "new" ? "Saving…" : "Add to inventory"}</button></footer></form></div>}
    </div>
  );
}
