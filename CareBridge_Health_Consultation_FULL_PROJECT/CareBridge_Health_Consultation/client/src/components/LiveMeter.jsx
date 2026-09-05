import React, { useEffect, useState } from "react";
import { CalendarDays, Video, BedDouble, Home } from "lucide-react";

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

export function EcgRibbon() {
  return (
    <div className="ecg-ribbon vital-doctor" aria-hidden="true">
      <div className="ecg-track">
        <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
        <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
      </div>
    </div>
  );
}

export function Heartbeat({ bpm = 72 }) {
  const [beat, setBeat] = useState(bpm);
  useEffect(() => {
    const id = setInterval(() => {
      setBeat((n) => Math.max(62, Math.min(88, n + (Math.random() > 0.5 ? 1 : -1))));
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="vital-card vital-doctor">
      <div className="vital-head">
        <span className="live-dot" />
        <span>Live · Monitor</span>
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
      <div className="ecg" aria-hidden="true">
        <div className="ecg-track">
          <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
          <svg viewBox="0 0 280 72" preserveAspectRatio="none"><path d={ECG} fill="none" /></svg>
        </div>
      </div>
    </div>
  );
}

const CARE_STEPS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Visit" },
  { icon: Video, label: "Consult" },
  { icon: BedDouble, label: "Ward" },
];

export function CarePath({ caption = "From home to the ward" }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % CARE_STEPS.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="care-path-card">
      <div className="vital-head">
        <span className="care-dot" />
        <span>With you</span>
      </div>
      <div className="care-path" aria-hidden="true">
        <span className="care-halo" />
        {CARE_STEPS.map((item, i) => {
          const Icon = item.icon;
          return (
            <div className={`care-node ${i === step ? "on" : i < step ? "done" : ""}`} key={item.label}>
              <Icon size={16} />
              <small>{item.label}</small>
            </div>
          );
        })}
      </div>
      <p className="care-caption">{caption}</p>
    </div>
  );
}

export function OpsRadar({ occupancy = 0, pending = 0, beds = 0 }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 2200);
    return () => clearInterval(id);
  }, []);
  const blips = [
    { label: "Clinic", top: "22%", left: "62%" },
    { label: "Wards", top: "58%", left: "28%" },
    { label: "Queue", top: "70%", left: "68%" },
  ];
  const active = tick % blips.length;

  return (
    <div className="ops-radar-card">
      <div className="vital-head">
        <span className="radar-dot" />
        <span>Campus scan</span>
      </div>
      <div className="radar-disc" aria-hidden="true">
        <span className="radar-ring" />
        <span className="radar-ring inner" />
        <span className="radar-sweep" />
        {blips.map((b, i) => (
          <i className={`radar-blip ${i === active ? "on" : ""}`} style={{ top: b.top, left: b.left }} key={b.label} />
        ))}
        <div className="radar-readout">
          <strong>{occupancy}%</strong>
          <small>occupied</small>
        </div>
      </div>
      <div className="radar-meta">
        <span>{beds} open beds</span>
        <span>{pending} in queue</span>
      </div>
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
