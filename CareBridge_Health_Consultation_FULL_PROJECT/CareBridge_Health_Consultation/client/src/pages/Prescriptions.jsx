import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pill, Printer, ShoppingBag, Hospital } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../state";
import { formatDate } from "../utils";

export default function Prescriptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api(`/prescriptions?userId=${user.id}&role=${user.role}`).then(setRows).catch(() => {});
  }, [user.id, user.role]);

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
                <Link className="ghost-btn" to={`/pay?rx=${rx.id}&fulfill=hospital`}>
                  <Hospital size={16} /> Collect at hospital
                </Link>
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
