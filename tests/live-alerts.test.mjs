import { test } from "node:test";
import assert from "node:assert/strict";
import { alertsForWithReceiver } from "../src/liveAlerts.mjs";
import { alertsFor, defaults } from "../src/domain.mjs";

const now = Date.parse("2026-10-02T18:00:00Z");
const animal = { id: "animal-a", farm_id: "farm-a", status: "activo" };
const settings = {
  ...defaults,
  id: "farm-a",
  polygon: [[10.005, -84.12], [10.005, -84.11], [9.997, -84.11], [9.997, -84.12]],
};
const device = { id: "SH-COLLAR-001", farm_id: "farm-a", animal_id: animal.id, enabled: true };
const receiver = {
  device_id: device.id,
  receiver_connected: true,
  transmitter_connected: true,
  receiver_radio_ready: true,
  transmitter_radio_ready: true,
  demo_mode: true,
  transmitter_usb_connected: false,
  transmitter_interval_seconds: 3,
  boot_id: "A1B2C3D4",
  sequence: 42,
  signal: "fix",
  latitude: 10.001,
  longitude: -84.1,
  received_at: new Date(now - 1000).toISOString(),
  last_tx_at: new Date(now - 1000).toISOString(),
  gps_age_ms: 1000,
};
const evaluate = (patch = {}) => alertsForWithReceiver(
  patch.animal ?? animal,
  patch.readings ?? [],
  patch.settings ?? settings,
  patch.devices ?? [device],
  Object.hasOwn(patch, "receiver") ? patch.receiver : receiver,
  patch.now ?? now,
);

test("GPS LoRa fuera de la cerca genera una alerta sin telemetría en Supabase ni USB en el emisor", () => {
  const result = evaluate();
  assert.equal(result.length, 1);
  const alert = result[0];
  assert.equal(alert.kind, "fence");
  assert.equal(alert.source, "lora");
  assert.equal(alert.title, "Fuera de la cerca");
  assert.equal(alert.animal_id, animal.id);
  assert.equal(alert.recorded_at, receiver.received_at);
  for (const value of [settings.id, animal.id, receiver.boot_id, receiver.sequence, receiver.received_at])
    assert.ok(alert.id.includes(String(value)), `El ID identifica ${value}`);
});

test("una posición dentro o sobre el borde no genera una alerta LoRa", () => {
  assert.deepEqual(evaluate({ receiver: { ...receiver, longitude: -84.115 } }), []);
  assert.deepEqual(evaluate({ receiver: { ...receiver, latitude: 10.005, longitude: -84.115 } }), []);
  assert.deepEqual(evaluate({ receiver: { ...receiver, latitude: 10.005, longitude: -84.12 } }), []);
});

test("un perímetro modificado se evalúa usando la ubicación LoRa vigente", () => {
  assert.equal(evaluate().length, 1);
  assert.deepEqual(evaluate({ settings: { ...settings, polygon:
    [[10.005, -84.12], [10.005, -84.09], [9.997, -84.09], [9.997, -84.12]] } }), []);
});

test("sin perímetro configurado no se inventa una salida de finca", () => {
  assert.deepEqual(evaluate({ settings: { ...settings, polygon: [] } }), []);
});

test("solo una posición GPS válida y reciente permite una nueva alerta local", async (t) => {
  const cases = [
    ["sin puente", null],
    ["sin solución GPS", { ...receiver, signal: "no_fix" }],
    ["GPS sin datos", { ...receiver, signal: "no_data" }],
    ["esperando mensajes", { ...receiver, signal: "waiting" }],
    ["reporte obsoleto", { ...receiver, received_at: new Date(now - 15_001).toISOString() }],
    ["hora futura incorrecta", { ...receiver, received_at: new Date(now + 6000).toISOString() }],
    ["hora inválida", { ...receiver, received_at: "invalid" }],
    ["transmisión con hora futura incorrecta", { ...receiver, last_tx_at: new Date(now + 6000).toISOString() }],
    ["transmisión obsoleta", { ...receiver, last_tx_at: new Date(now - 20_000).toISOString() }],
    ["posición GPS anterior demasiado vieja", { ...receiver, gps_age_ms: 15_001 }],
    ["antigüedad GPS inválida", { ...receiver, gps_age_ms: -1 }],
    ["receptor desconectado", { ...receiver, receiver_connected: false }],
    ["receptor sin radio", { ...receiver, receiver_radio_ready: false }],
    ["emisor sin enlace", { ...receiver, transmitter_connected: false }],
    ["emisor sin radio", { ...receiver, transmitter_radio_ready: false }],
    ["latitud fuera de rango", { ...receiver, latitude: 91 }],
    ["longitud fuera de rango", { ...receiver, longitude: -181 }],
    ["latitud no finita", { ...receiver, latitude: NaN }],
    ["longitud no finita", { ...receiver, longitude: Infinity }],
    ["sin latitud", { ...receiver, latitude: null }],
    ["sin longitud", { ...receiver, longitude: null }],
    ["identificador diferente", { ...receiver, device_id: "SH-COLLAR-002" }],
  ];
  for (const [name, value] of cases)
    await t.test(name, () => assert.deepEqual(evaluate({ receiver: value }), []));
});

