import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs, rxOrderQty } from "../utils";

const cartKey = (id) => `carebridge-pharmacy-cart-${id}`;
const payKey = (id) => `carebridge-cart-${id}`;

function loadCart(userId) {
  try { return JSON.parse(sessionStorage.getItem(cartKey(userId))) || []; } catch { return []; }
}

export default function Pharmacy() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialTab = params.get("tab") === "labs" ? "labs" : params.get("tab") === "services" ? "services" : "pharmacy";
  const [tab, setTab] = useState(initialTab);
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState([]);
  const [labs, setLabs] = useState([]);
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState(() => loadCart(user.id));
  const [busy, setBusy] = useState(false);

  const persist = (next) => {
    setCart(next);
    sessionStorage.setItem(cartKey(user.id), JSON.stringify(next));
  };

  useEffect(() => {
    api("/pharmacy/stock").then(setStock).catch(() => api("/finance/pharmacy").then(setStock));
    api("/finance/labs").then(setLabs);
    api("/finance/rates").then((r) => setServices(r.services || []));
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("pharmacy-stock", setStock);
    socket.on("tariff-updated", (rates) => {
      if (rates?.labs) setLabs(rates.labs);
      if (rates?.services) setServices(rates.services);
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const rxId = params.get("rx");
    if (!rxId || !stock.length) return;
    let cancelled = false;
    api(`/prescriptions/${rxId}`).then((rx) => {
      if (cancelled) return;
      persist(mergePrescription(loadCart(user.id), rx, stock));
      push("Prescription medicines added to your basket. Set the amount you need, then pay or collect at the hospital.");
      const clean = new URLSearchParams(params);
      clean.delete("rx");
      setParams(clean, { replace: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [params.get("rx"), stock.length]);

  const categories = useMemo(() => {
    const set = new Set(stock.map((s) => s.category).filter(Boolean));
    return ["all", ...set];
  }, [stock]);

  const counts = useMemo(() => {
    const map = {};
    stock.forEach((p) => {
      const key = p.category || "Other";
      if (!map[key]) map[key] = { in: 0, out: 0 };
      if (p.inStock !== false && Number(p.qty) > 0) map[key].in += 1;
      else map[key].out += 1;
    });
    return map;
  }, [stock]);

  const grouped = useMemo(() => {
    const rows = category === "all" ? stock : stock.filter((s) => s.category === category);
    const map = {};
    rows.forEach((s) => {
      const key = s.category || "Other";
      map[key] = map[key] || [];
      map[key].push(s);
    });
    return map;
  }, [stock, category]);

  const inCart = (kind, id) => cart.find((c) => c.kind === kind && c.id === id);

  const setQty = (kind, product, qty) => {
    const max = kind === "med" ? Math.max(0, Number(product.qty ?? product.max ?? 0)) : 99;
    const n = Math.max(0, Math.min(max || 99, Number(qty) || 0));
    const rest = cart.filter((c) => !(c.kind === kind && c.id === product.id));
    if (n === 0) {
      persist(rest);
      return;
    }
    persist([...rest, {
      kind,
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      qty: n,
      pack: product.pack || product.specimen || "",
      max: kind === "med" ? Number(product.qty || n) : 99,
      category: product.category || (kind === "lab" ? "Laboratory" : "Service"),
      nhis: Boolean(product.nhis),
    }]);
  };

  const bump = (kind, product, delta) => {
    const current = inCart(kind, product.id)?.qty || 0;
    setQty(kind, product, current + delta);
  };

  const meds = cart.filter((c) => c.kind === "med");
  const labItems = cart.filter((c) => c.kind === "lab");
  const svcItems = cart.filter((c) => c.kind === "svc");
  const medTotal = meds.reduce((s, i) => s + i.price * i.qty, 0);
  const labTotal = labItems.reduce((s, i) => s + i.price * i.qty, 0);
  const svcTotal = svcItems.reduce((s, i) => s + i.price * i.qty, 0);
  const total = medTotal + labTotal + svcTotal;
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const pushInvoicesToPay = (invoices) => {
    let existing = [];
    try { existing = JSON.parse(sessionStorage.getItem(payKey(user.id))) || []; } catch { existing = []; }
    const next = [...existing];
    invoices.forEach((row) => {
      if (!row?.id) return;
      if (next.some((c) => c.kind === "invoice" && c.id === row.id)) return;
      next.push({ kind: "invoice", id: row.id, item: row.item, amount: row.amount, date: row.date, qty: 1, patientId: row.patientId || user.id });
    });
    sessionStorage.setItem(payKey(user.id), JSON.stringify(next));
  };

  const checkout = async (fulfill) => {
    if (!cart.length) return;
    setBusy(true);
    try {
      const invoices = [];
      if (meds.length) {
        const r = await api("/pharmacy/orders", {
          method: "POST",
          body: JSON.stringify({
            patientId: user.id,
            actorId: user.id,
            fulfill,
            items: meds.map((i) => ({ id: i.id, qty: i.qty })),
          }),
        });
        if (r.invoice) invoices.push(r.invoice);
      }
      if (labItems.length) {
        const inv = await api("/finance/labs/order", {
          method: "POST",
          body: JSON.stringify({ patientId: user.id, actorId: user.id, items: labItems.map((i) => ({ id: i.id, qty: i.qty })) }),
        });
        invoices.push(inv);
      }
      if (svcItems.length) {
        for (const s of svcItems) {
          for (let n = 0; n < s.qty; n += 1) {
            const inv = await api("/finance/services/order", {
              method: "POST",
              body: JSON.stringify({ patientId: user.id, actorId: user.id, serviceId: s.id }),
            });
            invoices.push(inv);
          }
        }
      }
      persist([]);
      if (invoices.length) {
        pushInvoicesToPay(invoices);
        push(fulfill === "hospital" && meds.length
          ? "Medicines queued at Ridge pharmacy. Labs and services are in your pay cart."
          : "Basket billed. Review the total and pay.");
        navigate("/pay");
      } else {
        push("The dispensary has your list. Collect at Ridge Campus pharmacy when the nurse marks it ready.");
      }
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Ridge Campus pharmacy</span>
          <h1>Pharmacy & laboratory</h1>
          <p>Choose how many packs you need. Switch between medicines and labs — both stay in one basket with a running total until you clear it or check out.</p>
        </div>
        <Link className="ghost-btn" to="/prescriptions">My prescriptions</Link>
      </div>

      <div className="filters">
        <button className={tab === "pharmacy" ? "active" : ""} onClick={() => setTab("pharmacy")}>Medicines</button>
        <button className={tab === "labs" ? "active" : ""} onClick={() => setTab("labs")}>Laboratory</button>
        <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>Other services</button>
      </div>

      <div className="pharmacy-layout">
        <div>
          {tab === "pharmacy" && (
            <>
              <div className="pharm-cats">
                <button type="button" className={category === "all" ? "on" : ""} onClick={() => setCategory("all")}>
                  <b>All categories</b>
                  <small>{stock.filter((p) => p.inStock !== false && Number(p.qty) > 0).length} in stock · {stock.filter((p) => p.inStock === false || Number(p.qty) <= 0).length} out</small>
                </button>
                {categories.filter((c) => c !== "all").map((c) => (
                  <button type="button" key={c} className={category === c ? "on" : ""} onClick={() => setCategory(c)}>
                    <b>{c}</b>
                    <small>{counts[c]?.in || 0} in stock · {counts[c]?.out || 0} out</small>
                  </button>
                ))}
              </div>
              {Object.entries(grouped).map(([cat, rows]) => (
                <section className="card pharm-cat" key={cat}>
                  <div className="card-head">
                    <div><span className="eyebrow">Cupboard</span><h3>{cat}</h3></div>
                    <small className="muted">{rows.filter((r) => r.inStock !== false && Number(r.qty) > 0).length} in stock</small>
                  </div>
                  <div className="pharm-grid">
                    {rows.map((p) => (
                      <StockCard key={p.id} product={p} kind="med" line={inCart("med", p.id)} onBump={bump} onSet={setQty} />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}

          {tab === "labs" && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Pathology</span><h3>Laboratory tests</h3></div></div>
              <div className="pharm-grid">
                {labs.map((p) => (
                  <StockCard key={p.id} product={{ ...p, pack: p.specimen, inStock: true, qty: 99 }} kind="lab" line={inCart("lab", p.id)} onBump={bump} onSet={setQty} hideStock />
                ))}
              </div>
            </section>
          )}

          {tab === "services" && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Tariff</span><h3>Other hospital services</h3></div></div>
              <div className="pharm-grid">
                {services.map((p) => (
                  <StockCard key={p.id} product={{ ...p, pack: p.nhis ? "NHIS eligible" : "Private pay", inStock: true, qty: 99 }} kind="svc" line={inCart("svc", p.id)} onBump={bump} onSet={setQty} hideStock />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="card pharmacy-basket">
          <div className="card-head">
            <div>
              <span className="eyebrow">Your basket</span>
              <h3><ShoppingCart size={16} /> {count ? `${count} item${count === 1 ? "" : "s"}` : "Empty"}</h3>
            </div>
            {cart.length > 0 && <button type="button" className="ghost-btn" onClick={() => persist([])}>Clear</button>}
          </div>
          {cart.length === 0 && <p className="muted">Add medicines or labs. Changing category does not empty this basket. You will see the full amount before you pay.</p>}
          {meds.length > 0 && <BasketGroup title="Medicines" items={meds} stock={stock} kind="med" onBump={bump} onRemove={(id) => persist(cart.filter((c) => !(c.kind === "med" && c.id === id)))} />}
          {labItems.length > 0 && <BasketGroup title="Laboratory" items={labItems} stock={labs} kind="lab" onBump={bump} onRemove={(id) => persist(cart.filter((c) => !(c.kind === "lab" && c.id === id)))} />}
          {svcItems.length > 0 && <BasketGroup title="Services" items={svcItems} stock={services} kind="svc" onBump={bump} onRemove={(id) => persist(cart.filter((c) => !(c.kind === "svc" && c.id === id)))} />}

          {cart.length > 0 && (
            <div className="basket-totals">
              {meds.length > 0 && <p><span>Medicines</span><b>{ghs(medTotal)}</b></p>}
              {labItems.length > 0 && <p><span>Laboratory</span><b>{ghs(labTotal)}</b></p>}
              {svcItems.length > 0 && <p><span>Services</span><b>{ghs(svcTotal)}</b></p>}
              <p className="basket-grand"><span>Amount you will spend</span><b>{ghs(total)}</b></p>
            </div>
          )}
          <button className="primary-btn full" type="button" disabled={!cart.length || busy} onClick={() => checkout("online")}>
            {busy ? "Placing order…" : `Pay ${ghs(total)}`}
          </button>
          {meds.length > 0 && (
            <button className="secondary-btn full" type="button" disabled={busy} onClick={() => checkout("hospital")}>
              Collect medicines at hospital{labItems.length || svcItems.length ? " · pay labs/services" : ""}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function StockCard({ product, kind, line, onBump, onSet, hideStock }) {
  const out = !hideStock && (product.inStock === false || Number(product.qty) <= 0);
  const qty = line?.qty || 0;
  const max = hideStock ? 99 : Number(product.qty || 0);
  return (
    <article className={`pharm-card ${out ? "out" : ""} ${qty ? "in-cart" : ""}`}>
      <div>
        <strong>{product.name}</strong>
        <span className="muted">{product.pack || product.form}{product.nhis ? " · NHIS" : ""}</span>
        {!hideStock && (
          <em className={`stock-pill ${out ? "out" : qty > 0 && max <= 5 ? "low" : "ok"}`}>
            {out ? "Out of stock" : `${max} in stock`}
          </em>
        )}
      </div>
      <b>{ghs(product.price)}</b>
      {out ? (
        <button className="secondary-btn" type="button" disabled>Unavailable</button>
      ) : (
        <div className="qty-ctrl shop">
          <button type="button" onClick={() => onBump(kind, product, -1)} disabled={qty < 1}><Minus size={14} /></button>
          <input
            type="number"
            min="0"
            max={max}
            value={qty}
            onChange={(e) => onSet(kind, product, e.target.value)}
            aria-label={`Quantity for ${product.name}`}
          />
          <button type="button" onClick={() => onBump(kind, product, 1)} disabled={qty >= max}><Plus size={14} /></button>
        </div>
      )}
    </article>
  );
}

function BasketGroup({ title, items, stock, kind, onBump, onRemove }) {
  return (
    <div className="basket-group">
      <span className="eyebrow">{title}</span>
      {items.map((i) => {
        const product = stock.find((s) => s.id === i.id) || i;
        return (
          <div className="basket-row" key={`${kind}-${i.id}`}>
            <div className="grow">
              <strong>{i.name}</strong>
              <span className="muted">{ghs(i.price)} each</span>
            </div>
            <div className="qty-ctrl">
              <button type="button" onClick={() => onBump(kind, product, -1)}><Minus size={14} /></button>
              <span>{i.qty}</span>
              <button type="button" onClick={() => onBump(kind, product, 1)}><Plus size={14} /></button>
            </div>
            <b>{ghs(i.price * i.qty)}</b>
            <button type="button" className="icon-btn" onClick={() => onRemove(i.id)}><Trash2 size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}

function mergePrescription(cart, rx, stock) {
  const next = [...cart];
  (rx.items || [{ drug: rx.drug, stockId: "" }]).forEach((line) => {
    const product = stock.find((s) => s.id === line.stockId) || stock.find((s) => s.name.toLowerCase() === String(line.drug || "").toLowerCase());
    if (!product || Number(product.qty) <= 0) return;
    const add = rxOrderQty(line, product);
    const found = next.find((c) => c.kind === "med" && c.id === product.id);
    if (found) found.qty = Math.min(Number(product.qty), found.qty + add);
    else {
      next.push({
        kind: "med",
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        qty: add,
        pack: product.pack || "",
        max: Number(product.qty || 1),
        category: product.category,
        nhis: Boolean(product.nhis),
      });
    }
  });
  return next;
}
