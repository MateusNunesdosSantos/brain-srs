import { chromium } from "playwright-core";
import { origin, prepareBrowserAccount } from "./test-helpers.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await prepareBrowserAccount(context.request);
const page = await context.newPage();

await page.goto(`${origin}/revisar`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Todos os cadernos" }).click();
await page.getByRole("option", { name: "História" }).click();
await page.getByRole("button", { name: "Todas as matérias" }).click();
await page.getByRole("option", { name: "História do Brasil" }).click();
await page.getByRole("button", { name: "Começar revisão" }).click();
await page.getByText("Qual era o principal objetivo da criação das Capitanias", { exact: false }).waitFor();

console.log("Review filter validation passed: notebook -> subject -> persisted review session");
await browser.close();
