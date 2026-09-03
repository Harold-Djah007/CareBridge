import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, LayoutDashboard, MessageCircle, BedDouble, Video, LogOut, HeartPulse, Bell, Users, Mail, Shield, UserRound } from "lucide-react";
import { io } from "socket.io-client";
import { useAuth, useToast } from "../main";
import { api, socketUrl } from "../api";
import { roleLabel } from "../utils";

export default function AppShell() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);

  const links = user.role === "admin" ? [
    ["/admin", LayoutDashboard, "Overview"],
    ["/admin/users", Users, "People"],
    ["/admin/appointments", CalendarDays, "Appointments"],
    ["/admin/hospital", BedDouble, "Hospital"],
    ["/alerts", Mail, "Email log"],
    ["/messages", MessageCircle, "Messages"],
    ["/profile", UserRound, "Profile"],
  ] : [
    ["/home", LayoutDashboard, "Dashboard"],
    ["/care", Users, user.role === "patient" ? "Find a doctor" : "My patients"],
    ["/appointments", CalendarDays, "Appointments"],
    ["/messages", MessageCircle, "Messages"],
    ["/video", Video, "Video visit"],
    ["/wards", BedDouble, user.role === "patient" ? "Book a ward" : "Ward requests"],
    ...(user.role === "patient" ? [["/alerts", Mail, "Email alerts"]] : []),
    ["/profile", UserRound, "Profile"],
  ];

  const loadNotes = () => api(`/notifications/${user.id}`).then(setNotes).catch(() => {});

  useEffect(() => {
    loadNotes();
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    socket.on("notification", (n) => {
      push(n.title);
      loadNotes();
    });
    socket.on("email-alert", (n) => {
      push(`Email sent: ${n.subject}`);
      loadNotes();
    });
    return () => socket.disconnect();
  }, [user.id]);

  const unread = notes.filter((n) => !n.read).length;
  const markRead = async () => {
    await api(`/notifications/${user.id}/read`, { method: "PATCH" });
    loadNotes();
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><HeartPulse size={22} /></div><div><b>CareBridge</b><span>Health</span></div></div>
        <div className="role-pill">{user.role === "admin" ? "Admin console" : user.role === "doctor" ? "Doctor workspace" : "Patient portal"}</div>
        <nav>
          {links.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end={to === "/home" || to === "/admin"} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.avatar}</div>
          <div className="sidebar-user-text"><strong>{user.name}</strong><span>{user.specialty || roleLabel(user.role)}</span></div>
          <button className="icon-btn" title="Sign out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">Care made simple</span></div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => { setOpen((v) => !v); if (!open && unread) markRead(); }} title="Notifications">
              <Bell size={19} />{unread > 0 && <i className="dot" />}
            </button>
            {user.role === "admin" && <span className="status confirmed" style={{ display: "inline-flex", gap: 6 }}><Shield size={14} /> Admin</span>}
            <button className="avatar small" onClick={() => navigate("/profile")}>{user.avatar}</button>
          </div>
          {open && (
            <div className="notice">
              <div className="card-head"><b>Notifications</b><button className="ghost-btn" onClick={markRead}>Mark read</button></div>
              {notes.length === 0 && <p className="muted">No notifications yet.</p>}
              {notes.slice(0, 8).map((n) => (
                <div key={n.id} className={`notice-item ${n.read ? "" : "unread"}`}><b>{n.title}</b><span>{n.body}</span></div>
              ))}
              {user.role === "patient" && <button className="secondary-btn full" onClick={() => { setOpen(false); navigate("/alerts"); }}>Open email alerts</button>}
            </div>
          )}
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  );
}
