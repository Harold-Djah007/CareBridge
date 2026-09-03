import React, { useEffect, useState } from "react";

const ECG = "M0 36 L18 36 L26 36 L32 12 L38 60 L46 36 L58 36 L66 36 L72 22 L78 36 L96 36 L104 36 L110 14 L116 58 L124 36 L160 36 L168 36 L174 20 L180 36 L220 36 L228 36 L234 12 L240 60 L248 36 L280 36";

export function LiveClock({ className = "" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time className={`live-clock ${className}`} dateTime={now.toISOString()}>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </time>
  );
}

export function EcgRibbon({ variant = "doctor" }) {
  return (
    <div className={`ecg-ribbon vital-${variant}`} aria-hidden="true">
      <div className="ecg-track">
        <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
        <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
      </div>
    </div>
  );
}

export function Heartbeat({ bpm = 72, variant = "patient", compact = false }) {
  const [beat, setBeat] = useState(bpm);
  useEffect(() => {
    const id = setInterval(() => {
      setBeat((n) => Math.max(62, Math.min(88, n + (Math.random() > 0.5 ? 1 : -1))));
    }, 1100);
    return () => clearInterval(id);
  }, []);

  const label = variant === "admin" ? "System pulse" : variant === "doctor" ? "Monitor" : "Heart rate";

  return (
    <div className={`vital-card vital-${variant} ${compact ? "compact" : ""}`}>
      <div className="vital-head">
        <span className="live-dot" />
        <span>Live · {label}</span>
      </div>
      <div className="vital-body">
        <div className="heart-wrap" aria-hidden="true">
          <span className="pulse-ring" />
          <svg className="heart-icon" viewBox="0 0 24 24">
            <path d="M12 21s-6.7-4.4-9.3-8.1C.4 9.8 1.6 5.8 5.2 4.7c2-.6 3.9.3 4.8 1.8 1-1.5 2.8-2.4 4.8-1.8 3.6 1.1 4.8 5.1 2.5 8.2C18.7 16.6 12 21 12 21z" />
          </svg>
        </div>
        <div className="vital-readout">
          <strong>{beat}</strong>
          <small>BPM</small>
        </div>
      </div>
      {!compact && (
        <div className="ecg" aria-hidden="true">
          <div className="ecg-track">
            <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
            <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
          </div>
        </div>
      )}
    </div>
  );
}

export function OccupancyBars({ items = [] }) {
  return (
    <div className="occ-board">
      {items.map((item) => {
        const max = Number(item.max) || 1;
        const value = Math.max(0, Number(item.value) || 0);
        const pct = Math.min(100, (value / max) * 100);
        return (
          <div className="occ-row" key={item.label}>
            <div className="occ-meta">
              <b>{item.label}</b>
              <span>{value} / {max}</span>
            </div>
            <div className="occ-track">
              <span style={{ "--w": `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
