import { createClient } from "@supabase/supabase-js";
import { makeSeed, defaults } from "./domain.mjs";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export let supabase = null;
export let configurationError = "";
try {
  if (url && key) supabase = createClient(url, key);
} catch {
  configurationError = "Configuración de Supabase inválida";
}
const storageKey = "smartherd-demo-v1";
export function loadDemo() {
  const raw = localStorage.getItem(storageKey);
  if (raw) return JSON.parse(raw);
  const seed = makeSeed();
  localStorage.setItem(storageKey, JSON.stringify(seed));
  return seed;
}
export function saveDemo(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}
export async function loadCloud() {
  const names = [
    "animals",
    "devices",
    "telemetry",
    "events",
    "farm_settings",
    "alert_acknowledgements",
  ];
  const results = await Promise.all(
    names.map((n) => {
      let q = supabase.from(n).select("*");
      if (n === "telemetry")
        q = q.order("recorded_at", { ascending: false }).limit(5000);
      return q;
    }),
  );
  for (const r of results) if (r.error) throw r.error;
  return {
    animals: results[0].data,
    devices: results[1].data,
    readings: results[2].data,
    events: results[3].data,
    settings: results[4].data[0] || { ...defaults, polygon: [] },
    acknowledged: results[5].data.map((x) => x.alert_id),
  };
}
export async function writeCloud(table, row) {
  const { error } = await supabase.from(table).upsert(row);
  if (error) throw error;
}
