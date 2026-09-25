import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveTrackingInterval, inspectGps, inspectRadio } from "../src/tracking.mjs";

const now = Date.parse("2026-09-25T12:00:00Z");
const receiver = {
  receiver_connected: true, transmitter_connected: true,
  receiver_radio_ready: true, transmitter_radio_ready: true,
  last_tx_at: new Date(now - 20_000).toISOString(),
  received_at: new Date(now - 20_000).toISOString(),
  signal: "no_fix", rssi: -52, snr: 9.2,
};

test("rastreo rápido caduca y el habitual tolera el intervalo de cinco minutos", () => {
  assert.equal(effectiveTrackingInterval({ interval_seconds: 5, live_until: new Date(now + 10_000).toISOString() }, now), 5);
  assert.equal(effectiveTrackingInterval({ interval_seconds: 5, live_until: new Date(now - 1).toISOString() }, now), 300);
  assert.equal(effectiveTrackingInterval(null, now), 300);
  assert.equal(inspectRadio({ ...receiver, received_at: new Date(now - 5 * 60_000).toISOString() }, 300, now).ok, true);
  assert.equal(inspectRadio({ ...receiver, received_at: new Date(now - 12 * 60_000).toISOString() }, 300, now).ok, false);
});

test("prueba LoRa y GPS distingue ausencia de posición de ausencia de radio", () => {
  assert.equal(inspectRadio(receiver, 5, now).ok, true);
  assert.match(inspectGps(receiver, 5, now).message, /GPS todavía no tiene/);
  assert.equal(inspectGps({ ...receiver, signal: "fix", latitude: 10.001, longitude: -84.115 }, 5, now).ok, true);
  assert.match(inspectGps({ ...receiver, received_at: null }, 5, now).message, /No se puede confirmar GPS/);
});