test("el GPS local solo se evalúa para un collar habilitado y vinculado al animal y finca actuales", async (t) => {
  const cases = [
    ["sin collar", { devices: [] }],
    ["collar desactivado", { devices: [{ ...device, enabled: false }] }],
    ["collar no vinculado", { devices: [{ ...device, animal_id: null }] }],
    ["collar de otro animal", { devices: [{ ...device, animal_id: "animal-b" }] }],
    ["collar de otra finca", { devices: [{ ...device, farm_id: "farm-b" }] }],
    ["animal de otra finca", { animal: { ...animal, farm_id: "farm-b" } }],
    ["otra finca seleccionada", { settings: { ...settings, id: "farm-b" } }],
    ["animal vendido", { animal: { ...animal, status: "vendido" } }],
    ["animal fallecido", { animal: { ...animal, status: "muerto" } }],
  ];
  for (const [name, patch] of cases)
    await t.test(name, () => assert.deepEqual(evaluate(patch), []));
});

test("la identidad de una lectura repetida es estable; nuevas lecturas, reinicios y fincas se distinguen", () => {
  const first = evaluate()[0].id;
  assert.equal(evaluate()[0].id, first);
  assert.notEqual(evaluate({ receiver: { ...receiver, sequence: 43 } })[0].id, first);
  assert.notEqual(evaluate({ receiver: { ...receiver, boot_id: "E5F60708" } })[0].id, first);
  assert.notEqual(evaluate({ receiver: { ...receiver, received_at: new Date(now).toISOString() } })[0].id, first);
  const anotherFarm = evaluate({
    animal: { ...animal, farm_id: "farm-b" },
    devices: [{ ...device, farm_id: "farm-b" }],
    settings: { ...settings, id: "farm-b" },
  });
  assert.equal(anotherFarm.length, 1);
  assert.notEqual(anotherFarm[0].id, first);
});

test("reconocer una lectura fuera no silencia el siguiente paquete LoRa", () => {
  const acknowledged = [evaluate()[0].id];
  assert.equal(evaluate().filter((alert) => !acknowledged.includes(alert.id)).length, 0);
  const next = evaluate({ receiver: { ...receiver, sequence: 43, received_at: new Date(now).toISOString() } });
  assert.equal(next.filter((alert) => !acknowledged.includes(alert.id)).length, 1);
});

test("GPS local reciente dentro de la cerca reemplaza geocerca cloud anterior y preserva alertas reales de sensores", () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({
    id: `cloud-${i}`, animal_id: animal.id, device_id: device.id,
    recorded_at: new Date(now - (i + 1) * 60_000).toISOString(),
    temperature_c: i === 0 ? 38 : 33,
    activity: i === 0 ? 80 : 20,
    battery_pct: i === 0 ? 10 : 80,
    latitude: 10.001, longitude: -84.1,
  }));
  const cloud = alertsFor(animal, rows, settings, now);
  assert.deepEqual(cloud.map((alert) => alert.kind), ["fence", "battery", "temperature", "activity"]);
  const inside = evaluate({ readings: rows, receiver: { ...receiver, longitude: -84.115 } });
  assert.deepEqual(inside, cloud.filter((alert) => alert.kind !== "fence"));
  assert.ok(inside.every((alert) => alert.source !== "lora"));
  const outside = evaluate({ readings: rows });
  assert.equal(outside.filter((alert) => alert.kind === "fence").length, 1);
  assert.deepEqual(outside.filter((alert) => alert.kind !== "fence"), cloud.filter((alert) => alert.kind !== "fence"));
});

test("un FIX local fresco evita la alerta cloud de ausencia de lecturas, pero un paquete viejo no la oculta", () => {
  const rows = [{ id: "old-cloud", animal_id: animal.id, device_id: device.id,
    recorded_at: new Date(now - 40 * 60_000).toISOString(), latitude: 10.001, longitude: -84.1 }];
  const cloud = alertsFor(animal, rows, settings, now);
  assert.equal(cloud[0].kind, "offline");
  assert.deepEqual(evaluate({ readings: rows, receiver: { ...receiver, longitude: -84.115 } }), []);
  assert.deepEqual(evaluate({ readings: rows, receiver: { ...receiver, received_at: new Date(now - 20_000).toISOString() } }), cloud);
});

test("sin GPS local válido se conserva el comportamiento de las alertas de Supabase", () => {
  const rows = [{ id: "cloud", animal_id: animal.id, device_id: device.id,
    recorded_at: new Date(now - 60_000).toISOString(), latitude: 10.001, longitude: -84.1,
    battery_pct: 12 }];
  const cloud = alertsFor(animal, rows, settings, now);
  assert.deepEqual(evaluate({ readings: rows, receiver: null }), cloud);
  assert.deepEqual(evaluate({ readings: rows, receiver: { ...receiver, signal: "no_fix" } }), cloud);
});
