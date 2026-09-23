import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const tile = readFileSync(new URL('./fixtures/tile.png', import.meta.url));
const browser = await chromium.launch({ executablePath: '/Applications/Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/(?:\.tile\.openstreetmap\.org|World_Imagery\/MapServer\/tile)/,
    route => route.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Explorar demostración' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Mapa', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ['Satélite', 'Mapa', 'Satélite', 'Mapa']) {
      await page.locator('.map-view-options').getByRole('button', { name: mode, exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.map .leaflet-tile-pane > .leaflet-layer').length === 1, {}, { timeout: 20000 });
      assert.equal(await page.locator('.map-view-options').getByRole('button', { name: mode, exact: true }).getAttribute('aria-pressed'), 'true');
      for (const control of ['out', 'out', 'in', 'in']) {
        await page.locator(`.leaflet-control-zoom-${control}`).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.map img.leaflet-tile')].some(tile => tile.complete && tile.naturalWidth > 0), {}, { timeout: 20000 });
        assert.deepEqual(errors, [], 'Switching layers must detach disposed zoom handlers');
        assert.equal(await page.locator('.map .leaflet-tile-pane > .leaflet-layer').count(), 1);
      }
    }
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Resumen', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Mapa', exact: true }).click();
  await page.locator('.leaflet-control-zoom-out').click();
  assert.deepEqual(errors, []);
  console.log('PASS: 32 cambios de zoom tras alternar ambas capas, imágenes cargadas, móvil y navegación sin errores');
} finally { await browser.close(); }
