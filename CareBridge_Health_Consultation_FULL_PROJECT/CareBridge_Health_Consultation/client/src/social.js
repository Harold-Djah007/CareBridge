export const SOCIAL_NETWORKS = [
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "https://www.facebook.com/your-hospital",
    hint: "Official Facebook page for campus notices",
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "https://www.instagram.com/your-hospital",
    hint: "Photos, visiting notes, and clinic days",
  },
  {
    id: "x",
    label: "X (Twitter)",
    placeholder: "https://x.com/your-hospital",
    hint: "Short updates and public alerts",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "https://www.linkedin.com/company/your-hospital",
    hint: "Careers and hospital news",
  },
  {
    id: "youtube",
    label: "YouTube",
    placeholder: "https://www.youtube.com/@your-hospital",
    hint: "Health information videos",
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "https://www.tiktok.com/@your-hospital",
    hint: "Short health information clips",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    placeholder: "https://wa.me/233306104400",
    hint: "A chat line, or a Ghana number such as 0306104400",
  },
];

export const publishedSocial = (social = {}) =>
  SOCIAL_NETWORKS
    .map((network) => ({ ...network, href: String(social[network.id] || "").trim() }))
    .filter((network) => network.href);

export function previewHref(id, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (id === "whatsapp" && !/^https?:/i.test(raw) && !/wa\.me|whatsapp/i.test(raw)) {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length >= 9) {
      const intl = digits.startsWith("0") ? `233${digits.slice(1)}` : digits;
      return `https://wa.me/${intl}`;
    }
  }
  return /^https?:/i.test(raw) ? raw : `https://${raw}`;
}
