import { validatePacket } from "./domain.mjs";
const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
export const createHandler = (db) => async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Solo POST" });
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer [a-f0-9]{64}$/.test(auth))
    return reply(401, { error: "Credencial de estación requerida" });
  if (!req.headers.get("content-type")?.includes("application/json"))
    return reply(415, { error: "Usa application/json" });
  // Bound body size even for requests without Content-Length.
  const reader = req.body?.getReader();
  if (!reader) return reply(400, { error: "JSON requerido" });
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      return reply(413, { error: "Máximo 4096 bytes" });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let packet;
  try {
    packet = validatePacket(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    return reply(400, {
      error: e instanceof Error ? e.message : "JSON inválido",
    });
  }
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(auth.slice(7)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { data: gateway, error: credentialError } = await db
    .from("gateway_credentials")
    .select("owner_id")
    .eq("token_hash", hash)
    .eq("enabled", true)
    .maybeSingle();
  if (credentialError)
    return reply(503, { error: "Servicio temporalmente no disponible" });
  if (!gateway) return reply(401, { error: "Credencial inválida o revocada" });
  const { data: device, error: deviceError } = await db
    .from("devices")
    .select("id,animal_id,owner_id,animals!inner(status)")
    .eq("id", packet.device_id)
    .eq("owner_id", gateway.owner_id)
    .eq("enabled", true)
    .eq("animals.status", "activo")
    .maybeSingle();
  if (deviceError) return reply(503, { error: "No se pudo validar el collar" });
  if (!device)
    return reply(403, {
      error: "Collar no habilitado para esta finca o animal inactivo",
    });
  const { error } = await db
    .from("telemetry")
    .insert({
      ...packet,
      owner_id: device.owner_id,
      animal_id: device.animal_id,
    });
  if (error?.code === "23505")
    return reply(200, {
      ok: true,
      duplicate: true,
      packet_id: packet.packet_id,
    });
  if (error)
    return reply(503, {
      error: "No se pudo guardar; reintenta el mismo packet_id",
    });
  return reply(201, {
    ok: true,
    duplicate: false,
    packet_id: packet.packet_id,
  });
};
