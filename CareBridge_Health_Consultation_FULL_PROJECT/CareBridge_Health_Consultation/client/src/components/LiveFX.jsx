import React from "react";
import { useCountUp, useInViewOnce } from "../hooks/useMotion";

export function GoldDust({ count = 16 }) {
  return (
    <div className="gold-dust" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <i key={i} />)}
    </div>
  );
}

export function SoftOrbs() {
  return (
    <div className="hero-orbs" aria-hidden="true">
      <span className="o1" />
      <span className="o2" />
      <span className="o3" />
    </div>
  );
}

export function Reveal({ as: Tag = "div", className = "", delay = 0, children, ...rest }) {
  const [ref, on] = useInViewOnce();
  return (
    <Tag
      ref={ref}
      className={`reveal ${on ? "in" : ""} ${className}`}
      style={{ "--d": `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CountStat({ value, label, suffix = "", prefix = "" }) {
  const [ref, shown] = useCountUp(value, { suffix, prefix });
  return (
    <div className="trust-stat" ref={ref}>
      <strong>{shown}</strong>
      <span>{label}</span>
    </div>
  );
}
