import { useEffect, useState } from "react";
import { api } from "../api";

let cache = null;
let inflight = null;

export function invalidateSiteCache() {
  cache = null;
  inflight = null;
}

export function useSite() {
  const [site, setSite] = useState(cache || { social: {} });
  const [loaded, setLoaded] = useState(Boolean(cache));

  useEffect(() => {
    let alive = true;
    const request = cache
      ? Promise.resolve(cache)
      : inflight || (inflight = api("/site")
        .then((data) => {
          cache = data;
          inflight = null;
          return data;
        })
        .catch((err) => {
          inflight = null;
          throw err;
        }));

    request
      .then((data) => {
        if (!alive) return;
        setSite(data);
        setLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setSite({ social: {} });
        setLoaded(true);
      });

    return () => { alive = false; };
  }, []);

  return { site, loaded, social: site?.social || {} };
}
