import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, BedDouble, Bell, Building2, CalendarDays, ChevronRight, ClipboardList, Command,
  FolderKanban, FolderOpen, HeartPulse, Inbox, LayoutDashboard, LifeBuoy, LogOut,
  Mail, MessageCircle, Pill, Receipt, Search, ScrollText, Settings2,
  ShoppingBag, Sparkles, Stethoscope, Users, Video, Wifi, X,
} from "lucide-react";
import { io } from "socket.io-client";
import { CartMastButton, useCart } from "../ShopCart";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { HOSPITAL } from "../utils";
import { LiveClock } from "./LiveMeter";
import Avatar from "./Avatar";
import NotificationReader, { normalizeNotification } from "./NotificationReader";
import { photoFor, sceneFor } from "../imagery";

const NAV = {
  patient: [
    { to: "/home", icon: LayoutDashboard, label: "Home", end: true, primary: true },
    { to: "/appointments", icon: CalendarDays, label: "Appointments", primary: true },
    { to: "/records", icon: FolderOpen, label: "Health record", primary: true },
    { to: "/messages", icon: MessageCircle, label: "Messages", badge: "messages", primary: true },
    { to: "/prescriptions", icon: ClipboardList, label: "Prescriptions" },
    { to: "/wards", icon: BedDouble, label: "Admissions", badge: "wards" },
    { to: "/pay", icon: ShoppingBag, label: "Shop & pay", primary: true },
    { to: "/care", icon: Stethoscope, label: "Care team" },
    { to: "/alerts", icon: Inbox, label: "Notifications", badge: "notifications" },
    { to: "/support", icon: LifeBuoy, label: "Support", badge: "tickets" },
  ],
  doctor: [
    { group: "Today", items: [
      { to: "/home", icon: Activity, label: "Clinical home", end: true, primary: true },
      { to: "/appointments", icon: CalendarDays, label: "Schedule", badge: "visits", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Inbox", badge: "messages", primary: true },
      { to: "/video", icon: Video, label: "Teleconsult" },
    ]},
    { group: "Clinical", items: [
      { to: "/care", icon: Users, label: "Caseload", primary: true },
      { to: "/records", icon: FolderOpen, label: "Patient charts", primary: true },
      { to: "/prescriptions", icon: Pill, label: "Prescriptions" },
      { to: "/wards", icon: BedDouble, label: "Admissions", badge: "wards" },
    ]},
    { group: "Hospital", items: [
      { to: "/billing/tariff", icon: ScrollText, label: "Tariff" },
      { to: "/support", icon: LifeBuoy, label: "Support", badge: "tickets" },
      { to: "/settings", icon: Settings2, label: "Preferences" },
    ]},
  ],
  nurse: [
    { group: "Dispensary", items: [
      { to: "/home", icon: ClipboardList, label: "Dispensing board", end: true, badge: "queue", primary: true },
      { to: "/pharmacy-stock", icon: Pill, label: "Inventory", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Clinical messages", badge: "messages", primary: true },
    ]},
    { group: "Account", items: [
      { to: "/support", icon: LifeBuoy, label: "Support" },
      { to: "/settings", icon: Settings2, label: "Workspace settings" },
    ]},
  ],
  admin: [
    { group: "Operations", items: [
      { to: "/admin", icon: LayoutDashboard, label: "Operations home", end: true, primary: true },
      { to: "/admin/hospital", icon: Building2, label: "Capacity & beds", badge: "wards", primary: true },
      { to: "/admin/appointments", icon: CalendarDays, label: "Clinic operations", primary: true },
      { to: "/admin/users", icon: Users, label: "People", primary: true },
    ]},
    { group: "Control", items: [
      { to: "/admin/cases", icon: FolderKanban, label: "Case workflow" },
      { to: "/admin/reports", icon: ScrollText, label: "Analytics & audit", primary: true },
      { to: "/pay", icon: Receipt, label: "Finance & receipts" },
      { to: "/billing/tariff", icon: ScrollText, label: "Tariff manager" },
    ]},
    { group: "Communications", items: [
      { to: "/support", icon: LifeBuoy, label: "Support desk", badge: "tickets", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Switchboard", badge: "messages" },
      { to: "/alerts", icon: Mail, label: "Patient notices", badge: "notifications" },
      { to: "/settings", icon: Settings2, label: "System preferences" },
    ]},
  ],
};

const PAGE_META = [
  ["/admin/reports", "Analytics & audit", "Operational intelligence and governance"],
  ["/admin/appointments", "Clinic operations", "Hospital diary and encounter flow"],
  ["/admin/hospital", "Capacity & beds", "Occupancy, admissions and bed allocation"],
  ["/admin/users", "People", "Patients, clinicians and access"],
  ["/admin/cases", "Case workflow", "Operational cases and follow-up"],
  ["/admin", "Operations home", "Live hospital overview"],
  ["/appointments", "Appointments", "Schedule and manage care"],
  ["/messages", "Messages", "Secure care communication"],
  ["/video", "Teleconsultation", "Private video consultation"],
  ["/wards", "Admissions", "Bed requests and admission status"],
  ["/records", "Health record", "Longitudinal clinical information"],
  ["/prescriptions", "Prescriptions", "Medication orders and fulfilment"],
  ["/pharmacy-stock", "Inventory", "Dispensary stock and availability"],
  ["/pay", "Shop & pay", "Bills, medicines and services"],
  ["/care", "Care team", "People involved in care"],
  ["/support", "Support", "Hospital support and assistance"],
  ["/settings", "Settings", "Identity, preferences, appearance and security"],
  ["/alerts", "Notifications", "Hospital notices and communications"],
  ["/billing/tariff", "Hospital tariff", "Published prices and service charges"],
  ["/home", "Home", "Your CareBridge workspace"],
];

const DEFAULT_APPEARANCE = { theme: "pearl", density: "comfortable", motion: "full", nav: "floating" };
const EMPTY_BADGES = { visits: 0, wards: 0, messages: 0, tickets: 0, queue: 0, notifications: 0 };

function readAppearance() {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem("carebridge-appearance") || "{}") };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function pageMeta(pathname, role) {
  const hit = PAGE_META.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  if (hit) return { title: hit[1], description: hit[2] };
  return {
    title: role === "admin" ? "Operations" : role === "doctor" ? "Clinical workspace" : role === "nurse" ? "Dispensary" : "CareBridge",
    description: "Connected hospital care",
  };
}

function flatNav(role) {
  const rows = NAV[role] || NAV.patient;
  return rows.flatMap((row) => row.items || [row]);
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [connected, setConnected] = useState(false);
  const [appearance, setAppearance] = useState(readAppearance);
  const [badges, setBadges] = useState(EMPTY_BADGES);

  const isPatient = user.role === "patient";
  const meta = pageMeta(location.pathname, user.role);
  const scene = sceneFor(location.pathname, user.role);
  const scenePhoto = photoFor(scene);
  const allNav = flatNav(user.role);
  const mobileNav = allNav.filter((item) => item.primary).slice(0, 5);

  const loadNotes = () => api(`/notifications/${user.id}`).then((rows) => { setNotes(rows); return rows; }).catch(() => []);
  const loadBadges = () => api(`/badges?userId=${user.id}&role=${user.role}`).then((next) => { setBadges({ ...EMPTY_BADGES, ...next }); return next; }).catch(() => EMPTY_BADGES);

  useEffect(() => {
    loadNotes();
    loadBadges();
    const socket = io(socketUrl, socketOptions());
    socket.emit("join-user", user.id);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    const refresh = () => { loadNotes(); loadBadges(); };
    socket.on("notification", (notification) => { if (notification?.title) push(notification.title); refresh(); });
    socket.on("email-alert", refresh);
    socket.on("chat-message", loadBadges);
    socket.on("badges-updated", (patch) => {
      if (patch && typeof patch === "object") setBadges((current) => ({ ...current, ...patch }));
      loadBadges();
    });
    socket.on("ward-capacity", loadBadges);
    socket.on("pharmacy-order", refresh);
    socket.on("pharmacy-stock", refresh);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  useEffect(() => {
    const sync = () => setAppearance(readAppearance());
    window.addEventListener("carebridge:appearance", sync);
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setNoticeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("carebridge:appearance", sync);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setNoticeOpen(false);
    setPaletteOpen(false);
    setPaletteQuery("");
    loadBadges();
  }, [location.pathname]);

  const unread = Number(badges.notifications || 0);
  const roleName = user.role === "doctor" ? "Clinician" : user.role === "nurse" ? "Pharmacy" : user.role === "admin" ? "Operations" : "Patient";
  const userMeta = useMemo(() => {
    if (user.role === "patient") return `MRN ${user.mrn || "Pending"}`;
    if (user.role === "doctor") return user.specialty || user.department || "Clinical staff";
    if (user.role === "nurse") return user.department || "Dispensary";
    return HOSPITAL.campus;
  }, [user]);

  const onSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    if (user.role === "admin") navigate(q ? `/admin/users?q=${encodeURIComponent(q)}` : "/admin/users");
    else if (user.role === "nurse") navigate("/home");
    else navigate(q ? `/care?q=${encodeURIComponent(q)}` : "/care");
  };

  const openLiveNotice = async (note) => {
    setNoticeOpen(false);
    setSelectedNotice(normalizeNotification({ ...note, source: "live" }, user));
    if (note.read) return;
    try {
      await api(`/notifications/${user.id}/${note.id}/read`, { method: "PATCH" });
      await Promise.all([loadNotes(), loadBadges()]);
    } catch {}
  };

  const badgeCount = (key) => Number(badges[key] || 0);
  const navLink = (item, compact = false) => {
    const Icon = item.icon;
    const badge = item.badge ? badgeCount(item.badge) : 0;
    const cartCount = user.role === "patient" && item.to === "/pay" ? Number(cart?.count || 0) : 0;
    const shown = badge || cartCount;
    return (
      <NavLink
        key={`${compact ? "compact-" : ""}${item.to}`}
        to={item.to}
        end={item.end}
        className={({ isActive }) => `cbv6-nav-link ${isActive ? "is-active" : ""}`}
      >
        <span className="cbv6-nav-icon"><Icon size={compact ? 19 : 18} /></span>
        <span>{item.label}</span>
        {shown > 0 && <b>{shown > 99 ? "99+" : shown}</b>}
      </NavLink>
    );
  };

  const paletteItems = allNav.filter((item) => item.label.toLowerCase().includes(paletteQuery.trim().toLowerCase()));

  return (
    <div
      className={`cbv6-app cbv6-role-${user.role} cbv6-theme-${appearance.theme} cbv6-density-${appearance.density} cbv6-motion-${appearance.motion} cbv6-nav-${appearance.nav}`}
      style={{ "--cbv6-scene": `url(${scenePhoto})` }}
    >
      <a className="skip-link" href="#cbv6-main">Skip to main content</a>
      <div className="cbv6-ambient" aria-hidden="true"><i /><i /><i /></div>

      <header className="cbv6-topbar">
        <Link className="cbv6-brand" to={user.role === "admin" ? "/admin" : "/home"}>
          <span className="cbv6-brand-mark"><HeartPulse size={22} /></span>
          <span><strong>CareBridge</strong><small>{isPatient ? "Care, beautifully connected" : "Health operating system"}</small></span>
        </Link>

        <div className="cbv6-page-identity">
          <small>{roleName} workspace</small>
          <strong>{meta.title}</strong>
          <span>{meta.description}</span>
        </div>

        <div className="cbv6-top-actions">
          <button className="cbv6-command-trigger" type="button" onClick={() => setPaletteOpen(true)}>
            <Command size={16} /><span>Jump anywhere</span><kbd>Ctrl K</kbd>
          </button>
          <span className={`cbv6-live ${connected ? "is-live" : ""}`} title={connected ? "Live services connected" : "Reconnecting"}>
            <Wifi size={14} /><span>{connected ? "Live" : "Syncing"}</span>
          </span>
          <LiveClock />
          {isPatient && <CartMastButton />}
          <button className="cbv6-icon-btn" type="button" onClick={() => setNoticeOpen((value) => !value)} aria-label="Notifications">
            <Bell size={18} />{unread > 0 && <em>{unread > 99 ? "99+" : unread}</em>}
          </button>
          <button className="cbv6-profile" type="button" onClick={() => navigate("/settings")}>
            <Avatar person={user} className="small" />
            <span><strong>{user.name}</strong><small>{userMeta}</small></span>
          </button>
        </div>
      </header>

      {isPatient && (
        <nav className="cbv6-patient-dock" aria-label="Patient navigation">
          <div className="cbv6-patient-dock-inner">{allNav.map((item) => navLink(item))}</div>
        </nav>
      )}

      <div className={`cbv6-shell ${isPatient ? "cbv6-shell-patient" : "cbv6-shell-staff"}`}>
        {!isPatient && (
          <aside className="cbv6-rail">
            <div className="cbv6-rail-scene">
              <span className="cbv6-rail-photo" />
              <div><strong>{HOSPITAL.campus}</strong><small>{HOSPITAL.city}</small></div>
              <span className={`cbv6-status-dot ${connected ? "on" : ""}`} />
            </div>

            <nav className="cbv6-rail-nav" aria-label={`${roleName} navigation`}>
              {(NAV[user.role] || []).map((group) => (
                <section key={group.group}>
                  <p>{group.group}</p>
                  {group.items.map((item) => navLink(item))}
                </section>
              ))}
            </nav>

            <div className="cbv6-rail-footer">
              <button type="button" className="cbv6-mini-profile" onClick={() => navigate("/settings")}>
                <Avatar person={user} className="small" />
                <span><strong>{user.name}</strong><small>{userMeta}</small></span>
              </button>
              <button className="cbv6-logout" type="button" title="Sign out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={17} /></button>
            </div>
          </aside>
        )}

        <main className="cbv6-main" id="cbv6-main" tabIndex="-1">
          <div className="cbv6-context-strip">
            <div><Sparkles size={14} /><span>{meta.description}</span></div>
            <form onSubmit={onSearch} className="cbv6-inline-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={user.role === "admin" ? "Search people" : user.role === "doctor" ? "Search patients" : user.role === "nurse" ? "Find medicine or queue" : "Find a doctor or service"} aria-label="Search CareBridge" />
            </form>
            <button type="button" onClick={() => navigate("/settings?tab=experience")}><Settings2 size={15} /> Personalize</button>
          </div>

          {noticeOpen && (
            <aside className="cbv6-notice-panel" role="dialog" aria-label="Notifications">
              <header><div><small>Live feed</small><strong>Notifications</strong></div><button type="button" onClick={() => setNoticeOpen(false)}><X size={16} /></button></header>
              <div>
                {notes.length === 0 && <p className="cbv6-empty-copy">You are all caught up.</p>}
                {notes.slice(0, 8).map((note) => (
                  <button key={note.id} type="button" className={`cbv6-notice-item ${note.read ? "" : "unread"}`} onClick={() => openLiveNotice(note)}>
                    <i /><div><strong>{note.title}</strong><p>{note.body}</p></div><ChevronRight size={16} />
                  </button>
                ))}
              </div>
              <footer><button type="button" onClick={() => { setNoticeOpen(false); navigate("/alerts"); }}>Open notification centre</button></footer>
            </aside>
          )}

          <div className="cbv6-content">
            <div key={location.pathname} className="cbv6-route-frame">
              <Outlet context={{ badges, refreshBadges: loadBadges, refreshNotifications: loadNotes }} />
            </div>
          </div>
        </main>
      </div>

      <nav className="cbv6-mobile-nav" aria-label="Primary navigation">{mobileNav.map((item) => navLink(item, true))}</nav>

      <NotificationReader notice={selectedNotice} onClose={() => setSelectedNotice(null)} />

      {paletteOpen && (
        <div className="cbv6-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <section className="cbv6-palette" role="dialog" aria-modal="true" aria-label="CareBridge command palette">
            <header><Command size={18} /><input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Type a page or workspace…" /><button type="button" onClick={() => setPaletteOpen(false)}><X size={17} /></button></header>
            <div className="cbv6-palette-list">
              {paletteItems.map((item) => {
                const Icon = item.icon;
                return <button key={item.to} type="button" onClick={() => navigate(item.to)}><span><Icon size={18} /></span><div><strong>{item.label}</strong><small>{pageMeta(item.to, user.role).description}</small></div></button>;
              })}
              <button type="button" onClick={() => navigate("/settings?tab=experience")}><span><Settings2 size={18} /></span><div><strong>Appearance & experience</strong><small>Theme, density, motion and navigation</small></div></button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
