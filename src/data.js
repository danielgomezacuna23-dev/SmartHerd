import { createClient } from "@supabase/supabase-js";
import { defaults } from "./domain.mjs";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export let supabase = null;
export let configurationError = "";
try {
  if (url && key) supabase = createClient(url, key);
} catch {
  configurationError = "Configuración de Supabase inválida";
}
export async function loadCloud() {
  const names = [
    "animals",
    "devices",
    "telemetry",
    "events",
    "farm_settings",
    "alert_acknowledgements",
    "tracking_mode",
    "module_registry",
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
    tracking: results[6].data[0] || { interval_seconds: 300, live_until: null },
    modules: results[7].data,
  };
}
export async function loadTelemetry() {
  const { data, error } = await supabase.from("telemetry").select("*")
    .order("recorded_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return data;
}
export async function writeCloud(table, row) {
  const { error } = await supabase.from(table).upsert(row);
  if (error) throw error;
}
