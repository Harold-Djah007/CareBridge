import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, LayoutDashboard, MessageCircle, BedDouble, Video, LogOut, HeartPulse, Bell } from "lucide-react";
import { useAuth } from "../main";

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = [
    ["/", LayoutDashboard, "Dashboard"],
    ["/appointments", CalendarDays, "Appointments"],
    ["/messages", MessageCircle, "Messages"],
    ["/video", Video, "Video consultation"],
    ["/wards", BedDouble, user.role === "patient" ? "Book a ward" : "Ward bookings"],
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><HeartPulse size={22}/></div><div><b>CareBridge</b><span>Health</span></div></div>
        <div className="role-pill">{user.role === "doctor" ? "Doctor workspace" : "Patient portal"}</div>
        <nav>
          {links.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
              <Icon size={19}/><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.avatar}</div>
          <div className="sidebar-user-text"><strong>{user.name}</strong><span>{user.role === "doctor" ? user.specialty : "Patient"}</span></div>
          <button className="icon-btn" onClick={() => { logout(); navigate("/login"); }} title="Sign out"><LogOut size={18}/></button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">Care made simple</span></div>
          <div className="topbar-actions"><button className="icon-btn"><Bell size={19}/></button><div className="avatar small">{user.avatar}</div></div>
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  );
}
