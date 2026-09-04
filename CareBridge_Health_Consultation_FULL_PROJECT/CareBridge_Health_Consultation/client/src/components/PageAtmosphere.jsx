import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../state";

const ECG = "M0 40 L24 40 L32 40 L38 18 L44 62 L52 40 L72 40 L80 40 L86 28 L92 40 L120 40 L128 40 L134 16 L140 64 L148 40 L200 40 L208 40 L214 22 L220 40 L280 40";

function sceneFor(pathname, role) {
  if (pathname.startsWith("/pay") || pathname.startsWith("/receipts") || pathname.includes("tariff")) return "billing";
  if (pathname.startsWith("/pharmacy")) return "pharmacy";
  if (pathname.startsWith("/video")) return "consult";
  if (pathname.startsWith("/appointments") || pathname.startsWith("/admin/appointments")) return "schedule";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/wards") || pathname.startsWith("/admin/hospital")) return "wards";
  if (pathname.startsWith("/records")) return "records";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/support") || pathname.startsWith("/admin/support") || pathname.startsWith("/guide")) return "support";
  if (pathname.startsWith("/care")) return "care";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/admin/users")) return "directory";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/cases")) return "cases";
  if (pathname.startsWith("/admin")) return "ops";
  if (pathname === "/home" && role === "doctor") return "clinic";
  return role === "admin" ? "ops" : "home";
}

function ConsultMarks() {
  return (
    <>
      <div className="atm-ring r1" />
      <div className="atm-ring r2" />
      <div className="atm-ring r3" />
      <svg className="atm-ecg" viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true">
        <path d={ECG} fill="none" />
      </svg>
    </>
  );
}

export default function PageAtmosphere() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const scene = sceneFor(pathname, user?.role);

  return (
    <div className={`page-atmosphere scene-${scene}`} aria-hidden="true">
      <div className="atm-orb o1" />
      <div className="atm-orb o2" />
      <div className="atm-orb o3" />
      <div className="atm-grid" />
      {(scene === "consult" || scene === "clinic" || scene === "home" || scene === "records") && <ConsultMarks />}
      {scene === "billing" && (
        <div className="atm-ledger">
          <span>GHS</span><span>MoMo</span><span>NHIS</span><span>GCB</span><span>RECEIPT</span>
        </div>
      )}
      {scene === "pharmacy" && (
        <div className="atm-crosses">
          <i /><i /><i /><i />
        </div>
      )}
      {scene === "schedule" && <div className="atm-slots"><i /><i /><i /><i /><i /><i /></div>}
      {scene === "messages" && <div className="atm-bubbles"><i /><i /><i /><i /></div>}
      {scene === "wards" && <div className="atm-beds"><i /><i /><i /><i /><i /></div>}
      {scene === "support" && <div className="atm-ping" />}
      {scene === "settings" && <div className="atm-gear" />}
      {scene === "care" && <div className="atm-nodes"><i /><i /><i /></div>}
      {scene === "ops" && <div className="atm-sweep" />}
      {scene === "alerts" && <div className="atm-mail"><i /><i /><i /></div>}
      {scene === "directory" && <div className="atm-cards"><i /><i /><i /></div>}
      {scene === "reports" && <div className="atm-bars"><i /><i /><i /><i /></div>}
      {scene === "cases" && <div className="atm-cards"><i /><i /><i /></div>}
      {scene === "profile" && <div className="atm-id-ring" />}
    </div>
  );
}
