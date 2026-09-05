import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../state";
import { photoFor, sceneFor } from "../imagery";

const ECG = "M0 40 L24 40 L32 40 L38 18 L44 62 L52 40 L72 40 L80 40 L86 28 L92 40 L120 40 L128 40 L134 16 L140 64 L148 40 L200 40 L208 40 L214 22 L220 40 L280 40";

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

export default function PageAtmosphere({ scene: sceneProp }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const scene = sceneProp || sceneFor(pathname, user?.role);

  return (
    <div className={`page-atmosphere scene-${scene}`} aria-hidden="true">
      <div className="atm-photo kb-layer" style={{ backgroundImage: `url(${photoFor(scene)})` }} />
      <div className="atm-wash" />
      <div className="atm-orb o1" />
      <div className="atm-orb o2" />
      <div className="atm-orb o3" />
      <div className="atm-grid" />
      {(scene === "consult" || scene === "clinic" || scene === "home" || scene === "records") && <ConsultMarks />}
      {(scene === "billing" || scene === "tariff") && (
        <div className="atm-ledger">
          <span>GHS</span><span>MoMo</span><span>NHIS</span><span>GCB</span><span>RECEIPT</span>
        </div>
      )}
      {(scene === "pharmacy" || scene === "shop" || scene === "nurse") && (
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
