import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { homeFor } from "./utils";
import { AuthProvider, ToastProvider, useAuth } from "./state";
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
import ClinicalRecord from "./pages/ClinicalRecord";
import Help from "./pages/Help";
import Privacy from "./pages/Privacy";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminSchedule from "./pages/admin/Schedule";
import AdminHospital from "./pages/admin/Hospital";
import AdminReports from "./pages/admin/Reports";
import AppShell from "./components/AppShell";

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to={homeFor(user)} /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to={homeFor(user)} /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={homeFor(user)} /> : <Register />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route element={user ? <AppShell /> : <Navigate to="/login" />}>
          <Route path="/home" element={<RoleRoute roles={["patient", "doctor"]}><Dashboard /></RoleRoute>} />
          <Route path="/care" element={<RoleRoute roles={["patient", "doctor"]}><CareTeam /></RoleRoute>} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/video" element={<RoleRoute roles={["patient", "doctor"]}><VideoConsultation /></RoleRoute>} />
          <Route path="/wards" element={<WardBooking />} />
          <Route path="/alerts" element={<RoleRoute roles={["patient", "admin"]}><Alerts /></RoleRoute>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/records" element={<RoleRoute roles={["patient", "doctor", "admin"]}><ClinicalRecord /></RoleRoute>} />
          <Route path="/records/:patientId" element={<RoleRoute roles={["doctor", "admin"]}><ClinicalRecord /></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute roles={["admin"]}><AdminOverview /></RoleRoute>} />
          <Route path="/admin/users" element={<RoleRoute roles={["admin"]}><AdminUsers /></RoleRoute>} />
          <Route path="/admin/appointments" element={<RoleRoute roles={["admin"]}><AdminSchedule /></RoleRoute>} />
          <Route path="/admin/hospital" element={<RoleRoute roles={["admin"]}><AdminHospital /></RoleRoute>} />
          <Route path="/admin/reports" element={<RoleRoute roles={["admin"]}><AdminReports /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? homeFor(user) : "/"} />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
