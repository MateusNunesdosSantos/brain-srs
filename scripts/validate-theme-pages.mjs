import { chromium } from "playwright-core";
import { loginProAccount, origin } from "./test-helpers.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await loginProAccount(context.request);
const page = await context.newPage();

for (const route of ["/", "/biblioteca", "/estatisticas", "/vulnerabilidades", "/simulado"]) {
  await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
  if (await page.locator("h1").count() !== 1) throw new Error(`Missing title on ${route}`);
}

console.log("Theme page validation passed: dashboard, library, stats, vulnerabilities, simulation");
await browser.close();
