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
  const session = await response.json();
  expect(session.token).toBeTruthy();
  expect(session.user?.role).toBe(role);
  return session;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test("support desk derives requester and actor identity only from the authenticated session", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Authorization abuse regression runs once.");

  const unauthenticated = await request.get(`${API}/tickets?role=admin`);
  expect(unauthenticated.status()).toBe(401);

  const patient = await login(request, "patient", 81);
  const admin = await login(request, "admin", 82);

  const baselineBadgesResponse = await request.get(`${API}/badges?userId=${patient.user.id}&role=patient`, {
    headers: auth(patient.token),
  });
  expect(baselineBadgesResponse.ok()).toBeTruthy();
  const baselineBadges = await baselineBadgesResponse.json();
  const baselineUnread = Number(baselineBadges.tickets || 0);

  const subject = `Identity boundary ${Date.now()}`;
  const createdResponse = await request.post(`${API}/tickets`, {
    headers: auth(patient.token),
    data: {
      userId: admin.user.id,
      category: "account",
      subject,
      body: "This ticket deliberately carries a spoofed userId in the test payload.",
    },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  expect(created.userId).toBe(patient.user.id);
  expect(created.userId).not.toBe(admin.user.id);

  const spoofedListResponse = await request.get(`${API}/tickets?userId=${admin.user.id}&role=admin`, {
    headers: auth(patient.token),
  });
  expect(spoofedListResponse.ok()).toBeTruthy();
  const spoofedList = await spoofedListResponse.json();
  expect(spoofedList.some((ticket) => ticket.id === created.id)).toBeTruthy();
  expect(spoofedList.every((ticket) => ticket.userId === patient.user.id)).toBeTruthy();

  const adminReplyResponse = await request.post(`${API}/tickets/${created.id}/replies`, {
    headers: auth(admin.token),
    data: { actorId: patient.user.id, body: "Operations reply from the authenticated admin." },
  });
  expect(adminReplyResponse.status()).toBe(201);
  const adminReply = await adminReplyResponse.json();
  const adminMessage = adminReply.replies.at(-1);
  expect(adminMessage.authorId).toBe(admin.user.id);
  expect(adminMessage.role).toBe("admin");

  const unreadResponse = await request.get(`${API}/badges?userId=${patient.user.id}&role=patient`, {
    headers: auth(patient.token),
  });
  expect(unreadResponse.ok()).toBeTruthy();
  const unread = await unreadResponse.json();
  expect(Number(unread.tickets || 0)).toBe(baselineUnread + 1);

  const openedResponse = await request.get(`${API}/tickets/${created.id}?userId=${admin.user.id}&role=admin`, {
    headers: auth(patient.token),
  });
  expect(openedResponse.ok()).toBeTruthy();

  const readResponse = await request.get(`${API}/badges?userId=${patient.user.id}&role=patient`, {
    headers: auth(patient.token),
  });
  expect(readResponse.ok()).toBeTruthy();
  const read = await readResponse.json();
  expect(Number(read.tickets || 0)).toBe(baselineUnread);

  const patientReplyResponse = await request.post(`${API}/tickets/${created.id}/replies`, {
    headers: auth(patient.token),
    data: { actorId: admin.user.id, body: "Requester reply carrying a spoofed admin actorId." },
  });
  expect(patientReplyResponse.status()).toBe(201);
  const patientReply = await patientReplyResponse.json();
  const patientMessage = patientReply.replies.at(-1);
  expect(patientMessage.authorId).toBe(patient.user.id);
  expect(patientMessage.role).toBe("patient");

  const spoofedStatus = await request.patch(`${API}/tickets/${created.id}`, {
    headers: auth(patient.token),
    data: { actorId: admin.user.id, status: "in_progress" },
  });
  expect(spoofedStatus.status()).toBe(403);

  const unauthenticatedReply = await request.post(`${API}/tickets/${created.id}/replies`, {
    data: { actorId: admin.user.id, body: "No session" },
  });
  expect(unauthenticatedReply.status()).toBe(401);
});
