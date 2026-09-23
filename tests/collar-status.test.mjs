import test from "node:test";
import assert from "node:assert/strict";
import { collarStatus, PHYSICAL_COLLAR_ID } from "../src/collarStatus.mjs";
import { validReceiverStatus } from "../src/useReceiverStatus.js";

const now = Date.now();
const device = { id: PHYSICAL_COLLAR_ID, enabled: true };
const recent = new Date(now - 5_000).toISOString();
const old = new Date(now - 50_000).toISOString();
const online = {
  receiver_connected: true,
  transmitter_connected: true,
  receiver_radio_ready: true,
  transmitter_radio_ready: true,
  last_tx_at: recent,
  received_at: recent,
  signal: "fix",
};

test("estados del collar físico distinguen GPS, LoRa, desconexión y desactivación", () => {
  const label = (d, status) => collarStatus(d, status, now).label;
  assert.equal(label(device, online), "GPS y LoRa activos");
  assert.equal(label(device, { ...online, signal: "no_fix" }), "Sin señal GPS");
  assert.equal(label(device, { ...online, received_at: old }), "Sin señal LoRa");
  assert.equal(label(device, { ...online, transmitter_radio_ready: false }), "Sin señal LoRa");
  assert.equal(label(device, { ...online, transmitter_connected: false }), "Desconectado");
  assert.equal(label({ ...device, enabled: false }, online), "Desactivado");
  assert.equal(label(device, { ...online, receiver_connected: false }), "Receptor desconectado");
  assert.equal(label(device, { ...online, last_tx_at: old }), "Sin transmisión");
  assert.equal(label(device, null), "Monitoreo no disponible");
  assert.equal(label({ id: "SH-COLLAR-002", enabled: true }, online), "Sin módulo físico");
});

test("rechaza estados del puente con identidad o coordenadas inválidas", () => {
  const packet = { ...online, device_id: PHYSICAL_COLLAR_ID, latitude: 10, longitude: -84 };
  assert.equal(validReceiverStatus(packet), true);
  assert.equal(validReceiverStatus({ ...packet, device_id: "SH-COLLAR-002" }), false);
  assert.equal(validReceiverStatus({ ...packet, latitude: null }), false);
  assert.equal(validReceiverStatus({ ...packet, latitude: 91 }), false);
  assert.equal(validReceiverStatus({ ...packet, received_at: "desconocido" }), false);
});
