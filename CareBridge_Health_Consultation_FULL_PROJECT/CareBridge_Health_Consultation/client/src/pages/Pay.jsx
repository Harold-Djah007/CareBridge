import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { ghs } from "../utils";
import { loadCart, saveCart, cartTotal, cartCount, invoiceLine, mergePrescription, clampCartToStock } from "../cart";

const METHODS = [
  { id: "momo", label: "Mobile money", hint: "MTN, Telecel Cash, or AirtelTigo Money to the hospital merchant wallets" },
  { id: "bank", label: "GCB bank transfer", hint: "CareBridge Medical Centre Ltd, Ridge branch — use the payment reference as narration" },
  { id: "nhis", label: "NHIS / insurance", hint: "Claim against the policy number on the patient file" },
  { id: "cash", label: "Cash at cashier", hint: "Ridge Campus accounts desk, ground floor — receipt issued immediately" },
];

function tabFromParams(params) {
  const tab = params.get("tab");
  if (tab === "labs" || tab === "services" || tab === "pharmacy" || tab === "bills") return tab;
  if (params.get("rx") || params.get("fulfill") === "hospital") return "pharmacy";
  return "bills";
}

export default function Pay() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isAdmin = user.role === "admin";
  const [tab, setTab] = useState(() => tabFromParams(params));
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState([]);
  const [labs, setLabs] = useState([]);
  const [services, setServices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(user.role === "patient" ? user.id : "");
  const prefs = user.paymentPrefs || {};
  const [method, setMethod] = useState(prefs.method || "momo");
  const [form, setForm] = useState({
    network: prefs.momoNetwork || "mtn",
    phone: prefs.momoNumber || user.phone || "",
    payerName: user.name,
    nhisNumber: prefs.nhisNumber || user.insurance || "",
  });
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cart, setCart] = useState(() => loadCart(user.id));
  const appliedRx = useRef("");

  const persist = (next) => setCart(saveCart(user.id, next));

  const loadBills = async () => {
    const rows = await api(`/billing?userId=${user.id}&role=${user.role}`);
    setInvoices(rows);
    return rows;
  };

  useEffect(() => {
    loadBills();
    api("/finance/accounts").then(setAccounts);
    api("/finance/rates").then((r) => {
      setServices(r.services || []);
      if (r.labs) setLabs(r.labs);
    });
    if (!isAdmin) {
      api("/pharmacy/stock").then((rows) => {
        setStock(rows);
        persist(clampCartToStock(loadCart(user.id), rows));
      }).catch(() => api("/finance/pharmacy").then((rows) => {
        setStock(rows);
        persist(clampCartToStock(loadCart(user.id), rows));
      }));
      api("/finance/labs").then(setLabs);
    }
    if (isAdmin) api("/patients").then(setPatients);
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("pharmacy-stock", (rows) => {
      setStock(rows);
      persist(clampCartToStock(loadCart(user.id), rows));
    });
    socket.on("tariff-updated", (rates) => {
      if (rates?.labs) setLabs(rates.labs);
      if (rates?.services) setServices(rates.services);
    });
    return () => socket.disconnect();
  }, [user.id, user.role, isAdmin]);

  useEffect(() => {
    const hydrate = () => setCart(loadCart(user.id));
    const onVis = () => { if (document.visibilityState === "visible") hydrate(); };
    window.addEventListener("pageshow", hydrate);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pageshow", hydrate);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user.id]);

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
            push(`${row.item} added to your basket.`);
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
    if (!stock.length || isAdmin) return;
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
          : "Prescription medicines added to your basket.");
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
      bits.push(`Basket ${ghs(totalNow)}.`);
      push(bits.join(" "), result.added.length ? "ok" : "error");
      const clean = new URLSearchParams(params);
      clean.delete("rx");
      clean.delete("fulfill");
      setParams(clean, { replace: true });
      if (fulfill === "hospital") {
        requestAnimationFrame(() => {
          document.getElementById("shop-basket")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    }).catch(() => {
      appliedRx.current = "";
    });
    return () => { cancelled = true; };
  }, [params.get("rx"), params.get("fulfill"), stock.length, isAdmin]);

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
      item: product.name,
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

  const addInvoice = (row) => {
    if (cart.some((c) => c.kind === "invoice" && c.id === row.id)) {
      push("That bill is already in your basket.");
      return;
    }
    persist([...cart, invoiceLine(row, user.id)]);
    if (isAdmin && row.patientId) setPatientId(row.patientId);
    push("Added to basket");
  };

  const meds = cart.filter((c) => c.kind === "med");
  const labItems = cart.filter((c) => c.kind === "lab");
  const svcItems = cart.filter((c) => c.kind === "svc");
  const billItems = cart.filter((c) => c.kind === "invoice");
  const medTotal = meds.reduce((s, i) => s + i.price * i.qty, 0);
  const labTotal = labItems.reduce((s, i) => s + i.price * i.qty, 0);
  const svcTotal = svcItems.reduce((s, i) => s + i.price * i.qty, 0);
  const billTotal = billItems.reduce((s, i) => s + Number(i.amount || i.price || 0), 0);
  const total = cartTotal(cart);
  const count = cartCount(cart);
  const due = invoices.filter((i) => i.status === "due");
  const paid = invoices.filter((i) => i.status === "paid");
  const merchant = accounts?.momo?.[form.network] || accounts?.momo?.mtn;
  const pid = user.role === "patient" ? user.id : (cart.find((c) => c.patientId)?.patientId || patientId);
  const payable = billItems.length + labItems.length + svcItems.length + meds.length;

  const startPayment = async (invoiceIds, servicesToBill) => {
    const r = await api("/finance/checkout-cart", {
      method: "POST",
      body: JSON.stringify({
        patientId: pid,
        actorId: user.id,
        invoiceIds,
        services: servicesToBill,
        method,
        ...form,
      }),
    });
    setPayment(r.payment);
    persist([]);
    await loadBills();
    if (r.payment.status === "paid") {
      push("Cash posted. Receipt issued.");
      navigate(`/receipts/${r.payment.id}`);
    }
  };

  const checkout = async (fulfill, e) => {
    e?.preventDefault();
    if (!cart.length) {
      push("Add unpaid bills, medicines, or labs to the basket first.", "error");
      return;
    }
    if ((fulfill === "online" || billItems.length || labItems.length || svcItems.length) && !pid) {
      push("Choose a patient first.", "error");
      return;
    }
    setBusy(true);
    try {
      let next = [...cart];
      const invoiceIds = next.filter((c) => c.kind === "invoice").map((c) => c.id);

      if (meds.length) {
        const r = await api("/pharmacy/orders", {
          method: "POST",
          body: JSON.stringify({
            patientId: pid || user.id,
            actorId: user.id,
            fulfill,
            items: meds.map((i) => ({ id: i.id, qty: i.qty })),
          }),
        });
        next = next.filter((c) => c.kind !== "med");
        if (r.invoice?.id && !invoiceIds.includes(r.invoice.id)) {
          invoiceIds.push(r.invoice.id);
          next.push(invoiceLine(r.invoice, pid || user.id));
        }
        persist(next);
      }

      if (fulfill === "hospital") {
        persist(next);
        if (!next.length) {
          push("The dispensary has your list. Collect at Ridge Campus pharmacy when the nurse marks it ready.");
        } else {
          push("Medicines queued at Ridge pharmacy. Pay bills, labs, and services in the basket.");
        }
        await loadBills();
        return;
      }

      if (labItems.length) {
        const inv = await api("/finance/labs/order", {
          method: "POST",
          body: JSON.stringify({
            patientId: pid || user.id,
            actorId: user.id,
            items: labItems.map((i) => ({ id: i.id, qty: i.qty })),
          }),
        });
        next = next.filter((c) => c.kind !== "lab");
        if (inv?.id && !invoiceIds.includes(inv.id)) {
          invoiceIds.push(inv.id);
          next.push(invoiceLine(inv, pid || user.id));
        }
        persist(next);
      }

      const servicesToBill = next.filter((c) => c.kind === "svc").map((c) => ({ id: c.id, qty: c.qty }));

      if (!invoiceIds.length && !servicesToBill.length) {
        persist([]);
        push("Basket updated.");
        return;
      }

      await startPayment(invoiceIds, servicesToBill);
    } catch (err) {
      push(err.message, "error");
      loadBills();
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api("/finance/confirm", { method: "POST", body: JSON.stringify({ paymentId: payment.id, actorId: user.id }) });
      push("Accounts posted the payment and emailed the receipt.");
      navigate(`/receipts/${r.payment.id}`);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const tabs = isAdmin
    ? [
      { id: "bills", label: "Unpaid bills" },
      { id: "services", label: "Hospital services" },
    ]
    : [
      { id: "bills", label: "Unpaid bills" },
      { id: "pharmacy", label: "Medicines" },
      { id: "labs", label: "Laboratory" },
      { id: "services", label: "Other services" },
    ];

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{isAdmin ? "Accounts" : "Ridge Campus shop"}</span>
          <h1>{isAdmin ? "Patient billing cart" : "Shop & pay"}</h1>
          <p>{isAdmin
            ? "Add a patient’s unpaid invoices and tariff services, then check out once — MoMo, GCB, NHIS, or cash."
            : "Unpaid bills, medicines, and labs share one basket. Switching category does not empty it. The amount you will spend stays in view until you pay or collect at the hospital."}</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-btn" to="/billing/tariff">View tariff</Link>
          {!isAdmin && <Link className="ghost-btn" to="/prescriptions">My prescriptions</Link>}
        </div>
      </div>

      <div className="filters">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.id === "bills" && due.length ? `${t.label} (${due.length})` : t.label}
          </button>
        ))}
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
                <p className="muted">Consults, admissions, and earlier orders. Add them to the same basket as medicines and labs.</p>
                {isAdmin && (
                  <label>Patient
                    <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                      <option value="">Select patient</option>
                      {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
                    </select>
                  </label>
                )}
                {due.length === 0 && <p className="muted">Nothing outstanding. Shop medicines, labs, or services if you need a new bill.</p>}
                {due.map((i) => {
                  const added = cart.some((c) => c.kind === "invoice" && c.id === i.id);
                  return (
                    <div className={`pay-pick ${added ? "on" : ""}`} key={i.id}>
                      <span>
                        <b>{i.item}</b>
                        <small>{i.date}{i.patient?.name && isAdmin ? ` · ${i.patient.name}` : ""}</small>
                      </span>
                      <strong>{ghs(i.amount)}</strong>
                      <button type="button" className={added ? "ghost-btn" : "secondary-btn"} disabled={added} onClick={() => addInvoice(i)}>
                        {added ? "In basket" : "Add to basket"}
                      </button>
                    </div>
                  );
                })}
              </section>
              {paid.length > 0 && (
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

          {tab === "pharmacy" && !isAdmin && (
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

          {tab === "labs" && !isAdmin && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Pathology</span><h3>Laboratory tests</h3></div></div>
              <p className="muted">Adding a test does not clear medicines already in the basket.</p>
              <div className="pharm-grid">
                {labs.map((p) => (
                  <StockCard key={p.id} product={{ ...p, pack: p.specimen, inStock: true, qty: 99 }} kind="lab" line={inCart("lab", p.id)} onBump={bump} onSet={setQty} hideStock />
                ))}
              </div>
            </section>
          )}

          {tab === "services" && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Tariff</span><h3>{isAdmin ? "Bill a hospital service" : "Other hospital services"}</h3></div></div>
              {isAdmin && (
                <label>Patient
                  <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                    <option value="">Select patient</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
                  </select>
                </label>
              )}
              <div className="pharm-grid">
                {services.map((p) => (
                  <StockCard
                    key={p.id}
                    product={{ ...p, pack: p.nhis ? "NHIS eligible" : "Private pay", inStock: true, qty: 99 }}
                    kind="svc"
                    line={inCart("svc", p.id)}
                    onBump={bump}
                    onSet={setQty}
                    hideStock
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="card pharmacy-basket" id="shop-basket">
          <div className="card-head">
            <div>
              <span className="eyebrow">Your basket</span>
              <h3><ShoppingCart size={16} /> {count ? `${count} item${count === 1 ? "" : "s"}` : "Empty"}</h3>
            </div>
            {cart.length > 0 && !payment && <button type="button" className="ghost-btn" onClick={() => persist([])}>Clear</button>}
          </div>
          <p className="basket-grand running-total">
            <span>Running total</span>
            <b>{ghs(payment ? payment.amount : total)}</b>
          </p>
          {cart.length === 0 && !payment && (
            <p className="muted">Add unpaid bills, medicines, or labs. Changing tab or leaving this page does not empty this basket. Buy on site adds to the total already here.</p>
          )}
          {billItems.length > 0 && (
            <BasketGroup
              title="Unpaid bills"
              items={billItems}
              kind="invoice"
              onRemove={(id) => persist(cart.filter((c) => !(c.kind === "invoice" && c.id === id)))}
            />
          )}
          {meds.length > 0 && (
            <BasketGroup
              title="Medicines"
              items={meds}
              stock={stock}
              kind="med"
              onBump={bump}
              onRemove={(id) => persist(cart.filter((c) => !(c.kind === "med" && c.id === id)))}
            />
          )}
          {labItems.length > 0 && (
            <BasketGroup
              title="Laboratory"
              items={labItems}
              stock={labs}
              kind="lab"
              onBump={bump}
              onRemove={(id) => persist(cart.filter((c) => !(c.kind === "lab" && c.id === id)))}
            />
          )}
          {svcItems.length > 0 && (
            <BasketGroup
              title="Services"
              items={svcItems}
              stock={services}
              kind="svc"
              onBump={bump}
              onRemove={(id) => persist(cart.filter((c) => !(c.kind === "svc" && c.id === id)))}
            />
          )}

          {(cart.length > 0 || payment) && (
            <div className="basket-totals">
              {billItems.length > 0 && <p><span>Unpaid bills</span><b>{ghs(billTotal)}</b></p>}
              {meds.length > 0 && <p><span>Medicines</span><b>{ghs(medTotal)}</b></p>}
              {labItems.length > 0 && <p><span>Laboratory</span><b>{ghs(labTotal)}</b></p>}
              {svcItems.length > 0 && <p><span>Services</span><b>{ghs(svcTotal)}</b></p>}
              <p className="basket-grand"><span>Amount you will spend</span><b>{ghs(payment ? payment.amount : total)}</b></p>
            </div>
          )}

          {cart.length > 0 && !payment && (
            <form onSubmit={(e) => checkout("online", e)} className="pay-form">
              <p className="eyebrow">Checkout</p>
              {METHODS.map((m) => (
                <label className="check-row" key={m.id}>
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <span><b>{m.label}</b><small className="muted"> — {m.hint}</small></span>
                </label>
              ))}
              {method === "momo" && (
                <>
                  <label>Network
                    <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}>
                      <option value="mtn">MTN MoMo</option>
                      <option value="telecel">Telecel Cash</option>
                      <option value="at">AirtelTigo Money</option>
                    </select>
                  </label>
                  <label>Payer MoMo number<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label>
                  <div className="bank-box">
                    <p><b>Send to hospital merchant</b></p>
                    <p>{accounts?.momo.name}<br />Merchant ID {accounts?.momo.merchantId}<br />{form.network.toUpperCase()} {merchant}</p>
                    <p className="muted">MTN: *170# → Send Money → Mobile Number → {merchant}.</p>
                  </div>
                </>
              )}
              {method === "bank" && accounts && (
                <div className="bank-box">
                  <p><b>{accounts.bank.bank}</b></p>
                  <p>{accounts.bank.accountName}<br />A/C {accounts.bank.accountNumber}<br />{accounts.bank.branch}</p>
                  <label>Account name used for the transfer<input value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} required /></label>
                </div>
              )}
              {method === "nhis" && (
                <label>NHIS / policy number<input value={form.nhisNumber} onChange={(e) => setForm({ ...form, nhisNumber: e.target.value })} required /></label>
              )}
              {method === "cash" && (
                <p className="muted">{accounts?.cashier.desk}. {accounts?.cashier.hours}.</p>
              )}
              <button className="primary-btn full" disabled={busy || !payable}>
                {busy ? "Posting…" : method === "cash" ? `Pay ${ghs(total)} cash` : `Pay ${ghs(total)}`}
              </button>
            </form>
          )}

          {meds.length > 0 && !payment && (
            <button className="secondary-btn full" type="button" disabled={busy} onClick={() => checkout("hospital")}>
              Collect medicines at hospital{labItems.length || svcItems.length || billItems.length ? " · pay the rest" : ""}
            </button>
          )}

          {payment && payment.status === "pending" && (
            <div>
              <p className="eyebrow">Reference {payment.reference}</p>
              <h3>Complete this transfer</h3>
              {payment.method === "momo" && (
                <p>Pay <b>{ghs(payment.amount)}</b> from <b>{payment.phone}</b> to merchant <b>{payment.destination?.number}</b>. Use reference {payment.reference}.</p>
              )}
              {payment.method === "bank" && (
                <p>Transfer <b>{ghs(payment.amount)}</b> to GCB {accounts?.bank.accountNumber}. Narration must be <b>{payment.reference}</b>.</p>
              )}
              {payment.method === "nhis" && (
                <p>Claim for policy <b>{payment.nhisNumber}</b> is lodged. Confirm when NHIS authorises.</p>
              )}
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="primary-btn full" type="button" disabled={busy} onClick={confirm}>Payment sent — issue receipt</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {cart.length > 0 && !payment && (
        <a className="shop-spend-bar" href="#shop-basket">
          <span>Amount you will spend</span>
          <b>{ghs(total)}</b>
        </a>
      )}
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

function BasketGroup({ title, items, stock = [], kind, onBump, onRemove }) {
  return (
    <div className="basket-group">
      <span className="eyebrow">{title}</span>
      {items.map((i) => {
        const product = stock.find((s) => s.id === i.id) || i;
        const label = i.name || i.item;
        return (
          <div className="basket-row" key={`${kind}-${i.id}`}>
            <div className="grow">
              <strong>{label}</strong>
              <span className="muted">{kind === "invoice" ? (i.date || "On file") : `${ghs(i.price)} each`}</span>
            </div>
            {kind !== "invoice" && onBump && (
              <div className="qty-ctrl">
                <button type="button" onClick={() => onBump(kind, product, -1)}><Minus size={14} /></button>
                <span>{i.qty}</span>
                <button type="button" onClick={() => onBump(kind, product, 1)}><Plus size={14} /></button>
              </div>
            )}
            <b>{ghs(kind === "invoice" ? i.amount : i.price * i.qty)}</b>
            <button type="button" className="icon-btn" onClick={() => onRemove(i.id)}><Trash2 size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}
