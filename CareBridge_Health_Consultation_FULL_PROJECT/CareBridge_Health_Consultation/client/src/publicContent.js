import {
  Stethoscope, Video, Pill, BedDouble, FolderOpen, HeartPulse, Baby, Bone, Wallet, UserRound,
} from "lucide-react";
import { HOSPITAL } from "./utils";

export const PUBLIC_NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About Us" },
  { to: "/services", label: "Our Services" },
  { to: "/patients", label: "For Patients" },
  { to: "/doctors", label: "Find a Doctor" },
  { to: "/help", label: "Health Information" },
  { to: "/contact", label: "Contact" },
];

export const HERO_SLIDES = [
  {
    image: "/imagery/hero-campus.jpg",
    eyebrow: `${HOSPITAL.campus} · ${HOSPITAL.city}`,
    title: "Private hospital care on one clinical record.",
    copy: "Outpatient clinic, teleconsult, pharmacy, and admissions at CareBridge Medical Centre. Book a visit, then sign in for your file, invoices, and receipts.",
  },
  {
    image: "/imagery/clinic.jpg",
    eyebrow: "Consultants on campus",
    title: "Seen by a named Ridge consultant — not a waiting-room lottery.",
    copy: "General medicine, cardiology, paediatrics, and orthopaedics on a booked clinic list. Walk-ins register at the front desk.",
  },
  {
    image: "/imagery/teleconsult.jpg",
    eyebrow: "Telemedicine",
    title: "Follow up by video without travelling to Accra.",
    copy: "Share records, get a second opinion, or review after a campus visit on a secure teleconsult.",
  },
];

export const QUICK_ACTIONS = [
  { to: "/doctors", icon: Stethoscope, title: "Find a doctor", copy: "Directory of Ridge consultants" },
  { to: "/tariff", icon: Wallet, title: "Pay bills / tariff", copy: "Published fees before you book" },
  { to: "/login", icon: UserRound, title: "Patient portal", copy: "File, invoices, and receipts" },
];

export const SERVICES = [
  {
    id: "telemedicine",
    title: "Telemedicine",
    image: "/imagery/teleconsult.jpg",
    icon: Video,
    copy: "Secure video with a Ridge consultant. Share records, get a second opinion, or follow up after a campus visit.",
    to: "/book",
  },
  {
    id: "opd",
    title: "Outpatient clinic",
    image: "/imagery/clinic.jpg",
    icon: Stethoscope,
    copy: "General medicine and specialty clinic days. Walk-ins are registered at the Ridge front desk.",
    to: "/book",
  },
  {
    id: "pharmacy",
    title: "Pharmacy",
    image: "/imagery/pharmacy.jpg",
    icon: Pill,
    copy: "Prescriptions written from chat or video. Collect at the Ridge cupboard or add medicines in Shop & pay.",
    to: "/login",
  },
  {
    id: "admissions",
    title: "Admissions",
    image: "/imagery/wards.jpg",
    icon: BedDouble,
    copy: "Request a ward and room type before you travel. Accounts invoice the nightly rate when the bed is accepted.",
    to: "/login",
  },
  {
    id: "records",
    title: "Records",
    image: "/imagery/records.jpg",
    icon: FolderOpen,
    copy: "Problems, vitals, labs, visit notes, prescriptions, invoices, and receipts stay on one medical record number.",
    to: "/login",
  },
  {
    id: "cardiology",
    title: "Cardiology",
    image: "/imagery/clinic.jpg",
    icon: HeartPulse,
    copy: "Blood pressure, chest pain, and recovery after cardiac events with a named consultant.",
    to: "/doctors",
  },
  {
    id: "paediatrics",
    title: "Paediatrics",
    image: "/imagery/corridor.jpg",
    icon: Baby,
    copy: "Infants, children, and adolescents — family-centred clinic days on campus or by video.",
    to: "/doctors",
  },
  {
    id: "orthopaedics",
    title: "Orthopaedics",
    image: "/imagery/wards.jpg",
    icon: Bone,
    copy: "Joints, bone, and mobility with a rehabilitation plan after each visit.",
    to: "/doctors",
  },
];

export const NEWS = [
  {
    id: "n1",
    date: "4 Sep 2026",
    title: "Weekend paediatric clinic hours extended",
    copy: "Saturday morning slots are open for children who cannot attend a weekday list.",
    image: "/imagery/corridor.jpg",
    to: "/help",
  },
  {
    id: "n2",
    date: "28 Aug 2026",
    title: "How to settle a bill by MoMo or GCB",
    copy: "Merchant CB-RIDGE-001 and GCB 1011130022847 — a numbered receipt follows every payment.",
    image: "/imagery/pharmacy.jpg",
    to: "/tariff",
  },
  {
    id: "n3",
    date: "12 Aug 2026",
    title: "Teleconsult follow-up after a campus visit",
    copy: "Review labs and change a plan without a second trip to Ridge.",
    image: "/imagery/teleconsult.jpg",
    to: "/services",
  },
];

export const HEALTH_TOPICS = [
  {
    id: "visits",
    cat: "Visits",
    title: "Preparing for a clinic or teleconsult",
    copy: "Bring a valid ID, any referral, and a list of medicines you already take. For video, test your camera ten minutes early.",
    image: "/imagery/clinic.jpg",
  },
  {
    id: "pharmacy",
    cat: "Pharmacy",
    title: "Collecting a prescription at Ridge",
    copy: "Hospital pickup orders appear on the pharmacy queue. You will be notified when the pack is ready.",
    image: "/imagery/pharmacy.jpg",
  },
  {
    id: "bills",
    cat: "Accounts",
    title: "Understanding the hospital tariff",
    copy: "Every consult, admission, lab, and medicine has a published fee. Pay by MoMo, GCB, NHIS, or cash for a numbered receipt.",
    image: "/imagery/records.jpg",
  },
  {
    id: "wards",
    cat: "Admissions",
    title: "Requesting a ward before you travel",
    copy: "Choose a ward and room type in the portal. Visiting hours are 10:00–11:00 and 16:00–18:00 daily.",
    image: "/imagery/wards.jpg",
  },
  {
    id: "heart",
    cat: "Cardiology",
    title: "Blood pressure follow-up",
    copy: "Bring home readings if you have them. The consultant files the plan on the same record as your last visit.",
    image: "/imagery/clinic.jpg",
  },
  {
    id: "child",
    cat: "Paediatrics",
    title: "Bringing a child to clinic",
    copy: "A parent or guardian must attend. Growth, vaccines, and school notes stay on the child’s file.",
    image: "/imagery/corridor.jpg",
  },
];

export const WHY_RIDGE = [
  { title: "Named consultants", copy: "You book a person on the Ridge directory, not a generic slot." },
  { title: "One clinical file", copy: "Visits, labs, medicines, and receipts share a medical record number." },
  { title: "Published tariff", copy: "Fees are on the public tariff before you confirm a visit." },
  { title: "Campus and video", copy: "The same consultant can see you at Ridge or on a secure teleconsult." },
];

export const PATIENT_FAQS = [
  { q: "Do I need an account to book?", a: "Yes. Booking writes to a patient file. Register first, or sign in if you already have an MRN." },
  { q: "Can I walk in?", a: "Walk-ins register at the Ridge front desk. A booked list is faster for specialty clinics." },
  { q: "How do I pay?", a: "MTN / Telecel / AirtelTigo MoMo to merchant CB-RIDGE-001, GCB 1011130022847, NHIS, or cash at the cashier." },
  { q: "Is this an emergency department?", a: `For a life-threatening emergency call ${HOSPITAL.emergency}. CareBridge is for scheduled care.` },
];
