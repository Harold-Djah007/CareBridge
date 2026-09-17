import { audit } from "./clinical.js";

export const SOCIAL_KEYS = ["facebook", "instagram", "x", "linkedin", "youtube", "tiktok", "whatsapp"];

const LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export function defaultSocial() {
  return Object.fromEntries(SOCIAL_KEYS.map((key) => [key, ""]));
}

export function sanitizeHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  return parsed.href;
}

export function sanitizeSocialUrl(key, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (key === "whatsapp") {
    if (/^https?:\/\//i.test(raw) || /wa\.me|whatsapp\.com/i.test(raw)) {
      return sanitizeHttpUrl(raw.includes("://") ? raw : `https://${raw}`);
    }
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length >= 9 && digits.length <= 15) {
      const intl = digits.startsWith("0") ? `233${digits.slice(1)}` : digits;
      return `https://wa.me/${intl}`;
    }
    return null;
  }
  return sanitizeHttpUrl(raw);
}

export function publicSocial(social = {}) {
  const out = {};
  for (const key of SOCIAL_KEYS) {
    const url = sanitizeSocialUrl(key, social[key]);
    if (url) out[key] = url;
  }
  return out;
}

export function ensureSite(db) {
  const current = db.site && typeof db.site === "object" ? db.site : {};
  const social = { ...defaultSocial(), ...(current.social || {}) };
  SOCIAL_KEYS.forEach((key) => {
    if (typeof social[key] !== "string") social[key] = "";
  });
  const next = {
    social,
    updatedAt: current.updatedAt || null,
    updatedBy: current.updatedBy || null,
  };
  const changed = JSON.stringify(current) !== JSON.stringify(next);
  db.site = next;
  return changed;
}

export function mountSite(app, { readDb, writeDb }) {
  app.get("/api/admin/site", (_req, res) => {
    const db = readDb();
    res.json(db.site);
  });

  app.patch("/api/admin/site", (req, res) => {
    const db = readDb();
    const incoming = req.body?.social && typeof req.body.social === "object" ? req.body.social : null;
    if (!incoming) return res.status(400).json({ message: "Send the social media URLs to publish." });

    const social = defaultSocial();
    for (const key of SOCIAL_KEYS) {
      if (incoming[key] === undefined) {
        social[key] = db.site?.social?.[key] || "";
        continue;
      }
      const url = sanitizeSocialUrl(key, incoming[key]);
      if (url === null) {
        return res.status(400).json({
          message: `${LABELS[key]} needs a valid web address starting with https://. Leave the field blank to hide that network.`,
        });
      }
      social[key] = url;
    }

    db.site = {
      social,
      updatedAt: new Date().toISOString(),
      updatedBy: req.authUser?.id || "",
    };
    audit(db, {
      actorId: req.authUser?.id,
      action: "site.update",
      entity: "site",
      entityId: "social",
      detail: "Updated public social media links",
    });
    writeDb(db);
    res.json(db.site);
  });
}
