import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./styles.css";
import "./carebridge-refresh.css";
import "./carebridge-field.css";
import "./carebridge-live.css";
import "./carebridge-cart-fix.css";
import "./carebridge-product.css";
import "./carebridge-workflows.css";
import "./carebridge-modules.css";
import "./carebridge-v6.css";
import "./carebridge-premium-pages.css";
import "./carebridge-premium-video.css";
import "./carebridge-premium-care.css";
import "./carebridge-premium-utility.css";
import "./carebridge-premium-ops.css";
import "./carebridge-premium-admin.css";
import "./carebridge-premium-finance.css";
import "./carebridge-premium-ehr.css";
import "./carebridge-premium-final.css";
import "./carebridge-premium-readable.css";
import "./carebridge-premium-contrast.css";
import "./carebridge-premium-repair.css";
import "./carebridge-premium-viewport.css";
import "./carebridge-live-state.css";
import "./carebridge-notification-portal.css";
import "./carebridge-patient-experience.css";
import { homeFor } from "./utils";
import { AuthProvider, ToastProvider, useAuth } from "./state";
import { PatientExperienceProvider, usePatientExperience } from "./patientExperience";
import { CartProvider } from "./ShopCart";
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
import AdminPatientExperience from "./pages/admin/PatientExperience";
import Pay from "./pages/Pay";
import Pharmacy from "./pages/Pharmacy";
import PharmacyStock from "./pages/PharmacyStock";
import Prescriptions from "./pages/Prescriptions";
import PrescriptionPrint from "./pages/PrescriptionPrint";
import Receipt from "./pages/Receipt";
import Tariff from "./pages/Tariff";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import PaymentCallback from "./pages/PaymentCallback";
import PaymentStatus from "./pages/PaymentStatus";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./ErrorBoundary";

function RouteReset() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);
  return null;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function PatientFeatureRoute({ feature, children }) {
  const { user } = useAuth();
  const { moduleVisible, loading } = usePatientExperience();
  if (user.role !== "patient") return children;
  if (loading) return <div className="cbv6-route-loading">Preparing your CareBridge workspace…</div>;
  if (!moduleVisible(feature)) return <Navigate to="/home" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <RouteReset />
      <CartProvider>
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
          <Route path="/care" element={<PatientFeatureRoute feature="careTeam"><RoleRoute roles={["patient", "doctor"]}><CareTeam /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/appointments" element={<PatientFeatureRoute feature="appointments"><Appointments /></PatientFeatureRoute>} />
          <Route path="/messages" element={<PatientFeatureRoute feature="messages"><Messages /></PatientFeatureRoute>} />
          <Route path="/video" element={<PatientFeatureRoute feature="video"><RoleRoute roles={["patient", "doctor"]}><VideoConsultation /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/wards" element={<PatientFeatureRoute feature="admissions"><WardBooking /></PatientFeatureRoute>} />
          <Route path="/alerts" element={<PatientFeatureRoute feature="notifications"><RoleRoute roles={["patient", "admin"]}><Alerts /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<PatientFeatureRoute feature="support"><Support /></PatientFeatureRoute>} />
          <Route path="/guide" element={<Help />} />
          <Route path="/records" element={<PatientFeatureRoute feature="records"><RoleRoute roles={["patient", "doctor", "admin"]}><ClinicalRecord /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/records/:patientId" element={<RoleRoute roles={["doctor", "admin"]}><ClinicalRecord /></RoleRoute>} />
          <Route path="/pay" element={<PatientFeatureRoute feature="shop"><RoleRoute roles={["patient", "admin"]}><Pay /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/payment/callback" element={<PatientFeatureRoute feature="shop"><RoleRoute roles={["patient"]}><PaymentCallback /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/payments/:id" element={<PatientFeatureRoute feature="shop"><RoleRoute roles={["patient", "admin"]}><PaymentStatus /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/receipts" element={<PatientFeatureRoute feature="shop"><RoleRoute roles={["patient", "admin"]}><Navigate to="/pay" replace /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/admin/billing" element={<RoleRoute roles={["admin"]}><Navigate to="/pay" replace /></RoleRoute>} />
          <Route path="/pharmacy" element={<PatientFeatureRoute feature="shop"><RoleRoute roles={["patient", "admin"]}><Pharmacy /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/pharmacy-stock" element={<RoleRoute roles={["nurse", "admin"]}><PharmacyStock /></RoleRoute>} />
          <Route path="/prescriptions" element={<PatientFeatureRoute feature="prescriptions"><RoleRoute roles={["patient", "doctor"]}><Prescriptions /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/prescriptions/:id" element={<PatientFeatureRoute feature="prescriptions"><RoleRoute roles={["patient", "doctor", "admin"]}><PrescriptionPrint /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/receipts/:id" element={<PatientFeatureRoute feature="shop"><RoleRoute roles={["patient", "doctor", "admin"]}><Receipt /></RoleRoute></PatientFeatureRoute>} />
          <Route path="/billing/tariff" element={<Tariff />} />
          <Route path="/admin" element={<RoleRoute roles={["admin"]}><AdminOverview /></RoleRoute>} />
          <Route path="/admin/users" element={<RoleRoute roles={["admin"]}><AdminUsers /></RoleRoute>} />
          <Route path="/admin/appointments" element={<RoleRoute roles={["admin"]}><AdminSchedule /></RoleRoute>} />
          <Route path="/admin/hospital" element={<RoleRoute roles={["admin"]}><AdminHospital /></RoleRoute>} />
          <Route path="/admin/reports" element={<RoleRoute roles={["admin"]}><AdminReports /></RoleRoute>} />
          <Route path="/admin/cases" element={<RoleRoute roles={["admin"]}><AdminCases /></RoleRoute>} />
          <Route path="/admin/cases/:id" element={<RoleRoute roles={["admin"]}><AdminCaseDetail /></RoleRoute>} />
          <Route path="/admin/patient-experience" element={<RoleRoute roles={["admin"]}><AdminPatientExperience /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? homeFor(user) : "/"} />} />
      </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <PatientExperienceProvider>
            <AppRoutes />
          </PatientExperienceProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
