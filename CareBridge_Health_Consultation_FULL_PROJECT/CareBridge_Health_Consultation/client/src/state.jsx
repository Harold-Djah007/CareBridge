import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const ToastContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("carebridge-user")); } catch { return null; }
  });

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("carebridge:session-expired", expire);
    return () => window.removeEventListener("carebridge:session-expired", expire);
  }, []);

  const auth = useMemo(() => ({
    user,
    login: (u, token) => {
      setUser(u);
      localStorage.setItem("carebridge-user", JSON.stringify(u));
      if (token) localStorage.setItem("carebridge-token", token);
    },
    logout: () => {
      const token = localStorage.getItem("carebridge-token");
      if (token) {
        const apiBase = import.meta.env.VITE_API_URL || "/api";
        fetch(`${apiBase}/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
      setUser(null);
      localStorage.removeItem("carebridge-user");
      localStorage.removeItem("carebridge-token");
    },
    updateUser: (u) => { setUser(u); localStorage.setItem("carebridge-user", JSON.stringify(u)); },
  }), [user]);
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function ToastProvider({ children }) {
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
