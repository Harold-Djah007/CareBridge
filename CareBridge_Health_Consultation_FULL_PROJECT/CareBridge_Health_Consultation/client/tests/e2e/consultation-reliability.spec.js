import { test, expect } from "@playwright/test";

test("doctor can enter first; patient joins later and ending the call releases media", async ({ browser, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Fake-media WebRTC regression runs in Chromium.");
  test.setTimeout(90_000);
  const sessions = {};
  for (const [index, role] of ["patient", "doctor"].entries()) {
    const response = await request.post("http://127.0.0.1:5000/api/login", {
      headers: { "X-Forwarded-For": `127.0.0.${110 + index}` },
      data: { email: `${role}@carebridge.test`, password: `${role}123`, expectedRole: role },
    });
    expect(response.ok()).toBeTruthy();
    sessions[role] = await response.json();
  }
  const contexts = [];
  try {
    const pages = {};
    for (const role of ["doctor", "patient"]) {
      const context = await browser.newContext({ permissions: ["camera", "microphone"], baseURL: "http://127.0.0.1:5173" });
      contexts.push(context);
      await context.addInitScript(({ user, token }) => {
        localStorage.setItem("carebridge-user", JSON.stringify(user));
        localStorage.setItem("carebridge-token", token);
      }, sessions[role]);
      pages[role] = await context.newPage();
      const peer = role === "doctor" ? sessions.patient.user.id : sessions.doctor.user.id;
      await pages[role].goto(`/video?with=${peer}`);
      if (role === "patient") await pages[role].getByRole("checkbox").check();
      await pages[role].getByRole("button", { name: "Enter consultation" }).click();
      await expect(pages[role].getByRole("button", { name: "End consultation" })).toBeVisible();
    }
    await expect(pages.doctor.locator(".px-call-state")).toHaveText("Connected", { timeout: 20_000 });
    await expect(pages.patient.locator(".px-call-state")).toHaveText("Connected", { timeout: 20_000 });
    await pages.doctor.getByRole("button", { name: "Mute microphone" }).click();
    await expect(pages.doctor.getByRole("button", { name: "Unmute microphone" })).toBeVisible();

    await pages.doctor.evaluate(() => {
      const camera = document.querySelector(".px-local-video").srcObject;
      window.testCameraTracks = camera.getTracks();
      navigator.mediaDevices.getDisplayMedia = async () => {
        const display = new MediaStream([camera.getVideoTracks()[0].clone()]);
        window.testDisplayTracks = display.getTracks();
        return display;
      };
    });
    await pages.doctor.getByRole("button", { name: "Share screen" }).click();
    await expect(pages.doctor.getByRole("button", { name: "Stop screen sharing" })).toBeVisible();
    await pages.doctor.getByRole("button", { name: "Stop screen sharing" }).click();
    await expect(pages.doctor.getByRole("button", { name: "Share screen" })).toBeVisible();
    await expect.poll(() => pages.doctor.evaluate(() => window.testDisplayTracks.every((track) => track.readyState === "ended"))).toBeTruthy();
    await pages.patient.evaluate(() => { window.testCameraTracks = document.querySelector(".px-local-video").srcObject.getTracks(); });
    await pages.doctor.getByRole("button", { name: "End consultation" }).click();
    await expect(pages.patient.getByRole("button", { name: "Enter consultation" })).toBeVisible();
    await expect.poll(() => pages.patient.evaluate(() => window.testCameraTracks.every((track) => track.readyState === "ended"))).toBeTruthy();
    await expect.poll(() => pages.doctor.evaluate(() => window.testCameraTracks.every((track) => track.readyState === "ended") && document.querySelector(".px-local-video").srcObject === null)).toBeTruthy();
  } finally { await Promise.all(contexts.map((context) => context.close())); }
});
