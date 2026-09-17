import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, Save, Share2 } from "lucide-react";
import { api } from "../../api";
import { useToast } from "../../state";
import { HOSPITAL, prettyDate } from "../../utils";
import { SOCIAL_NETWORKS, publishedSocial, previewHref } from "../../social";
import { invalidateSiteCache } from "../../hooks/useSite";
import SocialLinks, { SocialIcon } from "../../components/SocialLinks";
import PageHero from "../../components/PageHero";

const blank = () => Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, ""]));

export default function AdminWebsite() {
  const { push } = useToast();
  const [social, setSocial] = useState(blank);
  const [meta, setMeta] = useState({ updatedAt: null });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    api("/admin/site")
      .then((site) => {
        setSocial({ ...blank(), ...(site.social || {}) });
        setMeta({ updatedAt: site.updatedAt || null });
        setLoaded(true);
      })
      .catch((err) => {
        push(err.message, "error");
        setLoaded(true);
      });
  };

  useEffect(() => { load(); }, []);

  const live = useMemo(() => publishedSocial(social), [social]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await api("/admin/site", { method: "PATCH", body: JSON.stringify({ social }) });
      setSocial({ ...blank(), ...(next.social || {}) });
      setMeta({ updatedAt: next.updatedAt || null });
      invalidateSiteCache();
      push(live.length
        ? "Social links saved. Visitors can click them on the public website."
        : "Saved. Add at least one URL to show icons on the public website.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <p className="muted">Loading website channels…</p>;

  return (
    <div className="website-desk">
      <PageHero
        scene="directory"
        eyebrow={`${HOSPITAL.campus} · public website`}
        title="Website & social"
        lead="Paste the official URLs for Facebook, Instagram, X, LinkedIn, YouTube, TikTok and WhatsApp. Visitors click those icons for more information. Leave a field blank to hide that network until you have the correct address."
      />

      <form className="website-layout" onSubmit={save}>
        <section className="card website-editor">
          <div className="card-head">
            <div>
              <span className="eyebrow">Official channels</span>
              <h3><Share2 size={16} /> Social media URLs</h3>
            </div>
            <span className="website-count">{live.length} live</span>
          </div>
          <p className="muted">Only hospital operations can edit these. Patients and the public cannot change where the icons go.</p>
          <div className="website-network-list">
            {SOCIAL_NETWORKS.map((network) => {
              const value = social[network.id] || "";
              const liveNow = Boolean(String(value).trim());
              return (
                <article className={`website-network ${liveNow ? "live" : ""}`} key={network.id}>
                  <div className="website-network-head">
                    <span className={`social-link tone-light net-${network.id} preview-icon`} aria-hidden="true">
                      <SocialIcon id={network.id} size={18} />
                    </span>
                    <div>
                      <b>{network.label}</b>
                      <small>{network.hint}</small>
                    </div>
                    <em className={`website-status ${liveNow ? "on" : ""}`}>{liveNow ? "Live" : "Hidden"}</em>
                  </div>
                  <label>
                    {network.label} URL
                    <span className="website-url-row">
                      <input
                        type="text"
                        inputMode="url"
                        autoComplete="url"
                        placeholder={network.placeholder}
                        value={value}
                        onChange={(e) => setSocial((current) => ({ ...current, [network.id]: e.target.value }))}
                      />
                      {liveNow && (
                        <a className="secondary-btn" href={previewHref(network.id, value)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={15} /> Open
                        </a>
                      )}
                    </span>
                  </label>
                </article>
              );
            })}
          </div>
          <div className="modal-actions website-actions">
            <button className="primary-btn" disabled={busy}>
              <Save size={16} /> {busy ? "Saving…" : "Save public links"}
            </button>
            {meta.updatedAt && <span className="muted">Last published {prettyDate(meta.updatedAt)}</span>}
          </div>
        </section>

        <aside className="website-preview-col">
          <section className="card website-preview">
            <div className="card-head">
              <div>
                <span className="eyebrow">Visitor preview</span>
                <h3><Globe2 size={16} /> How it appears</h3>
              </div>
            </div>
            <p className="muted">These icons show on the public footer, the home page, and Contact. They open in a new tab.</p>
            <div className="website-preview-navy">
              <small>On the navy footer</small>
              {live.length ? <SocialLinks social={social} tone="navy" /> : <p className="muted">No live channels yet.</p>}
            </div>
            <div className="website-preview-light">
              <small>On light pages</small>
              {live.length ? <SocialLinks social={social} tone="light" /> : <p className="muted">Paste a URL on the left, then save.</p>}
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Where visitors click</span>
                <h3>Public surfaces</h3>
              </div>
            </div>
            <ul className="website-surfaces">
              <li>Home page — follow band above the footer</li>
              <li>Every public page footer</li>
              <li>Contact Us — “more information” card</li>
              <li>About Us — campus section</li>
              <li>Sign-in and registration pages</li>
            </ul>
          </section>
        </aside>
      </form>
    </div>
  );
}
