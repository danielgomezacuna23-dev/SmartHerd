export const NORMAL_INTERVAL_SECONDS = 300;
export const LIVE_INTERVAL_SECONDS = 5;
export const LIVE_DURATION_MS = 15 * 60_000;

export function effectiveTrackingInterval(tracking, now = Date.now()) {
  return tracking?.interval_seconds === LIVE_INTERVAL_SECONDS &&
    Number.isFinite(Date.parse(tracking.live_until)) &&
    Date.parse(tracking.live_until) > now
    ? LIVE_INTERVAL_SECONDS
    : NORMAL_INTERVAL_SECONDS;
}

export function expectedReportAgeMs(intervalSeconds) {
  return Math.max(45_000, intervalSeconds * 2.2 * 1000);
}

export function inspectRadio(receiver, intervalSeconds, now = Date.now()) {
  if (!receiver) return { ok: false, message: "No se puede consultar el receptor local." };
  if (!receiver.receiver_connected)
    return { ok: false, message: "El receptor del hub no está conectado." };
  if (receiver.receiver_radio_ready === false)
    return { ok: false, message: "El receptor está conectado, pero LoRa no inició." };
  if (!receiver.transmitter_connected)
    return { ok: false, message: "El emisor con GPS no está conectado." };
  if (receiver.transmitter_radio_ready === false)
    return { ok: false, message: "El emisor está conectado, pero LoRa no inició." };
  const limit = expectedReportAgeMs(intervalSeconds);
  const txAt = Date.parse(receiver.last_tx_at);
  if (!Number.isFinite(txAt) || now - txAt > limit)
    return { ok: false, message: "No hay una transmisión reciente del emisor." };
  const rxAt = Date.parse(receiver.received_at);
  if (!Number.isFinite(rxAt) || now - rxAt > limit)
    return { ok: false, message: "El emisor transmitió, pero no llegó una trama LoRa reciente." };
  return { ok: true, message: `LoRa recibió una trama. RSSI ${receiver.rssi ?? "—"} dBm; SNR ${receiver.snr ?? "—"} dB.` };
}

export function inspectGps(receiver, intervalSeconds, now = Date.now()) {
  const radio = inspectRadio(receiver, intervalSeconds, now);
  if (!radio.ok) return { ok: false, message: `No se puede confirmar GPS: ${radio.message}` };
  if (receiver.signal === "no_fix")
    return { ok: false, message: "LoRa funciona; el GPS todavía no tiene una posición válida." };
  if (receiver.signal === "fix" && Number.isFinite(receiver.latitude) && Number.isFinite(receiver.longitude))
    return { ok: true, message: `Posición GPS válida: ${receiver.latitude.toFixed(6)}, ${receiver.longitude.toFixed(6)}.` };
  return { ok: false, message: "Aún no llegó una posición GPS válida." };
}
