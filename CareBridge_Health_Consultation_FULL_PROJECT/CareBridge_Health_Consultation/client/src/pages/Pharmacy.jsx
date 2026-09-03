import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToast } from "../state";

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;

export default function Pharmacy() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState("pharmacy");
  const [catalog, setCatalog] = useState([]);
  const [labs, setLabs] = useState([]);
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState({});

  useEffect(() => {
    api("/finance/pharmacy").then(setCatalog);
    api("/finance/labs").then(setLabs);
    api("/finance/rates").then((r) => setServices(r.services || []));
  }, []);

  const source = tab === "labs" ? labs : catalog;
  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const items = source.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id], lineTotal: cart[p.id] * p.price }));
  const total = items.reduce((s, i) => s + i.lineTotal, 0);

  const order = async () => {
    if (tab === "services") return;
    if (!items.length) return;
    const path = tab === "labs" ? "/finance/labs/order" : "/finance/pharmacy/order";
    const inv = await api(path, {
      method: "POST",
      body: JSON.stringify({ patientId: user.id, actorId: user.id, items: items.map((i) => ({ id: i.id, qty: i.qty })) }),
    });
    push(tab === "labs" ? "Lab request billed. Pay to have samples processed." : "Pharmacy order billed. Pay to collect at Ridge pharmacy.");
    navigate(`/pay?invoice=${inv.id}`);
  };

  const billService = async (serviceId) => {
    const inv = await api("/finance/services/order", {
      method: "POST",
      body: JSON.stringify({ patientId: user.id, actorId: user.id, serviceId }),
    });
    push("Service added to your account.");
    navigate(`/pay?invoice=${inv.id}`);
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Ridge Campus</span>
          <h1>Pharmacy, laboratory & services</h1>
          <p>Every item has a published fee. NHIS items can be claimed; others settle by MoMo, GCB, or cash. Collection requires a receipt.</p>
        </div>
      </div>
      <div className="filters">
        <button className={tab === "pharmacy" ? "active" : ""} onClick={() => { setTab("pharmacy"); setCart({}); }}>Medicines</button>
        <button className={tab === "labs" ? "active" : ""} onClick={() => { setTab("labs"); setCart({}); }}>Laboratory</button>
        <button className={tab === "services" ? "active" : ""} onClick={() => { setTab("services"); setCart({}); }}>Other services</button>
      </div>

      {tab !== "services" ? (
        <div className="dashboard-grid">
          <section className="card">
            {source.map((p) => (
              <div className="appointment-row" key={p.id}>
                <div className="grow">
                  <strong>{p.name}</strong>
                  <span className="muted">{p.pack || p.specimen}{p.sku ? ` · ${p.sku}` : ""} · {p.nhis ? "NHIS" : "Not on NHIS"}</span>
                </div>
                <b>{ghs(p.price)}</b>
                <button className="secondary-btn" type="button" onClick={() => add(p.id)}>Add</button>
              </div>
            ))}
          </section>
          <section className="card">
            <h3>Order</h3>
            {items.length === 0 && <p className="muted">Select items to bill.</p>}
            {items.map((i) => (
              <div className="appointment-row" key={i.id}>
                <div className="grow"><strong>{i.name}</strong><span className="muted">× {i.qty}</span></div>
                <span>{ghs(i.lineTotal)}</span>
              </div>
            ))}
            <p><b>Total {ghs(total)}</b></p>
            <button className="primary-btn" disabled={!items.length} type="button" onClick={order}>Bill and pay</button>
          </section>
        </div>
      ) : (
        <section className="card">
          {services.map((s) => (
            <div className="appointment-row" key={s.id}>
              <div className="grow">
                <strong>{s.name}</strong>
                <span className="muted">{s.nhis ? "NHIS eligible" : "Private pay"}</span>
              </div>
              <b>{ghs(s.price)}</b>
              <button className="primary-btn" type="button" onClick={() => billService(s.id)}>Bill this</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
