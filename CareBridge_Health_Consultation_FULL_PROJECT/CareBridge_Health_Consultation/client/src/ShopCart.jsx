import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { api } from "./api";
import { BILLS_EVENT, cartCount, cartTotal, invoiceLine, loadCart, saveCart } from "./cart";
import { useAuth, useToast } from "./state";
import { ghs } from "./utils";

const CartContext = createContext(null);

const METHODS = [
  { id: "momo", label: "Mobile money", hint: "MTN, Telecel Cash, or AirtelTigo Money to the hospital merchant wallets" },
  { id: "bank", label: "GCB bank transfer", hint: "CareBridge Medical Centre Ltd, Ridge branch — use the payment reference as narration" },
  { id: "nhis", label: "NHIS / insurance", hint: "Claim against the policy number on the patient file" },
  { id: "cash", label: "Cash at cashier", hint: "Ridge Campus accounts desk, ground floor — receipt issued immediately" },
];

export function useCart() {
  return useContext(CartContext);
}

function stockCap(kind, product) {
  if (kind !== "med") return 99;
  return Math.max(0, Number(product?.max ?? product?.qty ?? 0));
}

function lineProduct(kind, product) {
  return {
    kind,
    id: product.id,
    name: product.name || product.item,
    item: product.item || product.name,
    price: Number(product.price || product.amount || 0),
    pack: product.pack || product.specimen || "",
    max: stockCap(kind, product),
    category: product.category || (kind === "lab" ? "Laboratory" : "Service"),
    nhis: Boolean(product.nhis),
  };
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState(() => loadCart(user?.id));
  const [open, setOpen] = useState(false);

  const reload = () => setItems(loadCart(user?.id));

  useEffect(() => {
    setItems(loadCart(user?.id));
    setOpen(false);
  }, [user?.id]);

  useEffect(() => {
    const hydrate = () => setItems(loadCart(user?.id));
    const onVis = () => { if (document.visibilityState === "visible") hydrate(); };
    window.addEventListener("carebridge-cart", hydrate);
    window.addEventListener("pageshow", hydrate);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("carebridge-cart", hydrate);
      window.removeEventListener("pageshow", hydrate);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id]);

  const persist = (next) => {
    const saved = saveCart(user?.id, next);
    setItems(saved);
    return saved;
  };

  const inCart = (kind, id) => items.find((c) => c.kind === kind && c.id === id);

  const setQty = (kind, product, qty) => {
    setItems((current) => {
      const max = stockCap(kind, product);
      const n = Math.max(0, Math.min(max || 99, Number(qty) || 0));
      const rest = current.filter((c) => !(c.kind === kind && c.id === product.id));
      const next = n === 0 ? rest : [...rest, { ...lineProduct(kind, product), qty: n }];
      return saveCart(user?.id, next);
    });
  };

  const bump = (kind, product, delta) => {
    const current = inCart(kind, product.id)?.qty || 0;
    setQty(kind, product, current + delta);
  };

  const addProduct = (kind, product, qty = 1) => {
    const current = inCart(kind, product.id)?.qty || 0;
    const max = stockCap(kind, product);
    if (current >= max) {
      push("That is all we have on the shelf.", "error");
      return;
    }
    setQty(kind, product, current + qty);
    if (current === 0) {
      push(`${product.name} added to cart`);
      setOpen(true);
    }
  };

  const addInvoice = (row) => {
    if (items.some((c) => c.kind === "invoice" && c.id === row.id)) {
      push("That bill is already in your cart.");
      return false;
    }
    persist([...items, invoiceLine(row, user.id)]);
    push(`${row.item} added to cart`);
    setOpen(true);
    return true;
  };

  const remove = (kind, id) => persist(items.filter((c) => !(c.kind === kind && c.id === id)));
  const clear = () => persist([]);

  const value = useMemo(() => ({
    items,
    count: cartCount(items),
    total: cartTotal(items),
    persist,
    reload,
    inCart,
    setQty,
    bump,
    addProduct,
    addInvoice,
    remove,
    clear,
    open,
    setOpen,
    openDrawer: () => setOpen(true),
    closeDrawer: () => setOpen(false),
    toggleDrawer: () => setOpen((v) => !v),
  }), [items, open, user?.id]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {user?.role === "patient" && <CartDrawer />}
    </CartContext.Provider>
  );
}

export function CartMastButton() {
  const cart = useCart();
  if (!cart) return null;
  return (
    <button
      className={`icon-btn cart-mast-btn ${cart.count ? "has-items" : ""}`}
      type="button"
      onClick={cart.toggleDrawer}
      title={cart.count ? `${cart.count} in cart · ${ghs(cart.total)}` : "Your cart"}
      aria-label={cart.count ? `Open cart, ${cart.count} items` : "Open cart"}
    >
      <ShoppingCart size={18} />
      {cart.count > 0 && <em className="bell-count cart-count">{cart.count > 99 ? "99+" : cart.count}</em>}
    </button>
  );
}

