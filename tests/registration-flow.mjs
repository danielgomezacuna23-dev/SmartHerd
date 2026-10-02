import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const root = process.env.SMARTHERD_TEST_URL || "http://127.0.0.1:5173/";
const userId = "11111111-1111-4111-8111-111111111111";
const farmId = "22222222-2222-4222-8222-222222222222";
const farm = {
  id: farmId, owner_id: userId, name: "Finca de prueba", production_type: "leche",
  breeds: ["Jersey"], latitude: 9.94, longitude: -84.1, polygon: [[9.9395, -84.1005], [9.9405, -84.1005], [9.9405, -84.0995], [9.9395, -84.0995]],
  offline_minutes: 30, temperature_delta: 2, activity_ratio: 2, battery_min: 20,
};
const user = {
  id: userId, aud: "authenticated", role: "authenticated", email: "prueba@example.test",
  email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, created_at: new Date().toISOString(),
};
const jwt = [
  { alg: "HS256", typ: "JWT" },
  { aud: "authenticated", role: "authenticated", sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600, iss: "https://vqtgbgkwleveevlmguqe.supabase.co/auth/v1" },
].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".signature";
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600,
  refresh_token: "test-refresh-token", user };
const animals = [];
const devices = [];
const modules = [];
const acknowledgements = [];
const browser = await chromium.launch({ executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("https://vqtgbgkwleveevlmguqe.supabase.co/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value),
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204,
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE", "access-control-max-age": "600" } });
  if (url.pathname === "/auth/v1/token") return json(session);
  if (url.pathname === "/auth/v1/user") return json(user);
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.split("/").at(-1);
    if (request.method() === "GET")
      return json(table === "farm_settings" ? [farm] : table === "animals" ? animals : table === "devices" ? devices : table === "module_registry" ? modules : table === "alert_acknowledgements" ? acknowledgements : []);
    if (request.method() === "POST") {
      const row = JSON.parse(request.postData());
      if (table === "animals") animals.push(row);
      if (table === "devices") devices.push(row);
      if (table === "module_registry") modules.push(row);
      if (table === "alert_acknowledgements") acknowledgements.push(row);
      return json([], 201);
    }
    return json([]);
  }
  return json({});
});
let receiver = { device_id: "SH-COLLAR-001", transmitter_connected: true,
  receiver_connected: true, transmitter_radio_ready: true, receiver_radio_ready: true,
  demo_mode: true, transmitter_usb_connected: false, transmitter_interval_seconds: 3,
  signal: "no_fix", last_tx_at: new Date().toISOString(), received_at: new Date().toISOString(),
  boot_id: "TEST0001", sequence: 1, rssi: -55, snr: 8.5, satellites: 0, valid_nmea: 30, gps_baud: 9600 };
await page.route("http://127.0.0.1:8765/status", (route) => route.fulfill({
  status: 200, contentType: "application/json",
  headers: { "access-control-allow-origin": new URL(root).origin },
  body: JSON.stringify(receiver),
}));
await page.route(/(?:\.tile\.openstreetmap\.org|World_Imagery\/MapServer\/tile)/,
  (route) => route.fulfill({ status: 200, contentType: "image/png", path: "tests/fixtures/tile.png" }));


