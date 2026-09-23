import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const browser = await chromium.launch({
  executablePath: "/Applications/Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results/usability", { recursive: true });
const home = () =>
  page
    .getByRole("navigation")
    .getByRole("button", { name: "Resumen", exact: true })
    .click();
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
  await page.getByRole("heading", { name: "Resumen", exact: true }).waitFor();
  const initialData = await page.evaluate(() =>
    localStorage.getItem("smartherd-demo-v1"),
  );
  assert.equal(
    await page.getByText("Tu ganado, de un vistazo.", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("CADA ANIMAL, UNA HISTORIA", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByText("Todo lo que necesitas para cuidar tu finca hoy.", {
        exact: true,
      })
      .count(),
    0,
  );

  await page.getByRole("button", { name: /^Animales activos:/ }).click();
  await page.getByRole("textbox", { name: "Buscar animal" }).waitFor();
  await home();
  await page.getByRole("button", { name: /^Collar físico:/ }).click();
  await page.getByRole("heading", { name: "Collares vinculados" }).waitFor();
  await home();
  await page.getByRole("button", { name: /^Por revisar:/ }).click();
  await page.getByRole("heading", { name: "Pendientes de revisión" }).waitFor();
  await home();
  const history = page.getByRole("button", { name: /^Eventos registrados:/ });
  await history.click();
  await page.getByRole("dialog", { name: "Eventos registrados" }).waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Estrella/ })
    .click();
  await page
    .getByRole("heading", { name: "Historial sanitario y reproductivo" })
    .waitFor();
  await home();
  await page.getByRole("button", { name: "Abrir mapa", exact: true }).click();
  await page.getByRole("heading", { name: "Mapa", exact: true }).waitFor();
  await home();

  const register = page.getByRole("button", {
    name: "Registrar animal",
    exact: true,
  });
  await register.click();
  assert(
    await page
      .getByLabel("Nombre", { exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Shift+Tab");
  assert(
    await page
      .getByRole("button", { name: "Cerrar", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Shift+Tab");
  assert(
    await page
      .getByRole("button", { name: "Guardar animal", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Tab");
  assert(
    await page
      .getByRole("button", { name: "Cerrar", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Escape");
  assert(
    await register.evaluate((el) => el === document.activeElement),
    "Focus returns to the button that opened the form",
  );

  for (const theme of ["claro", "oscuro"]) {
    await page.getByRole("button", { name: "Abrir preferencias" }).click();
    await page.getByRole("button", { name: `Modo ${theme}` }).click();
    await page.keyboard.press("Escape");
    for (const width of [1440, 1100, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme} overflows at ${width}`,
      );
      const card = await page.locator(".stat-link").first().boundingBox();
      assert(card.y < 240, `Indicators should appear early at ${width}`);
      const action = await register.boundingBox();
      assert(action.height >= 44, "Primary action touch area");
      await page.screenshot({
        path: `test-results/usability/${theme}-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  assert.equal(
    await page.evaluate(() => localStorage.getItem("smartherd-demo-v1")),
    initialData,
    "Navigation and theme changes preserve animal data",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 4 indicadores, mapa, historial, foco de formularios, textos retirados y 5 anchos en ambos temas.",
  );
} finally {
  await browser.close();
}