function CartDrawer() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const cart = useCart();
  const prefs = user?.paymentPrefs || {};
  const [accounts, setAccounts] = useState(null);
  const [method, setMethod] = useState(prefs.method || "momo");
  const [form, setForm] = useState({
    network: prefs.momoNetwork || "mtn",
    phone: prefs.momoNumber || user?.phone || "",
    payerName: user?.name || "",
    nhisNumber: prefs.nhisNumber || user?.insurance || "",
  });
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cart?.open) return;
    api("/finance/accounts").then(setAccounts).catch(() => {});
  }, [cart?.open]);

  useEffect(() => {
    if (!cart?.open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") cart.closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart]);

  const items = cart?.items || [];
  const meds = items.filter((c) => c.kind === "med");
  const labItems = items.filter((c) => c.kind === "lab");
  const svcItems = items.filter((c) => c.kind === "svc");
  const billItems = items.filter((c) => c.kind === "invoice");
  const medTotal = meds.reduce((s, i) => s + i.price * i.qty, 0);
  const labTotal = labItems.reduce((s, i) => s + i.price * i.qty, 0);
  const svcTotal = svcItems.reduce((s, i) => s + i.price * i.qty, 0);
  const billTotal = billItems.reduce((s, i) => s + Number(i.amount || i.price || 0), 0);
  const merchant = accounts?.momo?.[form.network] || accounts?.momo?.mtn;
  const pid = user?.id;
  const payable = items.length;

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
    cart.persist([]);
    window.dispatchEvent(new CustomEvent(BILLS_EVENT));
    if (r.payment.status === "paid") {
      push("Cash posted. Receipt issued.");
      cart.closeDrawer();
      navigate(`/receipts/${r.payment.id}`);
    }
  };

  const checkout = async (fulfill, e) => {
    e?.preventDefault();
    if (!items.length) {
      push("Add unpaid bills, medicines, or labs to the cart first.", "error");
      return;
    }
    setBusy(true);
    try {
      let next = [...items];
      const invoiceIds = next.filter((c) => c.kind === "invoice").map((c) => c.id);

      if (meds.length) {
        const r = await api("/pharmacy/orders", {
          method: "POST",
          body: JSON.stringify({
            patientId: pid,
            actorId: user.id,
            fulfill,
            items: meds.map((i) => ({ id: i.id, qty: i.qty })),
          }),
        });
        next = next.filter((c) => c.kind !== "med");
        if (r.invoice?.id && !invoiceIds.includes(r.invoice.id)) {
          invoiceIds.push(r.invoice.id);
          next.push(invoiceLine(r.invoice, pid));
        }
        cart.persist(next);
      }

      if (fulfill === "hospital") {
        cart.persist(next);
        window.dispatchEvent(new CustomEvent(BILLS_EVENT));
        if (!next.length) {
          push("The dispensary has your list. Collect at Ridge Campus pharmacy when the nurse marks it ready.");
          cart.closeDrawer();
        } else {
          push("Medicines queued at Ridge pharmacy. Pay bills, labs, and services in the cart.");
        }
        return;
      }

      if (labItems.length) {
        const inv = await api("/finance/labs/order", {
          method: "POST",
          body: JSON.stringify({
            patientId: pid,
            actorId: user.id,
            items: labItems.map((i) => ({ id: i.id, qty: i.qty })),
          }),
        });
        next = next.filter((c) => c.kind !== "lab");
        if (inv?.id && !invoiceIds.includes(inv.id)) {
          invoiceIds.push(inv.id);
          next.push(invoiceLine(inv, pid));
        }
        cart.persist(next);
      }

      const servicesToBill = next.filter((c) => c.kind === "svc").map((c) => ({ id: c.id, qty: c.qty }));

      if (!invoiceIds.length && !servicesToBill.length) {
        cart.persist([]);
        push("Cart updated.");
        return;
      }

      await startPayment(invoiceIds, servicesToBill);
    } catch (err) {
      push(err.message, "error");
      window.dispatchEvent(new CustomEvent(BILLS_EVENT));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api("/finance/confirm", { method: "POST", body: JSON.stringify({ paymentId: payment.id, actorId: user.id }) });
      push("Accounts posted the payment and emailed the receipt.");
      setPayment(null);
      cart.closeDrawer();
      navigate(`/receipts/${r.payment.id}`);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!cart || !user) return null;

  return (
    <>
      <button
        type="button"
        className={`cart-scrim ${cart.open ? "on" : ""}`}
        aria-hidden={!cart.open}
        tabIndex={cart.open ? 0 : -1}
        onClick={cart.closeDrawer}
      />
      <aside className={`cart-drawer ${cart.open ? "open" : ""}`} id="shop-basket" aria-hidden={!cart.open} aria-label="Shopping cart">
        <div className="cart-drawer-head">
          <div>
            <span className="eyebrow">Shop & pay</span>
            <h3>
              <ShoppingCart size={16} />
              {cart.count ? `${cart.count} item${cart.count === 1 ? "" : "s"}` : "Your cart"}
            </h3>
          </div>
          <div className="row-actions">
            {items.length > 0 && !payment && (
              <button type="button" className="ghost-btn" onClick={cart.clear}>Empty</button>
            )}
            <button type="button" className="icon-btn" onClick={cart.closeDrawer} aria-label="Close cart">
              <X size={18} />
            </button>
          </div>
        </div>

        <p className="basket-grand running-total">
          <span>Running total</span>
          <b>{ghs(payment ? payment.amount : cart.total)}</b>
        </p>

        <div className="cart-drawer-body">
          {items.length === 0 && !payment && (
            <div className="cart-empty">
              <ShoppingCart size={28} />
              <p>Your cart is empty.</p>
              <small>Add unpaid bills, medicines, labs, or hospital services. Leaving a page does not empty it.</small>
              <button type="button" className="secondary-btn" onClick={() => { cart.closeDrawer(); navigate("/pay"); }}>
                Continue shopping
              </button>
            </div>
          )}

          {billItems.length > 0 && (
            <CartGroup title="Unpaid bills" items={billItems} kind="invoice" onRemove={(id) => cart.remove("invoice", id)} />
          )}
          {meds.length > 0 && (
            <CartGroup title="Medicines" items={meds} kind="med" onBump={cart.bump} onRemove={(id) => cart.remove("med", id)} />
          )}
          {labItems.length > 0 && (
            <CartGroup title="Laboratory" items={labItems} kind="lab" onBump={cart.bump} onRemove={(id) => cart.remove("lab", id)} />
          )}
          {svcItems.length > 0 && (
            <CartGroup title="Services" items={svcItems} kind="svc" onBump={cart.bump} onRemove={(id) => cart.remove("svc", id)} />
          )}

          {(items.length > 0 || payment) && (
            <div className="basket-totals">
              {billItems.length > 0 && <p><span>Unpaid bills</span><b>{ghs(billTotal)}</b></p>}
              {meds.length > 0 && <p><span>Medicines</span><b>{ghs(medTotal)}</b></p>}
              {labItems.length > 0 && <p><span>Laboratory</span><b>{ghs(labTotal)}</b></p>}
              {svcItems.length > 0 && <p><span>Services</span><b>{ghs(svcTotal)}</b></p>}
              <p className="basket-grand"><span>Amount you will spend</span><b>{ghs(payment ? payment.amount : cart.total)}</b></p>
            </div>
          )}

          {items.length > 0 && !payment && (
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
                {busy ? "Posting…" : method === "cash" ? `Pay ${ghs(cart.total)} cash` : `Pay ${ghs(cart.total)}`}
              </button>
            </form>
          )}

          {meds.length > 0 && !payment && (
            <button className="secondary-btn full" type="button" disabled={busy} onClick={() => checkout("hospital")}>
              Collect medicines at hospital{labItems.length || svcItems.length || billItems.length ? " · pay the rest" : ""}
            </button>
          )}

          {payment && payment.status === "pending" && (
            <div className="cart-pending">
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
        </div>
      </aside>
    </>
  );
}

function CartGroup({ title, items, kind, onBump, onRemove }) {
  return (
    <div className="basket-group">
      <span className="eyebrow">{title}</span>
      {items.map((i) => {
        const label = i.name || i.item;
        return (
          <div className="basket-row" key={`${kind}-${i.id}`}>
            <div className="grow">
              <strong>{label}</strong>
              <span className="muted">{kind === "invoice" ? (i.date || "On file") : `${ghs(i.price)} each`}</span>
            </div>
            {kind !== "invoice" && onBump && (
              <div className="qty-ctrl">
                <button type="button" onClick={() => onBump(kind, i, -1)} aria-label={`Fewer ${label}`}><Minus size={14} /></button>
                <span>{i.qty}</span>
                <button type="button" onClick={() => onBump(kind, i, 1)} aria-label={`More ${label}`}><Plus size={14} /></button>
              </div>
            )}
            <b>{ghs(kind === "invoice" ? i.amount : i.price * i.qty)}</b>
            <button type="button" className="icon-btn" onClick={() => onRemove(i.id)} aria-label={`Remove ${label}`}>
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
