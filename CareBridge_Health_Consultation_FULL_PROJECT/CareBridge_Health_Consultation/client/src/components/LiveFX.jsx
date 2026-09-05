import React, { useEffect, useState } from "react";
import { reducedMotion, useCountUp, useInViewOnce } from "../hooks/useMotion";

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

export function HeroCarousel({ slides, interval = 7000 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    if (reducedMotion()) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [slides.length, interval]);

  return (
    <div className="hero-carousel" aria-roledescription="carousel">
      {slides.map((slide, idx) => (
        <div
          key={slide.image}
          className={`hero-slide ${idx === i ? "on" : ""}`}
          aria-hidden={idx !== i}
        >
          <div className="kb-photo" style={{ backgroundImage: `url(${slide.image})` }} />
        </div>
      ))}
      <div className="hero-shade" />
      {slides.length > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Hero slides">
          {slides.map((slide, idx) => (
            <button
              key={slide.image}
              type="button"
              role="tab"
              aria-selected={idx === i}
              className={idx === i ? "on" : ""}
              onClick={() => setI(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
