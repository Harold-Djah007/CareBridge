import { test, expect } from "@playwright/test";

const routes = {
  patient: ["/home", "/care", "/appointments", "/messages", "/video", "/wards", "/alerts", "/settings", "/support", "/guide", "/records", "/pay", "/prescriptions", "/billing/tariff"],
  doctor: ["/home", "/care", "/appointments", "/messages", "/video", "/wards", "/settings", "/support", "/guide", "/records", "/records/p1", "/orders", "/prescriptions", "/billing/tariff"],
  nurse: ["/home", "/messages", "/settings", "/support", "/guide", "/orders", "/pharmacy-stock", "/billing/tariff"],
  admin: ["/admin", "/admin/users", "/admin/appointments", "/admin/hospital", "/admin/reports", "/admin/cases", "/admin/patient-experience", "/orders", "/pay", "/alerts", "/settings", "/support", "/messages", "/guide", "/billing/tariff", "/pharmacy-stock", "/records/p1"],
};
const screens = [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 },
  { width: 1440, height: 900 }, { width: 844, height: 390 },
  { width: 1280, height: 800 },
];
let sequence = 0;
async function signIn(page, request, role) {
  const response = await request.post("http://127.0.0.1:5000/api/login", {
    headers: { "x-forwarded-for": `127.2.1.${1 + sequence++}` },
    data: { email: `${role}@carebridge.test`, password: `${role}123`, expectedRole: role },
  });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.goto("/login");
  // Finish bootstrap before injecting the next role's session. Otherwise WebKit
  // can race the login redirect against the first workspace navigation.
  await page.waitForLoadState("networkidle");
  await page.evaluate(({ user, token }) => {
    localStorage.setItem("carebridge-user", JSON.stringify(user));
    localStorage.setItem("carebridge-token", token);
    localStorage.setItem("carebridge-appearance", JSON.stringify({ theme: "pearl", motion: "reduced", density: "comfortable", nav: "floating" }));
  }, session);
}

async function checkPage(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#cbv6-main")).toBeVisible();
  // Document overflow alone misses controls clipped by an overflow:hidden ancestor.
  const state = await page.evaluate(() => {
    const main = document.querySelector("#cbv6-main");
    const clipped = [];
    for (const element of main.querySelectorAll("h1,h2,h3,button,input,select,textarea,[class*='toolbar'],[class*='tabs'],[class*='stats'],[class*='hero']")) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(element).visibility === "hidden") continue;
      let scrollable = false;
      for (let parent = element.parentElement; parent && parent !== main; parent = parent.parentElement) {
        if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth + 2) scrollable = true;
      }
      if (!scrollable && (rect.left < -2 || rect.right > innerWidth + 2)) clipped.push(`${element.tagName} ${element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40)}`);
    }
    return { overflow: document.documentElement.scrollWidth - innerWidth, clipped };
  });
  expect(state.overflow, route).toBeLessThanOrEqual(2);
  expect(state.clipped, `${route}: controls must fit or belong to an intentional horizontal scroller`).toEqual([]);
  if (page.viewportSize().width <= 980) {
    await expect(page.locator(".cbv6-mobile-nav")).toBeVisible();
    await expect(page.locator(".cbv6-patient-dock")).not.toBeVisible();
  }
  if (route === "/pharmacy-stock") {
    const row = page.locator(".px-stock-row").first();
    await expect(row.getByRole("spinbutton", { name: /^Quantity / })).toBeVisible();
    await expect(row.getByRole("checkbox", { name: /^NHIS eligibility / })).toBeVisible();
  }
}

for (const screen of screens) {
  test(`all four portals fit ${screen.width}x${screen.height}`, async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium" && !(testInfo.project.name === "mobile-webkit" && screen.width <= 390));
    test.setTimeout(180_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize(screen);
    for (const [role, pages] of Object.entries(routes)) {
      await signIn(page, request, role);
      for (const route of pages) await checkPage(page, route);
    }
    expect(errors, "Portal pages must render without browser crashes").toEqual([]);
  });
}

