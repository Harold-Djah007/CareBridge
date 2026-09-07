import React from "react";
import { ChevronRight } from "lucide-react";
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
    <header className={`page-hero product-page-hero ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="product-page-hero-main">
        <div className="product-page-hero-copywrap">
          {leading ? <div className="product-page-hero-leading">{leading}</div> : null}
          <div className="page-hero-copy">
            {eyebrow && (
              <div className="product-breadcrumb">
                <span>{eyebrow}</span>
                <ChevronRight size={13} aria-hidden="true" />
                <strong>CareBridge</strong>
              </div>
            )}
            {title && <h1>{title}</h1>}
            {lead ? <p className="product-page-lead">{lead}</p> : null}
            {children ? <div className="product-page-meta">{children}</div> : null}
          </div>
        </div>
        {actions ? <div className="page-hero-actions">{actions}</div> : null}
      </div>
      <div className="product-page-hero-visual" aria-hidden="true">
        <div className="product-page-hero-photo kb-layer" style={{ backgroundImage: `url(${src})` }} />
        <div className="product-page-hero-grid" />
        <span className="product-live-beacon"><i /> Live</span>
      </div>
      {extras ? <div className="product-page-hero-extras">{extras}</div> : null}
    </header>
  );
}

export function EmptyPlate({ scene = "clinic", image, icon: Icon, title, hint, children, compact }) {
  const src = image || photoFor(scene);
  return (
    <div className={`empty empty-plate product-empty-state ${compact ? "compact" : ""}`}>
      <div className="empty-photo" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
      <div className="product-empty-content">
        {Icon ? <span className="product-empty-icon"><Icon size={compact ? 20 : 24} /></span> : null}
        {title && <h3>{title}</h3>}
        {hint && <p>{hint}</p>}
        {children}
      </div>
    </div>
  );
}
