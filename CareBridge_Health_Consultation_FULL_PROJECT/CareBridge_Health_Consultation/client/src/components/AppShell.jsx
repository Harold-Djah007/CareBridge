import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, BedDouble, Bell, Building2, CalendarDays, ClipboardList, FolderKanban,
  FolderOpen, HeartPulse, Inbox, LayoutDashboard, LifeBuoy, LogOut, Mail,
  MessageCircle, Pill, Receipt, Search, ScrollText, ShieldCheck, ShoppingBag,
  Stethoscope, UserRound, Users, Video, Wifi,
} from "lucide-react";
import { io } from "socket.io-client";
import { CartMastButton, useCart } from "../ShopCart";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { HOSPITAL } from "../utils";
import { LiveClock } from "./LiveMeter";
import Avatar from "./Avatar";
import { photoFor, sceneFor } from "../imagery";

const NAV = {
  patient: [
    { to: "/home", icon: LayoutDashboard, label: "Home", end: true, primary: true },
    { to: "/appointments", icon: CalendarDays, label: "Appointments", primary: true },
    { to: "/messages", icon: MessageCircle, label: "Messages", badge: "messages", primary: true },
    { to: "/records", icon: FolderOpen, label: "Health record", primary: true },
    { to: "/prescriptions", icon: ClipboardList, label: "Prescriptions" },
    { to: "/wards", icon: BedDouble, label: "Admissions", badge: "wards" },
    { to: "/pay", icon: ShoppingBag, label: "Shop & pay", primary: true },
    { to: "/care", icon: Stethoscope, label: "Care team" },
    { to: "/alerts", icon: Inbox, label: "Notifications" },
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
      { to: "/settings", icon: UserRound, label: "Account" },
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
      { to: "/settings", icon: UserRound, label: "Profile & shift" },
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
      { to: "/alerts", icon: Mail, label: "Patient notices" },
      { to: "/settings", icon: UserRound, label: "Account" },
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
  ["/settings", "Account", "Identity, preferences and security"],
  ["/alerts", "Notifications", "Hospital notices and communications"],
  ["/billing/tariff", "Hospital tariff", "Published prices and service charges"],
  ["/home", "Home", "Your CareBridge workspace"],
];

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
  const [connected, setConnected] = useState(false);
  const [badges, setBadges] = useState({ visits: 0, wards: 0, messages: 0, tickets: 0, queue: 0, notifications: 0 });

  const isPatient = user.role === "patient";
  const meta = pageMeta(location.pathname, user.role);
  const scene = sceneFor(location.pathname, user.role);
  const scenePhoto = photoFor(scene);
  const allNav = flatNav(user.role);
  const mobileNav = allNav.filter((item) => item.primary).slice(0, 5);

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
    socket.on("email-alert", refresh);
    socket.on("chat-message", refresh);
    socket.on("pharmacy-order", refresh);
    socket.on("pharmacy-stock", refresh);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  useEffect(() => {
    setNoticeOpen(false);
    loadBadges();
  }, [location.pathname]);

  const unread = Number(badges.notifications || notes.filter((n) => !n.read).length);
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

  const markAllRead = async () => {
    try {
      await api(`/notifications/${user.id}/read`, { method: "PATCH" });
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
        className={({ isActive }) => `cbx-nav-link ${isActive ? "is-active" : ""}`}
      >
        <Icon size={compact ? 19 : 17} />
        <span>{item.label}</span>
        {shown > 0 && <b>{shown > 99 ? "99+" : shown}</b>}
      </NavLink>
    );
  };

  return (
    <div className={`cbx-app cbx-role-${user.role}`}>
      <a className="skip-link" href="#cbx-main">Skip to main content</a>

      <header className="cbx-topbar">
        <Link className="cbx-brand" to={user.role === "admin" ? "/admin" : "/home"}>
          <span className="cbx-brand-mark"><HeartPulse size={21} /></span>
          <span className="cbx-brand-copy"><strong>CareBridge</strong><small>{isPatient ? "My health" : "Hospital workspace"}</small></span>
        </Link>

        <div className="cbx-top-title">
          <small>{roleName}</small>
          <strong>{meta.title}</strong>
        </div>

        <form className="cbx-search" onSubmit={onSearch}>
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={user.role === "admin" ? "Search people" : user.role === "doctor" ? "Search patients" : user.role === "nurse" ? "Search dispensing" : "Find a doctor or service"}
            aria-label="Search CareBridge"
          />
        </form>

        <div className="cbx-top-actions">
          <span className={`cbx-live ${connected ? "is-live" : ""}`} title={connected ? "Live services connected" : "Reconnecting"}>
            <Wifi size={14} /><span>{connected ? "Live" : "Connecting"}</span>
          </span>
          <LiveClock />
          {isPatient && <CartMastButton />}
          <button className="cbx-icon-btn" type="button" onClick={() => { setNoticeOpen((v) => !v); if (!noticeOpen && unread) markAllRead(); }} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <em>{unread > 99 ? "99+" : unread}</em>}
          </button>
          <button className="cbx-profile" type="button" onClick={() => navigate("/settings")}>
            <Avatar person={user} className="small" />
            <span><strong>{user.name}</strong><small>{userMeta}</small></span>
          </button>
        </div>
      </header>

      {isPatient && (
        <nav className="cbx-patient-nav" aria-label="Patient navigation">
          <div>{allNav.map((item) => navLink(item))}</div>
        </nav>
      )}

      <div className={`cbx-layout ${isPatient ? "cbx-layout-patient" : "cbx-layout-staff"}`}>
        {!isPatient && (
          <aside className="cbx-side">
            <div className="cbx-side-campus">
              <span className="cbx-campus-photo" style={{ backgroundImage: `url(${scenePhoto})` }} />
              <div><strong>{HOSPITAL.campus}</strong><small>{HOSPITAL.city}</small></div>
              <span className={`cbx-status-dot ${connected ? "on" : ""}`} />
            </div>

            <nav className="cbx-side-nav" aria-label={`${roleName} navigation`}>
              {(NAV[user.role] || []).map((group) => (
                <section key={group.group}>
                  <p>{group.group}</p>
                  {group.items.map((item) => navLink(item))}
                </section>
              ))}
            </nav>

            <div className="cbx-side-foot">
              <button type="button" onClick={() => navigate("/settings")}>
                <Avatar person={user} className="small" />
                <span><strong>{user.name}</strong><small>{userMeta}</small></span>
              </button>
              <button className="cbx-side-logout" type="button" title="Sign out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={17} /></button>
            </div>
          </aside>
        )}

        <main className="cbx-main" id="cbx-main" tabIndex="-1">
          <div className="cbx-contextbar">
            <div>
              <ShieldCheck size={15} />
              <span>{meta.description}</span>
            </div>
            <span className="cbx-context-photo" style={{ backgroundImage: `url(${scenePhoto})` }} aria-hidden="true" />
          </div>

          {noticeOpen && (
            <aside className="cbx-notice-popover" role="dialog" aria-label="Notifications">
              <header><div><small>Live feed</small><strong>Notifications</strong></div><button type="button" onClick={markAllRead}>Mark read</button></header>
              <div className="cbx-notice-list">
                {notes.length === 0 && <p>No new hospital notices.</p>}
                {notes.slice(0, 8).map((note) => (
                  <article key={note.id} className={note.read ? "" : "unread"}>
                    <i />
                    <div><strong>{note.title}</strong><p>{note.body}</p></div>
                  </article>
                ))}
              </div>
              <footer><button type="button" onClick={() => { setNoticeOpen(false); navigate("/alerts"); }}>Open notification centre</button></footer>
            </aside>
          )}

          <div className="cbx-content"><Outlet /></div>
        </main>
      </div>

      <nav className="cbx-mobile-nav" aria-label="Primary navigation">
        {mobileNav.map((item) => navLink(item, true))}
      </nav>
    </div>
  );
}
