import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs } from "../utils";

const blank = { name: "", sku: "", pack: "30 tablets", form: "Tablet", category: "Vitamins", price: 20, qty: 12, nhis: true };

export default function PharmacyStock() {
  const { user } = useAuth();
  const { push } = useToast();
  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");

  const load = () => api("/pharmacy/stock").then(setStock);

  useEffect(() => {
    load();
    api("/pharmacy/categories").then(setCategories).catch(() => {});
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("pharmacy-stock", setStock);
    return () => socket.disconnect();
  }, []);

  const saveRow = async (row, patch) => {
    setBusy(row.id);
    try {
      await api(`/pharmacy/stock/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actorId: user.id, ...patch }),
      });
      push(`${row.name} updated`);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  const addSku = async (e) => {
    e.preventDefault();
    setBusy("new");
    try {
      await api("/pharmacy/stock", {
        method: "POST",
        body: JSON.stringify({ actorId: user.id, ...form }),
      });
      push(`${form.name} added to the cupboard`);
      setForm(blank);
      setOpen(false);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Ridge pharmacy</span>
          <h1>Medicine cupboard</h1>
          <p>Quantities and prices here are what patients see in Pharmacy. Out-of-stock lines cannot be added to a basket.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Add SKU</button>
      </div>

      <section className="card" style={{ overflow: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Pack</th>
              <th>Price (GHS)</th>
              <th>Qty</th>
              <th>Shelf</th>
              <th>NHIS</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((row) => (
              <tr key={`${row.id}-${row.qty}-${row.price}-${row.nhis}`}>
                <td>
                  <b>{row.name}</b>
                  <div className="muted">{row.sku} · {row.form}</div>
                </td>
                <td>{row.category}</td>
                <td>{row.pack}</td>
                <td>
                  <input
                    className="stock-input"
                    type="number"
                    min="0"
                    defaultValue={row.price}
                    disabled={busy === row.id}
                    onBlur={(e) => {
                      const price = Number(e.target.value);
                      if (price !== Number(row.price)) saveRow(row, { price });
                    }}
                  />
                </td>
                <td>
                  <input
                    className="stock-input"
                    type="number"
                    min="0"
                    defaultValue={row.qty}
                    disabled={busy === row.id}
                    onBlur={(e) => {
                      const qty = Number(e.target.value);
                      if (qty !== Number(row.qty)) saveRow(row, { qty });
                    }}
                  />
                </td>
                <td><em className={`stock-badge ${row.inStock ? "in" : "out"}`}>{row.inStock ? `${row.qty} in stock` : "Out of stock"}</em></td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.nhis}
                    onChange={(e) => saveRow(row, { nhis: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={addSku}>
            <h2>Add medicine</h2>
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <div className="form-grid">
              <label>SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional" /></label>
              <label>Form<input value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} /></label>
            </div>
            <div className="form-grid">
              <label>Pack<input value={form.pack} onChange={(e) => setForm({ ...form, pack: e.target.value })} /></label>
              <label>Category
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {(categories.length ? categories : ["Vitamins"]).map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>Price (GHS)<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
              <label>Quantity<input type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></label>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={form.nhis} onChange={(e) => setForm({ ...form, nhis: e.target.checked })} />
              NHIS eligible
            </label>
            <p className="muted">Preview: {form.name || "New SKU"} · {ghs(form.price)}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary-btn" disabled={busy === "new"}>{busy === "new" ? "Saving…" : "Add to cupboard"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
