import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, BedDouble, Bell, Building2, CalendarDays, ChevronLeft, ClipboardList,
  FolderKanban, FolderOpen, HeartPulse, Inbox, LayoutDashboard, LifeBuoy, LogOut,
  Mail, Menu, MessageCircle, Pill, Receipt, Search, ScrollText, ShieldCheck,
  ShoppingBag, Stethoscope, UserRound, Users, Video, Wifi,
} from "lucide-react";
import { io } from "socket.io-client";
import { CartMastButton, useCart } from "../ShopCart";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { BUILD, HOSPITAL } from "../utils";
import { LiveClock } from "./LiveMeter";
import PageAtmosphere from "./PageAtmosphere";
import { sceneFor } from "../imagery";
import Avatar from "./Avatar";

const NAV = {
  patient: [
    { group: "Care", items: [
      { to: "/home", icon: LayoutDashboard, label: "Care overview", end: true, primary: true },
      { to: "/appointments", icon: CalendarDays, label: "Appointments", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Messages", badge: "messages", primary: true },
      { to: "/wards", icon: BedDouble, label: "Admissions", badge: "wards" },
      { to: "/records", icon: FolderOpen, label: "Clinical record", primary: true },
      { to: "/prescriptions", icon: ClipboardList, label: "Prescriptions" },
    ]},
    { group: "Services", items: [
      { to: "/pay", icon: ShoppingBag, label: "Shop & pay", primary: true },
      { to: "/care", icon: Stethoscope, label: "Care team" },
      { to: "/alerts", icon: Inbox, label: "Notifications" },
    ]},
    { group: "Account", items: [
      { to: "/support", icon: LifeBuoy, label: "Support", badge: "tickets" },
      { to: "/settings", icon: UserRound, label: "Profile & settings" },
    ]},
  ],
  doctor: [
    { group: "Clinical workspace", items: [
      { to: "/home", icon: Activity, label: "Clinical cockpit", end: true, primary: true },
      { to: "/appointments", icon: CalendarDays, label: "Schedule", badge: "visits", primary: true },
      { to: "/care", icon: Users, label: "Caseload", primary: true },
      { to: "/records", icon: FolderOpen, label: "Patient charts", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Clinical inbox", badge: "messages", primary: true },
      { to: "/video", icon: Video, label: "Teleconsult" },
      { to: "/prescriptions", icon: Pill, label: "Prescriptions" },
      { to: "/wards", icon: BedDouble, label: "Admissions", badge: "wards" },
    ]},
    { group: "Hospital", items: [
      { to: "/billing/tariff", icon: ScrollText, label: "Tariff" },
      { to: "/support", icon: LifeBuoy, label: "Support", badge: "tickets" },
      { to: "/settings", icon: UserRound, label: "Account" },
    ]},
  ],
  nurse: [
    { group: "Dispensary", items: [
      { to: "/home", icon: ClipboardList, label: "Dispensary board", end: true, badge: "queue", primary: true },
      { to: "/pharmacy-stock", icon: Pill, label: "Stock control", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Clinical messages", badge: "messages", primary: true },
    ]},
    { group: "Account", items: [
      { to: "/support", icon: LifeBuoy, label: "Support" },
      { to: "/settings", icon: UserRound, label: "Profile & shift" },
    ]},
  ],
  admin: [
    { group: "Hospital command", items: [
      { to: "/admin", icon: LayoutDashboard, label: "Command centre", end: true, primary: true },
      { to: "/admin/hospital", icon: Building2, label: "Capacity & beds", badge: "wards", primary: true },
      { to: "/admin/appointments", icon: CalendarDays, label: "Clinic operations", primary: true },
      { to: "/admin/users", icon: Users, label: "People directory", primary: true },
      { to: "/admin/cases", icon: FolderKanban, label: "Case workflow" },
      { to: "/admin/reports", icon: ScrollText, label: "Analytics & audit", primary: true },
      { to: "/pay", icon: Receipt, label: "Finance & receipts" },
      { to: "/billing/tariff", icon: ScrollText, label: "Tariff manager" },
    ]},
    { group: "Communications", items: [
      { to: "/support", icon: LifeBuoy, label: "Support desk", badge: "tickets", primary: true },
      { to: "/messages", icon: MessageCircle, label: "Switchboard", badge: "messages" },
      { to: "/alerts", icon: Mail, label: "Patient notices" },
      { to: "/settings", icon: UserRound, label: "Account" },
    ]},
  ],
};

const PAGE_META = [
  ["/admin/reports", "Analytics & audit", "Financial, operational and audit intelligence"],
  ["/admin/appointments", "Clinic operations", "Manage the hospital diary and encounter flow"],
  ["/admin/hospital", "Capacity & beds", "Live occupancy, admission decisions and bed allocation"],
  ["/admin/users", "People directory", "Patients, clinicians, access and hospital identities"],
  ["/admin/cases", "Case workflow", "Operational files, cases and follow-up state"],
  ["/admin", "Hospital command centre", "Live operational picture across Ridge Campus"],
  ["/appointments", "Appointments", "Schedule, prepare for and manage encounters"],
  ["/messages", "Messages", "Secure care-team communication"],
  ["/video", "Teleconsultation", "Private real-time consultation workspace"],
  ["/wards", "Admissions", "Bed availability, requests and admission status"],
  ["/records", "Clinical record", "Longitudinal patient information and clinical actions"],
  ["/prescriptions", "Prescriptions", "Medication orders, dispensing and patient access"],
  ["/pharmacy-stock", "Stock control", "Dispensary inventory and availability"],
  ["/pharmacy", "Pharmacy", "Medicines and fulfilment"],
  ["/pay", "Shop & pay", "Bills, services, medicines and verified payments"],
  ["/care", "Care team", "People and relationships around care"],
  ["/support", "Support", "Operational and patient support"],
  ["/settings", "Profile & settings", "Identity, preferences and account controls"],
  ["/alerts", "Notifications", "Hospital notices and patient communications"],
  ["/billing/tariff", "Hospital tariff", "Published prices and service charges"],
  ["/home", "Overview", "Your live CareBridge workspace"],
];

function contextFor(pathname, role) {
  const found = PAGE_META.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  if (found) return { title: found[1], description: found[2] };
  const fallback = role === "admin" ? "Hospital workspace" : role === "doctor" ? "Clinical workspace" : role === "nurse" ? "Dispensary workspace" : "Care workspace";
  return { title: fallback, description: "CareBridge connected care" };
}

function NavRail({ children }) {
  const railRef = useRef(null);
  const [glow, setGlow] = useState({ y: 0, h: 44, visible: false });
  const [spot, setSpot] = useState({ y: 40, visible: false });

  const onMove = (event) => {
    const nav = railRef.current;
    if (!nav) return;
    const nr = nav.getBoundingClientRect();
    setSpot({ y: event.clientY - nr.top + nav.scrollTop, visible: true });
    const item = event.target.closest(".nav-item");
    if (!item || !nav.contains(item)) return;
    const ir = item.getBoundingClientRect();
    setGlow({ y: ir.top - nr.top + nav.scrollTop, h: ir.height, visible: true });
  };

  return (
    <nav ref={railRef} className="nav-rail product-nav-rail" onMouseMove={onMove} onMouseLeave={() => { setGlow((g) => ({ ...g, visible: false })); setSpot((s) => ({ ...s, visible: false })); }}>
      <span className={`nav-follow ${glow.visible ? "on" : ""}`} style={{ transform: `translate3d(0, ${glow.y}px, 0)`, height: glow.h }} />
      <span className={`nav-spot ${spot.visible ? "on" : ""}`} style={{ transform: `translate3d(0, ${spot.y - 48}px, 0)` }} />
      {children}
    </nav>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("carebridge-nav-collapsed") === "1");
  const [connected, setConnected] = useState(false);
  const [badges, setBadges] = useState({ visits: 0, wards: 0, messages: 0, tickets: 0, queue: 0, notifications: 0 });

  const groups = NAV[user.role] || NAV.patient;
  const mobileItems = groups.flatMap((g) => g.items).filter((i) => i.primary).slice(0, 5);
  const scene = sceneFor(location.pathname, user.role);
  const context = contextFor(location.pathname, user.role);

  const loadNotes = () => api(`/notifications/${user.id}`).then(setNotes).catch(() => {});
  const loadBadges = () => api(`/badges?userId=${user.id}&role=${user.role}`).then(setBadges).catch(() => {});

  useEffect(() => {
    loadNotes();
    loadBadges();
    const socket = io(socketUrl, socketOptions());
    socket.emit("join-user", user.id);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    const refresh = () => { loadNotes(); loadBadges(); };
    socket.on("notification", (n) => { push(n.title); refresh(); });
    socket.on("email-alert", (n) => { push(`Notice sent: ${n.subject}`); refresh(); });
    socket.on("chat-message", refresh);
    socket.on("pharmacy-order", refresh);
    socket.on("pharmacy-stock", refresh);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  useEffect(() => { setNoticeOpen(false); loadBadges(); }, [location.pathname]);
  useEffect(() => { localStorage.setItem("carebridge-nav-collapsed", collapsed ? "1" : "0"); }, [collapsed]);

  const unread = Number(badges.notifications || notes.filter((n) => !n.read).length);
  const markRead = async () => {
    await api(`/notifications/${user.id}/read`, { method: "PATCH" });
    loadNotes();
    loadBadges();
  };

  const topMeta = useMemo(() => {
    if (user.role === "doctor") return `${user.department || "Outpatient"} · ${user.clinic || HOSPITAL.campus}`;
    if (user.role === "admin") return `${HOSPITAL.campus} operations`;
    if (user.role === "nurse") return `Dispensary · ${HOSPITAL.campus}`;
    return `MRN ${user.mrn || "Pending"} · ${HOSPITAL.campus}`;
  }, [user]);

  const roleLabel = user.role === "patient" ? "Patient" : user.role === "doctor" ? "Clinician" : user.role === "nurse" ? "Pharmacy" : "Operations";
  const searchPlaceholder = user.role === "admin" ? "Search people or operations" : user.role === "doctor" ? "Search patients" : user.role === "nurse" ? "Search dispensing queue" : "Find a doctor or service";

  const onSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    if (user.role === "admin") navigate(q ? `/admin/users?q=${encodeURIComponent(q)}` : "/admin/users");
    else if (user.role === "nurse") navigate("/home");
    else navigate(q ? `/care?q=${encodeURIComponent(q)}` : "/care");
  };

  const badgeFor = (key) => Number(badges[key] || 0);
  const renderLink = (item, mobile = false) => {
    const Icon = item.icon;
    const count = item.badge ? badgeFor(item.badge) : 0;
    const cartItems = user.role === "patient" && item.to === "/pay" ? Number(cart?.count || 0) : 0;
    const shown = count || cartItems;
    return (
      <NavLink key={`${mobile ? "m-" : ""}${item.to}`} to={item.to} end={item.end} title={collapsed && !mobile ? item.label : undefined} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <span className="nav-icon"><Icon size={18} /></span>
        <span className="nav-text">{item.label}</span>
        {shown > 0 && <em className="nav-badge">{shown > 99 ? "99+" : shown}</em>}
      </NavLink>
    );
  };

  return (
    <div className={`app-layout portal-app carebridge-shell role-${user.role} ${collapsed ? "nav-collapsed" : ""}`} data-role={user.role}>
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className={`sidebar product-sidebar sidebar-${user.role}`}>
        <div className="product-sidebar-head">
          <Link to={user.role === "admin" ? "/admin" : "/home"} className="product-brand" aria-label="CareBridge home">
            <span className="product-brand-mark"><HeartPulse size={20} /></span>
            <span className="product-brand-copy"><b>{HOSPITAL.short}</b><small>Health OS</small></span>
          </Link>
          <button className="product-collapse" type="button" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
            {collapsed ? <Menu size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <div className="product-campus-card">
          <span className="product-live-dot" />
          <div><strong>{HOSPITAL.campus}</strong><small>{HOSPITAL.city} · {BUILD}</small></div>
        </div>

        <NavRail>
          {groups.map((group) => (
            <div className="nav-group" key={group.group}>
              <p className="nav-label">{group.group}</p>
              {group.items.map((item) => renderLink(item))}
            </div>
          ))}
        </NavRail>

        <div className="product-sidebar-foot">
          <button type="button" className="product-user-card" onClick={() => navigate("/settings")}>
            <Avatar person={user} className="small" />
            <span><b>{user.name}</b><small>{user.role === "patient" ? `MRN ${user.mrn || "—"}` : user.employeeId || user.specialty || roleLabel}</small></span>
          </button>
          <button className="icon-btn product-logout" title="Sign out" aria-label="Sign out" type="button" onClick={() => { logout(); navigate("/login"); }}><LogOut size={18} /></button>
        </div>
      </aside>

      <section className="product-workspace">
        <header className="product-topbar">
          <div className="product-page-context">
            <span className="product-context-kicker">{roleLabel} workspace</span>
            <strong>{context.title}</strong>
          </div>

          <form className="top-search product-search" onSubmit={onSearch}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
            <kbd>⌘ K</kbd>
          </form>

          <div className="product-top-actions">
            <span className={`product-connection ${connected ? "connected" : "offline"}`} title={connected ? "Live services connected" : "Reconnecting live services"}>
              <Wifi size={14} /><span>{connected ? "Live" : "Connecting"}</span>
            </span>
            <LiveClock />
            {user.role === "patient" && <CartMastButton />}
            <button className="icon-btn bell-btn" type="button" onClick={() => { setNoticeOpen((v) => !v); if (!noticeOpen && unread) markRead(); }} title="Notifications" aria-label={unread ? `${unread} unread notices` : "Notifications"} aria-expanded={noticeOpen}>
              <Bell size={18} />
              {unread > 0 && <em className="bell-count">{unread > 99 ? "99+" : unread}</em>}
            </button>
            <button type="button" className="product-top-user" onClick={() => navigate("/settings")} aria-label="Open account settings">
              <Avatar person={user} className="small" />
              <span><b>{user.name.split(" ").slice(-1)[0]}</b><small>{roleLabel}</small></span>
            </button>
          </div>
        </header>

        <div className="product-context-strip">
          <div><ShieldCheck size={15} /><span>{context.description}</span></div>
          <div className="product-context-right"><Activity size={14} /><span>{topMeta}</span></div>
        </div>

        <main className="main portal-main product-main" id="main-content" tabIndex="-1">
          {noticeOpen && (
            <aside className="product-notification-drawer" role="dialog" aria-label="Notifications">
              <div className="product-notification-head">
                <div><span className="eyebrow">Live feed</span><h3>Notifications</h3></div>
                <button className="ghost-btn" type="button" onClick={markRead}>Mark all read</button>
              </div>
              <div className="product-notification-list">
                {notes.length === 0 && <p className="muted">No new hospital notices.</p>}
                {notes.slice(0, 10).map((n) => (
                  <div key={n.id} className={`notice-item ${n.read ? "" : "unread"}`}><i /><span><b>{n.title}</b><small>{n.body}</small></span></div>
                ))}
              </div>
              <div className="notice-actions">
                {(user.role === "patient" || user.role === "admin") && <button className="secondary-btn" type="button" onClick={() => { setNoticeOpen(false); navigate("/alerts"); }}>Open notification centre</button>}
                <button className="secondary-btn" type="button" onClick={() => { setNoticeOpen(false); navigate("/support"); }}>Support</button>
              </div>
            </aside>
          )}

          <div className={`page-stage scene-${scene}`}>
            <PageAtmosphere scene={scene} />
            <div className="page-wrap product-page"><Outlet /></div>
          </div>
        </main>
      </section>

      <nav className="product-mobile-nav" aria-label="Primary navigation">
        {mobileItems.map((item) => renderLink(item, true))}
      </nav>
    </div>
  );
}
