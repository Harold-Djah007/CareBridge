import React, { createContext, useContext, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import Messages from "./pages/Messages";
import WardBooking from "./pages/WardBooking";
import VideoConsultation from "./pages/VideoConsultation";
import AppShell from "./components/AppShell";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("carebridge-user")); } catch { return null; }
  });
  const auth = useMemo(() => ({
    user,
    login: (u) => { setUser(u); localStorage.setItem("carebridge-user", JSON.stringify(u)); },
    logout: () => { setUser(null); localStorage.removeItem("carebridge-user"); }
  }), [user]);

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route element={user ? <AppShell /> : <Navigate to="/login" />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/wards" element={<WardBooking />} />
            <Route path="/video" element={<VideoConsultation />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
