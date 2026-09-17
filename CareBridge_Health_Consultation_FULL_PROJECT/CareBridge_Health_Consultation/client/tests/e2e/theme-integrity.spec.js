import { test, expect } from "@playwright/test";

const ACCOUNTS = {
  patient: { email: "patient@carebridge.test", password: "patient123", home: "/home" },
  doctor: { email: "doctor@carebridge.test", password: "doctor123", home: "/home" },
  nurse: { email: "nurse@carebridge.test", password: "nurse123", home: "/home" },
  admin: { email: "admin@carebridge.test", password: "admin123", home: "/admin" },
};

const PUBLIC_ROUTES = [
  "/", "/about", "/services", "/patients", "/doctors", "/book",
  "/contact", "/login", "/register", "/help", "/privacy", "/tariff",
];

const ROLE_ROUTES = {
  patient: [
    "/home", "/care", "/appointments", "/messages", "/video", "/wards",
    "/alerts", "/settings", "/support", "/guide", "/records", "/pay",
    "/prescriptions", "/billing/tariff",
  ],
  doctor: [
    "/home", "/care", "/appointments", "/messages", "/video", "/wards",
    "/settings", "/support", "/guide", "/records", "/records/p1", "/orders",
    "/prescriptions", "/billing/tariff",
  ],
  nurse: [
    "/home", "/messages", "/settings", "/support", "/guide", "/orders",
    "/pharmacy-stock", "/billing/tariff",
  ],
  admin: [
    "/admin", "/admin/users", "/admin/appointments", "/admin/hospital",
    "/admin/reports", "/admin/cases", "/admin/patient-experience", "/orders",
    "/pay", "/alerts", "/settings", "/support", "/messages", "/guide",
    "/billing/tariff", "/pharmacy-stock", "/records/p1",
  ],
};

async function waitForApp(page) {
  await expect(page.locator("#cbv6-main")).toBeVisible();
  await page.locator(".cbv6-route-loading").waitFor({ state: "hidden", timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(160);
}

async function login(page, request, role, projectName) {
  const account = ACCOUNTS[role];
  const roleOffset = Object.keys(ACCOUNTS).indexOf(role);
  const mobileOffset = projectName.includes("mobile") ? 40 : 0;
  const response = await request.post("http://127.0.0.1:5000/api/login", {
    headers: { "x-forwarded-for": `127.0.1.${30 + roleOffset + mobileOffset}` },
    data: { email: account.email, password: account.password, expectedRole: role },
  });
  expect(response.ok(), `${role} login failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  const session = await response.json();

  await page.goto("/login");
  await page.evaluate(({ user, token }) => {
    localStorage.setItem("carebridge-user", JSON.stringify(user));
    localStorage.setItem("carebridge-token", token);
    localStorage.setItem("carebridge-appearance", JSON.stringify({
      theme: "midnight",
      density: "comfortable",
      motion: "reduced",
      nav: "floating",
    }));
  }, { user: session.user, token: session.token });
  await page.goto(account.home);
  await waitForApp(page);
  await expect(page.locator(".cbv6-theme-midnight")).toBeVisible();
}

async function severeContrastIssues(page) {
  return page.evaluate(() => {
    const candidates = "h1,h2,h3,h4,h5,h6,p,small,strong,label,a,button,td,th,code,dt,dd,li,span";

    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.08 && rect.width > 0 && rect.height > 0;
    };

    const hasOwnText = (element) => [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && String(node.textContent || "").trim()
    );

    const rgba = (value) => {
      const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
    };

    const composite = (front, back) => {
      const a = front.a + back.a * (1 - front.a);
      if (!a) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a,
        a,
      };
    };

    const luminance = ({ r, g, b }) => {
      const linear = [r, g, b].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };

    const ratio = (a, b) => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    const backgroundFor = (element) => {
      const layers = [];
      let node = element;
      while (node) {
        const style = getComputedStyle(node);
        const bg = rgba(style.backgroundColor);
        if (bg && bg.a > 0) layers.push(bg);
        if (style.backgroundImage && style.backgroundImage !== "none" && (!bg || bg.a < 0.95)) return null;
        if (bg && bg.a >= 0.98) break;
        node = node.parentElement;
      }
      let result = rgba(getComputedStyle(document.body).backgroundColor) || { r: 10, g: 26, b: 37, a: 1 };
      if (result.a < 0.98) result = { r: 10, g: 26, b: 37, a: 1 };
      for (let index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
      return result;
    };

    const describe = (element) => {
      const id = element.id ? `#${element.id}` : "";
      const classes = String(element.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 3).map((item) => `.${item}`).join("");
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    };

    const issues = [];
    for (const element of document.querySelectorAll(candidates)) {
      if (!visible(element) || !hasOwnText(element)) continue;
      if (element.matches(":disabled,[aria-disabled='true']")) continue;
      const text = String(element.textContent || "").trim().replace(/\s+/g, " ");
      if (!text) continue;
      const foreground = rgba(getComputedStyle(element).color);
      const background = backgroundFor(element);
      if (!foreground || !background) continue;
      const contrast = ratio(foreground, background);
      // 2.5 is intentionally conservative: this catches the near-white-on-white
      // regressions seen in Midnight without turning decorative muted copy into
      // a brittle visual-snapshot test.
      if (contrast < 2.5) {
        issues.push(`${describe(element)} contrast ${contrast.toFixed(2)}:1 — ${text.slice(0, 80)}`);
      }
      if (issues.length >= 20) break;
    }
    return issues;
  });
}

async function routeHealth(page, route) {
  await page.goto(route);
  await waitForApp(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${route} horizontally overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  return severeContrastIssues(page);
}

test("public CareBridge pages remain free of browser and server crashes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Full public-route sweep runs once on desktop Chromium.");
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
  }

  expect(pageErrors, `Public-page browser errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Public-page HTTP 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});

test("Midnight stays readable and stable across every authenticated role workspace", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Full Midnight route sweep runs once on desktop Chromium.");
  const pageErrors = [];
  const serverErrors = [];
  const contrastFailures = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  for (const role of Object.keys(ACCOUNTS)) {
    await login(page, request, role, testInfo.project.name);
    for (const route of ROLE_ROUTES[role]) {
      const issues = await routeHealth(page, route);
      if (issues.length) contrastFailures.push(`${role} ${route}:\n  - ${issues.join("\n  - ")}`);
    }
    await page.evaluate(() => {
      localStorage.removeItem("carebridge-user");
      localStorage.removeItem("carebridge-token");
      localStorage.removeItem("carebridge-appearance");
    });
  }

  expect(pageErrors, `Midnight browser errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Midnight HTTP 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
  expect(contrastFailures, `Severe Midnight contrast regressions:\n${contrastFailures.join("\n")}`).toEqual([]);
});
