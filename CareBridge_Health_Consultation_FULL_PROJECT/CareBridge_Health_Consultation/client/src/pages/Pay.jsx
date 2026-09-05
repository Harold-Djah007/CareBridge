import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Search } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { useCart } from "../ShopCart";
import { ghs } from "../utils";
import { BILLS_EVENT, loadCart, cartTotal, invoiceLine, mergePrescription, clampCartToStock } from "../cart";
import AdminReceipts from "./admin/Receipts";
import PageHero from "../components/PageHero";

function tabFromParams(params) {
  const tab = params.get("tab");
  if (tab === "labs" || tab === "services" || tab === "pharmacy" || tab === "bills") return tab;
  if (params.get("rx") || params.get("fulfill") === "hospital") return "pharmacy";
  return "bills";
}

function matchesCatalogQuery(kind, row, q) {
  if (!q) return true;
  const bits = kind === "med"
    ? [row.name, row.sku, row.category]
    : kind === "invoice"
      ? [row.item]
      : [row.name];
  return bits.filter(Boolean).join(" ").toLowerCase().includes(q);
}

export default function Pay() {
  const { user } = useAuth();
  if (user.role === "admin") return <AdminReceipts />;
  return <PatientShop />;
}

function PatientShop() {
  const { user } = useAuth();
  const { push } = useToast();
  const shop = useCart();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(() => tabFromParams(params));
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState([]);
  const [labs, setLabs] = useState([]);
  const [services, setServices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [query, setQuery] = useState("");
  const appliedRx = useRef("");
  const q = query.trim().toLowerCase();
  const cart = shop?.items || [];
  const persist = shop?.persist || ((next) => next);

  const loadBills = async () => {
    const rows = await api(`/billing?userId=${user.id}&role=${user.role}`);
    setInvoices(rows);
    return rows;
  };

  useEffect(() => {
    loadBills();
    api("/finance/rates").then((r) => {
      setServices(r.services || []);
      if (r.labs) setLabs(r.labs);
    });
    api("/pharmacy/stock").then((rows) => {
      setStock(rows);
      persist(clampCartToStock(loadCart(user.id), rows));
    }).catch(() => api("/finance/pharmacy").then((rows) => {
      setStock(rows);
      persist(clampCartToStock(loadCart(user.id), rows));
    }));
    api("/finance/labs").then(setLabs);
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("pharmacy-stock", (rows) => {
      setStock(rows);
      persist(clampCartToStock(loadCart(user.id), rows));
    });
    socket.on("tariff-updated", (rates) => {
      if (rates?.labs) setLabs(rates.labs);
      if (rates?.services) setServices(rates.services);
    });
    const onBills = () => loadBills();
    window.addEventListener(BILLS_EVENT, onBills);
    return () => {
      socket.disconnect();
      window.removeEventListener(BILLS_EVENT, onBills);
    };
  }, [user.id, user.role]);

  useEffect(() => {
    const invoiceId = params.get("invoice");
    const addCode = params.get("add");
    if (!invoiceId && !addCode) return;
    let cancelled = false;
    (async () => {
      const rows = await loadBills();
      if (cancelled) return;
      if (invoiceId) {
        const row = rows.find((r) => r.id === invoiceId && r.status === "due");
        if (row) {
          const current = loadCart(user.id);
          if (!current.some((c) => c.kind === "invoice" && c.id === row.id)) {
            persist([...current, invoiceLine(row, user.id)]);
            push(`${row.item} added to your cart.`);
            shop?.openDrawer();
          }
        }
      }
      setTab("bills");
      const clean = new URLSearchParams(params);
      clean.delete("invoice");
      clean.delete("add");
      setParams(clean, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [params.get("invoice"), params.get("add")]);

  useEffect(() => {
    const rxId = params.get("rx");
    if (!rxId) {
      appliedRx.current = "";
      return;
    }
    if (!stock.length) return;
    if (appliedRx.current === rxId) return;
    let cancelled = false;
    const fulfill = params.get("fulfill");
    api(`/prescriptions/${rxId}`).then((rx) => {
      if (cancelled) return;
      appliedRx.current = rxId;
      const result = mergePrescription(loadCart(user.id), rx, stock);
      persist(result.cart);
      setTab("pharmacy");
      const totalNow = cartTotal(result.cart);
      const bits = [];
      if (result.added.length) {
        bits.push(fulfill === "hospital"
          ? "Prescription medicines added. Collect at Ridge pharmacy or pay the combined total."
          : "Prescription medicines added to your cart.");
      }
      if (result.skipped.length) {
        const names = result.skipped.map((s) => s.name).join(", ");
        const out = result.skipped.every((s) => s.reason === "out");
        bits.push(result.skipped.length === 1
          ? `${names} ${out ? "is out of stock" : "is not on the Ridge shelf"} and was not added.`
          : `${names} were skipped (${out ? "out of stock" : "not on the Ridge shelf"}).`);
      }
      if (!result.added.length && !result.skipped.length) {
        bits.push("No medicines from that prescription could be added.");
      }
      bits.push(`Cart ${ghs(totalNow)}.`);
      push(bits.join(" "), result.added.length ? "ok" : "error");
      const clean = new URLSearchParams(params);
      clean.delete("rx");
      clean.delete("fulfill");
      setParams(clean, { replace: true });
      if (result.added.length) shop?.openDrawer();
    }).catch(() => {
      appliedRx.current = "";
    });
    return () => { cancelled = true; };
  }, [params.get("rx"), params.get("fulfill"), stock.length]);

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
    const rows = (category === "all" ? stock : stock.filter((s) => s.category === category))
      .filter((s) => matchesCatalogQuery("med", s, q));
    const map = {};
    rows.forEach((s) => {
      const key = s.category || "Other";
      map[key] = map[key] || [];
      map[key].push(s);
    });
    return map;
  }, [stock, category, q]);

  const inCart = (kind, id) => cart.find((c) => c.kind === kind && c.id === id);
  const due = invoices.filter((i) => i.status === "due");
  const paid = invoices.filter((i) => i.status === "paid");
  const dueVisible = q ? due.filter((i) => matchesCatalogQuery("invoice", i, q)) : due;
  const visibleLabs = q ? labs.filter((p) => matchesCatalogQuery("lab", p, q)) : labs;
  const visibleServices = q ? services.filter((p) => matchesCatalogQuery("svc", p, q)) : services;

  const tabs = [
    { id: "bills", label: "Unpaid bills" },
    { id: "pharmacy", label: "Medicines" },
    { id: "labs", label: "Laboratory" },
    { id: "services", label: "Other services" },
  ];

  return (
    <div>
      <PageHero
        scene="shop"
        eyebrow="Pharmacy & accounts"
        title="Shop & pay"
        lead="Unpaid bills, medicines, and labs share one cart. Switching category does not empty it."
        actions={(
          <div className="row-actions">
            <Link className="secondary-btn" to="/billing/tariff">Tariff</Link>
            <Link className="ghost-btn" to="/prescriptions">Prescriptions</Link>
          </div>
        )}
      />

      <div className="shop-toolbar">
        <label className="shop-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog"
            aria-label="Search the shop catalog"
          />
          {query && (
            <button type="button" className="shop-search-clear" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </label>
        <div className="filters">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.id === "bills" && due.length ? `${t.label} (${due.length})` : t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`chip-link shop-cart-chip ${shop?.count ? "on" : ""}`}
          onClick={() => shop?.openDrawer()}
        >
          <ShoppingCart size={14} aria-hidden="true" />
          {shop?.count ? `View cart · ${shop.count} · ${ghs(shop.total)}` : "View cart"}
        </button>
      </div>

      <div className="pharmacy-layout shop-layout">
        <div>
          {tab === "bills" && (
            <>
              <section className="card">
                <div className="card-head">
                  <div>
                    <span className="eyebrow">On file</span>
                    <h3>Unpaid bills</h3>
                  </div>
                </div>
                <p className="muted">Consults, admissions, and earlier orders. Add them to the same cart as medicines and labs.</p>
                {due.length === 0 && !q && <p className="muted">Nothing outstanding. Shop medicines, labs, or services if you need a new bill.</p>}
                {q && dueVisible.length === 0 && (
                  <p className="shop-empty-copy">No unpaid bills match “{query.trim()}”.</p>
                )}
                {dueVisible.map((i) => {
                  const added = cart.some((c) => c.kind === "invoice" && c.id === i.id);
                  return (
                    <div className={`pay-pick ${added ? "on" : ""}`} key={i.id}>
                      <span>
                        <b>{i.item}</b>
                        <small>{i.date}</small>
                      </span>
                      <strong>{ghs(i.amount)}</strong>
                      <button
                        type="button"
                        className={added ? "ghost-btn in-cart-bill" : "add-cart-btn"}
                        disabled={added}
                        onClick={() => shop?.addInvoice(i)}
                      >
                        {added ? "In cart" : "Add to cart"}
                      </button>
                    </div>
                  );
                })}
              </section>
              {paid.length > 0 && !q && (
                <section className="card" style={{ marginTop: 16 }}>
                  <div className="card-head"><div><span className="eyebrow">Settled</span><h3>Paid receipts</h3></div></div>
                  {paid.slice(0, 8).map((i) => (
                    <Link key={i.id} className="pay-pick receipt" to={`/receipts/${i.paymentId || i.receiptNo || i.id}`}>
                      <span><b>{i.item}</b><small>Paid · {i.receiptNo || "Receipt"} · {i.method}</small></span>
                      <strong>{ghs(i.amount)}</strong>
                    </Link>
                  ))}
                </section>
              )}
            </>
          )}

          {tab === "pharmacy" && (
            <>
              <div className="shelf-bar">
                <label className="jump-menu">
                  <span>Cupboard</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">
                      All shelves · {stock.filter((p) => p.inStock !== false && Number(p.qty) > 0).length} in · {stock.filter((p) => p.inStock === false || Number(p.qty) <= 0).length} out
                    </option>
                    {categories.filter((c) => c !== "all").map((c) => (
                      <option key={c} value={c}>{c} · {counts[c]?.in || 0} in · {counts[c]?.out || 0} out</option>
                    ))}
                  </select>
                </label>
                <div className="chip-row" aria-label="Medicine shelves">
                  <button type="button" className={`chip-link ${category === "all" ? "on" : ""}`} onClick={() => setCategory("all")}>All</button>
                  {categories.filter((c) => c !== "all").map((c) => (
                    <button type="button" key={c} className={`chip-link ${category === c ? "on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
                  ))}
                </div>
              </div>
              {Object.entries(grouped).map(([cat, rows]) => (
                <section className="card pharm-cat" key={cat}>
                  <div className="card-head">
                    <div><span className="eyebrow">Cupboard</span><h3>{cat}</h3></div>
                    <small className="muted">{rows.filter((r) => r.inStock !== false && Number(r.qty) > 0).length} in stock</small>
                  </div>
                  <div className="pharm-grid">
                    {rows.map((p) => (
                      <StockCard
                        key={p.id}
                        product={p}
                        kind="med"
                        line={inCart("med", p.id)}
                        onAdd={shop?.addProduct}
                        onBump={shop?.bump}
                        onSet={shop?.setQty}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {Object.keys(grouped).length === 0 && (
                <section className="card shop-empty">
                  <p className="shop-empty-copy">
                    {q ? `No medicines match “${query.trim()}”.` : "No medicines in this category."}
                  </p>
                </section>
              )}
            </>
          )}

          {tab === "labs" && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Pathology</span><h3>Laboratory tests</h3></div></div>
              <p className="muted">Adding a test does not clear medicines already in the cart.</p>
              {q && visibleLabs.length === 0 && (
                <p className="shop-empty-copy">No laboratory tests match “{query.trim()}”.</p>
              )}
              <div className="pharm-grid">
                {visibleLabs.map((p) => (
                  <StockCard
                    key={p.id}
                    product={{ ...p, pack: p.specimen, inStock: true, qty: 99 }}
                    kind="lab"
                    line={inCart("lab", p.id)}
                    onAdd={shop?.addProduct}
                    onBump={shop?.bump}
                    onSet={shop?.setQty}
                    hideStock
                  />
                ))}
              </div>
            </section>
          )}

          {tab === "services" && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Tariff</span><h3>Other hospital services</h3></div></div>
              {q && visibleServices.length === 0 && (
                <p className="shop-empty-copy">No hospital services match “{query.trim()}”.</p>
              )}
              <div className="pharm-grid">
                {visibleServices.map((p) => (
                  <StockCard
                    key={p.id}
                    product={{ ...p, pack: p.nhis ? "NHIS eligible" : "Private pay", inStock: true, qty: 99 }}
                    kind="svc"
                    line={inCart("svc", p.id)}
                    onAdd={shop?.addProduct}
                    onBump={shop?.bump}
                    onSet={shop?.setQty}
                    hideStock
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {cart.length > 0 && (
        <button type="button" className="shop-spend-bar" onClick={() => shop?.openDrawer()}>
          <span>Amount you will spend · {shop?.count || cart.length} in cart</span>
          <b>{ghs(shop?.total || 0)}</b>
        </button>
      )}
    </div>
  );
}

function StockCard({ product, kind, line, onAdd, onBump, onSet, hideStock }) {
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
      ) : qty < 1 ? (
        <button type="button" className="add-cart-btn" onClick={() => onAdd?.(kind, product)}>
          Add to cart
        </button>
      ) : (
        <div className="in-cart-ctrl">
          <div className="qty-ctrl shop">
            <button type="button" onClick={() => onBump?.(kind, product, -1)} disabled={qty < 1} aria-label={`Fewer ${product.name}`}><Minus size={14} /></button>
            <input
              type="number"
              min="0"
              max={max}
              value={qty}
              onChange={(e) => onSet?.(kind, product, e.target.value)}
              aria-label={`Quantity for ${product.name}`}
            />
            <button type="button" onClick={() => onBump?.(kind, product, 1)} disabled={qty >= max} aria-label={`More ${product.name}`}><Plus size={14} /></button>
          </div>
          <em className="in-cart-tag">In cart</em>
        </div>
      )}
    </article>
  );
}
