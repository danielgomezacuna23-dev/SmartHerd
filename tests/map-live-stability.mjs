import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tile = readFileSync(new URL("./fixtures/tile.png", import.meta.url));
const browser = await chromium.launch({
  executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/(?:\.tile\.openstreetmap\.org|World_Imagery\/MapServer\/tile)/,
    (route) => route.fulfill({ status: 200, contentType: "image/png", body: tile }));
  let offline = false;
  let requests = 0;
  let position = [10.12, -84.13];
  await page.route("http://127.0.0.1:8765/status", (route) => {
    requests += 1;
    if (offline) return route.abort();
    const time = new Date().toISOString();
    return route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "http://127.0.0.1:5173" },
      body: JSON.stringify({
        device_id: "SH-COLLAR-001", transmitter_connected: true, receiver_connected: true,
        transmitter_radio_ready: true, receiver_radio_ready: true,
        last_tx_at: time, received_at: time, signal: "fix",
        latitude: position[0], longitude: position[1], rssi: -55, snr: 8,
      }),
    });
  });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  await page.locator(".receiver-status").getByText("GPS y LoRa activos").waitFor();
  await page.waitForFunction(() => document.querySelector(".farm-boundary") &&
    document.querySelector(".leaflet-overlay-pane .leaflet-interactive"));
  await page.waitForFunction(() => document.querySelector(".leaflet-overlay-pane .leaflet-interactive")?.getAttribute("d") !== "M0 0",
    {}, { timeout: 4000 });
  await page.evaluate(() => {
    window.__farmPath = document.querySelector(".farm-boundary");
    window.__collarPath = document.querySelector(".leaflet-overlay-pane .leaflet-interactive");
  });
  await page.waitForTimeout(6600);
  assert(requests >= 3, "El estado se consulta repetidamente");
  assert(await page.evaluate(() => window.__farmPath === document.querySelector(".farm-boundary") &&
    window.__collarPath === document.querySelector(".leaflet-overlay-pane .leaflet-interactive")),
    "Las lecturas no reconstruyen los objetos del mapa");

  const rect = await page.locator(".map").boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 110, rect.y + rect.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const transform = await page.locator(".leaflet-map-pane").evaluate((element) => element.style.transform);
  const countBefore = requests;
  position = [10.121, -84.131];
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator(".receiver-status").getByText(/10\.121000, -84\.131000/).waitFor({ timeout: 4000 });
  // The next poll updates the existing marker without moving the user's map view.
  await page.waitForTimeout(3200);
  assert(requests > countBefore, "Al volver a la pestaña se consulta de inmediato");
  assert.equal(await page.locator(".leaflet-map-pane").evaluate((element) => element.style.transform), transform);
  assert(await page.evaluate(() => window.__collarPath === document.querySelector(".leaflet-overlay-pane .leaflet-interactive")));
  await page.getByRole("button", { name: "Centrar collar" }).click();
  assert.notEqual(await page.locator(".leaflet-map-pane").evaluate((element) => element.style.transform), transform);

  offline = true;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator(".receiver-status").getByText("Monitoreo no disponible").waitFor({ timeout: 4000 });
  assert.equal(await page.locator(".cow-marker").count(), 0,
    "No se sustituyen posiciones reales por posiciones ficticias ante un corte breve");
  offline = false;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator(".receiver-status").getByText("GPS y LoRa activos").waitFor({ timeout: 4000 });
  assert.deepEqual(errors, []);
  console.log("PASS: objetos estables, actualización inmediata, vista sin saltos y reconexión sin marcadores ficticios");
} finally {
  await browser.close();
}
