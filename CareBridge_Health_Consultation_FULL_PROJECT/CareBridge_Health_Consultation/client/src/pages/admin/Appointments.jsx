import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { useToast } from "../../main";
import { formatDate, formatTime } from "../../utils";

export default function AdminAppointments() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);

  const load = () => api("/appointments").then(setRows);
  useEffect(load, []);

  const update = async (id, status) => {
    await api(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    push(`Appointment ${status}. Patient emailed.`);
    load();
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Schedule</span>
          <h1>All appointments</h1>
          <p>Confirm, complete, or cancel any visit. Patients receive an email on status changes.</p>
        </div>
      </div>
      <div className="card" style={{ overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>When</th><th>Patient</th><th>Doctor</th><th>Mode</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{formatDate(a.date)} {formatTime(a.time)}</td>
                <td>{a.patient?.name}</td>
                <td>{a.doctor?.name}</td>
                <td>{a.mode}</td>
                <td><span className={`status ${a.status}`}>{a.status}</span></td>
                <td>
                  <div className="row-actions">
                    {a.status === "pending" && <button className="secondary-btn" onClick={() => update(a.id, "confirmed")}>Confirm</button>}
                    {a.status !== "completed" && a.status !== "cancelled" && <button className="ghost-btn" onClick={() => update(a.id, "completed")}>Complete</button>}
                    {a.status !== "cancelled" && <button className="ghost-btn" onClick={() => update(a.id, "cancelled")}>Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
