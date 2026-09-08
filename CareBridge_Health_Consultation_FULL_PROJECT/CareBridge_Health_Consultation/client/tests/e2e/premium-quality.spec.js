import { test, expect } from "@playwright/test";

const ACCOUNTS = {
  patient: { portal: "Patient", email: "patient@carebridge.test", password: "patient123", home: "/home" },
  doctor: { portal: "Clinician", email: "doctor@carebridge.test", password: "doctor123", home: "/home" },
  nurse: { portal: "Nurse", email: "nurse@carebridge.test", password: "nurse123", home: "/home" },
  admin: { portal: "Operations", email: "admin@carebridge.test", password: "admin123", home: "/admin" },
};

const ROUTES = {
  patient: ["/home", "/appointments", "/records", "/messages", "/wards", "/pay", "/settings"],
  doctor: ["/home", "/appointments", "/records", "/orders", "/messages", "/settings"],
  nurse: ["/home", "/orders", "/pharmacy-stock", "/messages", "/settings"],
  admin: ["/admin", "/admin/hospital", "/admin/appointments", "/admin/users", "/admin/patient-experience", "/orders", "/admin/reports", "/settings"],
};

async function directLogin(page, request, role, projectName) {
  const account = ACCOUNTS[role];
  const lastOctet = 20 + Object.keys(ACCOUNTS).indexOf(role) + (projectName.includes("mobile") ? 20 : 0);
  const response = await request.post("http://127.0.0.1:5000/api/login", {
    headers: { "x-forwarded-for": `127.0.0.${lastOctet}` },
    data: { email: account.email, password: account.password, expectedRole: role },
  });
  expect(response.ok(), `${role} API login failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  const session = await response.json();
  expect(session.token).toBeTruthy();
  expect(session.user?.role).toBe(role);

  await page.goto("/login");
  await page.evaluate(({ user, token }) => {
    localStorage.setItem("carebridge-user", JSON.stringify(user));
    localStorage.setItem("carebridge-token", token);
  }, { user: session.user, token: session.token });
  await page.goto(account.home);
  await expect(page.locator("#cbv6-main")).toBeVisible();
}

async function waitForRoute(page) {
  await expect(page.locator("#cbv6-main")).toBeVisible();
  await page.locator(".cbv6-route-loading").waitFor({ state: "hidden", timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(120);
}

async function expectViewportQuality(page, route) {
  await page.goto(route);
  await waitForRoute(page);
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    mainVisible: Boolean(document.querySelector("#cbv6-main")),
  }));
  expect(state.mainVisible).toBeTruthy();
  expect(state.overflow, `${route} horizontally overflows by ${state.overflow}px`).toBeLessThanOrEqual(2);
}

test("login UI establishes a secure patient session", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Patient" }).click();
  await page.getByLabel("Email used at registration").fill(ACCOUNTS.patient.email);
  await page.getByLabel("Password").fill(ACCOUNTS.patient.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator("#cbv6-main")).toBeVisible();
  await expect(page.getByRole("link", { name: "Home", exact: true }).first()).toBeVisible();
});

test("critical role workspaces render without browser crashes or viewport overflow", async ({ page, request }, testInfo) => {
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  for (const role of Object.keys(ACCOUNTS)) {
    await directLogin(page, request, role, testInfo.project.name);
    for (const route of ROUTES[role]) await expectViewportQuality(page, route);
    await page.evaluate(() => {
      localStorage.removeItem("carebridge-user");
      localStorage.removeItem("carebridge-token");
    });
  }

  expect(pageErrors, `Unhandled browser errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `HTTP 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});

test("desktop shell keyboard, command palette and notification reader remain accessible", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Keyboard shell audit runs on desktop Chromium.");
  await directLogin(page, request, "patient", testInfo.project.name);

  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#cbv6-main")).toBeFocused();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "CareBridge command palette" });
  await expect(palette).toBeVisible();
  await expect(palette.locator("input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  await page.getByRole("button", { name: "Notifications" }).click();
  const feed = page.locator(".cbv6-notice-panel");
  await expect(feed).toBeVisible();
  const firstNotice = feed.locator(".cbv6-notice-item").first();
  await expect(firstNotice).toBeVisible();
  await firstNotice.click();

  const reader = page.locator(".cb-notification-reader");
  await expect(reader).toBeVisible();
  await expect(reader.locator(".cb-notification-reader-close")).toBeFocused();
  const layers = await page.evaluate(() => ({
    overlay: Number.parseInt(getComputedStyle(document.querySelector(".cb-notification-portal")).zIndex || "0", 10),
    topbar: Number.parseInt(getComputedStyle(document.querySelector(".cbv6-topbar")).zIndex || "0", 10),
    bodyOverflow: document.body.style.overflow,
  }));
  expect(layers.overlay).toBeGreaterThan(layers.topbar);
  expect(layers.bodyOverflow).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(reader).toBeHidden();
});
