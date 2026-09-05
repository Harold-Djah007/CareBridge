import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);
const ToastContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("carebridge-user")); } catch { return null; }
  });
  const auth = useMemo(() => ({
    user,
    login: (u) => { setUser(u); localStorage.setItem("carebridge-user", JSON.stringify(u)); },
    logout: () => { setUser(null); localStorage.removeItem("carebridge-user"); },
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
