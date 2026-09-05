import { useEffect, useRef, useState } from "react";

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useInViewOnce(options = {}) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setOn(true);
        io.disconnect();
      }
    }, { threshold: 0.2, rootMargin: "0px 0px -36px 0px", ...options });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, on];
}

export function useCountUp(target, { duration = 1300, prefix = "", suffix = "" } = {}) {
  const [ref, on] = useInViewOnce();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!on) return undefined;
    if (reducedMotion()) {
      setN(target);
      return undefined;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, target, duration]);

  return [ref, `${prefix}${n}${suffix}`];
}
