import React, { useEffect, useMemo, useState } from "react";
import { Archive, Boxes, PackageCheck, PackageX, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs } from "../utils";
import { IMAGERY } from "../imagery";
import PageHero, { EmptyPlate } from "../components/PageHero";

const blank = { name: "", sku: "", pack: "30 tablets", form: "Tablet", category: "Vitamins", price: 20, qty: 12, nhis: true, available: true };

function ShelfToggle({ on, disabled, onChange }) {
  return <div className={`shelf-toggle ${on ? "on" : "off"}`} role="group" aria-label="Shelf status"><button type="button" className={on ? "active" : ""} disabled={disabled} onClick={() => onChange(true)}>In stock</button><button type="button" className={!on ? "active" : ""} disabled={disabled} onClick={() => onChange(false)}>Out</button></div>;
}

function RestockCell({ disabled, onRestock }) {
  const [value, setValue] = useState(10);
  return <div className="restock-cell"><input className="stock-input" type="number" min="1" value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} aria-label="Restock quantity" /><button type="button" className="ghost-btn" disabled={disabled} onClick={() => onRestock(Number(value) || 0)}>Restock</button></div>;
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

  const load = () => api("/pharmacy/stock?manage=1").then(setStock);
  useEffect(() => {
    load();
    api("/pharmacy/categories").then(setCategories).catch(() => {});
    const socket = io(socketUrl, socketOptions());
    socket.on("pharmacy-stock", load);
    return () => socket.disconnect();
  }, []);

  const cats = useMemo(() => [...new Set([...(categories || []), ...stock.map((row) => row.category).filter(Boolean)])], [categories, stock]);
  const visible = stock.filter((row) => filter === "archived" ? row.archived : row.archived ? false : filter === "in" ? row.inStock : filter === "out" ? !row.inStock : true);

  const saveRow = async (row, patch, ok) => {
    setBusy(row.id);
    try {
      await api(`/pharmacy/stock/${row.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, ...patch }) });
      push(ok || `${row.name} updated`);
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const addSku = async (event) => {
    event.preventDefault();
    setBusy("new");
    try {
      await api("/pharmacy/stock", { method: "POST", body: JSON.stringify({ actorId: user.id, ...form, qty: form.available === false ? 0 : form.qty, available: form.available !== false }) });
      push(`${form.name} added to the cupboard`);
      setForm(blank);
      setOpen(false);
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const toggleShelf = (row, available) => {
    if (!available) return saveRow(row, { available: false }, `${row.name} marked out of stock.`);
    if (Number(row.qty) > 0) return saveRow(row, { available: true }, `${row.name} marked in stock.`);
    const raw = window.prompt(`How many packs of ${row.name} should go back on the shelf?`, "10");
    if (raw === null) return;
    const qty = Math.max(0, Number(raw));
    if (!qty) return push("Enter a quantity above 0 so patients can buy again.", "error");
    saveRow(row, { available: true, qty }, `${row.name} restocked and marked in stock.`);
  };

  const archive = async (row) => {
    if (!window.confirm(`Remove ${row.name} from the shelf? Patients will no longer see it in Shop & pay.`)) return;
    setBusy(row.id);
    try {
      await api(`/pharmacy/stock/${row.id}?actorId=${user.id}`, { method: "DELETE" });
      push(`${row.name} archived. Patients no longer see it.`);
    } catch {
      try {
        await api(`/pharmacy/stock/${row.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, archived: true, available: false }) });
        push(`${row.name} archived. Patients no longer see it.`);
      } catch (err) { push(err.message, "error"); }
    } finally { setBusy(""); }
  };

  const active = stock.filter((row) => !row.archived);
  const inCount = active.filter((row) => row.inStock).length;
  const outCount = active.filter((row) => !row.inStock).length;
  const lowCount = active.filter((row) => Number(row.qty || 0) > 0 && Number(row.qty || 0) <= 5).length;
  const archivedCount = stock.filter((row) => row.archived).length;

  return (
    <div className="stock-workspace">
      <PageHero scene="pharmacy" eyebrow="Inventory control" title="Pharmacy stock" lead="A live operational inventory for what patients can see and buy in Shop & pay. Restock, change availability and archive products without leaving the dispensary workspace." actions={<button className="primary-btn" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Add medicine</button>} />

      <div className="product-metric-grid stock-metrics">
        <div className="product-metric-card"><span className="metric-icon tone-green"><PackageCheck size={18} /></span><div className="metric-copy"><small>In stock</small><strong>{inCount}</strong><span>Visible to patients</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-red"><PackageX size={18} /></span><div className="metric-copy"><small>Out of stock</small><strong>{outCount}</strong><span>Unavailable in shop</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-amber"><Boxes size={18} /></span><div className="metric-copy"><small>Low stock</small><strong>{lowCount}</strong><span>5 packs or fewer</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-violet"><Archive size={18} /></span><div className="metric-copy"><small>Archived</small><strong>{archivedCount}</strong><span>Removed from patient shop</span></div></div>
      </div>

      <section className="product-imagery-strip stock-visual" style={{ backgroundImage: `url(${IMAGERY.pharmacy})` }}><div><span className="eyebrow">Live dispensary inventory</span><h3>{active.length} active medicine SKUs</h3><p>Changes made here flow into the patient storefront and dispensing workflows so stock status stays operationally consistent.</p></div></section>

      <div className="stock-toolbar"><div className="filters">{[["all",`Active · ${active.length}`],["in",`In stock · ${inCount}`],["out",`Out · ${outCount}`],["archived",`Archived · ${archivedCount}`]].map(([id,label]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div><span className="live-state"><i /> Live inventory</span></div>

      <section className="product-section stock-table-section">
        <div className="product-section-head"><div><span className="eyebrow">Stock ledger</span><h2>{visible.length} medicine{visible.length === 1 ? "" : "s"}</h2></div><div className="ops-footer-assurance compact"><ShieldCheck size={14} /><span>Only authorised pharmacy staff can change stock</span></div></div>
        <div className="stock-table-wrap">
          <table className="table stock-table product-stock-table"><thead><tr><th>Medicine</th><th>Category</th><th>Pack</th><th>Price</th><th>Qty</th><th>Shelf</th><th>NHIS</th><th>Restock</th><th /></tr></thead><tbody>{visible.map((row) => {
            const on = !row.archived && row.inStock;
            const qty = Number(row.qty || 0);
            const low = !row.archived && qty <= 5;
            return <tr key={`${row.id}-${row.qty}-${row.inStock}-${row.archived}-${row.price}-${row.nhis}`} className={row.archived ? "oos-row" : low ? "stock-row-low" : ""}>
              <td><div className="stock-product-cell"><input defaultValue={row.name} disabled={busy === row.id} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== row.name) saveRow(row, { name }); }} aria-label={`Name for ${row.name}`} /><small>{row.sku || "No SKU"}</small><input className="stock-input wide" defaultValue={row.form} disabled={busy === row.id} onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== row.form) saveRow(row, { form: value }); }} aria-label={`Form for ${row.name}`} /></div></td>
              <td><select value={row.category} disabled={busy === row.id} onChange={(event) => saveRow(row, { category: event.target.value })}>{(cats.includes(row.category) ? cats : [row.category, ...cats]).map((category) => <option key={category}>{category}</option>)}</select></td>
              <td><input defaultValue={row.pack} disabled={busy === row.id} onBlur={(event) => { const pack = event.target.value.trim(); if (pack && pack !== row.pack) saveRow(row, { pack }); }} /></td>
              <td><input className="stock-input" type="number" min="0" defaultValue={row.price} disabled={busy === row.id} onBlur={(event) => { const price = Number(event.target.value); if (price !== Number(row.price)) saveRow(row, { price }); }} /></td>
              <td><input className="stock-input" type="number" min="0" defaultValue={row.qty} disabled={busy === row.id} onBlur={(event) => { const nextQty = Number(event.target.value); if (nextQty !== Number(row.qty)) saveRow(row, { qty: nextQty }); }} />{low && <em className={`stock-warn ${qty === 0 ? "empty" : ""}`}>{qty === 0 ? "Empty" : `Low · ${qty}`}</em>}</td>
              <td>{row.archived ? <em className="stock-badge out">Archived</em> : <ShelfToggle on={on} disabled={busy === row.id} onChange={(available) => toggleShelf(row, available)} />}</td>
              <td><input type="checkbox" checked={row.nhis} disabled={busy === row.id} onChange={(event) => saveRow(row, { nhis: event.target.checked })} /></td>
              <td>{!row.archived && <RestockCell disabled={busy === row.id} onRestock={(amount) => { if (amount >= 1) saveRow(row, { restock: amount }, `Restocked ${row.name} by ${amount}.`); }} />}</td>
              <td>{row.archived ? <button type="button" className="secondary-btn" disabled={busy === row.id} onClick={() => saveRow(row, { archived: false, available: true }, `${row.name} restored to the shop.`)}><RotateCcw size={14} /> Restore</button> : <button type="button" className="ghost-btn" disabled={busy === row.id} onClick={() => archive(row)}><Archive size={14} /> Archive</button>}</td>
            </tr>;
          })}</tbody></table>
        </div>
        {visible.length === 0 && <EmptyPlate compact scene="pharmacy" title="Nothing in this inventory view" />}
      </section>

      {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal-card" onMouseDown={(event) => event.stopPropagation()} onSubmit={addSku}><div className="modal-icon"><Boxes /></div><span className="eyebrow">New inventory item</span><h2>Add medicine</h2><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><div className="form-grid"><label>SKU<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Optional" /></label><label>Form<input value={form.form} onChange={(event) => setForm({ ...form, form: event.target.value })} /></label></div><div className="form-grid"><label>Pack<input value={form.pack} onChange={(event) => setForm({ ...form, pack: event.target.value })} /></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{(cats.length ? cats : ["Vitamins"]).map((category) => <option key={category}>{category}</option>)}</select></label></div><div className="form-grid"><label>Price (GHS)<input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Quantity<input type="number" min="0" value={form.qty} disabled={form.available === false} onChange={(event) => setForm({ ...form, qty: event.target.value })} /></label></div><label className="check-row"><input type="checkbox" checked={form.nhis} onChange={(event) => setForm({ ...form, nhis: event.target.checked })} /> NHIS eligible</label><div className="add-shelf"><span>Shelf</span><ShelfToggle on={form.available !== false} disabled={false} onChange={(on) => setForm({ ...form, available: on, qty: on ? (Number(form.qty) || 10) : 0 })} /></div><div className="booking-quote"><span>Patient shop preview</span><strong>{ghs(form.price)}</strong><small>{form.name || "New SKU"} · {form.available === false ? "Out of stock" : `${form.qty || 0} on shelf`}</small></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button><button className="primary-btn" disabled={busy === "new"}>{busy === "new" ? "Saving…" : "Add to inventory"}</button></div></form></div>}
    </div>
  );
}
