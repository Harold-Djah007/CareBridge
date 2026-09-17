import React from "react";
import { HOSPITAL } from "../utils";
import { SOCIAL_NETWORKS, publishedSocial } from "../social";
import { useSite } from "../hooks/useSite";

function Icon({ path, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  facebook: "M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9c0-.6.4-1 1-1z",
  instagram: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm8 2H8a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm-4 2.8A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 0 1 12 7.8zm0 2A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.4a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1z",
  x: "M18.24 2H21.5l-7.5 8.57L22.5 22h-6.59l-5.16-6.74L5.2 22H1.93l8.02-9.16L1.5 2h6.76l4.66 6.17L18.24 2zm-1.16 18.06h1.8L6.99 3.84H5.05l12.03 16.22z",
  linkedin: "M6.5 9H3.7v11.2h2.8zm.2-4.1A1.7 1.7 0 1 0 5 6.6a1.7 1.7 0 0 0 1.7-1.7zM20.3 13.3c0-3.4-1.8-5-4.2-5a3.6 3.6 0 0 0-3.2 1.6h-.1V8.4H10v11.8h2.8v-6.2c0-1.6.3-3.2 2.3-3.2s2 1.8 2 3.3v6.1h2.8z",
  youtube: "M23 12.2s0-3.2-.4-4.6a3 3 0 0 0-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.5a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.6a3 3 0 0 0 2.1 2.1C5.1 19.4 12 19.4 12 19.4s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.4.4-4.6.4-4.6zM9.8 15.6V8.8l6.4 3.4z",
  tiktok: "M19.6 6.7A4.8 4.8 0 0 1 15.8 2.4V2h-3.5v13.7a2.9 2.9 0 1 1-2.9-2.9c.3 0 .5 0 .8.1V9.4a6.3 6.3 0 1 0 5.6 6.3V9a8.2 8.2 0 0 0 4.8 1.5V7.5a4.8 4.8 0 0 1-1.3-.8z",
  whatsapp: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.4.2-.3a.4.4 0 0 0 0-.4c0-.1-.5-1.3-.7-1.8s-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.8 3.6 4.4 4.4 0 0 0 2.6.8 2.4 2.4 0 0 0 1.6-.7 2 2 0 0 0 .4-1.4c0-.2-.2-.3-.4-.4z",
};

export function SocialIcon({ id, size = 18 }) {
  return <Icon path={ICONS[id] || ICONS.x} size={size} />;
}

export default function SocialLinks({ social, tone = "navy", size = 18, className = "" }) {
  const links = publishedSocial(social);
  if (!links.length) return null;
  return (
    <nav className={`social-links tone-${tone} ${className}`.trim()} aria-label={`${HOSPITAL.short} on social media`}>
      {links.map((network) => (
        <a
          key={network.id}
          className={`social-link net-${network.id}`}
          href={network.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${network.label} — more information from ${HOSPITAL.short}`}
          title={network.label}
        >
          <SocialIcon id={network.id} size={size} />
        </a>
      ))}
    </nav>
  );
}

export function FollowBlock({ social, tone = "light" }) {
  const links = publishedSocial(social);
  if (!links.length) return null;
  return (
    <section className={`follow-block tone-${tone}`} aria-label="Follow CareBridge for more information">
      <div className="follow-copy">
        <span className="eyebrow">Stay informed</span>
        <h2>More information on our channels</h2>
        <p className="muted">Campus notices, visiting notes, and health information. These are the official {HOSPITAL.short} pages — click any icon to open it.</p>
      </div>
      <SocialLinks social={social} tone={tone === "navy" ? "navy" : "light"} size={20} />
    </section>
  );
}

export function PublicSocial({ tone = "navy", className = "" }) {
  const { social } = useSite();
  return <SocialLinks social={social} tone={tone} className={className} />;
}

export function PublicFollow({ tone = "light" }) {
  const { social } = useSite();
  return <FollowBlock social={social} tone={tone} />;
}

export function FooterSocial() {
  const { social } = useSite();
  if (!publishedSocial(social).length) return null;
  return (
    <>
      <p className="foot-follow-label">Follow us for more information</p>
      <SocialLinks social={social} tone="navy" />
    </>
  );
}
