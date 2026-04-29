import { chromium } from "playwright";
import { ensureSmokeUser } from "./smoke-auth.mjs";

const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";

function isNearWhite(rgb) {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!match) {
    return false;
  }

  const [, r, g, b] = match.map(Number);
  return r > 235 && g > 235 && b > 235;
}

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

async function collectBackground(page) {
  return page.evaluate(() => ({
    htmlDark: document.documentElement.classList.contains("dark"),
    htmlTheme: document.documentElement.dataset.theme ?? null,
    htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    mainBackground: getComputedStyle(
      document.querySelector("#main-content") ?? document.body
    ).backgroundColor,
  }));
}

async function navigateAndSample(page, linkName, expectedText) {
  const samples = [];
  samples.push(await collectBackground(page));
  await page.getByRole("link", { name: linkName, exact: true }).click();

  for (let index = 0; index < 8; index += 1) {
    await page.waitForTimeout(75);
    samples.push(await collectBackground(page));
  }

  await page.getByRole("heading", { name: expectedText, exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  samples.push(await collectBackground(page));

  return {
    linkName,
    expectedText,
    samples,
    hasLightFlash: samples.some(
      (sample) =>
        !sample.htmlDark ||
        isNearWhite(sample.htmlBackground) ||
        isNearWhite(sample.bodyBackground)
    ),
  };
}

const credentials = await ensureSmokeUser();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];

await page.addInitScript(() => {
  window.localStorage.setItem("fortexa-theme", "dark");
});

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

try {
  await signIn(page, credentials);
  const initial = await collectBackground(page);
  const transitions = [
    await navigateAndSample(page, "Assets", "Asset Management"),
    await navigateAndSample(page, "Vulnerabilities", "Vulnerability Management"),
    await navigateAndSample(page, "Remediation", "Remediation"),
    await navigateAndSample(page, "Reports", "Reports"),
    await navigateAndSample(page, "Settings", "Settings"),
    await navigateAndSample(page, "Dashboard", "Security Dashboard"),
  ];
  const failed =
    !initial.htmlDark ||
    isNearWhite(initial.bodyBackground) ||
    transitions.some((transition) => transition.hasLightFlash) ||
    consoleErrors.some((error) => /hydration|did not match/i.test(error));

  console.log(
    JSON.stringify(
      {
        result: failed ? "failed" : "passed",
        baseUrl,
        initial,
        transitions: transitions.map((transition) => ({
          linkName: transition.linkName,
          hasLightFlash: transition.hasLightFlash,
          sampleCount: transition.samples.length,
        })),
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
