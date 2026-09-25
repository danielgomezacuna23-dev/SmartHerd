export const uid = () => crypto.randomUUID();
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
export const defaults = {
  name: "Mi finca",
  polygon: [
    [10.005, -84.12],
    [10.005, -84.11],
    [9.997, -84.11],
    [9.997, -84.12],
  ],
  offline_minutes: 30,
  temperature_delta: 2,
  activity_ratio: 2,
  battery_min: 20,
};
export function insidePolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i],
      [yj, xj] = polygon[j];
    const cross = (lng - xi) * (yj - yi) - (lat - yi) * (xj - xi);
    if (
      Math.abs(cross) < 1e-10 &&
      lng >= Math.min(xi, xj) &&
      lng <= Math.max(xi, xj) &&
      lat >= Math.min(yi, yj) &&
      lat <= Math.max(yi, yj)
    )
      return true;
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function validateSettings(s) {
  if (!s.name?.trim()) throw new Error("Escribe el nombre de la finca.");
  if (
    !Array.isArray(s.polygon) ||
    s.polygon.length < 3 ||
    s.polygon.length > 100 ||
    s.polygon.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        Math.abs(p[0]) > 90 ||
        Math.abs(p[1]) > 180,
    )
  )
    throw new Error(
      "La cerca necesita entre 3 y 100 pares de latitud y longitud válidos.",
    );
  const area = s.polygon.reduce((a, p, i) => {
    const q = s.polygon[(i + 1) % s.polygon.length];
    return a + p[1] * q[0] - q[1] * p[0];
  }, 0);
  if (Math.abs(area) < 1e-10)
    throw new Error("La cerca debe encerrar un área.");
  const turn = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < s.polygon.length; i++)
    for (let j = i + 1; j < s.polygon.length; j++) {
      const n = s.polygon.length;
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = s.polygon[i],
        b = s.polygon[(i + 1) % n],
        c = s.polygon[j],
        d = s.polygon[(j + 1) % n];
      if (
        turn(a, b, c) * turn(a, b, d) <= 0 &&
        turn(c, d, a) * turn(c, d, b) <= 0 &&
        Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
          Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
        Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
          Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
      )
        throw new Error("Los lados de la cerca no pueden cruzarse.");
    }
  for (const [key, min, max] of [
    ["offline_minutes", 1, 10080],
    ["temperature_delta", 0.1, 20],
    ["activity_ratio", 1.1, 20],
    ["battery_min", 0, 100],
  ])
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      throw new Error("Revisa los límites de las alertas.");
  return s;
}
export function validatePacket(p, now = Date.now()) {
  if (!p || typeof p !== "object" || Array.isArray(p))
    throw new Error("Se requiere un objeto JSON.");
  if (
    typeof p.device_id !== "string" ||
    !/^SH-[A-Z0-9-]{3,40}$/.test(p.device_id)
  )
    throw new Error("Identificador de collar inválido.");
  if (
    typeof p.packet_id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(p.packet_id)
  )
    throw new Error("packet_id inválido.");
  const t = Date.parse(p.recorded_at);
  if (!Number.isFinite(t) || t > now + 300000 || t < now - 30 * 86400000)
    throw new Error(
      "Fecha fuera del intervalo permitido (30 días; hasta 5 minutos futuros).",
    );
  for (const [key, min, max] of [
    ["temperature_c", -55, 125],
    ["activity", 0, 100],
    ["battery_pct", 0, 100],
    ["latitude", -90, 90],
    ["longitude", -180, 180],
  ]) {
    if (
      p[key] !== null &&
      p[key] !== undefined &&
      (typeof p[key] !== "number" ||
        !Number.isFinite(p[key]) ||
        p[key] < min ||
        p[key] > max)
    )
      throw new Error("Valor inválido: " + key);
  }
  if ((p.latitude == null) !== (p.longitude == null))
    throw new Error("Envía ambas coordenadas o ninguna.");
  if (
    ["temperature_c", "activity", "latitude", "battery_pct"].every(
      (k) => p[k] == null,
    )
  )
    throw new Error("La lectura no contiene mediciones.");
  return {
    device_id: p.device_id,
    packet_id: p.packet_id,
    recorded_at: new Date(t).toISOString(),
    temperature_c: p.temperature_c ?? null,
    activity: p.activity ?? null,
    battery_pct: p.battery_pct ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  };
}
export function animalReadings(animal, readings) {
  return readings
    .filter((r) => r.animal_id === animal.id)
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
}
export function alertsFor(animal, readings, settings, now = Date.now()) {
  if (animal.status !== "activo") return [];
  const rows = animalReadings(animal, readings),
    r = rows[0],
    alerts = [];
  const add = (kind, title, detail) =>
    alerts.push({
      id: `${animal.id}:${kind}:${r?.id || "none"}`,
      animal_id: animal.id,
      kind,
      title,
      detail,
      recorded_at: r?.recorded_at,
    });
  if (!r) return alerts;
  const stale =
    now - Date.parse(r.recorded_at) > settings.offline_minutes * 60000;
  if (stale) {
    add(
      "offline",
      "Sin lecturas recientes",
      `Último reporte: ${new Date(r.recorded_at).toLocaleString("es-CR")}.`,
    );
    return alerts;
  }
  if (
    r.latitude != null &&
    r.longitude != null &&
    !insidePolygon(r.latitude, r.longitude, settings.polygon)
  )
    add(
      "fence",
      "Fuera de la cerca",
      "La última ubicación recibida está fuera del área configurada. Verifica la posición GPS.",
    );
  if (r.battery_pct != null && r.battery_pct < settings.battery_min)
    add("battery", "Batería baja", `${r.battery_pct}% de carga reportada.`);
  const history = rows
    .slice(1)
    .filter(
      (x) =>
        Date.parse(r.recorded_at) - Date.parse(x.recorded_at) <= 7 * 86400000,
    );
  for (const [key, kind, title] of [
    ["temperature_c", "temperature", "Cambio de temperatura"],
    ["activity", "activity", "Actividad elevada"],
  ]) {
    const values = history.map((x) => x[key]).filter((x) => x != null);
    if (values.length < 5 || r[key] == null) continue;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (
      key === "temperature_c"
        ? Math.abs(r[key] - avg) >= settings.temperature_delta
        : avg > 0 && r[key] >= avg * settings.activity_ratio
    )
      add(
        kind,
        title,
        key === "temperature_c"
          ? `Lectura del collar: ${r[key]} °C; promedio anterior: ${avg.toFixed(1)} °C. Revisar al animal.`
          : `Índice ${r[key]}/100; promedio anterior ${avg.toFixed(1)}. Observar comportamiento; no confirma celo.`,
      );
  }
  return alerts;
}
