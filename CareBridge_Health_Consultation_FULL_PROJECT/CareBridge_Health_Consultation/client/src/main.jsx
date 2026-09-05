import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { homeFor } from "./utils";
import { AuthProvider, ToastProvider, useAuth } from "./state";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Services from "./pages/Services";
import Patients from "./pages/Patients";
import DoctorsDirectory from "./pages/DoctorsDirectory";
import Book from "./pages/Book";
import Contact from "./pages/Contact";
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
import AdminCases from "./pages/admin/Cases";
import AdminCaseDetail from "./pages/admin/CaseDetail";
import Pay from "./pages/Pay";
import Pharmacy from "./pages/Pharmacy";
import PharmacyStock from "./pages/PharmacyStock";
import Prescriptions from "./pages/Prescriptions";
import PrescriptionPrint from "./pages/PrescriptionPrint";
import Receipt from "./pages/Receipt";
import Tariff from "./pages/Tariff";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./ErrorBoundary";

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
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/doctors" element={<DoctorsDirectory />} />
        <Route path="/find-a-doctor" element={<Navigate to="/doctors" replace />} />
        <Route path="/book" element={<Book />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={user ? <Navigate to={homeFor(user)} /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={homeFor(user)} /> : <Register />} />
        <Route path="/help" element={user ? <Navigate to="/guide" replace /> : <Help />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/tariff" element={user ? <Navigate to="/billing/tariff" replace /> : <Tariff />} />
        <Route element={user ? <AppShell /> : <Navigate to="/login" />}>
          <Route path="/home" element={<RoleRoute roles={["patient", "doctor", "nurse"]}><Dashboard /></RoleRoute>} />
          <Route path="/care" element={<RoleRoute roles={["patient", "doctor"]}><CareTeam /></RoleRoute>} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/video" element={<RoleRoute roles={["patient", "doctor"]}><VideoConsultation /></RoleRoute>} />
          <Route path="/wards" element={<WardBooking />} />
          <Route path="/alerts" element={<RoleRoute roles={["patient", "admin"]}><Alerts /></RoleRoute>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
          <Route path="/guide" element={<Help />} />
          <Route path="/records" element={<RoleRoute roles={["patient", "doctor", "admin"]}><ClinicalRecord /></RoleRoute>} />
          <Route path="/records/:patientId" element={<RoleRoute roles={["doctor", "admin"]}><ClinicalRecord /></RoleRoute>} />
          <Route path="/pay" element={<RoleRoute roles={["patient", "admin"]}><Pay /></RoleRoute>} />
          <Route path="/receipts" element={<RoleRoute roles={["patient", "admin"]}><Navigate to="/pay" replace /></RoleRoute>} />
          <Route path="/admin/billing" element={<RoleRoute roles={["admin"]}><Navigate to="/pay" replace /></RoleRoute>} />
          <Route path="/pharmacy" element={<RoleRoute roles={["patient", "admin"]}><Pharmacy /></RoleRoute>} />
          <Route path="/pharmacy-stock" element={<RoleRoute roles={["nurse", "admin"]}><PharmacyStock /></RoleRoute>} />
          <Route path="/prescriptions" element={<RoleRoute roles={["patient", "doctor"]}><Prescriptions /></RoleRoute>} />
          <Route path="/prescriptions/:id" element={<RoleRoute roles={["patient", "doctor", "admin"]}><PrescriptionPrint /></RoleRoute>} />
          <Route path="/receipts/:id" element={<RoleRoute roles={["patient", "doctor", "admin"]}><Receipt /></RoleRoute>} />
          <Route path="/billing/tariff" element={<Tariff />} />
          <Route path="/admin" element={<RoleRoute roles={["admin"]}><AdminOverview /></RoleRoute>} />
          <Route path="/admin/users" element={<RoleRoute roles={["admin"]}><AdminUsers /></RoleRoute>} />
          <Route path="/admin/appointments" element={<RoleRoute roles={["admin"]}><AdminSchedule /></RoleRoute>} />
          <Route path="/admin/hospital" element={<RoleRoute roles={["admin"]}><AdminHospital /></RoleRoute>} />
          <Route path="/admin/reports" element={<RoleRoute roles={["admin"]}><AdminReports /></RoleRoute>} />
          <Route path="/admin/cases" element={<RoleRoute roles={["admin"]}><AdminCases /></RoleRoute>} />
          <Route path="/admin/cases/:id" element={<RoleRoute roles={["admin"]}><AdminCaseDetail /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? homeFor(user) : "/"} />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
