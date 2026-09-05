import { useEffect, useState } from "react";

const KEY = "carebridge-topbar";
const EVENT = "carebridge-topbar";

export function readTopbar() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function writeTopbar(open) {
  localStorage.setItem(KEY, open ? "1" : "0");
  window.dispatchEvent(new Event(EVENT));
}

export function useTopbar() {
  const [open, setOpen] = useState(readTopbar);
  useEffect(() => {
    const sync = () => setOpen(readTopbar());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const setTopbar = (value) => {
    const next = typeof value === "function" ? value(open) : value;
    writeTopbar(!!next);
    setOpen(!!next);
  };
  return [open, setTopbar];
}
