import { expectedReportAgeMs } from "./tracking.mjs";
export const PHYSICAL_COLLAR_ID = "SH-COLLAR-001";

export function collarStatus(device, receiver, now = Date.now(), intervalSeconds = 300) {
  if (!device.enabled) return { label: "Desactivado", tone: "neutral", detail: "Desactivado en esta página" };
  if (device.id !== PHYSICAL_COLLAR_ID)
    return { label: "Sin receptor local", tone: "neutral", detail: "Consulta el último reporte de Supabase" };
  if (!receiver)
    return { label: "Monitoreo no disponible", tone: "amber", detail: "Inicia el puente local de los ESP32" };
  if (!receiver.transmitter_connected)
    return { label: "Desconectado", tone: "amber", detail: "El emisor con GPS no está conectado por USB" };
  if (!receiver.receiver_connected)
    return { label: "Receptor desconectado", tone: "amber", detail: "Revisa el ESP32 conectado al hub" };
  if (receiver.receiver_radio_ready === false)
    return { label: "LoRa no disponible", tone: "amber", detail: "El receptor está conectado, pero su radio no inició" };
  if (receiver.transmitter_radio_ready === false)
    return { label: "Sin señal LoRa", tone: "amber", detail: "El emisor está conectado, pero su radio no inició" };
  const txAge = now - Date.parse(receiver.last_tx_at);
  if (!Number.isFinite(txAge) || txAge > expectedReportAgeMs(intervalSeconds))
    return { label: "Sin transmisión", tone: "amber", detail: "Emisor detectado, pero no transmite tramas recientes" };
  const rxAge = now - Date.parse(receiver.received_at);
  if (!Number.isFinite(rxAge) || rxAge > expectedReportAgeMs(intervalSeconds))
    return { label: "Sin señal LoRa", tone: "amber", detail: "El emisor transmite, pero el receptor no recibe tramas" };
  if (receiver.signal === "no_fix")
    return { label: "Sin señal GPS", tone: "amber", detail: "LoRa activo; el GPS aún no tiene posición válida" };
  if (receiver.signal === "fix")
    return { label: "GPS y LoRa activos", tone: "", detail: "Posición recibida por el receptor" };
  return { label: "Esperando lectura", tone: "amber", detail: "Esperando una trama válida" };
}
