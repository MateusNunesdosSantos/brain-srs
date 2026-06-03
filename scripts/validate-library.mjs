import { chromium } from "playwright-core";
import { origin, prepareBrowserAccount } from "./test-helpers.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await prepareBrowserAccount(context.request, { withContent: false });
const page = await context.newPage();

await page.goto(`${origin}/biblioteca`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Novo caderno" }).click();
await page.getByPlaceholder("Ex: Direito, Medicina, Idiomas...").fill("Idiomas");
await page.getByPlaceholder("Descreva brevemente o conteúdo...").fill("Estudos de línguas.");
await page.getByRole("button", { name: "Criar" }).click();
await page.getByText("Idiomas", { exact: true }).waitFor();
await page.getByText("Este caderno ainda não possui matérias", { exact: false }).waitFor();

await page.getByRole("button", { name: "Nova matéria" }).click();
await page.getByPlaceholder("Ex: Anatomia, Direito Civil, Inglês...").fill("Inglês");
await page.getByPlaceholder("Descreva brevemente o conteúdo...").fill("Vocabulário e gramática.");
await page.getByRole("button", { name: "Criar" }).click();
await page.getByText("Inglês", { exact: true }).waitFor();

console.log("Library validation passed: new notebook -> empty guidance -> new subject");
await browser.close();
