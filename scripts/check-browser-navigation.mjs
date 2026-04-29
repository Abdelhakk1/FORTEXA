import { chromium } from "playwright";
import { ensureSmokeUser } from "./smoke-auth.mjs";

const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";

async function signIn(page, credentials) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", credentials.email);
  await page.fill("#password", credentials.password);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 30_000 }),
    page.locator("form").getByRole("button", { name: /^sign in$/i }).click(),
  ]);
  await page.getByRole("heading", { name: "Security Dashboard", exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
}

async function assertClientNavigation(page, linkName, expectedText) {
  await page.evaluate(() => {
    window.__fortexaNavigationMarker = "client-navigation-marker";
  });

  const startedAt = Date.now();
  await page.getByRole("link", { name: linkName, exact: true }).click();
  await page.getByRole("heading", { name: expectedText, exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  const marker = await page.evaluate(() => window.__fortexaNavigationMarker);

  return {
    linkName,
    expectedText,
    ms: Date.now() - startedAt,
    preservedWindowState: marker === "client-navigation-marker",
  };
}

const credentials = await ensureSmokeUser();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

try {
  await signIn(page, credentials);
  const dashboardReloadStartedAt = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Security Dashboard", exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  const dashboardReloadMs = Date.now() - dashboardReloadStartedAt;
  const transitions = [
    await assertClientNavigation(page, "Assets", "Asset Management"),
    await assertClientNavigation(page, "Vulnerabilities", "Vulnerability Management"),
    await assertClientNavigation(page, "Remediation", "Remediation"),
    await assertClientNavigation(page, "Reports", "Reports"),
    await assertClientNavigation(page, "Settings", "Settings"),
    await assertClientNavigation(page, "Dashboard", "Security Dashboard"),
  ];
  const failedClientTransitions = transitions.filter(
    (transition) => !transition.preservedWindowState
  );
  const failed = failedClientTransitions.length > 0 || consoleErrors.length > 0;

  console.log(
    JSON.stringify(
      {
        result: failed ? "failed" : "passed",
        baseUrl,
        dashboardReloadMs,
        transitions,
        consoleErrors,
      },
      null,
      2
    )
  );
  process.exit(failed ? 1 : 0);
} finally {
  await browser.close();
}
