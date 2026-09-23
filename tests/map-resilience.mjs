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
  await page.route(/\.tile\.openstreetmap\.org/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: tile }));
  let failZoom = false;
  let failedZoomRequests = 0;
  await page.route(/World_Imagery\/MapServer\/tile/, async (route) => {
    if (failZoom) {
      failedZoomRequests += 1;
      return route.fulfill({ status: 503, body: "" });
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    return route.fulfill({ status: 200, contentType: "image/png", body: tile });
  });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll(".map img.leaflet-tile")]
    .some((tile) => tile.complete && tile.naturalWidth > 0));
  await page.locator(".map-view-options").getByRole("button", { name: "Satélite" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".map .leaflet-tile-pane > .leaflet-layer").length === 2);
  assert(await page.evaluate(() => [...document.querySelectorAll(".map .leaflet-tile-pane > .leaflet-layer")]
    .some((layer) => [...layer.querySelectorAll("img")].some((image) => image.complete && image.naturalWidth > 0 && Number(layer.style.opacity || 1) > 0))),
    "El mapa anterior sigue visible mientras carga el satelital");
  await page.waitForFunction(() => document.querySelectorAll(".map .leaflet-tile-pane > .leaflet-layer").length === 1 &&
    [...document.querySelectorAll(".map img.leaflet-tile")].some((image) => image.src.includes("World_Imagery") && image.complete && image.naturalWidth > 0));
  assert.equal(await page.locator(".map-view-options").getByRole("button", { name: "Satélite" }).getAttribute("aria-pressed"), "true");
  failZoom = true;
  await page.locator(".leaflet-control-zoom-in").click();
  await page.waitForFunction(() => document.querySelector(".map-street") &&
    [...document.querySelectorAll(".map img.leaflet-tile")].some((image) =>
      image.src.includes("tile.openstreetmap.org") && image.complete && image.naturalWidth > 0),
    {}, { timeout: 15_000 });
  assert(failedZoomRequests > 0, "La falla satelital durante zoom fue observada");

  const failurePage = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  failurePage.on("pageerror", (error) => errors.push(error.message));
  let failedRequests = 0;
  await failurePage.route(/\.tile\.openstreetmap\.org/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: tile }));
  await failurePage.route(/World_Imagery\/MapServer\/tile/, (route) => {
    failedRequests += 1;
    return route.fulfill({ status: 503, body: "" });
  });
  await failurePage.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await failurePage.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await failurePage.getByRole("navigation").getByRole("button", { name: "Mapa", exact: true }).click();
  await failurePage.waitForFunction(() => [...document.querySelectorAll(".map img.leaflet-tile")]
    .some((image) => image.src.includes("tile.openstreetmap.org") && image.complete && image.naturalWidth > 0));
  await failurePage.locator(".map-view-options").getByRole("button", { name: "Satélite" }).click();
  await failurePage.locator(".map-notice").filter({ hasText: "No se pudieron cargar" }).waitFor({ timeout: 15_000 });
  await failurePage.waitForFunction(() => document.querySelector('.map-street') &&
    document.querySelectorAll(".map .leaflet-tile-pane > .leaflet-layer").length === 1, {}, { timeout: 15_000 });
  assert(failedRequests > 0);
  assert(await failurePage.locator(".map img.leaflet-tile").first().evaluate((image) => image.complete && image.naturalWidth > 0));
  await failurePage.getByRole("button", { name: "Reintentar mapa" }).click();
  await failurePage.locator(".map-notice").filter({ hasText: "No se pudieron cargar" }).waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log("PASS: cambio sin fondo vacío, recuperación al fallar satélite y reintento manual");
} finally {
  await browser.close();
}
