import React from "react";
import { Link } from "react-router-dom";

export function TileGrid({ children, label = "Shortcuts" }) {
  return <nav className="tile-grid" aria-label={label}>{children}</nav>;
}

export default function TileCard({ to, icon: Icon, title, subtitle }) {
  return (
    <Link className="tile-card" to={to}>
      <span className="tile-icon" aria-hidden="true">
        {Icon ? <Icon size={16} strokeWidth={2.1} /> : null}
      </span>
      <span className="tile-copy">
        <b>{title}</b>
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}
