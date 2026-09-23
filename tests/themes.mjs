import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results/themes", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("heading", { name: "Resumen", exact: true }).waitFor();
  const seed = await page.evaluate(() =>
    localStorage.getItem("smartherd-demo-v1"),
  );
  for (const mode of ["claro", "oscuro"]) {
    await page.getByRole("button", { name: "Abrir preferencias" }).click();
    await page
      .getByRole("button", { name: `Modo ${mode}`, exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: `Modo ${mode}`, exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `test-results/themes/${mode}-desktop.png`,
      fullPage: true,
    });
    await page.reload();
    await page.getByRole("heading", { name: "Resumen", exact: true }).waitFor();
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      mode === "claro" ? "light" : "dark",
    );
    await page
      .getByRole("button", { name: "Registrar animal", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({
      path: `test-results/themes/${mode}-form.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    for (const section of [
      "Mi ganado",
      "Mapa",
      "Alertas",
      "Collares",
      "Mi finca",
    ]) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: new RegExp("^" + section) })
        .click();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${mode} overflow ${section}`,
      );
      if (section === "Mi ganado") {
        await page
          .getByRole("button")
          .filter({
            has: page.getByRole("heading", { name: "Estrella", exact: true }),
          })
          .click();
        await page
          .getByRole("heading", { name: "Historial sanitario y reproductivo" })
          .waitFor();
        await page.screenshot({
          path: `test-results/themes/${mode}-detail.png`,
          fullPage: true,
        });
      }
    }
    await page.getByRole("button", { name: "Resumen", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/themes/${mode}-mobile.png`,
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${mode} mobile overflow`,
    );
    await page
      .getByRole("button", { name: "Registrar animal", exact: true })
      .click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1080 });
  }
  assert.equal(
    await page.evaluate(() => localStorage.getItem("smartherd-demo-v1")),
    seed,
    "Theme must not change farm data",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: ambos temas, persistencia, 6 secciones, formularios, ficha, móvil y datos intactos.",
  );
} finally {
  await browser.close();
}
