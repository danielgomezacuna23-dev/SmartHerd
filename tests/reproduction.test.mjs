import test from "node:test";
import assert from "node:assert/strict";
import { potentialHeatForecast } from "../src/reproduction.mjs";

const cow = { id: "cow-1", sex: "hembra", status: "activo" };
const event = (type, date, id = type) => ({ id, animal_id: cow.id, type, date });

test("último celo observado crea una sola ventana orientativa 18 a 24 días después", () => {
  const events = [event("celo", "2026-09-01")];
  const before = potentialHeatForecast(cow, events, "2026-09-18");
  assert.equal(before.active, false);
  assert.equal(before.start, "2026-09-19");
  assert.equal(before.end, "2026-09-25");
  assert.equal(potentialHeatForecast(cow, events, "2026-09-21").active, true);
  assert.equal(potentialHeatForecast(cow, events, "2026-09-26").active, false);
});

test("tras parto muestra una ventana amplia y la preñez confirmada la suspende", () => {
  const postpartum = [event("parto", "2026-07-01")];
  const forecast = potentialHeatForecast(cow, postpartum, "2026-08-15");
  assert.equal(forecast.start, "2026-08-10");
  assert.equal(forecast.end, "2026-08-30");
  assert.equal(forecast.active, true);
  assert.equal(potentialHeatForecast(cow, [...postpartum, event("preniez", "2026-08-01")], "2026-08-15"), null);
  assert.equal(potentialHeatForecast({ ...cow, sex: "macho" }, postpartum, "2026-08-15"), null);
  assert.equal(potentialHeatForecast({ ...cow, status: "vendido" }, postpartum, "2026-08-15"), null);
});
