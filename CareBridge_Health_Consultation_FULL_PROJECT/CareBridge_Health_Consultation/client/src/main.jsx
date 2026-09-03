import React, { createContext, useContext, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { homeFor } from "./utils";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import Messages from "./pages/Messages";
import WardBooking from "./pages/WardBooking";
import VideoConsultation from "./pages/VideoConsultation";
import CareTeam from "./pages/CareTeam";
import Profile from "./pages/Profile";
import Alerts from "./pages/Alerts";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminAppointments from "./pages/admin/Appointments";
import AdminHospital from "./pages/admin/Hospital";
import AppShell from "./components/AppShell";

const AuthContext = createContext(null);
const ToastContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg, type = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === "error" ? "error" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("carebridge-user")); } catch { return null; }
  });
  const auth = useMemo(() => ({
    user,
    login: (u) => { setUser(u); localStorage.setItem("carebridge-user", JSON.stringify(u)); },
    logout: () => { setUser(null); localStorage.removeItem("carebridge-user"); },
    updateUser: (u) => { setUser(u); localStorage.setItem("carebridge-user", JSON.stringify(u)); },
  }), [user]);

  return (
    <AuthContext.Provider value={auth}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={user ? <Navigate to={homeFor(user)} /> : <Landing />} />
            <Route path="/login" element={user ? <Navigate to={homeFor(user)} /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to={homeFor(user)} /> : <Register />} />
            <Route element={user ? <AppShell /> : <Navigate to="/login" />}>
              <Route path="/home" element={<RoleRoute roles={["patient", "doctor"]}><Dashboard /></RoleRoute>} />
              <Route path="/care" element={<RoleRoute roles={["patient", "doctor"]}><CareTeam /></RoleRoute>} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/video" element={<RoleRoute roles={["patient", "doctor"]}><VideoConsultation /></RoleRoute>} />
              <Route path="/wards" element={<WardBooking />} />
              <Route path="/alerts" element={<RoleRoute roles={["patient", "admin"]}><Alerts /></RoleRoute>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<RoleRoute roles={["admin"]}><AdminOverview /></RoleRoute>} />
              <Route path="/admin/users" element={<RoleRoute roles={["admin"]}><AdminUsers /></RoleRoute>} />
              <Route path="/admin/appointments" element={<RoleRoute roles={["admin"]}><AdminAppointments /></RoleRoute>} />
              <Route path="/admin/hospital" element={<RoleRoute roles={["admin"]}><AdminHospital /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to={user ? homeFor(user) : "/"} />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
