import React from "react";
import { ArrowUpRight } from "lucide-react";
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
    <header className={`cbv6-pagehead ${compact ? "is-compact" : ""} ${className}`.trim()} data-scene={scene}>
      <div className="cbv6-pagehead-copy">
        <div className="cbv6-pagehead-kicker">
          {leading ? <span className="cbv6-pagehead-leading">{leading}</span> : null}
          {eyebrow ? <span>{eyebrow}</span> : <span>CareBridge</span>}
        </div>
        {title && <h1>{title}</h1>}
        {lead && <p>{lead}</p>}
        {children ? <div className="cbv6-pagehead-meta">{children}</div> : null}
      </div>

      <div className="cbv6-pagehead-side">
        <div className="cbv6-pagehead-media" style={{ backgroundImage: `url(${src})` }} aria-hidden="true">
          <span><ArrowUpRight size={14} /></span>
        </div>
        {actions ? <div className="cbv6-pagehead-actions">{actions}</div> : null}
      </div>

      {extras ? <div className="cbv6-pagehead-extras">{extras}</div> : null}
    </header>
  );
}

export function EmptyPlate({ scene = "clinic", image, icon: Icon, title, hint, children, compact }) {
  const src = image || photoFor(scene);
  return (
    <div className={`cbv6-empty ${compact ? "is-compact" : ""}`}>
      <div className="cbv6-empty-media" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
      <div className="cbv6-empty-copy">
        {Icon ? <span className="cbv6-empty-icon"><Icon size={compact ? 19 : 23} /></span> : null}
        <div>
          {title && <h3>{title}</h3>}
          {hint && <p>{hint}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
