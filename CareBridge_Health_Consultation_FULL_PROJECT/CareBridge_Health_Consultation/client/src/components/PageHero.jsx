import React from "react";
import { photoFor } from "../imagery";

export default function PageHero({
  scene = "home",
  image,
  eyebrow,
  title,
  lead,
  actions,
  leading,
  extras,
  children,
  compact = true,
  className = "",
}) {
  const src = image || photoFor(scene);
  return (
    <header className={`page-hero ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="page-hero-photo kb-layer" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
      <div className="page-hero-shade" aria-hidden="true" />
      {extras}
      <div className="page-hero-body">
        {leading}
        <div className="page-hero-copy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {title && <h1>{title}</h1>}
          {lead && <p>{lead}</p>}
          {children}
        </div>
        {actions ? <div className="page-hero-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyPlate({ scene = "clinic", image, icon: Icon, title, hint, children, compact }) {
  const src = image || photoFor(scene);
  return (
    <div className={`empty empty-plate ${compact ? "compact" : ""}`}>
      <div className="empty-photo" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
      {Icon ? <Icon size={compact ? 26 : 32} /> : null}
      {title && <h3>{title}</h3>}
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}
