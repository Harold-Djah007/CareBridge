import React, { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Trash2 } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs } from "../utils";

const blankLine = () => ({ stockId: "", drug: "", sig: "", qty: "1" });

export default function RxPad({ patient, source = "chart", compact = false, onIssued }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [stock, setStock] = useState([]);
  const [lines, setLines] = useState([blankLine()]);
  const [notes, setNotes] = useState("");
  const [refills, setRefills] = useState(0);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api("/pharmacy/stock").then(setStock).catch(() => {});
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("pharmacy-stock", setStock);
    return () => socket.disconnect();
  }, []);

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter((p) => !q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q));
  }, [stock, query]);

  const setLine = (i, patch) => setLines((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const pickStock = (i, product) => {
    setLine(i, {
      stockId: product.id,
      drug: product.name,
      qty: "1",
      sig: lines[i]?.sig || "",
    });
    setQuery("");
  };

  const issue = async (e) => {
    e?.preventDefault?.();
    if (!patient?.id) {
      push("Choose a patient first.", "error");
      return;
    }
    const items = lines
      .map((row) => ({
        stockId: row.stockId,
        drug: String(row.drug || "").trim(),
        sig: String(row.sig || "").trim(),
        qty: String(row.qty || "").trim() || "1",
      }))
      .filter((row) => row.drug);
    if (!items.length) {
      push("Add at least one medicine.", "error");
      return;
    }
    setBusy(true);
    try {
      const rx = await api("/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          patientId: patient.id,
          doctorId: user.id,
          items,
          notes,
          refills,
          source,
        }),
      });
      setLines([blankLine()]);
      setNotes("");
      setRefills(0);
      push(`Prescription issued for ${patient.name.split(" ")[0]}.`);
      onIssued?.(rx);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`rx-pad ${compact ? "compact" : ""}`} onSubmit={issue}>
      <div className="card-head">
        <div>
          <span className="eyebrow">Prescription pad</span>
          <h3><Pill size={16} /> {patient ? `Rx · ${patient.name}` : "Choose a patient"}</h3>
        </div>
      </div>
      <p className="muted">Pick from Ridge pharmacy stock. The patient can print, buy on CareBridge, or collect at the hospital.</p>
      {lines.map((line, i) => {
        const product = stock.find((p) => p.id === line.stockId);
        return (
          <div className="rx-line" key={i}>
            <label>Medicine
              <input
                value={line.drug}
                onChange={(e) => setLine(i, { drug: e.target.value, stockId: line.stockId && e.target.value === product?.name ? line.stockId : "" })}
                placeholder="Search or type a medicine"
                required
              />
            </label>
            {i === lines.length - 1 && (
              <div className="rx-suggest">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter stock…" />
                <div className="rx-suggest-list">
                  {catalog.slice(0, 8).map((p) => (
                    <button type="button" key={p.id} className={!p.inStock ? "oos" : ""} onClick={() => pickStock(i, p)}>
                      <span><b>{p.name}</b><small>{p.pack} · {p.category}</small></span>
                      <em className={`stock-badge ${p.inStock ? "in" : "out"}`}>{p.inStock ? `${p.qty} in stock` : "Out of stock"}</em>
                      <span>{ghs(p.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label>Directions
              <input value={line.sig} onChange={(e) => setLine(i, { sig: e.target.value })} placeholder="e.g. One tablet every morning" required />
            </label>
            <div className="rx-line-meta">
              <label>Packs
                <input value={line.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
              </label>
              {product && <em className={`stock-badge ${product.inStock ? "in" : "out"}`}>{product.inStock ? `${product.qty} on shelf` : "Out of stock"}</em>}
              {lines.length > 1 && (
                <button type="button" className="icon-btn" title="Remove line" onClick={() => setLines((rows) => rows.filter((_, idx) => idx !== i))}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div className="row-actions">
        <button type="button" className="ghost-btn" onClick={() => setLines((rows) => [...rows, blankLine()])}>
          <Plus size={16} /> Add line
        </button>
        <label className="rx-refill">Refills
          <input type="number" min="0" value={refills} onChange={(e) => setRefills(Number(e.target.value || 0))} />
        </label>
      </div>
      <label>Notes for pharmacy / patient
        <textarea rows={compact ? 2 : 3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional counselling or duration" />
      </label>
      <button className="primary-btn" disabled={busy || !patient}>{busy ? "Issuing…" : "Issue prescription"}</button>
    </form>
  );
}
