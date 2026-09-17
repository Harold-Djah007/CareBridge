const QUERY_IDENTITY_ROUTES = new Set([
  "/api/contacts",
  "/api/appointments",
  "/api/ward-bookings",
  "/api/badges",
]);

const deny = (res, status, message) => res.status(status).json({ message });

function requireSignedIn(req, res) {
  if (req.authUser) return true;
  deny(res, 401, "Your session has expired. Please sign in again.");
  return false;
}

function sameIdentityQuery(req) {
  return String(req.query?.userId || "") === String(req.authUser.id)
    && String(req.query?.role || "") === String(req.authUser.role);
}

function enforceQueryIdentity(req, res) {
  if (!requireSignedIn(req, res)) return false;
  if (req.authUser.role === "admin") return true;
  if (!sameIdentityQuery(req)) {
    deny(res, 403, "CareBridge derives account scope from your authenticated session.");
    return false;
  }
  return true;
}

function enforcePatientOwnership(req, res) {
  if (!requireSignedIn(req, res)) return false;
  if (!["patient", "doctor", "admin"].includes(req.authUser.role)) {
    deny(res, 403, "You do not have permission to create this care request.");
    return false;
  }
  if (req.authUser.role === "patient" && String(req.body?.patientId || "") !== String(req.authUser.id)) {
    deny(res, 403, "Patients can only create care requests on their own account.");
    return false;
  }
  return true;
}

function enforceSelfPath(req, res, userId) {
  if (!requireSignedIn(req, res)) return false;
  if (req.authUser.role === "admin" || String(userId) === String(req.authUser.id)) return true;
  deny(res, 403, "You cannot access another account's private activity.");
  return false;
}

/**
 * Mount immediately after CareBridge resolves bearer-session identity and before
 * legacy route declarations. This keeps authorization based on req.authUser even
 * where older handlers still accept userId/role parameters for filtering.
 */
export function installIdentityBoundary(app) {
  app.use((req, res, next) => {
    const path = String(req.path || "").split("?")[0];

    if (req.method === "GET" && QUERY_IDENTITY_ROUTES.has(path)) {
      if (!enforceQueryIdentity(req, res)) return;
      return next();
    }

    if (req.method === "POST" && (path === "/api/appointments" || path === "/api/ward-bookings")) {
      if (!enforcePatientOwnership(req, res)) return;
      return next();
    }

    if (path === "/api/admin/emails") {
      if (!requireSignedIn(req, res)) return;
      if (req.authUser.role !== "admin") return deny(res, 403, "Only hospital operations can read the delivery log.");
      return next();
    }

    if (req.method === "POST" && path === "/api/emails/test") {
      if (!requireSignedIn(req, res)) return;
      const target = String(req.body?.userId || "");
      if (req.authUser.role !== "admin" && target !== String(req.authUser.id)) {
        return deny(res, 403, "You can only send a test alert to your own account.");
      }
      return next();
    }

    const notificationMatch = path.match(/^\/api\/notifications\/([^/]+)(?:\/read)?$/);
    if (notificationMatch) {
      if (!enforceSelfPath(req, res, decodeURIComponent(notificationMatch[1]))) return;
      return next();
    }

    const emailMatch = req.method === "GET" && path.match(/^\/api\/emails\/([^/]+)$/);
    if (emailMatch) {
      if (!enforceSelfPath(req, res, decodeURIComponent(emailMatch[1]))) return;
      return next();
    }

    return next();
  });
}
