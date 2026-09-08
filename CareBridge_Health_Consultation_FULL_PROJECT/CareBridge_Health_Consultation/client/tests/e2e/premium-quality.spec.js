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
  const state = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          classes: String(element.className || "").trim().replace(/\s+/g, ".").slice(0, 140),
          left: Number(rect.left.toFixed(1)),
          right: Number(rect.right.toFixed(1)),
          width: Number(rect.width.toFixed(1)),
          position: style.position,
          overflowX: style.overflowX,
        };
      })
      .filter((row) => row.width > 0 && (row.right > window.innerWidth + 2 || row.left < -2))
      .slice(0, 12);
    return {
      overflow,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      mainVisible: Boolean(document.querySelector("#cbv6-main")),
      offenders,
    };
  });
  expect(state.mainVisible).toBeTruthy();
  expect(
    state.overflow,
    `${route} horizontally overflows by ${state.overflow}px\nOffenders: ${JSON.stringify(state.offenders, null, 2)}`
  ).toBeLessThanOrEqual(2);
}

async function semanticIssues(page) {
  return page.evaluate(() => {
    const issues = [];
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const referenceText = (element, attribute) => String(element.getAttribute(attribute) || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .join(" ")
      .trim();
    const labelText = (element) => [...(element.labels || [])].map((label) => label.textContent?.trim() || "").join(" ").trim();
    const nameOf = (element) => [
      element.getAttribute("aria-label"),
      referenceText(element, "aria-labelledby"),
      labelText(element),
      element.textContent,
      element.getAttribute("title"),
    ].map((value) => String(value || "").trim()).find(Boolean) || "";
    const describe = (element) => {
      const id = element.id ? `#${element.id}` : "";
      const classes = String(element.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 3).map((value) => `.${value}`).join("");
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    };

    for (const element of document.querySelectorAll("button, a[href]")) {
      if (!visible(element)) continue;
      if (!nameOf(element)) issues.push(`${describe(element)} has no accessible name`);
    }

    for (const element of document.querySelectorAll("input, select, textarea")) {
      if (!visible(element) || element.type === "hidden") continue;
      const hasName = Boolean(element.getAttribute("aria-label") || referenceText(element, "aria-labelledby") || labelText(element));
      if (!hasName) issues.push(`${describe(element)} is a visible form control without a label`);
    }

    for (const image of document.querySelectorAll("img")) {
      if (visible(image) && !image.hasAttribute("alt")) issues.push(`${describe(image)} has no alt attribute`);
    }

    for (const dialog of document.querySelectorAll('[role="dialog"], dialog')) {
      if (!visible(dialog)) continue;
      if (!dialog.getAttribute("aria-label") && !referenceText(dialog, "aria-labelledby")) {
        issues.push(`${describe(dialog)} has no accessible dialog name`);
      }
    }

    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    duplicates.slice(0, 10).forEach((id) => issues.push(`duplicate id #${id}`));
    return issues.slice(0, 30);
  });
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

test("critical desktop routes meet semantic accessibility basics", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Semantic audit runs once on desktop Chromium.");
  const failures = [];
  for (const role of Object.keys(ACCOUNTS)) {
    await directLogin(page, request, role, testInfo.project.name);
    for (const route of ROUTES[role]) {
      await page.goto(route);
      await waitForRoute(page);
      const issues = await semanticIssues(page);
      if (issues.length) failures.push(`${role} ${route}:\n  - ${issues.join("\n  - ")}`);
    }
    await page.evaluate(() => {
      localStorage.removeItem("carebridge-user");
      localStorage.removeItem("carebridge-token");
    });
  }
  expect(failures, `Semantic accessibility regressions:\n${failures.join("\n")}`).toEqual([]);
});

test("desktop shell keyboard, command palette and notification reader remain accessible", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Keyboard shell audit runs on desktop Chromium.");
  await directLogin(page, request, "patient", testInfo.project.name);

  const skipLink = page.locator(".skip-link");
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
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
