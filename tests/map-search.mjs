import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tile = readFileSync(new URL("./fixtures/tile.png", import.meta.url));
const browser = await chromium.launch({ executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/(?:\.tile\.openstreetmap\.org|World_Imagery\/MapServer\/tile)/,
    (route) => route.fulfill({ status: 200, contentType: "image/png", body: tile }));
  let searchFails = false;
  await page.route(/photon\.komoot\.io\/api\//, (route) => searchFails
    ? route.fulfill({ status: 503, body: "" })
    : route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ features: [{ geometry: { type: "Point", coordinates: [-84.116, 10.001] },
        properties: { name: "Finca prueba", city: "Heredia", country: "Costa Rica" } }] }) }));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar un lugar" }).fill("Heredia");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: "Finca prueba, Heredia, Costa Rica" }).click();
  await page.getByText("Mostrando: Finca prueba, Heredia, Costa Rica").waitFor();
  assert.equal(await page.locator(".leaflet-tooltip").filter({ hasText: "Finca prueba" }).count(), 1);
  assert(await page.locator(".leaflet-overlay-pane svg path").count() > 0);
  searchFails = true;
  await page.getByRole("searchbox", { name: "Buscar un lugar" }).fill("Otro lugar");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByText("No se pudo buscar. Revisa tu conexión e intenta de nuevo.").waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log("PASS: búsqueda, navegación a un lugar, error recuperable y mapa móvil sin desbordamiento");
} finally {
  await browser.close();
}
