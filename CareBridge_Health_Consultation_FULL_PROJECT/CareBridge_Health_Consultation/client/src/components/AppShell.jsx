import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays, LayoutDashboard, MessageCircle, BedDouble, Video, LogOut, HeartPulse,
  Bell, Users, Mail, UserRound, Stethoscope, ClipboardList, Building2, Search, Inbox,
  FolderOpen, ScrollText, Pill, Receipt, ShoppingBag, Settings, LifeBuoy, FolderKanban,
} from "lucide-react";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketUrl } from "../api";
import { HOSPITAL, BUILD } from "../utils";
import { LiveClock } from "./LiveMeter";
import PageAtmosphere from "./PageAtmosphere";
import { sceneFor } from "../imagery";
import Avatar from "./Avatar";

const NAV = {
  patient: [
    {
      group: "My care",
      items: [
        { to: "/home", icon: LayoutDashboard, label: "Home", end: true, primary: true },
        { to: "/appointments", icon: CalendarDays, label: "Appointments", primary: true },
        { to: "/messages", icon: MessageCircle, label: "Messages", badge: "messages" },
        { to: "/wards", icon: BedDouble, label: "Admissions", badge: "wards" },
        { to: "/pay", icon: ShoppingBag, label: "Shop & pay", primary: true },
        { to: "/prescriptions", icon: ClipboardList, label: "Prescriptions", primary: true },
      ],
    },
    {
      group: "Accounts",
      items: [
        { to: "/records", icon: FolderOpen, label: "Clinical file", primary: true },
        { to: "/care", icon: Stethoscope, label: "Find a doctor" },
        { to: "/alerts", icon: Inbox, label: "Notifications" },
        { to: "/profile", icon: UserRound, label: "My details" },
      ],
    },
    {
      group: "Hospital",
      items: [
        { to: "/support", icon: LifeBuoy, label: "Help & support", badge: "tickets" },
        { to: "/settings", icon: Settings, label: "Settings" },
      ],
    },
  ],
  doctor: [
    {
      group: "Clinic",
      items: [
        { to: "/home", icon: ClipboardList, label: "Clinic board", end: true, primary: true },
        { to: "/appointments", icon: CalendarDays, label: "My schedule", primary: true, badge: "visits" },
        { to: "/messages", icon: MessageCircle, label: "Inbox", primary: true, badge: "messages" },
        { to: "/video", icon: Video, label: "Consult room" },
        { to: "/prescriptions", icon: Pill, label: "Prescriptions", primary: true },
      ],
    },
    {
      group: "Caseload",
      items: [
        { to: "/care", icon: Users, label: "Patients", primary: true },
        { to: "/records", icon: FolderOpen, label: "Open chart", primary: true },
        { to: "/wards", icon: BedDouble, label: "Admissions", primary: true, badge: "wards" },
        { to: "/profile", icon: UserRound, label: "Credentials" },
      ],
    },
    {
      group: "Hospital",
      items: [
        { to: "/support", icon: LifeBuoy, label: "Help & support", badge: "tickets" },
        { to: "/billing/tariff", icon: ScrollText, label: "Tariff" },
        { to: "/settings", icon: Settings, label: "Settings" },
      ],
    },
  ],
  admin: [
    {
      group: "Operations",
      items: [
        { to: "/admin", icon: LayoutDashboard, label: "Operations", end: true, primary: true },
        { to: "/admin/users", icon: Users, label: "Staff directory", primary: true },
        { to: "/admin/hospital", icon: Building2, label: "Bed board", primary: true, badge: "wards" },
        { to: "/admin/appointments", icon: CalendarDays, label: "Clinic diary", primary: true },
        { to: "/admin/reports", icon: ScrollText, label: "Reports & audit", primary: true },
        { to: "/admin/cases", icon: FolderKanban, label: "Case workflow", primary: true },
        { to: "/pay", icon: Receipt, label: "Receipts", primary: true },
        { to: "/billing/tariff", icon: ScrollText, label: "Hospital tariff", primary: true },
      ],
    },
    {
      group: "Communications",
      items: [
        { to: "/support", icon: LifeBuoy, label: "Support desk", primary: true, badge: "tickets" },
        { to: "/messages", icon: MessageCircle, label: "Switchboard", badge: "messages" },
        { to: "/alerts", icon: Mail, label: "Patient notices", primary: true },
        { to: "/settings", icon: Settings, label: "Settings" },
        { to: "/profile", icon: UserRound, label: "My account" },
      ],
    },
  ],
  nurse: [
    {
      group: "Dispensary",
      items: [
        { to: "/home", icon: ClipboardList, label: "Queue", end: true, primary: true, badge: "queue" },
        { to: "/pharmacy-stock", icon: Pill, label: "Stock", primary: true },
        { to: "/messages", icon: MessageCircle, label: "Messages", primary: true, badge: "messages" },
      ],
    },
    {
      group: "Hospital",
      items: [
        { to: "/settings", icon: Settings, label: "Settings", primary: true },
        { to: "/profile", icon: UserRound, label: "My account" },
      ],
    },
  ],
};

