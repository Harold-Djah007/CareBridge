import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays, LayoutDashboard, MessageCircle, BedDouble, Video, LogOut, HeartPulse,
  Bell, Users, Mail, UserRound, Stethoscope, ClipboardList, Building2, Search, Inbox,
  FolderOpen, ScrollText, Pill, Wallet,
} from "lucide-react";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../state";
import { api, socketUrl } from "../api";
import { HOSPITAL, isUpcoming, longDate } from "../utils";
import { LiveClock } from "./LiveMeter";

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
        { to: "/pay", icon: Wallet, label: "Patient billing" },
      ],
    },
    {
      group: "Communications",
      items: [
        { to: "/messages", icon: MessageCircle, label: "Switchboard" },
        { to: "/alerts", icon: Mail, label: "Patient notices", primary: true },
        { to: "/profile", icon: UserRound, label: "My account" },
      ],
    },
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [badges, setBadges] = useState({ visits: 0, wards: 0, messages: 0 });

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
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    socket.on("notification", (n) => { push(n.title); loadNotes(); });
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
          <span>{HOSPITAL.city} · {longDate()}</span>
        </div>
        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group.group}>
              <p className="nav-label">{group.group}</p>
              {group.items.map(renderLink)}
            </div>
          ))}
        </nav>
        <div className="mobile-nav">{mobileItems.map(renderLink)}</div>
        <div className="sidebar-user">
          <button className="avatar" onClick={() => navigate("/profile")}>{user.avatar}</button>
          <div className="sidebar-user-text">
            <strong>{user.name}</strong>
            <span>{user.role === "patient" ? `MRN ${user.mrn || "—"}` : user.employeeId || user.specialty || user.department}</span>
          </div>
          <button className="icon-btn" title="Sign out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">{topMeta}</span>
            <small className="muted">{user.role === "doctor" ? `On duty · ${user.shift || "Day clinic"}` : user.role === "patient" ? `File ${user.mrn || ""}` : user.employeeId}</small>
          </div>
          <form className="top-search" onSubmit={onSearch}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />
          </form>
          <div className="topbar-actions">
            <LiveClock />
            <button className="icon-btn" onClick={() => { setOpen((v) => !v); if (!open && unread) markRead(); }} title="Notifications">
              <Bell size={19} />{unread > 0 && <i className="dot" />}
            </button>
            <button className="avatar small" onClick={() => navigate("/profile")}>{user.avatar}</button>
          </div>
          {open && (
            <div className="notice">
              <div className="card-head"><b>Notifications</b><button className="ghost-btn" onClick={markRead}>Mark read</button></div>
              {notes.length === 0 && <p className="muted">No new hospital notices.</p>}
              {notes.slice(0, 8).map((n) => (
                <div key={n.id} className={`notice-item ${n.read ? "" : "unread"}`}><b>{n.title}</b><span>{n.body}</span></div>
              ))}
              {(user.role === "patient" || user.role === "admin") && (
                <button className="secondary-btn full" onClick={() => { setOpen(false); navigate("/alerts"); }}>
                  {user.role === "admin" ? "Open notice log" : "Open notifications"}
                </button>
              )}
            </div>
          )}
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  );
}
