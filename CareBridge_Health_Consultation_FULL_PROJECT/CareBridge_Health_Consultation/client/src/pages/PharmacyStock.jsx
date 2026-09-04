import React, { useEffect, useMemo, useState } from "react";
import { Plus, Archive, RotateCcw } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs } from "../utils";

const blank = { name: "", sku: "", pack: "30 tablets", form: "Tablet", category: "Vitamins", price: 20, qty: 12, nhis: true, available: true };

function ShelfToggle({ on, disabled, onChange }) {
  return (
    <div className={`shelf-toggle ${on ? "on" : "off"}`} role="group" aria-label="Shelf status">
      <button type="button" className={on ? "active" : ""} disabled={disabled} onClick={() => onChange(true)}>In stock</button>
      <button type="button" className={!on ? "active" : ""} disabled={disabled} onClick={() => onChange(false)}>Out of stock</button>
    </div>
  );
}

function RestockCell({ disabled, onRestock }) {
  const [n, setN] = useState(10);
  return (
    <div className="restock-cell">
      <input
        className="stock-input"
        type="number"
        min="1"
        value={n}
        disabled={disabled}
        onChange={(e) => setN(e.target.value)}
        aria-label="Restock quantity"
      />
      <button type="button" className="ghost-btn" disabled={disabled} onClick={() => onRestock(Number(n) || 0)}>Restock</button>
    </div>
  );
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
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("pharmacy-stock", load);
    return () => socket.disconnect();
  }, []);

  const cats = useMemo(() => {
    const set = new Set([...(categories || []), ...stock.map((s) => s.category).filter(Boolean)]);
    return [...set];
  }, [categories, stock]);

  const visible = stock.filter((row) => {
    if (filter === "archived") return row.archived;
    if (row.archived) return false;
    if (filter === "in") return row.inStock;
    if (filter === "out") return !row.inStock;
    return true;
  });

  const saveRow = async (row, patch, ok) => {
    setBusy(row.id);
    try {
      await api(`/pharmacy/stock/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actorId: user.id, ...patch }),
      });
      push(ok || `${row.name} updated`);
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
        body: JSON.stringify({
          actorId: user.id,
          ...form,
          qty: form.available === false ? 0 : form.qty,
          available: form.available !== false,
        }),
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

  const toggleShelf = (row, available) => {
    if (!available) {
      saveRow(row, { available: false }, `${row.name} marked out of stock.`);
      return;
    }
    if (Number(row.qty) > 0) {
      saveRow(row, { available: true }, `${row.name} marked in stock.`);
      return;
    }
    const raw = window.prompt(`How many packs of ${row.name} should go back on the shelf?`, "10");
    if (raw === null) return;
    const qty = Math.max(0, Number(raw));
    if (!qty) {
      push("Enter a quantity above 0 so patients can buy again.", "error");
      return;
    }
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
        await api(`/pharmacy/stock/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ actorId: user.id, archived: true, available: false }),
        });
        push(`${row.name} archived. Patients no longer see it.`);
      } catch (err) {
        push(err.message, "error");
      }
    } finally {
      setBusy("");
    }
  };

  const inCount = stock.filter((s) => !s.archived && s.inStock).length;
  const outCount = stock.filter((s) => !s.archived && !s.inStock).length;
  const archivedCount = stock.filter((s) => s.archived).length;

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Ridge pharmacy</span>
          <h1>Medicine cupboard</h1>
          <p>Toggle in or out of stock, edit the label patients see, restock, or archive a SKU so it leaves the shop. Changes appear live on Shop & pay.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Add SKU</button>
      </div>

      <div className="filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>On the books ({stock.filter((s) => !s.archived).length})</button>
        <button className={filter === "in" ? "active" : ""} onClick={() => setFilter("in")}>In stock ({inCount})</button>
        <button className={filter === "out" ? "active" : ""} onClick={() => setFilter("out")}>Out of stock ({outCount})</button>
        <button className={filter === "archived" ? "active" : ""} onClick={() => setFilter("archived")}>Archived ({archivedCount})</button>
      </div>

      <section className="card" style={{ overflow: "auto" }}>
        <table className="table stock-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Pack</th>
              <th>Price (GHS)</th>
              <th>Qty</th>
              <th>Shelf</th>
              <th>NHIS</th>
              <th>Restock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const on = !row.archived && row.inStock;
              const qty = Number(row.qty || 0);
              const low = !row.archived && qty <= 5;
              return (
                <tr key={`${row.id}-${row.qty}-${row.inStock}-${row.archived}-${row.price}-${row.nhis}`} className={row.archived ? "oos-row" : low ? "stock-row-low" : ""}>
                  <td>
                    <input
                      defaultValue={row.name}
                      disabled={busy === row.id}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== row.name) saveRow(row, { name });
                      }}
                      aria-label={`Name for ${row.name}`}
                    />
                    <div className="muted stock-sku">{row.sku || "No SKU"}</div>
                    <input
                      className="stock-input wide"
                      defaultValue={row.form}
                      disabled={busy === row.id}
                      onBlur={(e) => {
                        const formValue = e.target.value.trim();
                        if (formValue && formValue !== row.form) saveRow(row, { form: formValue });
                      }}
                      aria-label={`Form for ${row.name}`}
                    />
                  </td>
                  <td>
                    <select
                      value={row.category}
                      disabled={busy === row.id}
                      onChange={(e) => saveRow(row, { category: e.target.value })}
                      aria-label={`Category for ${row.name}`}
                    >
                      {(cats.includes(row.category) ? cats : [row.category, ...cats]).map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      defaultValue={row.pack}
                      disabled={busy === row.id}
                      onBlur={(e) => {
                        const pack = e.target.value.trim();
                        if (pack && pack !== row.pack) saveRow(row, { pack });
                      }}
                      aria-label={`Pack for ${row.name}`}
                    />
                  </td>
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
                        const nextQty = Number(e.target.value);
                        if (nextQty !== Number(row.qty)) saveRow(row, { qty: nextQty });
                      }}
                    />
                    {low && <em className={`stock-warn ${qty === 0 ? "empty" : ""}`}>{qty === 0 ? "Empty — patients cannot buy" : `Low stock · ${qty} left`}</em>}
                  </td>
                  <td>
                    {row.archived ? (
                      <em className="stock-badge out">Archived</em>
                    ) : (
                      <ShelfToggle
                        on={on}
                        disabled={busy === row.id}
                        onChange={(available) => toggleShelf(row, available)}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.nhis}
                      disabled={busy === row.id}
                      onChange={(e) => saveRow(row, { nhis: e.target.checked })}
                    />
                  </td>
                  <td>
                    {!row.archived && (
                      <RestockCell
                        disabled={busy === row.id}
                        onRestock={(n) => {
                          if (n < 1) return;
                          saveRow(row, { restock: n }, `Restocked ${row.name} by ${n}.`);
                        }}
                      />
                    )}
                  </td>
                  <td>
                    {row.archived ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={busy === row.id}
                        onClick={() => saveRow(row, { archived: false, available: true }, `${row.name} restored to the shop.`)}
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                    ) : (
                      <button type="button" className="ghost-btn" disabled={busy === row.id} onClick={() => archive(row)}>
                        <Archive size={14} /> Archive
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="muted" style={{ padding: 16 }}>Nothing in this list.</p>}
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
                  {(cats.length ? cats : ["Vitamins"]).map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>Price (GHS)<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
              <label>Quantity<input type="number" min="0" value={form.qty} disabled={form.available === false} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></label>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={form.nhis} onChange={(e) => setForm({ ...form, nhis: e.target.checked })} />
              NHIS eligible
            </label>
            <div className="add-shelf">
              <span>Shelf</span>
              <ShelfToggle
                on={form.available !== false}
                disabled={false}
                onChange={(on) => setForm({ ...form, available: on, qty: on ? (Number(form.qty) || 10) : 0 })}
              />
            </div>
            <p className="muted">Preview: {form.name || "New SKU"} · {ghs(form.price)} · {form.available === false ? "Out of stock" : `${form.qty || 0} on shelf`}</p>
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