function NavRail({ children }) {
  const railRef = useRef(null);
  const [glow, setGlow] = useState({ y: 8, h: 42, x: 12, visible: false });
  const [spot, setSpot] = useState({ y: 40, visible: false });

  const moveToItem = (item, nav) => {
    if (!item || !nav) return;
    const nr = nav.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    setGlow({
      y: ir.top - nr.top + nav.scrollTop,
      h: ir.height,
      x: ir.left - nr.left,
      visible: true,
    });
  };

  const onMove = (e) => {
    const nav = railRef.current;
    if (!nav) return;
    const nr = nav.getBoundingClientRect();
    setSpot({ y: e.clientY - nr.top + nav.scrollTop, visible: true });
    const item = e.target.closest(".nav-item");
    if (item && nav.contains(item)) moveToItem(item, nav);
  };

  const onLeave = () => {
    setGlow((g) => ({ ...g, visible: false }));
    setSpot((s) => ({ ...s, visible: false }));
  };

  return (
    <nav
      ref={railRef}
      className="nav-rail"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <span
        className={`nav-follow ${glow.visible ? "on" : ""}`}
        style={{
          transform: `translate3d(0, ${glow.y}px, 0)`,
          height: glow.h,
        }}
      />
      <span
        className={`nav-spot ${spot.visible ? "on" : ""}`}
        style={{ transform: `translate3d(0, ${spot.y - 48}px, 0)` }}
      />
      {children}
    </nav>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [badges, setBadges] = useState({ visits: 0, wards: 0, messages: 0, tickets: 0, queue: 0, notifications: 0 });

  const groups = NAV[user.role] || NAV.patient;
  const mobileItems = groups.flatMap((g) => g.items).filter((i) => i.primary).slice(0, 5);
  const scene = sceneFor(location.pathname, user.role);

  const loadNotes = () => api(`/notifications/${user.id}`).then(setNotes).catch(() => {});
  const loadBadges = () => api(`/badges?userId=${user.id}&role=${user.role}`).then(setBadges).catch(() => {});

  useEffect(() => {
    loadNotes();
    loadBadges();
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    const refresh = () => { loadNotes(); loadBadges(); };
    socket.on("notification", (n) => { push(n.title); refresh(); });
    socket.on("email-alert", (n) => { push(`Notice sent: ${n.subject}`); refresh(); });
    socket.on("chat-message", refresh);
    socket.on("pharmacy-order", refresh);
    socket.on("pharmacy-stock", refresh);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  useEffect(() => { setOpen(false); loadBadges(); }, [location.pathname]);

  const unread = Number(badges.notifications || notes.filter((n) => !n.read).length);
  const markRead = async () => {
    await api(`/notifications/${user.id}/read`, { method: "PATCH" });
    loadNotes();
    loadBadges();
  };

  const topMeta = useMemo(() => {
    if (user.role === "doctor") return `${user.department || "Outpatient"} · ${user.clinic || HOSPITAL.campus}`;
    if (user.role === "admin") return `Looking after ${HOSPITAL.campus}`;
    if (user.role === "nurse") return `Pharmacy · ${HOSPITAL.campus}`;
    return `${HOSPITAL.campus} · you are welcome`;
  }, [user]);

  const searchPlaceholder = user.role === "admin" ? "Search staff or patients" : user.role === "doctor" ? "Search patients" : user.role === "nurse" ? "Search pickup patients" : "Find a doctor";

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (user.role === "admin") navigate(q ? `/admin/users?q=${encodeURIComponent(q)}` : "/admin/users");
    else if (user.role === "nurse") navigate("/home");
    else navigate(q ? `/care?q=${encodeURIComponent(q)}` : "/care");
  };

  const badgeFor = (key) => Number(badges[key] || 0);

  const renderLink = (item) => {
    const Icon = item.icon;
    const count = item.badge ? badgeFor(item.badge) : 0;
    return (
      <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <Icon size={18} />
        <span>{item.label}</span>
        {count > 0 && <em className="nav-badge">{count}</em>}
      </NavLink>
    );
  };

  const portalLabel = user.role === "patient" ? "Your care" : user.role === "doctor" ? "Clinic" : user.role === "nurse" ? "Pharmacy" : "Hospital";

  return (
    <div className={`app-layout portal-app role-${user.role}`} data-role={user.role}>
      <header className="portal-mast">
        <Link to={user.role === "admin" ? "/admin" : "/home"} className="brand portal-brand">
          <div className="brand-mark live"><HeartPulse size={20} /></div>
          <div>
            <b>{HOSPITAL.short}</b>
            <span>{portalLabel}</span>
          </div>
        </Link>
        <p className="portal-meta">{topMeta}<em>{HOSPITAL.phone}</em></p>
        <form className="top-search portal-search" onSubmit={onSearch}>
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />
        </form>
        <div className="portal-tools">
          <LiveClock />
          <button className="icon-btn bell-btn" type="button" onClick={() => { setOpen((v) => !v); if (!open && unread) markRead(); }} title="Notifications" aria-label={unread ? `${unread} unread notices` : "Notifications"}>
            <Bell size={18} />
            {unread > 0 && <em className="bell-count">{unread > 99 ? "99+" : unread}</em>}
          </button>
          <button type="button" className="portal-user" onClick={() => navigate("/settings")}>
            <Avatar person={user} className="small" />
            <span>
              <b>{user.name.split(" ").slice(-1)[0]}</b>
              <small>{user.role === "patient" ? `MRN ${user.mrn || "—"}` : user.employeeId || user.specialty || portalLabel}</small>
            </span>
          </button>
          <button className="icon-btn" title="Sign out" type="button" onClick={() => { logout(); navigate("/login"); }}><LogOut size={18} /></button>
        </div>
      </header>
      <nav className="portal-pills" aria-label="Primary destinations">
        {mobileItems.map(renderLink)}
      </nav>
      <aside className={`sidebar sidebar-${user.role}`}>
        <div className="sidebar-campus">
          <strong>{HOSPITAL.campus}</strong>
          <span>{HOSPITAL.city} · {BUILD}</span>
        </div>
        <NavRail>
          {groups.map((group) => (
            <div className="nav-group" key={group.group}>
              <p className="nav-label">{group.group}</p>
              {group.items.map(renderLink)}
            </div>
          ))}
        </NavRail>
        <div className="mobile-nav">{mobileItems.map(renderLink)}</div>
      </aside>
      <main className="main portal-main">
        {open && (
          <div className="notice notice-float">
            <div className="card-head"><b>Notifications</b><button className="ghost-btn" type="button" onClick={markRead}>Mark read</button></div>
            {notes.length === 0 && <p className="muted">No new hospital notices.</p>}
            {notes.slice(0, 8).map((n) => (
              <div key={n.id} className={`notice-item ${n.read ? "" : "unread"}`}><b>{n.title}</b><span>{n.body}</span></div>
            ))}
            <div className="notice-actions">
              {(user.role === "patient" || user.role === "admin") && (
                <button className="secondary-btn" type="button" onClick={() => { setOpen(false); navigate("/alerts"); }}>
                  {user.role === "admin" ? "Notice log" : "Notifications"}
                </button>
              )}
              <button className="secondary-btn" type="button" onClick={() => { setOpen(false); navigate("/support"); }}>Support</button>
            </div>
          </div>
        )}
        <div className={`page-stage scene-${scene}`}>
          <PageAtmosphere scene={scene} />
          <div className="page-wrap"><Outlet /></div>
        </div>
      </main>
    </div>
  );
}
