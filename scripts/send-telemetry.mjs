import { randomUUID } from "node:crypto";
const { SUPABASE_URL, GATEWAY_TOKEN, DEVICE_ID } = process.env;
if (!SUPABASE_URL || !GATEWAY_TOKEN || !DEVICE_ID) {
  console.error(
    "Define SUPABASE_URL, GATEWAY_TOKEN y DEVICE_ID. Consulta README.md.",
  );
  process.exit(1);
}
const packet = {
  device_id: DEVICE_ID,
  packet_id: randomUUID(),
  recorded_at: new Date().toISOString(),
  temperature_c: 33.5,
  activity: 28,
  battery_pct: 80,
  latitude: 10.001,
  longitude: -84.115,
};
const response = await fetch(
  `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/ingest-telemetry`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify(packet),
  },
);
console.log("HTTP", response.status, await response.text());
if (!response.ok) process.exitCode = 1;