try {
  await page.goto(root);
  await page.getByLabel("Correo electrónico").fill("prueba@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  const otherTab = await context.newPage();
  await otherTab.goto("about:blank");
  await page.bringToFront();
  await page.getByRole("button", { name: /Finca de prueba/ }).waitFor();
  await page.getByRole("button", { name: /Finca de prueba/ }).click();
  await page.getByRole("button", { name: "Abrir preferencias" }).click();
  await page.getByRole("button", { name: "Rastreo y diagnóstico" }).click();
  await page.getByRole("button", { name: /Collar nuevo.*Vincularlo primero/ }).click();
  assert.equal(await page.getByLabel("Identificador del collar").inputValue(), "SH-COLLAR-001");
  await page.getByText("Primero registra un animal en Mi ganado", { exact: false }).waitFor();
  await page.getByRole("dialog", { name: "Vincular collar" }).getByRole("button", { name: "Registrar animal" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Estrella");
  await page.getByLabel("Arete / identificación").fill("A-001");
  await page.getByLabel("Raza", { exact: true }).fill("Jersey");
  await page.getByLabel("Nacimiento").fill("2023-01-01");
  await page.getByRole("button", { name: "Guardar animal" }).click();
  await page.getByRole("heading", { name: "Vincular collar" }).waitFor();
  assert.equal(await page.getByLabel("Animal registrado").inputValue(), animals[0].id);
  await page.getByRole("button", { name: "Guardar vínculo" }).click();
  await page.getByRole("heading", { name: "Vincular collar" }).waitFor({ state: "hidden" });
  assert.equal(devices[0].id, "SH-COLLAR-001");
  await page.getByRole("heading", { name: "Rastreo y diagnóstico" }).waitFor();
  await page.getByLabel("MAC del ESP32").fill("68:EE:8F:4F:50:20");
  await page.getByLabel("Nombre para reconocerlo").fill("Placa equivocada");
  await page.getByLabel("Collar asociado").selectOption("SH-COLLAR-001");
  await page.getByRole("button", { name: "Registrar módulo" }).click();
  await page.getByRole("dialog", { name: "Rastreo y diagnóstico" }).getByText("Esta MAC pertenece al receptor del prototipo", { exact: false }).waitFor();
  assert.equal(modules.length, 0);
  await page.getByRole("button", { name: "Detectar módulo" }).click();
  await page.getByText("Emisor con GPS detectado", { exact: false }).waitFor();
  assert.equal(await page.getByLabel("MAC del ESP32").inputValue(), "68:EE:8F:4F:32:20");
  await page.getByRole("button", { name: "Registrar módulo" }).click();
  await page.getByText("Emisor con GPS", { exact: false }).first().waitFor();
  assert.equal(modules[0].module_id, "68EE8F4F3220");
  await page.getByLabel("Función del módulo").selectOption("receptor");
  await page.getByRole("button", { name: "Detectar módulo" }).click();
  await page.getByText("Receptor LoRa detectado", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Registrar módulo" }).click();
  assert.equal(modules[1].module_id, "68EE8F4F5020");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.bringToFront();
  await page.waitForTimeout(1000);
  assert.equal(await page.getByText("Cargando tus fincas…").count(), 0);
  receiver = { ...receiver, received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await page.getByRole("button", { name: "GPS: Sin señal GPS. Ver diagnóstico", exact: true }).waitFor();
  await page.getByRole("button", { name: "LoRa: Conectado. Ver diagnóstico", exact: true }).waitFor();
  await page.getByRole("button", { name: "LoRa: Conectado. Ver diagnóstico", exact: true }).click();
  await page.getByRole("heading", { name: "Rastreo y diagnóstico" }).waitFor();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Collares", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "SH-COLLAR-001" });
  receiver = { ...receiver, received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await row.getByText("Sin señal GPS", { exact: true }).waitFor();
  receiver = { ...receiver, signal: "no_data", received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await row.getByText("GPS sin datos", { exact: true }).waitFor();
  receiver = { ...receiver, signal: "fix", latitude: 9.94, longitude: -84.1,
    received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await row.getByText("GPS y LoRa activos", { exact: true }).waitFor();
  await page.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  await page.locator(".receiver-status").getByText("GPS y LoRa activos").waitFor();
  await page.evaluate(() => {
    window.__mapPane = document.querySelector(".leaflet-map-pane");
    window.__gpsMarker = document.querySelector(".leaflet-overlay-pane path:not(.farm-boundary):not(.farm-boundary-halo)");
  });
  receiver = { ...receiver, latitude: 9.941, longitude: -84.101,
    received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await page.locator(".receiver-status").getByText(/9\.941000, -84\.101000/).waitFor();
  assert(await page.evaluate(() => window.__mapPane === document.querySelector(".leaflet-map-pane") &&
    window.__gpsMarker === document.querySelector(".leaflet-overlay-pane path:not(.farm-boundary):not(.farm-boundary-halo)")), "El mapa y marcador se conservan al actualizar GPS");
  await page.locator(".fence-notice").getByText("Fuera de la cerca", { exact: true }).waitFor();
  assert.equal(await page.locator(".fence-notice").count(), 1);
  await page.getByRole("button", { name: "Ver alerta", exact: true }).click();
  await page.getByRole("heading", { name: "Fuera de la cerca", exact: true }).waitFor();
  await page.getByRole("button", { name: "Marcar revisada: Fuera de la cerca" }).click();
  await page.getByRole("heading", { name: "Fuera de la cerca", exact: true }).waitFor({ state: "hidden" });
  assert.equal(acknowledgements.length, 1);
  await page.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  assert.equal(await page.locator(".fence-notice").count(), 0);
  receiver = { ...receiver, sequence: 2, received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await page.locator(".fence-notice").waitFor();
  receiver = { ...receiver, sequence: 3, latitude: 9.94, longitude: -84.1,
    received_at: new Date().toISOString(), last_tx_at: new Date().toISOString() };
  await page.locator(".fence-notice").waitFor({ state: "hidden" });
  receiver = { ...receiver, received_at: new Date(Date.now() - 20_000).toISOString() };
  await page.locator(".receiver-status").getByText("Sin señal LoRa", { exact: true }).waitFor();
  receiver = { ...receiver, transmitter_connected: false, receiver_connected: false };
  await page.locator(".receiver-status").getByText("Receptor desconectado", { exact: true }).waitFor();
  assert.equal(errors.length, 0, errors.join("; "));
  console.log("Registro, pestaña, GPS/LoRa, mapa estable y geocerca LoRa sin telemetría cloud: correcto");
} finally {
  await browser.close();
}
