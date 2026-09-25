const DAY = 86_400_000;

function dayNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? Math.floor(time / DAY) : NaN;
}

function addDays(date, days) {
  return new Date((dayNumber(date) + days) * DAY).toISOString().slice(0, 10);
}

export function potentialHeatForecast(animal, events, date) {
  if (animal.status !== "activo" || animal.sex !== "hembra") return null;
  const today = dayNumber(date);
  if (!Number.isFinite(today)) return null;
  const history = events.filter((event) => event.animal_id === animal.id &&
    ["celo", "parto", "preniez"].includes(event.type) &&
    Number.isFinite(dayNumber(event.date)) && dayNumber(event.date) <= today)
    .sort((a, b) => dayNumber(b.date) - dayNumber(a.date));
  const latest = history[0];
  if (!latest || latest.type === "preniez") return null;
  const postpartum = latest.type === "parto";
  const start = addDays(latest.date, postpartum ? 40 : 18);
  const end = addDays(latest.date, postpartum ? 60 : 24);
  const daysUntil = dayNumber(start) - today;
  return {
    id: `${animal.id}:potential-heat:${latest.id || `${latest.type}-${latest.date}`}`,
    animal_id: animal.id,
    kind: "potential-heat",
    title: "Potencialmente en Celo",
    start,
    end,
    active: today >= dayNumber(start) && today <= dayNumber(end),
    detail: postpartum
      ? `Posible retorno del ciclo entre ${start} y ${end} tras el parto. El periodo posparto varía; observa al animal y consulta al veterinario.`
      : `Ventana estimada entre ${start} y ${end} después del último celo observado. Confirma los signos antes de tomar decisiones reproductivas.`,
    recorded_at: `${latest.date}T12:00:00Z`,
    daysUntil,
  };
}
