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
await page.getByRole("button", { name: "Começar revisão" }).click();
await page.getByText("Qual era o principal objetivo da criação das Capitanias", { exact: false }).waitFor();
if (await page.getByRole("button", { name: "Biblioteca", exact: true }).count()) {
  throw new Error("Focus mode did not hide the application sidebar.");
}

await page.getByText("Abolir o trabalho escravizado", { exact: false }).click();
await page.getByText("Quase lá!").waitFor();
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByText("Quem foi o primeiro governador-geral", { exact: false }).waitFor();
await page.getByRole("button", { name: "Sair da revisão" }).click();
await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
await page.getByText("Organização do conhecimento").waitFor();

console.log("UI validation passed: setup -> persisted review -> answer lock -> exit -> library");
await browser.close();
