import { useCallback, useEffect, useState } from "react";
import { PHYSICAL_COLLAR_ID } from "./collarStatus.mjs";

export function validReceiverStatus(value) {
  if (!value || value.device_id !== PHYSICAL_COLLAR_ID) return false;
  if (typeof value.receiver_connected !== "boolean" ||
      typeof value.transmitter_connected !== "boolean" ||
      !["waiting", "no_fix", "fix"].includes(value.signal)) return false;
  if (value.signal === "fix" &&
      (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) ||
       Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180)) return false;
  if (["fix", "no_fix"].includes(value.signal) &&
      !Number.isFinite(Date.parse(value.received_at))) return false;
  return true;
}

export async function readReceiverStatus(timeoutMs = 10_000, externalSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch("http://127.0.0.1:8765/status", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Puente local no disponible");
    const value = await response.json();
    if (!validReceiverStatus(value)) throw new Error("Identidad o datos del receptor inválidos");
    return value;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}

export default function useReceiverStatus(enabled, intervalMs = 300_000) {
  const [receiver, setReceiver] = useState(null);
  const refresh = useCallback(async () => {
    const value = await readReceiverStatus(60_000);
    setReceiver(value);
    return value;
  }, []);
  useEffect(() => {
    if (!enabled) {
      setReceiver(null);
      return;
    }
    let active = true;
    let inFlight = false;
    let timer;
    let controller;
    let firstRequest = true;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(poll, document.hidden ? Math.max(15_000, intervalMs) : intervalMs);
    };
    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      // A public HTTPS page may wait for Chrome's local-network permission
      // before it can contact the receiver on this computer.
      try {
        const value = await readReceiverStatus(firstRequest ? 60_000 : 5_000, controller.signal);
        if (active) setReceiver((previous) => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
      } catch {
        if (active) setReceiver(null);
      } finally {
        firstRequest = false;
        controller = null;
        inFlight = false;
        if (active) schedule();
      }
    };
    const resume = () => {
      if (!active || document.hidden) return;
      clearTimeout(timer);
      if (!inFlight) void poll();
    };
    void poll();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [enabled, intervalMs]);
  return { receiver: enabled ? receiver : null, refresh };
}
