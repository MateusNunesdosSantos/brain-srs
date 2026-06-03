import { readFile } from "node:fs/promises";

export const origin = "http://127.0.0.1:3000";
export const exampleContent = JSON.parse(
  await readFile(new URL("../examples/historia-do-brasil.json", import.meta.url), "utf8"),
);

export async function action(request, payload) {
  const response = await request.post(`${origin}/api/actions`, { data: payload });
  if (!response.ok()) {
    throw new Error(`API action failed (${response.status()}): ${await response.text()}`);
  }
  return response.json();
}

export async function prepareBrowserAccount(request, { withContent = true } = {}) {
  const email = `browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const response = await request.post(`${origin}/api/auth/register`, {
    data: { name: "Teste Browser", email, password: "123456" },
  });
  if (!response.ok()) throw new Error(`Registration failed: ${response.status()}`);
  await request.post(`${origin}/api/auth/onboarding`);
  if (withContent) {
    await action(request, {
      type: "import",
      confirmReplace: true,
      content: exampleContent,
    });
  }
  return email;
}

export async function loginProAccount(request) {
  const response = await request.post(`${origin}/api/auth/login`, {
    data: { email: "mateusnunesmds@gmail.com", password: "123" },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
}
