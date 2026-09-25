import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  insidePolygon,
  validatePacket,
  validateSettings,
  alertsFor,
  defaults,
} from "../src/domain.mjs";
const now = Date.now();
const packet = {
  device_id: "SH-COLLAR-001",
  packet_id: "test-1",
  recorded_at: new Date(now).toISOString(),
  temperature_c: 33,
  activity: 25,
  battery_pct: 80,
  latitude: 10.001,
  longitude: -84.115,
};
test("validación idéntica en navegador y función", () =>
  assert.equal(
    readFileSync(new URL("../src/domain.mjs", import.meta.url), "utf8"),
    readFileSync(
      new URL(
        "../supabase/functions/ingest-telemetry/domain.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  ));
test("geocerca: dentro, fuera y en borde", () => {
  const polygon = [[10.005, -84.12], [10.005, -84.11], [9.997, -84.11], [9.997, -84.12]];
  assert.equal(insidePolygon(10.001, -84.115, polygon), true);
  assert.equal(insidePolygon(10.001, -84.1, polygon), false);
  assert.equal(insidePolygon(10.005, -84.115, polygon), true);
});
test("acepta paquete y elimina propietario inyectado", () => {
  assert.equal(
    validatePacket({ ...packet, owner_id: "evil" }, now).owner_id,
    undefined,
  );
  assert.equal(
    validatePacket({ ...packet, latitude: null, longitude: null }, now)
      .latitude,
    null,
  );
});
test("rechaza paquetes inválidos", () => {
  for (const patch of [
    { activity: 101 },
    { temperature_c: Infinity },
    { battery_pct: -1 },
    { latitude: 91 },
    { longitude: null },
    { device_id: "x" },
    { packet_id: "" },
    { recorded_at: new Date(now + 600001).toISOString() },
    { recorded_at: new Date(now - 31 * 86400000).toISOString() },
    {
      temperature_c: null,
      activity: null,
      battery_pct: null,
      latitude: null,
      longitude: null,
    },
  ])
    assert.throws(() => validatePacket({ ...packet, ...patch }, now));
});
test("línea base exige cinco lecturas y no alerta sobre datos obsoletos", () => {
  const a = { id: "a", status: "activo" };
  const rows = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    animal_id: "a",
    recorded_at: new Date(now - i * 60000).toISOString(),
    temperature_c: i === 0 ? 38 : 33,
    activity: i === 0 ? 80 : 20,
    latitude: 10.001,
    longitude: -84.115,
  }));
  assert.deepEqual(
    alertsFor(a, rows, defaults, now).map((a) => a.kind),
    ["temperature", "activity"],
  );
  assert.equal(alertsFor(a, rows.slice(0, 5), defaults, now).length, 0);
  assert.deepEqual(
    alertsFor(a, rows, defaults, now + 3600000).map((a) => a.kind),
    ["offline"],
  );
  assert.equal(
    alertsFor({ ...a, status: "vendido" }, rows, defaults, now).length,
    0,
  );
});
test("rechaza límites y geocercas degeneradas", () => {
  assert.throws(() =>
    validateSettings({
      ...defaults,
      polygon: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    }),
  );
  assert.throws(() => validateSettings({ ...defaults, offline_minutes: 0 }));
  assert.deepEqual(validateSettings(defaults), defaults);
});
