export const KNOWN_ESP32 = {
  emisor: { mac: "68:EE:8F:4F:32:20", name: "Emisor con GPS" },
  receptor: { mac: "68:EE:8F:4F:50:20", name: "Receptor LoRa" },
};

export function detectedModule(receiver, role) {
  if (!receiver || !KNOWN_ESP32[role]) return null;
  const connected = role === "emisor" ? receiver.transmitter_connected : receiver.receiver_connected;
  const radioReady = role === "emisor" ? receiver.transmitter_radio_ready : receiver.receiver_radio_ready;
  return connected && radioReady ? KNOWN_ESP32[role] : null;
}

export function normalizeModuleId(value) {
  const id = String(value || "").replace(/[:-]/g, "").trim().toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(id))
    throw new Error("Ingresa los 12 caracteres hexadecimales de la MAC del ESP32.");
  return id;
}

export function validateModule(input, devices, modules) {
  const module_id = normalizeModuleId(input.module_id);
  const role = input.role;
  const name = String(input.name || "").trim();
  const device_id = role === "emisor" ? input.device_id : null;
  if (!["emisor", "receptor"].includes(role)) throw new Error("Selecciona emisor o receptor.");
  if (!name || name.length > 80) throw new Error("Escribe un nombre de hasta 80 caracteres.");
  if (modules.some((module) => module.module_id === module_id))
    throw new Error("Este ESP32 ya está registrado.");
  const opposite = role === "emisor" ? "receptor" : "emisor";
  if (module_id === normalizeModuleId(KNOWN_ESP32[opposite].mac))
    throw new Error(`Esta MAC pertenece al ${opposite} del prototipo. Selecciona la función correcta.`);
  if (role === "emisor" && !devices.some((device) => device.id === device_id && device.enabled))
    throw new Error("Selecciona un collar activo antes de registrar el emisor.");
  if (role === "emisor" && modules.some((module) => module.device_id === device_id))
    throw new Error("Ese collar ya tiene un emisor registrado.");
  return { module_id, role, name, device_id };
}
