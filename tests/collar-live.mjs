import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Collares", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "SH-COLLAR-001" });
  await row.getByText("Sin señal GPS", { exact: true }).waitFor({ timeout: 15_000 });
  await row.getByRole("button", { name: "Desactivar" }).click();
  await row.getByText("Desactivado", { exact: true }).waitFor();
  await row.getByRole("button", { name: "Activar" }).click();
  await row.getByText("Sin señal GPS", { exact: true }).waitFor();

  const current = new Date().toISOString();
  let mock = {
    device_id: "SH-COLLAR-001", receiver_connected: true, transmitter_connected: true,
    receiver_radio_ready: true, transmitter_radio_ready: true,
    last_tx_at: current, received_at: current, signal: "no_fix",
  };
  await page.route("http://127.0.0.1:8765/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "http://127.0.0.1:5173" },
    body: JSON.stringify(mock),
  }));
  mock = { ...mock, received_at: null, signal: "waiting" };
  await row.getByText("Sin señal LoRa", { exact: true }).waitFor({ timeout: 6_000 });
  mock = { ...mock, transmitter_connected: false };
  await row.getByText("Desconectado", { exact: true }).waitFor({ timeout: 6_000 });
  mock = { ...mock, transmitter_connected: true, receiver_connected: false };
  await row.getByText("Receptor desconectado", { exact: true }).waitFor({ timeout: 6_000 });
  await page.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  await page.locator(".receiver-status").getByText("Receptor desconectado").waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS: LoRa real NO_FIX, desactivación, cambios en vivo y estado del mapa");
} finally {
  await browser.close();
}
