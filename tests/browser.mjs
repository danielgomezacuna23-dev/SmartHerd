import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("heading", { name: "Resumen", exact: true }).waitFor();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Registrar animal", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Prueba funcional");
  await page.getByLabel("Arete / identificación").fill("TEST-999");
  await page.getByLabel("Raza", { exact: true }).fill("Criollo");
  await page.getByLabel("Nacimiento").fill("2023-05-01");
  await page
    .getByRole("button", { name: "Guardar animal", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Prueba funcional", exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Registrar evento", exact: true })
    .click();
  await page.getByLabel("Tipo de evento").selectOption("peso");
  await page.getByLabel("Peso en kilogramos").fill("456.5");
  await page.getByLabel("Notas").fill("Peso verificado en prueba");
  await page
    .getByRole("button", { name: "Guardar evento", exact: true })
    .click();
  await page
    .getByRole("cell", {
      name: "456.5 kg · Peso verificado en prueba",
      exact: true,
    })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Mi ganado", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar animal" }).fill("TEST-999");
  await page
    .getByRole("heading", { name: "Prueba funcional", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Collares", exact: true }).click();
  await page
    .getByRole("button", { name: "Vincular collar", exact: true })
    .click();
  await page.getByLabel("Identificador del collar").fill("SH-TEST-999");
  await page
    .getByLabel("Animal", { exact: true })
    .selectOption({ label: "Prueba funcional · TEST-999" });
  await page
    .getByRole("button", { name: "Guardar vínculo", exact: true })
    .click();
  await page.getByRole("cell", { name: "SH-TEST-999", exact: true }).waitFor();
  await page.getByRole("button", { name: "Simular lecturas" }).click();
  await page.getByRole("status").filter({ hasText: "5 lecturas" }).waitFor();
  await page.getByRole("button", { name: "Mi finca", exact: true }).click();
  await page.getByLabel("Nombre de la finca").fill("Finca de prueba");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Configuración guardada" })
    .waitFor();
  await page.reload();
  await page.getByText("Finca de prueba", { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar lecturas CSV" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /smartherd-lecturas/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: registro, evento, persistencia, búsqueda, vínculo, simulación, configuración, CSV, vista móvil y consola.",
  );
} finally {
  await browser.close();
}
