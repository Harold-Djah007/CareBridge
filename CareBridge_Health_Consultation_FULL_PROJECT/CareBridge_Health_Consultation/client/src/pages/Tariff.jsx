import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { HOSPITAL } from "../utils";
import { useAuth } from "../state";

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;

export default function Tariff() {
  const { user } = useAuth();
  const [rates, setRates] = useState(null);

  useEffect(() => {
    api("/finance/rates").then(setRates);
  }, []);

  if (!rates) return <p className="muted">Loading hospital tariff…</p>;

  return (
    <div className={user ? "" : "landing"}>
      {!user && (
        <nav className="public-nav">
          <Link to="/" className="brand"><b>{HOSPITAL.short}</b></Link>
          <div className="links">
            <Link to="/login">Sign in</Link>
            <Link className="primary-btn" to="/register">Register</Link>
          </div>
        </nav>
      )}
      <div className="page-title">
        <div>
          <span className="eyebrow">{HOSPITAL.campus} accounts</span>
          <h1>Hospital tariff</h1>
          <p>Published fees in Ghana cedis. Pay by MTN / Telecel / AirtelTigo MoMo, GCB bank transfer, NHIS, or cash at the Ridge cashier. A numbered receipt is issued for every settled bill.</p>
        </div>
        {user?.role === "patient" && <Link className="primary-btn" to="/pay">Pay a bill</Link>}
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Settlement accounts</h3>
        <div className="tariff-accounts">
          <div>
            <span className="eyebrow">Mobile money</span>
            <p><b>{rates.accounts.momo.name}</b><br />Merchant {rates.accounts.momo.merchantId}<br />MTN {rates.accounts.momo.mtn}<br />Telecel {rates.accounts.momo.telecel}<br />AirtelTigo {rates.accounts.momo.at}</p>
          </div>
          <div>
            <span className="eyebrow">Bank</span>
            <p><b>{rates.accounts.bank.bank}</b><br />{rates.accounts.bank.accountName}<br />A/C {rates.accounts.bank.accountNumber}<br />{rates.accounts.bank.branch}<br />SWIFT {rates.accounts.bank.swift}</p>
          </div>
          <div>
            <span className="eyebrow">Cashier</span>
            <p>{rates.accounts.cashier.desk}<br />{rates.accounts.cashier.hours}<br />NHIS claims use the policy number on the patient file.</p>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Consultations</h3>
          <p className="muted">{rates.consultNote}</p>
          <table className="table">
            <thead><tr><th>Specialty</th><th>Video</th><th>Campus</th></tr></thead>
            <tbody>
              {Object.entries(rates.consults).map(([name, fee]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{ghs(fee)}</td>
                  <td>{ghs(fee + rates.campusSurcharge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h3>Inpatient (per night)</h3>
          <p className="muted">{rates.wardNote}</p>
          <table className="table">
            <thead><tr><th>Ward</th><th>Nightly</th></tr></thead>
            <tbody>
              {Object.entries(rates.wards).map(([name, fee]) => (
                <tr key={name}><td>{name}</td><td>{ghs(fee)}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="table">
            <thead><tr><th>Room supplement</th><th>Per night</th></tr></thead>
            <tbody>
              {Object.entries(rates.rooms).map(([name, fee]) => (
                <tr key={name}><td>{name}</td><td>{fee ? ghs(fee) : "Included"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="card">
          <h3>Laboratory</h3>
          <table className="table">
            <thead><tr><th>Test</th><th>NHIS</th><th>Fee</th></tr></thead>
            <tbody>
              {rates.labs.map((row) => (
                <tr key={row.id}><td>{row.name}</td><td>{row.nhis ? "Yes" : "No"}</td><td>{ghs(row.price)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h3>Pharmacy & other services</h3>
          <table className="table">
            <thead><tr><th>Item</th><th>NHIS</th><th>Fee</th></tr></thead>
            <tbody>
              {rates.pharmacy.map((row) => (
                <tr key={row.id}><td>{row.name} ({row.pack})</td><td>{row.nhis ? "Yes" : "No"}</td><td>{ghs(row.price)}</td></tr>
              ))}
              {rates.services.map((row) => (
                <tr key={row.id}><td>{row.name}</td><td>{row.nhis ? "Yes" : "No"}</td><td>{ghs(row.price)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