const dialogs = [
  { role: "patient", route: "/appointments", open: "Book care", close: "Close booking", submit: "Confirm appointment" },
  { role: "doctor", route: "/orders", open: "New order", close: "Close new order", submit: "Sign & place order" },
  { role: "nurse", route: "/pharmacy-stock", open: "Add medicine", close: "Close add medicine", submit: "Add to inventory" },
  { role: "admin", route: "/admin/users", open: "Add person", close: "Close identity editor", submit: "Create identity" },
];
test("settings sections fit small phones and tablet sidebars", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(120_000);
  for (const width of [320, 1024]) {
    await page.setViewportSize({ width, height: 768 });
    for (const role of Object.keys(routes)) {
      await signIn(page, request, role);
      for (const tab of ["experience", "security", "notifications", ...(role === "patient" ? ["pay"] : [])]) {
        await checkPage(page, `/settings?tab=${tab}`);
      }
    }
  }
});
test("inventory retains every editable field across device breakpoints", async ({ page, request }, testInfo) => {
  test.skip(!["desktop-chromium", "mobile-webkit"].includes(testInfo.project.name));
  test.setTimeout(60_000);
  await signIn(page, request, "nurse");
  for (const screen of screens) {
    await page.setViewportSize(screen);
    await checkPage(page, "/pharmacy-stock");
    const row = page.locator(".px-stock-row").first();
    for (const name of [/^Medicine name /, /^Category /, /^Price /, /^Quantity /, /^NHIS eligibility /]) {
      await expect(row.getByLabel(name)).toBeVisible();
    }
  }
});
test("clinic encounter controls fit every device breakpoint", async ({ page, request }, testInfo) => {
  test.skip(!["desktop-chromium", "mobile-webkit"].includes(testInfo.project.name));
  test.setTimeout(60_000);
  await signIn(page, request, "admin");
  for (const screen of screens) {
    await page.setViewportSize(screen);
    await checkPage(page, "/admin/appointments");
    await expect(page.locator(".px-clinic-row").first()).toBeVisible();
  }
});
test("populated documents and case details fit phones, tablets and laptops", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(120_000);
  const patient = { name: "Sample Patient With A Longer Name", mrn: "CB-DEMO-104829", email: "fictional.patient@carebridge.test" };
  const payment = { id: "layout-payment", receiptNo: "CB-DEMO-2026-000001", reference: "CB-DEMO-REFERENCE-000001", amount: 1234, status: "paid", method: "cash", createdAt: "2026-10-07T10:00:00Z" };
  await page.route("**/api/receipts/layout-payment", route => route.fulfill({ json: { patient, payment, invoice: { method: "cash" }, hospital: {}, lines: [{ name: "Sample consultation and laboratory service", qty: 2, lineTotal: 1234 }] } }));
  await page.route("**/api/finance/payments/layout-payment/status**", route => route.fulfill({ json: { payment } }));
  await page.route("**/api/prescriptions/layout-prescription", route => route.fulfill({ json: { id: "layout-prescription", date: "2026-10-07", patient, doctor: { name: "Sample Clinician With A Longer Name", specialty: "General medicine" }, items: [{ drug: "Sample medicine with a longer descriptive name", qty: 30, sig: "Take as directed by the sample clinician for this demonstration." }], notes: "Fictional data for responsive document testing." } }));
  await page.route("**/api/cases/layout-case", route => route.fulfill({ json: { id: "layout-case", caseName: "Sample patient follow-up and care coordination", externalId: "CB-DEMO-CASE-000001", typeLabel: "Care coordination", ownerName: "Sample Operations User", status: "open", stage: "follow_up", workflow: ["registration", "follow_up", "closed"], properties: { patient: patient.name, email: patient.email }, events: [{ id: "sample-event", form: "Registration", actorName: "Sample operator", at: "2026-10-07T10:00:00Z", detail: "A fictional case for layout verification." }] } }));
  for (const width of [320, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await signIn(page, request, "patient");
    for (const route of ["/receipts/layout-payment", "/payments/layout-payment", "/prescriptions/layout-prescription"]) {
      await checkPage(page, route);
      await expect(page.locator(".px-receipt-document,.px-payment-sheet,.rx-document-sheet")).toBeVisible();
    }
    await signIn(page, request, "admin");
    await checkPage(page, "/admin/cases/layout-case");
    await expect(page.locator(".px-case-followup")).toBeVisible();
  }
});
for (const screen of [screens[0], screens[5]]) {
  test(`portal dialogs remain usable at ${screen.width}x${screen.height}`, async ({ page, request }, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-webkit"].includes(testInfo.project.name));
    test.setTimeout(120_000);
    await page.setViewportSize(screen);
    for (const item of dialogs) {
      await signIn(page, request, item.role);
      await checkPage(page, item.route);
      await page.getByRole("button", { name: item.open, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(screen.width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(screen.height + 1);
      for (const name of [item.close, item.submit]) {
        const control = dialog.getByRole("button", { name, exact: true });
        await control.scrollIntoViewIfNeeded();
        const rect = await control.boundingBox();
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(screen.height);
        expect(await control.evaluate(element => {
          const r = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), `${item.role} ${name} must not be covered`).toBeTruthy();
      }
      await dialog.getByRole("button", { name: item.close, exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}
