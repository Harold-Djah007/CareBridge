import React from "react";
import { Link, useNavigate } from "react-router-dom";

export function TileGrid({ children, label = "Shortcuts" }) {
  return <nav className="tile-grid" aria-label={label}>{children}</nav>;
}

export function StatStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <ul className="stat-strip">
      {items.map((item) => (
        <li className="stat-chip" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </li>
      ))}
    </ul>
  );
}

export function JumpMenu({ label = "Go to", items = [] }) {
  const navigate = useNavigate();
  if (!items.length) return null;
  return (
    <div className="jump-bar">
      <label className="jump-menu">
        <span>{label}</span>
        <select
          defaultValue=""
          onChange={(e) => {
            const next = e.target.value;
            if (next) navigate(next);
            e.target.value = "";
          }}
        >
          <option value="" disabled>{label}…</option>
          {items.map((item) => (
            <option key={item.to} value={item.to}>{item.title}{item.subtitle ? ` — ${item.subtitle}` : ""}</option>
          ))}
        </select>
      </label>
      <nav className="chip-row" aria-label={label}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} className="chip-link" to={item.to}>
              {Icon ? <Icon size={14} strokeWidth={2.2} /> : null}
              {item.title}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function TileCard({ to, icon: Icon, title, subtitle, photo }) {
  return (
    <Link className={`tile-card ${photo ? "has-photo" : ""}`} to={to}>
      {photo ? <span className="tile-photo" style={{ backgroundImage: `url(${photo})` }} aria-hidden="true" /> : null}
      <span className="tile-shimmer" aria-hidden="true" />
      <span className="tile-icon" aria-hidden="true">
        {Icon ? <Icon size={18} strokeWidth={2.1} /> : null}
      </span>
      <span className="tile-copy">
        <b>{title}</b>
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}
