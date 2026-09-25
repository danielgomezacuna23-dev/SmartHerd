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
  if (role === "emisor" && !devices.some((device) => device.id === device_id))
    throw new Error("Selecciona un collar vinculado antes de registrar el emisor.");
  if (role === "emisor" && modules.some((module) => module.device_id === device_id))
    throw new Error("Ese collar ya tiene un emisor registrado.");
  return { module_id, role, name, device_id };
}
