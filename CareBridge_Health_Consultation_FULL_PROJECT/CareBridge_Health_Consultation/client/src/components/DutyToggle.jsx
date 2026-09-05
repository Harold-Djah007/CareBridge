import React from "react";

export default function DutyToggle({ available, onChange, disabled, hint }) {
  const on = available !== false;
  return (
    <div className={`duty-toggle ${on ? "on" : "off"}`}>
      <span className="duty-glow" aria-hidden="true" />
      <div className="duty-pill" role="group" aria-label="Duty status">
        <span className="duty-slider" aria-hidden="true" />
        <button type="button" className={on ? "active" : ""} disabled={disabled} onClick={() => onChange(true)}>
          Available
        </button>
        <button type="button" className={!on ? "active" : ""} disabled={disabled} onClick={() => onChange(false)}>
          Busy
        </button>
      </div>
      {hint !== false && (
        <small>{on ? "Patients can book and see you as free" : "Patients see you as busy — no new visits"}</small>
      )}
    </div>
  );
}
