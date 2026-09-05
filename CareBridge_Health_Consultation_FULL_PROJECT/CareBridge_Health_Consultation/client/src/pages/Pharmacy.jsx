import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function Pharmacy() {
  const { search, hash } = useLocation();
  return <Navigate to={`/pay${search}${hash}`} replace />;
}
