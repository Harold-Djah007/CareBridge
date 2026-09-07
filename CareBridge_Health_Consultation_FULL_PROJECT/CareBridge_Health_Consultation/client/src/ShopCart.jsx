import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2, X, ShieldCheck } from "lucide-react";
import { api } from "./api";
import { BILLS_EVENT, cartCount, cartTotal, clampCartToStock, invoiceLine, loadCart, mergeCarts, saveCart, toServerItem } from "./cart";
import { useAuth, useToast } from "./state";
import { ghs } from "./utils";

const CartContext = createContext(null);

const METHODS = [
  { id: "card", label: "Card", hint: "Visa or Mastercard on Flutterwave secure checkout", online: true },
  { id: "momo", label: "Mobile Money", hint: "MTN, Telecel Cash, or AirtelTigo Money through Flutterwave", online: true },
  { id: "bank", label: "Bank transfer", hint: "Flutterwave creates a temporary GHS account for this payment", online: true },
  { id: "nhis", label: "NHIS / insurance", hint: "Send the claim to hospital accounts for review", online: false },
  { id: "cash", label: "Cash at cashier", hint: "Pay at Ridge Campus accounts; staff confirm it before a receipt is issued", online: false },
];
const newCheckoutKey = () => (globalThis.crypto?.randomUUID?.() || `cb-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
  const canShop = user?.role === "patient" && Boolean(user?.id);

  const applyRemote = (payload) => {
    const saved = saveCart(user?.id, payload?.items || []);
    setItems(saved);
    return saved;
  };

  const persistLocal = (next) => {
    const saved = saveCart(user?.id, next);
    setItems(saved);
    return saved;
  };

  const replaceRemote = async (next) => {
    if (!canShop) return persistLocal(next);
    try {
      const remote = await api("/cart", {
        method: "PUT",
        body: JSON.stringify({ userId: user.id, items: (next || []).map(toServerItem) }),
      });
      return applyRemote(remote);
    } catch (err) {
      if (err.message?.startsWith("Only ")) push(err.message, "error");
      try {
        return applyRemote(await api(`/cart?userId=${user.id}`));
      } catch {
        return persistLocal(next);
      }
    }
  };

  const persist = (next) => {
    const saved = persistLocal(next);
    if (canShop) replaceRemote(saved);
    return saved;
  };

  const reload = async () => {
    if (!canShop) {
      setItems(loadCart(user?.id));
      return;
    }
    try {
      applyRemote(await api(`/cart?userId=${user.id}`));
    } catch {
      setItems(loadCart(user.id));
    }
  };

  useEffect(() => {
    setOpen(false);
    if (!canShop) {
      setItems([]);
      return undefined;
    }
    const session = loadCart(user.id);
    setItems(session);
    let cancelled = false;
    (async () => {
      try {
        const remote = await api(`/cart?userId=${user.id}`);
        if (cancelled) return;
        const merged = mergeCarts(remote.items || [], session);
        persistLocal(merged);
        const fingerprint = (rows) => (rows || [])
          .map((i) => `${i.kind}:${i.id || i.productId}:${i.qty}`)
          .sort()
          .join("|");
        if (session.length && fingerprint(merged) !== fingerprint(remote.items)) {
          await replaceRemote(merged);
        }
      } catch {
        if (!cancelled) persistLocal(session);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

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

  const inCart = (kind, id) => items.find((c) => c.kind === kind && c.id === id);

  const setQty = (kind, product, qty) => {
    const max = stockCap(kind, product);
    const n = Math.max(0, Math.min(max || 99, Number(qty) || 0));
    const rest = items.filter((c) => !(c.kind === kind && c.id === product.id));
    const next = n === 0 ? rest : [...rest, { ...lineProduct(kind, product), qty: n }];
    persistLocal(next);
    if (!canShop) return;
    const itemId = encodeURIComponent(`${kind}:${product.id}`);
    const req = n === 0
      ? api(`/cart/items/${itemId}?userId=${user.id}`, { method: "DELETE" })
      : inCart(kind, product.id)
        ? api(`/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ userId: user.id, qty: n }) })
        : api("/cart/items", { method: "POST", body: JSON.stringify({ userId: user.id, kind, productId: product.id, id: product.id, qty: n, replace: true }) });
    req.then(applyRemote).catch((err) => {
      push(err.message, "error");
      reload();
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
    const nextQty = current + qty;
    const rest = items.filter((c) => !(c.kind === kind && c.id === product.id));
    persistLocal([...rest, { ...lineProduct(kind, product), qty: nextQty }]);
    if (current === 0) {
      push(`${product.name} added to cart`);
      setOpen(true);
    }
    if (!canShop) return;
    api("/cart/items", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, kind, productId: product.id, id: product.id, qty: nextQty, replace: true }),
    }).then(applyRemote).catch((err) => {
      push(err.message, "error");
      reload();
    });
  };

  const addInvoice = (row) => {
    if (items.some((c) => c.kind === "invoice" && c.id === row.id)) {
      push("That bill is already in your cart.");
      return false;
    }
    persistLocal([...items, invoiceLine(row, user.id)]);
    push(`${row.item} added to cart`);
    setOpen(true);
    if (canShop) {
      api("/cart/items", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, kind: "invoice", productId: row.id, id: row.id, qty: 1 }),
      }).then(applyRemote).catch((err) => {
        push(err.message, "error");
        reload();
      });
    }
    return true;
  };

  const remove = (kind, id) => {
    persistLocal(items.filter((c) => !(c.kind === kind && c.id === id)));
    if (!canShop) return;
    api(`/cart/items/${encodeURIComponent(`${kind}:${id}`)}?userId=${user.id}`, { method: "DELETE" })
      .then(applyRemote)
      .catch(() => reload());
  };

  const clear = () => {
    persistLocal([]);
    if (!canShop) return;
    api(`/cart?userId=${user.id}`, { method: "DELETE" }).then(applyRemote).catch(() => reload());
  };

  const applyStock = (stock) => {
    setItems((current) => {
      const next = clampCartToStock(current, stock);
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      saveCart(user?.id, next);
      if (canShop) replaceRemote(next);
      return next;
    });
  };

  const value = useMemo(() => ({
    items,
    count: cartCount(items),
    subtotal: cartTotal(items),
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
    applyStock,
    open,
    setOpen,
    openDrawer: () => setOpen(true),
    closeDrawer: () => setOpen(false),
    toggleDrawer: () => setOpen((v) => !v),
  }), [items, open, user?.id, canShop]);

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
      aria-controls="shop-basket"
      aria-expanded={cart.open}
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
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [method, setMethod] = useState(prefs.method || "momo");
  const [form, setForm] = useState({
    network: prefs.momoNetwork || "mtn",
    phone: prefs.momoNumber || user?.phone || "",
    payerName: user?.name || "",
    nhisNumber: prefs.nhisNumber || user?.insurance || "",
  });
  const [payment, setPayment] = useState(null);
  const [checkoutKey, setCheckoutKey] = useState(() => newCheckoutKey());
  const [busy, setBusy] = useState(false);

  const closeDrawer = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest?.("#shop-basket")) active.blur();
    cart.closeDrawer();
  };

  useEffect(() => {
    if (!cart?.open) return;
    api("/finance/accounts").then(setAccounts).catch(() => {});
    api("/finance/payment-config").then(setPaymentConfig).catch(() => {});
  }, [cart?.open]);

  useEffect(() => {
    if (!cart?.open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart?.open]);

  const items = cart?.items || [];
  const meds = items.filter((c) => c.kind === "med");
  const labItems = items.filter((c) => c.kind === "lab");
  const svcItems = items.filter((c) => c.kind === "svc");
  const billItems = items.filter((c) => c.kind === "invoice");
  const medTotal = meds.reduce((s, i) => s + i.price * i.qty, 0);
  const labTotal = labItems.reduce((s, i) => s + i.price * i.qty, 0);
  const svcTotal = svcItems.reduce((s, i) => s + i.price * i.qty, 0);
  const billTotal = billItems.reduce((s, i) => s + Number(i.amount || i.price || 0), 0);
  const pid = user?.id;
  const payable = items.length;
  const flutterwaveReady = paymentConfig?.flutterwave?.configured !== false;

  const startPayment = async (invoiceIds, servicesToBill) => {
    const r = await api("/finance/checkout-cart", {
      method: "POST",
      body: JSON.stringify({
        patientId: pid,
        actorId: user.id,
        invoiceIds,
        services: servicesToBill,
        method,
        checkoutKey,
        ...form,
      }),
    });
    const nextPayment = { ...r.payment, bankTransfer: r.bankTransfer || r.payment?.bankTransfer || null };
    setPayment(nextPayment);
    cart.persist([]);
    setCheckoutKey(newCheckoutKey());
    window.dispatchEvent(new CustomEvent(BILLS_EVENT));
    if (r.checkoutUrl) {
      window.location.assign(r.checkoutUrl);
      return;
    }
    if (r.mode === "manual_review") {
      push(method === "cash" ? "Cash payment created. Accounts will issue the receipt after the cashier posts it." : "NHIS claim sent for accounts review.");
    } else if (r.mode === "bank_transfer") {
      push("Temporary bank-transfer details are ready.");
    } else {
      push("Payment started. Complete the authorization to receive your receipt.");
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
          closeDrawer();
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

  const refreshPayment = async ({ silent = false } = {}) => {
    if (!payment?.id) return null;
    if (!silent) setBusy(true);
    try {
      const r = await api(`/finance/payments/${payment.id}/status?refresh=1`);
      const next = r.payment || payment;
      setPayment(next);
      if (next.status === "paid") {
        if (!silent) push("Payment verified. Your receipt is ready.");
        closeDrawer();
        window.dispatchEvent(new CustomEvent(BILLS_EVENT));
        navigate(`/receipts/${next.id}`);
      } else if (!silent && next.status === "failed") {
        push("The payment was not completed. You can return to the cart and try again.", "error");
      } else if (!silent) {
        push("Payment is still awaiting confirmation.");
      }
      return next;
    } catch (err) {
      if (!silent) push(err.message, "error");
      return null;
    } finally {
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    if (!cart?.open || !payment?.id || payment.status !== "pending" || !["card", "momo", "bank"].includes(payment.method)) return undefined;
    const timer = window.setInterval(() => refreshPayment({ silent: true }), 7000);
    return () => window.clearInterval(timer);
  }, [cart?.open, payment?.id, payment?.status, payment?.method]);

  if (!cart || !user) return null;

  return (
    <>
      <div
        className={`cart-scrim ${cart.open ? "on" : ""}`}
        aria-hidden="true"
        onClick={closeDrawer}
      />
      <aside
        className={`cart-drawer ${cart.open ? "open" : ""}`}
        id="shop-basket"
        inert={!cart.open}
        role="dialog"
        aria-modal={cart.open}
        aria-label="Shopping cart"
        aria-live="polite"
      >
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
            <button type="button" className="icon-btn" onClick={closeDrawer} aria-label="Close cart">
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
              <button type="button" className="secondary-btn" onClick={() => { closeDrawer(); navigate("/pay"); }}>
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
              <p className="checkout-title"><ShieldCheck size={16} /> Secure checkout</p>
              {paymentConfig?.flutterwave && !paymentConfig.flutterwave.configured && (
                <div className="error-box">Online card, Mobile Money, and bank transfer are installed but disabled until the server has Flutterwave test keys.</div>
              )}
              {METHODS.map((m) => {
                const disabled = Boolean(m.online && !flutterwaveReady);
                return (
                  <label className={`check-row payment-method-card ${disabled ? "disabled" : ""}`} key={m.id}>
                    <input type="radio" name="method" disabled={disabled} checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <span><b>{m.label}</b><small className="muted"> — {m.hint}</small></span>
                  </label>
                );
              })}
              {method === "card" && (
                <div className="bank-box">
                  <p><b>Flutterwave hosted checkout</b></p>
                  <p className="muted">Card details are entered on Flutterwave's secure payment page. CareBridge never receives or stores your card number.</p>
                </div>
              )}
              {method === "momo" && (
                <>
                  <label>Network
                    <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}>
                      <option value="mtn">MTN MoMo</option>
                      <option value="telecel">Telecel Cash</option>
                      <option value="at">AirtelTigo Money</option>
                    </select>
                  </label>
                  <label>Payer MoMo number<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="tel" /></label>
                  <div className="bank-box">
                    <p><b>Secure Mobile Money request</b></p>
                    <p className="muted">Flutterwave will send the authorization request to this phone. CareBridge marks the bill paid only after Flutterwave verifies the transaction.</p>
                  </div>
                </>
              )}
              {method === "bank" && (
                <div className="bank-box">
                  <p><b>Temporary GHS transfer account</b></p>
                  <p className="muted">After you continue, Flutterwave creates a one-time bank account and exact transfer reference for this payment.</p>
                  <label>Payer name<input value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} required /></label>
                </div>
              )}
              {method === "nhis" && (
                <label>NHIS / policy number<input value={form.nhisNumber} onChange={(e) => setForm({ ...form, nhisNumber: e.target.value })} required /></label>
              )}
              {method === "cash" && (
                <p className="muted">{accounts?.cashier?.desk}. {accounts?.cashier?.hours}. Your receipt appears only after hospital accounts posts the cash payment.</p>
              )}
              <button className="primary-btn full" disabled={busy || !payable || (["card", "momo", "bank"].includes(method) && !flutterwaveReady)}>
                {busy ? "Starting checkout…" : method === "cash" ? `Create cash payment · ${ghs(cart.total)}` : method === "nhis" ? `Submit NHIS claim · ${ghs(cart.total)}` : `Pay securely · ${ghs(cart.total)}`}
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
              <h3>{payment.requiresManualReview ? "Awaiting hospital accounts" : "Waiting for verified payment"}</h3>
              {payment.method === "card" && (
                <p>If the hosted checkout window was closed, return to your unpaid bills to start a new card attempt. A receipt is created only after Flutterwave confirms success.</p>
              )}
              {payment.method === "momo" && (
                <p>Approve the <b>{ghs(payment.amount)}</b> Mobile Money request on <b>{payment.phone}</b>. This screen checks the server automatically.</p>
              )}
              {payment.method === "bank" && payment.bankTransfer && (
                <div className="bank-box">
                  <p><b>{payment.bankTransfer.bank}</b></p>
                  <p>Account <b>{payment.bankTransfer.account}</b><br />Amount <b>GHS {payment.bankTransfer.amount}</b><br />Reference <b>{payment.bankTransfer.transferReference || payment.reference}</b><br />Expires {payment.bankTransfer.expiration || "after the provider window"}</p>
                </div>
              )}
              {payment.method === "nhis" && (
                <p>Claim for policy <b>{payment.nhisNumber}</b> has been lodged. Hospital accounts must approve it before the invoice is marked paid.</p>
              )}
              {payment.method === "cash" && (
                <p>Pay <b>{ghs(payment.amount)}</b> at {accounts?.cashier?.desk || "the Ridge Campus accounts desk"}. Hospital staff will post the payment and your receipt will then appear.</p>
              )}
              {["card", "momo", "bank"].includes(payment.method) && (
                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button className="secondary-btn full" type="button" disabled={busy} onClick={() => refreshPayment()}>
                    {busy ? "Checking…" : "Check payment status"}
                  </button>
                </div>
              )}
            </div>
          )}

          {payment && payment.status === "failed" && (
            <div className="cart-pending">
              <p className="eyebrow">Reference {payment.reference}</p>
              <h3>Payment not completed</h3>
              <p>No receipt was issued and the hospital bills remain unpaid. Return to Shop & pay to try again.</p>
              <button className="secondary-btn full" type="button" onClick={() => { setPayment(null); closeDrawer(); navigate("/pay?tab=bills"); }}>Return to unpaid bills</button>
            </div>
          )}

          {payment && payment.status === "paid" && (
            <div className="cart-pending">
              <p className="eyebrow">Verified payment</p>
              <h3>Receipt ready</h3>
              <button className="primary-btn full" type="button" onClick={() => { closeDrawer(); navigate(`/receipts/${payment.id}`); }}>Open receipt</button>
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
