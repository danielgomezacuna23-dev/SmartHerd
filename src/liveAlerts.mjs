import { alertsFor, insidePolygon } from "./domain.mjs";
import { PHYSICAL_COLLAR_ID } from "./collarStatus.mjs";
import { DEMO_INTERVAL_SECONDS, expectedReportAgeMs, inspectRadio } from "./tracking.mjs";

// Live receiver coordinates are not persisted in telemetry. Evaluate them
// separately so they cannot replace temperature/activity/battery measurements.
export function alertsForWithReceiver(animal, readings, settings, devices, receiver, now = Date.now()) {
  const cloud = alertsFor(animal, readings, settings, now);
  const device = devices.find((d) => d.id === PHYSICAL_COLLAR_ID && d.animal_id === animal.id);
  if (animal.status !== "activo" || !device?.enabled ||
      receiver?.device_id !== device.id ||
      (settings.id && device.farm_id && settings.id !== device.farm_id) ||
      (settings.id && animal.farm_id && settings.id !== animal.farm_id)) return cloud;
  const interval = receiver.demo_mode ? DEMO_INTERVAL_SECONDS : receiver.transmitter_interval_seconds || DEMO_INTERVAL_SECONDS;
  const receivedAt = Date.parse(receiver.received_at);
  const transmittedAt = Date.parse(receiver.last_tx_at);
  const age = now - receivedAt;
  if (!Number.isFinite(age) || age < -5_000 || transmittedAt > now + 5_000 ||
      age > expectedReportAgeMs(interval) || !inspectRadio(receiver, interval, now).ok) return cloud;
  // A received radio packet proves the collar is online even without a GPS fix.
  const online = cloud.filter((alert) => alert.kind !== "offline");
  if (receiver.signal !== "fix" ||
      !Number.isFinite(receiver.latitude) || Math.abs(receiver.latitude) > 90 ||
      !Number.isFinite(receiver.longitude) || Math.abs(receiver.longitude) > 180 ||
      (receiver.gps_age_ms != null && (!Number.isFinite(receiver.gps_age_ms) ||
        receiver.gps_age_ms < 0 || receiver.gps_age_ms > 15_000))) return online;
  // Prefer the fresh position over an older cloud position, preserving all
  // unrelated sensor alerts and their original IDs/acknowledgements.
  const alerts = online.filter((alert) => alert.kind !== "fence");
  if (insidePolygon(receiver.latitude, receiver.longitude, settings.polygon)) return alerts;
  return [...alerts, {
    id: `${settings.id || "farm"}:${animal.id}:fence:lora:${receiver.boot_id || "legacy"}:${receiver.sequence ?? ""}:${receiver.received_at}`,
    animal_id: animal.id,
    kind: "fence",
    title: "Fuera de la cerca",
    detail: "La posición GPS recibida por LoRa está fuera del perímetro de la finca. Verifica la ubicación del animal.",
    recorded_at: receiver.received_at,
    source: "lora",
  }];
}
