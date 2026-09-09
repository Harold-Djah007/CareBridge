import { Suspense, lazy, useEffect } from "react";
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
import "./carebridge-clinical-orders.css";
import "./carebridge-quality-gate.css";
import { homeFor } from "./utils";
import { AuthProvider, ToastProvider, useAuth } from "./state";
import { PatientExperienceProvider, usePatientExperience } from "./patientExperience";
import { CartProvider } from "./ShopCart";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./ErrorBoundary";

const Landing = lazy(() => import("./pages/Landing"));
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const Patients = lazy(() => import("./pages/Patients"));
const DoctorsDirectory = lazy(() => import("./pages/DoctorsDirectory"));
const Book = lazy(() => import("./pages/Book"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Messages = lazy(() => import("./pages/Messages"));
const WardBooking = lazy(() => import("./pages/WardBooking"));
const VideoConsultation = lazy(() => import("./pages/VideoConsultation"));
const CareTeam = lazy(() => import("./pages/CareTeam"));
const Alerts = lazy(() => import("./pages/Alerts"));
const ClinicalRecord = lazy(() => import("./pages/ClinicalRecord"));
const ClinicalOrders = lazy(() => import("./pages/ClinicalOrders"));
const Help = lazy(() => import("./pages/Help"));
const Privacy = lazy(() => import("./pages/Privacy"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSchedule = lazy(() => import("./pages/admin/Schedule"));
const AdminHospital = lazy(() => import("./pages/admin/Hospital"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminCases = lazy(() => import("./pages/admin/Cases"));
const AdminCaseDetail = lazy(() => import("./pages/admin/CaseDetail"));
const AdminPatientExperience = lazy(() => import("./pages/admin/PatientExperience"));
const Pay = lazy(() => import("./pages/Pay"));
const PharmacyStock = lazy(() => import("./pages/PharmacyStock"));
const Prescriptions = lazy(() => import("./pages/Prescriptions"));
const PrescriptionPrint = lazy(() => import("./pages/PrescriptionPrint"));
const Receipt = lazy(() => import("./pages/Receipt"));
const Tariff = lazy(() => import("./pages/Tariff"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const PaymentStatus = lazy(() => import("./pages/PaymentStatus"));

function RouteLoader() {
  return <div className="cbv6-route-loading" role="status" aria-live="polite"><span className="cbv6-route-loading-pulse" aria-hidden="true" /><span>Loading…</span></div>;
}

function RouteReset() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return null;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role[0]) ? children : <Navigate to={homeFor(user)} replace />;
}

function PatientFeatureRoute({ feature, children }) {
  const { user } = useAuth();
  const { moduleVisible, loading } = usePatientExperience();
  if (user.role[0] !== "p") return children;
  if (loading) return <RouteLoader />;
  return moduleVisible(feature) ? children : <Navigate to="/home" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <RouteReset />
      <CartProvider>
        <Suspense fallback={<RouteLoader />}>
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
              <Route path="/home" element={<RoleRoute roles="pdn"><Dashboard /></RoleRoute>} />
              <Route path="/care" element={<PatientFeatureRoute feature="careTeam"><RoleRoute roles="pd"><CareTeam /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/appointments" element={<PatientFeatureRoute feature="appointments"><Appointments /></PatientFeatureRoute>} />
              <Route path="/messages" element={<PatientFeatureRoute feature="messages"><Messages /></PatientFeatureRoute>} />
              <Route path="/video" element={<PatientFeatureRoute feature="video"><RoleRoute roles="pd"><VideoConsultation /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/wards" element={<PatientFeatureRoute feature="admissions"><WardBooking /></PatientFeatureRoute>} />
              <Route path="/alerts" element={<PatientFeatureRoute feature="notifications"><RoleRoute roles="pa"><Alerts /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/support" element={<PatientFeatureRoute feature="support"><Support /></PatientFeatureRoute>} />
              <Route path="/guide" element={<Help />} />
              <Route path="/records" element={<PatientFeatureRoute feature="records"><RoleRoute roles="pda"><ClinicalRecord /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/records/:patientId" element={<RoleRoute roles="da"><ClinicalRecord /></RoleRoute>} />
              <Route path="/orders" element={<RoleRoute roles="dna"><ClinicalOrders /></RoleRoute>} />
              <Route path="/pay" element={<PatientFeatureRoute feature="shop"><RoleRoute roles="pa"><Pay /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/payment/callback" element={<PatientFeatureRoute feature="shop"><RoleRoute roles="p"><PaymentCallback /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/payments/:id" element={<PatientFeatureRoute feature="shop"><RoleRoute roles="pa"><PaymentStatus /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/receipts" element={<PatientFeatureRoute feature="shop"><RoleRoute roles="pa"><Navigate to="/pay" replace /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/admin/billing" element={<RoleRoute roles="a"><Navigate to="/pay" replace /></RoleRoute>} />
              <Route path="/pharmacy" element={<PatientFeatureRoute feature="shop"><RoleRoute roles="pa"><Navigate to="/pay" replace /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/pharmacy-stock" element={<RoleRoute roles="na"><PharmacyStock /></RoleRoute>} />
              <Route path="/prescriptions" element={<PatientFeatureRoute feature="prescriptions"><RoleRoute roles="pd"><Prescriptions /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/prescriptions/:id" element={<PatientFeatureRoute feature="prescriptions"><RoleRoute roles="pda"><PrescriptionPrint /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/receipts/:id" element={<PatientFeatureRoute feature="shop"><RoleRoute roles="pda"><Receipt /></RoleRoute></PatientFeatureRoute>} />
              <Route path="/billing/tariff" element={<Tariff />} />
              <Route path="/admin" element={<RoleRoute roles="a"><AdminOverview /></RoleRoute>} />
              <Route path="/admin/users" element={<RoleRoute roles="a"><AdminUsers /></RoleRoute>} />
              <Route path="/admin/appointments" element={<RoleRoute roles="a"><AdminSchedule /></RoleRoute>} />
              <Route path="/admin/hospital" element={<RoleRoute roles="a"><AdminHospital /></RoleRoute>} />
              <Route path="/admin/reports" element={<RoleRoute roles="a"><AdminReports /></RoleRoute>} />
              <Route path="/admin/cases" element={<RoleRoute roles="a"><AdminCases /></RoleRoute>} />
              <Route path="/admin/cases/:id" element={<RoleRoute roles="a"><AdminCaseDetail /></RoleRoute>} />
              <Route path="/admin/patient-experience" element={<RoleRoute roles="a"><AdminPatientExperience /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to={user ? homeFor(user) : "/"} />} />
          </Routes>
        </Suspense>
      </CartProvider>
    </BrowserRouter>
  );
}

function App() {
  return <ErrorBoundary><AuthProvider><ToastProvider><PatientExperienceProvider><AppRoutes /></PatientExperienceProvider></ToastProvider></AuthProvider></ErrorBoundary>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
