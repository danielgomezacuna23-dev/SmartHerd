import { useEffect, useRef, useState } from "react";

const cache = new Map();
export default function PlaceSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search(event) {
    event.preventDefault();
    if (busy || query.trim().length < 3) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setResults([]);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const key = query.trim().toLocaleLowerCase();
      let places = cache.get(key);
      if (!places) {
        const url = new URL(
          import.meta.env.VITE_GEOCODER_URL || "https://photon.komoot.io/api/",
        );
        url.search = new URLSearchParams({
          q: query.trim(),
          limit: "5",
        });
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Servicio no disponible");
        const data = await response.json();
        places = (data.features || [])
          .filter(
            (f) =>
              f.geometry?.type === "Point" &&
              Number.isFinite(f.geometry.coordinates[0]) &&
              Number.isFinite(f.geometry.coordinates[1]),
          )
          .map((f) => ({
            coordinates: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
            label: [
              ...new Set(
                [
                  f.properties.name,
                  f.properties.street,
                  f.properties.city,
                  f.properties.state,
                  f.properties.country,
                ].filter(Boolean),
              ),
            ].join(", "),
          }));
        if (cache.size >= 50) cache.delete(cache.keys().next().value);
        cache.set(key, places);
      }
      if (request.current !== controller) return;
      setResults(places);
      setMessage(
        places.length
          ? "Selecciona un lugar para verlo en el mapa."
          : "No se encontraron lugares. Prueba con el cantón, provincia o país.",
      );
    } catch {
      if (request.current === controller)
        setMessage("No se pudo buscar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      clearTimeout(timer);
      if (request.current === controller) setBusy(false);
    }
  }
  return (
    <div className="place-search">
      <form role="search" aria-label="Buscar en el mapa" onSubmit={search}>
        <label>
          Buscar un lugar
          <input
            type="search"
            value={query}
            placeholder="Ej. San Carlos, Costa Rica"
            minLength={3}
            maxLength={160}
            onChange={(event) => {
              request.current?.abort();
              request.current = null;
              setBusy(false);
              setQuery(event.target.value);
              setResults([]);
              setMessage("");
            }}
          />
        </label>
        <button
          className="secondary"
          type="submit"
          disabled={busy || query.trim().length < 3}
        >
          {busy ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {results.length > 0 && (
        <ul aria-label="Lugares encontrados">
          {results.map((place, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place);
                  setResults([]);
                  setMessage(`Mostrando: ${place.label}`);
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <small>
        Datos de{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>{" "}
        · Photon
      </small>
    </div>
  );
}
