export function suggestCollarId(devices) {
  const used = new Set(devices.map((device) => device.id));
  for (let number = 1; number < 10_000; number += 1) {
    const id = `SH-COLLAR-${String(number).padStart(3, "0")}`;
    if (!used.has(id)) return id;
  }
  throw new Error("No hay más identificadores disponibles");
}

export function animalsWithoutCollar(animals, devices) {
  const linked = new Set(devices.map((device) => device.animal_id));
  return animals.filter((animal) => animal.status === "activo" && !linked.has(animal.id));
}
