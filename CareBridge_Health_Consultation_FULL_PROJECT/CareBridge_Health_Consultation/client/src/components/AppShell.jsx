import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays, LayoutDashboard, MessageCircle, BedDouble, Video, LogOut, HeartPulse,
  Bell, Users, Mail, UserRound, Stethoscope, ClipboardList, Building2, Search, Inbox,
  FolderOpen, ScrollText, Pill, Wallet, Settings, LifeBuoy, HelpCircle, PanelTop, ChevronDown, ChevronUp, FolderKanban,
} from "lucide-react";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketUrl } from "../api";
import { HOSPITAL, isUpcoming, BUILD } from "../utils";
import { LiveClock } from "./LiveMeter";
import PageAtmosphere from "./PageAtmosphere";
import { useTopbar } from "../chrome";
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
        { to: "/pharmacy", icon: Pill, label: "Pharmacy & labs", primary: true },
      ],
    },
    {
      group: "Accounts",
      items: [
        { to: "/records", icon: FolderOpen, label: "Clinical file", primary: true },
        { to: "/pay", icon: Wallet, label: "Pay bills", primary: true },
        { to: "/care", icon: Stethoscope, label: "My doctors" },
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
        { to: "/pay", icon: Wallet, label: "Patient billing" },
      ],
    },
    {
      group: "Communications",
      items: [
        { to: "/support", icon: LifeBuoy, label: "Support desk", primary: true, badge: "tickets" },
        { to: "/messages", icon: MessageCircle, label: "Switchboard" },
        { to: "/alerts", icon: Mail, label: "Patient notices", primary: true },
        { to: "/settings", icon: Settings, label: "Settings" },
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
  const [badges, setBadges] = useState({ visits: 0, wards: 0, messages: 0, tickets: 0 });
  const [topbarOn, setTopbarOn] = useTopbar();

  const groups = NAV[user.role] || NAV.patient;
  const mobileItems = groups.flatMap((g) => g.items).filter((i) => i.primary).slice(0, 5);

  const loadNotes = () => api(`/notifications/${user.id}`).then(setNotes).catch(() => {});

  useEffect(() => {
    loadNotes();
    api(`/appointments?userId=${user.id}&role=${user.role}`).then((rows) => {
      setBadges((b) => ({ ...b, visits: rows.filter(isUpcoming).length }));
    }).catch(() => {});
    api(`/ward-bookings?userId=${user.id}&role=${user.role}`).then((rows) => {
      setBadges((b) => ({ ...b, wards: rows.filter((w) => w.status === "pending").length }));
    }).catch(() => {});
    api(`/tickets?userId=${user.id}&role=${user.role}`).then((rows) => {
      setBadges((b) => ({ ...b, tickets: rows.filter((t) => t.status !== "resolved").length }));
    }).catch(() => {});
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    socket.on("notification", (n) => {
      push(n.title);
      loadNotes();
      api(`/tickets?userId=${user.id}&role=${user.role}`).then((rows) => {
        setBadges((b) => ({ ...b, tickets: rows.filter((t) => t.status !== "resolved").length }));
      }).catch(() => {});
    });
    socket.on("email-alert", (n) => { push(`Notice sent: ${n.subject}`); loadNotes(); });
    return () => socket.disconnect();
  }, [user.id]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const unread = notes.filter((n) => !n.read).length;
  const markRead = async () => {
    await api(`/notifications/${user.id}/read`, { method: "PATCH" });
    loadNotes();
  };

  const topMeta = useMemo(() => {
    if (user.role === "doctor") return `${user.department || "Outpatient"} · ${user.clinic || HOSPITAL.campus}`;
    if (user.role === "admin") return `Hospital operations · ${HOSPITAL.campus}`;
    return `${HOSPITAL.campus} · Patient portal`;
  }, [user]);

  const searchPlaceholder = user.role === "admin" ? "Search staff or patients" : user.role === "doctor" ? "Search patients" : "Find a doctor";

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (user.role === "admin") navigate(q ? `/admin/users?q=${encodeURIComponent(q)}` : "/admin/users");
    else navigate(q ? `/care?q=${encodeURIComponent(q)}` : "/care");
  };

  const badgeFor = (key) => {
    if (key === "messages") return unread || 0;
    if (key === "visits") return badges.visits;
    if (key === "wards") return badges.wards;
    if (key === "tickets") return badges.tickets;
    return 0;
  };

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

  return (
    <div className={`app-layout role-${user.role}`} data-role={user.role}>
      <aside className={`sidebar sidebar-${user.role}`}>
        <div className="brand">
          <div className="brand-mark live"><HeartPulse size={22} /></div>
          <div>
            <b>{HOSPITAL.short}</b>
            <span>{user.role === "patient" ? "Patient portal" : user.role === "doctor" ? "Clinical" : "Operations"}</span>
          </div>
        </div>
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
        <div className="sidebar-user">
          <button type="button" className="avatar-btn" title="Settings" onClick={() => navigate("/settings")}><Avatar person={user} /></button>
          <div className="sidebar-user-text">
            <strong>{user.name}</strong>
            <span>{user.role === "patient" ? `MRN ${user.mrn || "—"}` : user.employeeId || user.specialty || user.department}</span>
          </div>
          <button className="icon-btn" title="Sign out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={18} /></button>
        </div>
      </aside>
      <main className={`main ${topbarOn ? "has-topbar" : "topbar-hidden"}`}>
        {!topbarOn && (
          <div className="chrome-strip">
            <button type="button" className="toolbar-toggle" onClick={() => setTopbarOn(true)}>
              <PanelTop size={16} />
              <span>Show toolbar</span>
              <ChevronDown size={14} />
            </button>
            <LiveClock />
            <button className="icon-btn" onClick={() => { setOpen((v) => !v); if (!open && unread) markRead(); }} title="Notifications">
              <Bell size={18} />{unread > 0 && <i className="dot" />}
            </button>
            <button type="button" className="avatar-btn" title="Settings" onClick={() => navigate("/settings")}><Avatar person={user} className="small" /></button>
          </div>
        )}
        {topbarOn && (
          <header className="topbar">
            <div className="topbar-copy">
              <span className="eyebrow">{topMeta}</span>
              <small className="muted">{user.role === "doctor" ? `On duty · ${user.shift || "Day clinic"}` : user.role === "patient" ? `File ${user.mrn || ""}` : user.employeeId}</small>
            </div>
            <nav className="topbar-nav" aria-label="Hospital shortcuts">
              <Link className="topbar-link" to={user.role === "admin" ? "/admin" : "/home"}>Home</Link>
              {user.role === "patient" && <Link className="topbar-link" to="/pay">Pay</Link>}
              <Link className="topbar-link" to="/support"><LifeBuoy size={15} /> Support</Link>
              <Link className="topbar-link" to="/settings"><Settings size={15} /> Settings</Link>
              <Link className="topbar-link" to="/guide"><HelpCircle size={15} /> Guide</Link>
            </nav>
            <form className="top-search" onSubmit={onSearch}>
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />
            </form>
            <div className="topbar-actions">
              <LiveClock />
              <button className="icon-btn" onClick={() => { setOpen((v) => !v); if (!open && unread) markRead(); }} title="Notifications">
                <Bell size={19} />{unread > 0 && <i className="dot" />}
              </button>
              <button type="button" className="avatar-btn" title="Settings" onClick={() => navigate("/settings")}><Avatar person={user} className="small" /></button>
              <button type="button" className="ghost-btn toolbar-hide" onClick={() => setTopbarOn(false)}>
                Hide <ChevronUp size={14} />
              </button>
            </div>
            {open && (
              <div className="notice">
                <div className="card-head"><b>Notifications</b><button className="ghost-btn" onClick={markRead}>Mark read</button></div>
                {notes.length === 0 && <p className="muted">No new hospital notices.</p>}
                {notes.slice(0, 8).map((n) => (
                  <div key={n.id} className={`notice-item ${n.read ? "" : "unread"}`}><b>{n.title}</b><span>{n.body}</span></div>
                ))}
                <div className="notice-actions">
                  {(user.role === "patient" || user.role === "admin") && (
                    <button className="secondary-btn" onClick={() => { setOpen(false); navigate("/alerts"); }}>
                      {user.role === "admin" ? "Notice log" : "Notifications"}
                    </button>
                  )}
                  <button className="secondary-btn" onClick={() => { setOpen(false); navigate("/support"); }}>Support desk</button>
                  <button className="ghost-btn" onClick={() => { setOpen(false); navigate("/settings"); }}>Settings</button>
                </div>
              </div>
            )}
          </header>
        )}
        {open && !topbarOn && (
          <div className="notice notice-float">
            <div className="card-head"><b>Notifications</b><button className="ghost-btn" onClick={markRead}>Mark read</button></div>
            {notes.length === 0 && <p className="muted">No new hospital notices.</p>}
            {notes.slice(0, 8).map((n) => (
              <div key={n.id} className={`notice-item ${n.read ? "" : "unread"}`}><b>{n.title}</b><span>{n.body}</span></div>
            ))}
          </div>
        )}
        <div className="page-stage">
          <PageAtmosphere />
          <div className="page-wrap"><Outlet /></div>
        </div>
      </main>
    </div>
  );
}
