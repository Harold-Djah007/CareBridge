import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:5000/api";
const ACCOUNTS = {
  patient: { email: "patient@carebridge.test", password: "patient123" },
  admin: { email: "admin@carebridge.test", password: "admin123" },
};

async function login(request, role, octet) {
  const response = await request.post(`${API}/login`, {
    headers: { "x-forwarded-for": `127.0.0.${octet}` },
    data: { ...ACCOUNTS[role], expectedRole: role },
  });
  expect(response.ok(), `${role} login failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test("authenticated account scope cannot be forged through query, path, or body identity", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Identity-boundary abuse regression runs once.");

  const patient = await login(request, "patient", 91);
  const admin = await login(request, "admin", 92);
  const patientHeaders = auth(patient.token);
  const adminHeaders = auth(admin.token);

  for (const path of [
    `/contacts?userId=${admin.user.id}&role=admin`,
    `/appointments?userId=${admin.user.id}&role=admin`,
    `/ward-bookings?userId=${admin.user.id}&role=admin`,
    `/badges?userId=${admin.user.id}&role=admin`,
  ]) {
    const response = await request.get(`${API}${path}`, { headers: patientHeaders });
    expect(response.status(), `forged identity unexpectedly reached ${path}`).toBe(403);
  }

  for (const path of [
    `/contacts?userId=${patient.user.id}&role=patient`,
    `/appointments?userId=${patient.user.id}&role=patient`,
    `/ward-bookings?userId=${patient.user.id}&role=patient`,
    `/badges?userId=${patient.user.id}&role=patient`,
  ]) {
    const response = await request.get(`${API}${path}`, { headers: patientHeaders });
    expect(response.ok(), `authenticated self-scope failed for ${path}: ${response.status()}`).toBeTruthy();
  }

  const missingIdentity = await request.get(`${API}/badges`, { headers: patientHeaders });
  expect(missingIdentity.status()).toBe(403);

  const forgedAppointment = await request.post(`${API}/appointments`, {
    headers: patientHeaders,
    data: { patientId: admin.user.id, doctorId: "d1", date: "2099-01-20", time: "10:00" },
  });
  expect(forgedAppointment.status()).toBe(403);

  const forgedWard = await request.post(`${API}/ward-bookings`, {
    headers: patientHeaders,
    data: { patientId: admin.user.id, ward: "Medical Ward", date: "2099-01-20", nights: 1 },
  });
  expect(forgedWard.status()).toBe(403);

  const unauthenticatedAdminMail = await request.get(`${API}/admin/emails`);
  expect(unauthenticatedAdminMail.status()).toBe(401);

  const patientAdminMail = await request.get(`${API}/admin/emails`, { headers: patientHeaders });
  expect(patientAdminMail.status()).toBe(403);

  const adminMail = await request.get(`${API}/admin/emails`, { headers: adminHeaders });
  expect(adminMail.ok()).toBeTruthy();

  const crossAccountEmail = await request.get(`${API}/emails/${admin.user.id}`, { headers: patientHeaders });
  expect(crossAccountEmail.status()).toBe(403);

  const crossAccountNotifications = await request.get(`${API}/notifications/${admin.user.id}`, { headers: patientHeaders });
  expect(crossAccountNotifications.status()).toBe(403);

  const forgedTestEmail = await request.post(`${API}/emails/test`, {
    headers: patientHeaders,
    data: { userId: admin.user.id },
  });
  expect(forgedTestEmail.status()).toBe(403);
});
