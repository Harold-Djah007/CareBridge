import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Printer, ShoppingBag, Hospital } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { formatDate, rxOrderQty } from "../utils";

export default function Prescriptions() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [stock, setStock] = useState([]);
  const [busy, setBusy] = useState("");

  const load = () => api(`/prescriptions?userId=${user.id}&role=${user.role}`).then(setRows).catch(() => {});

  useEffect(() => {
    load();
    api("/pharmacy/stock").then(setStock).catch(() => {});
  }, [user.id, user.role]);

  const itemsForOrder = (rx) => {
    const lines = (rx.items || []).map((line) => {
      const product = stock.find((p) => p.id === line.stockId) || stock.find((p) => p.name.toLowerCase() === String(line.drug || "").toLowerCase());
      if (!product) return null;
      return { id: product.id, qty: rxOrderQty(line, product), name: product.name };
    }).filter(Boolean);
    return lines;
  };

  const fulfill = async (rx, mode) => {
    const items = itemsForOrder(rx);
    if (!items.length) {
      push("Those medicines are not on the Ridge shelf. Open Pharmacy to pick equivalents.", "error");
      navigate("/pay?tab=pharmacy");
      return;
    }
    setBusy(`${rx.id}-${mode}`);
    try {
      const { order, invoice } = await api("/pharmacy/orders", {
        method: "POST",
        body: JSON.stringify({
          patientId: user.id,
          actorId: user.id,
          prescriptionId: rx.id,
          fulfill: mode,
          items,
        }),
      });
      if (mode === "online") {
        push("Pharmacy billed. Pay to complete the purchase.");
        navigate(`/pay?invoice=${invoice?.id || order.invoiceId}`);
      } else {
        push("Sent to Ridge pharmacy. A nurse will prepare it for collection.");
      }
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
          <span className="eyebrow">{user.role === "doctor" ? "Clinic" : "Your file"}</span>
          <h1>Prescriptions</h1>
          <p>{user.role === "doctor"
            ? "Prescriptions you have issued. Patients can print them, buy on CareBridge, or collect at Ridge pharmacy."
            : "Print or save a copy, buy the medicines on CareBridge, or collect them at Ridge Campus pharmacy."}</p>
        </div>
        {user.role === "patient" && <Link className="secondary-btn" to="/pay?tab=pharmacy">Open shop</Link>}
      </div>

      {rows.length === 0 && (
        <div className="empty">
          <Pill size={32} />
          <h3>No prescriptions yet</h3>
          <p>{user.role === "doctor" ? "Issue one from Messages, the video room, or a chart." : "When a doctor writes a prescription it will appear here."}</p>
        </div>
      )}

      {rows.map((rx) => (
        <section className="card rx-card" key={rx.id}>
          <div className="card-head">
            <div>
              <span className="eyebrow">{formatDate(rx.date)} · {rx.pharmacy}</span>
              <h3>{rx.drug}</h3>
              <p className="muted">{user.role === "patient" ? rx.doctor?.name : rx.patient?.name} · {rx.source || "chart"}</p>
            </div>
            <span className={`status ${rx.status}`}>{rx.status}</span>
          </div>
          <ul className="rx-items">
            {(rx.items || []).map((line, i) => (
              <li key={i}><b>{line.drug}</b><span>{line.sig || "As directed"} · {line.qty}</span></li>
            ))}
          </ul>
          {rx.notes && <p className="muted">{rx.notes}</p>}
          <div className="row-actions">
            <Link className="secondary-btn" to={`/prescriptions/${rx.id}`}><Printer size={16} /> Print / save PDF</Link>
            {user.role === "patient" && (
              <>
                <Link className="primary-btn" to={`/pay?rx=${rx.id}`}>
                  <ShoppingBag size={16} /> Buy on site
                </Link>
                <button type="button" className="ghost-btn" disabled={busy.startsWith(rx.id)} onClick={() => fulfill(rx, "hospital")}>
                  <Hospital size={16} /> {busy === `${rx.id}-hospital` ? "Queuing…" : "Collect at hospital"}
                </button>
              </>
            )}
          </div>
        </section>
      ))}

      {user.role === "doctor" && (
        <p className="muted top-gap">Issue a new prescription from a patient chat, the video room, or their clinical file.</p>
      )}
    </div>
  );
}
