import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import PlaceSearch from "./PlaceSearch";
import { collarStatus, PHYSICAL_COLLAR_ID } from "./collarStatus.mjs";
import "leaflet/dist/leaflet.css";
export default function HerdMap({
  animals,
  readings,
  polygon,
  onSelect,
  onSaveBoundary,
  isDemo = false,
  receiver = null,
  collarEnabled = true,
  hideDemoLocations = false,
}) {
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [basemap, setBasemap] = useState(() => {
    try {
      return localStorage.getItem("smartherd-basemap") === "satellite"
        ? "satellite"
        : "street";
    } catch {
      return "street";
    }
  });
  const [tileError, setTileError] = useState(false);
  const fittedBounds = useRef("");
  const centeredOnFirstFix = useRef(false);
  const committedTiles = useRef(null);
  const committedBasemap = useRef(null);
  const pendingTiles = useRef(null);
  const tileHandlers = useRef(new WeakMap());
  const searchMarker = useRef(null);
  const receiverMarker = useRef(null);
  const el = useRef(),
    map = useRef(),
    layer = useRef();
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.current = L.map(el.current, {
      zoomAnimation: false,
      fadeAnimation: !reducedMotion,
      markerZoomAnimation: false,
    }).setView([10.001, -84.115], 15);
    layer.current = L.layerGroup().addTo(map.current);
    let frame;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        map.current?.invalidateSize({ pan: false, debounceMoveend: true }),
      );
    };
    const observer = window.ResizeObserver ? new ResizeObserver(resize) : null;
    observer?.observe(el.current);
    if (!observer) window.addEventListener("resize", resize);
    resize();
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
      map.current.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (basemap === committedBasemap.current && committedTiles.current) return;
    setTileError(false);
    try { localStorage.setItem("smartherd-basemap", basemap); } catch {}
    const previous = committedTiles.current;
    const satellite = basemap === "satellite";
    const tiles = L.tileLayer(
      satellite
        ? "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: satellite
          ? 'Imágenes © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics y la comunidad GIS'
          : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        keepBuffer: 3,
        updateInterval: 150,
        opacity: previous ? 0 : 1,
        zIndex: previous ? 2 : 1,
      },
    );
    pendingTiles.current = tiles;
    let canceled = false;
    let failed = false;
    let loaded = 0;
    let fallback;
    const removeTiles = (layer) => {
      const handlers = tileHandlers.current.get(layer);
      if (handlers) Object.entries(handlers).forEach(([event, handler]) => layer.off(event, handler));
      layer.remove();
    };
    const onLoading = () => { failed = false; loaded = 0; };
    const onTileLoad = () => { loaded += 1; };
    const onError = () => {
      if (!canceled || tiles === committedTiles.current) {
        failed = true;
        setTileError(true);
      }
    };
    const onLoad = () => {
      if (canceled && tiles !== committedTiles.current) return;
      const committing = tiles !== committedTiles.current;
      if (committing) {
        if (previous && (failed || loaded === 0)) {
          clearTimeout(fallback);
          setTileError(true);
          try { localStorage.setItem("smartherd-basemap", committedBasemap.current); } catch {}
          setBasemap(committedBasemap.current);
          return;
        }
        tiles.setOpacity(1);
        if (previous) removeTiles(previous);
        tiles.setZIndex(1);
        committedTiles.current = tiles;
        committedBasemap.current = basemap;
        pendingTiles.current = null;
        clearTimeout(fallback);
        try { localStorage.setItem("smartherd-basemap", basemap); } catch {}
      }
      if (committing || failed || loaded === 0)
        setTileError(failed || loaded === 0);
      if (basemap === "satellite" && failed && loaded === 0)
        setBasemap("street");
    };
    const handlers = { loading: onLoading, tileload: onTileLoad, tileerror: onError, load: onLoad };
    tileHandlers.current.set(tiles, handlers);
    Object.entries(handlers).forEach(([event, handler]) => tiles.on(event, handler));
    tiles.addTo(map.current);
    fallback = setTimeout(() => {
      if (canceled || tiles === committedTiles.current) return;
      setTileError(true);
      if (previous) {
        try { localStorage.setItem("smartherd-basemap", committedBasemap.current); } catch {}
        setBasemap(committedBasemap.current);
      }
      else {
        committedTiles.current = tiles;
        committedBasemap.current = basemap;
        pendingTiles.current = null;
      }
    }, 12000);
    return () => {
      canceled = true;
      clearTimeout(fallback);
      // Only remove a pending layer. Keep the visible layer until its replacement loads.
      if (tiles !== committedTiles.current) {
        removeTiles(tiles);
        if (pendingTiles.current === tiles) pendingTiles.current = null;
      }
    };
  }, [basemap]);
  useEffect(() => {
    if (
      !map.current ||
      !collarEnabled ||
      !receiver?.receiver_connected ||
      !receiver?.transmitter_connected ||
      receiver.signal !== "fix" ||
      !Number.isFinite(receiver.latitude) ||
      !Number.isFinite(receiver.longitude)
    ) {
      receiverMarker.current?.remove();
      receiverMarker.current = null;
      centeredOnFirstFix.current = false;
      return;
    }
    const position = [receiver.latitude, receiver.longitude];
    if (!receiverMarker.current) {
      receiverMarker.current = L.circleMarker(position, {
        radius: 11,
        color: "#211a17",
        weight: 3,
        fillColor: "#fff8ed",
        fillOpacity: 1,
      })
        .addTo(map.current)
        .bindTooltip("GPS recibido por LoRa");
    } else receiverMarker.current.setLatLng(position);
    if (!centeredOnFirstFix.current && !editing) {
      centeredOnFirstFix.current = true;
      if (!map.current.getBounds().contains(position))
        map.current.setView(position, Math.max(map.current.getZoom(), 16), { animate: false });
    }
  }, [receiver?.receiver_connected, receiver?.transmitter_connected,
      receiver?.signal, receiver?.latitude, receiver?.longitude, collarEnabled, editing]);
  useEffect(() => {
    const group = layer.current;
    group.clearLayers();
    const bounds = [];
    if (!editing && polygon?.length >= 3) {
      L.polygon(polygon, {
        className: "farm-boundary-halo",
        color: "#211A17",
        weight: 7,
        opacity: 0.95,
        fill: false,
        interactive: false,
      }).addTo(group);
      L.polygon(polygon, {
        className: "farm-boundary",
        color: "#B85B3F",
        weight: 2,
        fillOpacity: 0.13,
        dashArray: "7 6",
        interactive: false,
      }).addTo(group);
      bounds.push(...polygon);
    }
    animals.forEach((a) => {
      if (isDemo && hideDemoLocations) return;
      const r = readings
        .filter((r) => r.animal_id === a.id && r.latitude != null)
        .sort(
          (a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at),
        )[0];
      if (!r) return;
      const point = [r.latitude, r.longitude];
      bounds.push(point);
      const marker = L.marker(point, {
        icon: L.divIcon({
          className: "cow-marker",
          html: "<span>●</span>",
          iconSize: [28, 28],
        }),
      }).addTo(group);
      const label = document.createElement("div");
      label.textContent = `${a.name} · ${new Date(r.recorded_at).toLocaleString("es-CR")}`;
      marker.bindTooltip(label);
      marker.on("click", () => {
        if (!editing) onSelect(a.id);
      });
    });
    const boundsKey = JSON.stringify(bounds);
    if (bounds.length && !editing && boundsKey !== fittedBounds.current) {
      const firstFit = !fittedBounds.current;
      fittedBounds.current = boundsKey;
      const firstLiveFix = firstFit && collarEnabled &&
        receiver?.receiver_connected && receiver?.transmitter_connected &&
        receiver.signal === "fix" && Number.isFinite(receiver.latitude) &&
        Number.isFinite(receiver.longitude);
      if (!firstLiveFix)
        map.current.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 16,
          animate: false,
        });
    }
  }, [
    animals,
    readings,
    polygon,
    onSelect,
    editing,
    isDemo,
    hideDemoLocations,
  ]);
  useEffect(() => {
    if (!editing || saving) return;
    const instance = map.current;
    const add = ({ latlng }) =>
      setPoints((previous) =>
        previous.length < 100
          ? [...previous, [latlng.lat, latlng.lng]]
          : previous,
      );
    instance.on("click", add);
    instance.doubleClickZoom.disable();
    return () => {
      instance.off("click", add);
      instance.doubleClickZoom.enable();
    };
  }, [editing, saving]);
  useEffect(() => {
    if (!editing) return;
    const draft = L.layerGroup().addTo(map.current);
    if (points.length > 1) {
      const draw = points.length >= 3 ? L.polygon : L.polyline;
      draw(points, {
        color: "#211A17",
        weight: 7,
        fill: false,
        interactive: false,
      }).addTo(draft);
      draw(points, {
        color: "#fff8ed",
        weight: 3,
        fillColor: "#211A17",
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(draft);
    }
    points.forEach((point, index) => {
      const marker = L.marker(point, {
        draggable: !saving,
        title: `Punto ${index + 1}`,
        icon: L.divIcon({
          className: "boundary-point",
          html: `<span>${index + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(draft);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setPoints((previous) =>
          previous.map((p, i) =>
            i === index ? [position.lat, position.lng] : p,
          ),
        );
      });
    });
    return () => draft.remove();
  }, [editing, points, saving]);
  return (
    <div className={`map-view map-${basemap}`}>
      {onSaveBoundary && isDemo && (
        <div className="receiver-status" role="status">
          <strong>Collar {PHYSICAL_COLLAR_ID}</strong>
          <span>{collarStatus({ id: PHYSICAL_COLLAR_ID, enabled: collarEnabled }, receiver).label}</span>
          {collarEnabled && receiver?.signal === "fix" && receiver?.receiver_connected && receiver?.transmitter_connected && (
            <span>
              GPS recibido: {receiver.latitude.toFixed(6)},{" "}
              {receiver.longitude.toFixed(6)} · RSSI {receiver.rssi} dBm
            </span>
          )}
          {collarEnabled && receiver?.receiver_connected && receiver?.transmitter_connected && receiver?.signal === "fix" && Number.isFinite(receiver?.latitude) && Number.isFinite(receiver?.longitude) && (
            <button
              type="button"
              className="text-link receiver-center"
              onClick={() => map.current?.setView([receiver.latitude, receiver.longitude], 16, { animate: false })}
            >
              Centrar collar
            </button>
          )}
        </div>
      )}
      <PlaceSearch
        onSelect={(place) => {
          map.current.setView(place.coordinates, 16, { animate: false });
          searchMarker.current?.remove();
          const label = document.createElement("span");
          label.textContent = place.label;
          searchMarker.current = L.circleMarker(place.coordinates, {
            radius: 9,
            color: "#211a17",
            weight: 3,
            fillColor: "#fff8ed",
            fillOpacity: 1,
            interactive: false,
          })
            .addTo(map.current)
            .bindTooltip(label, { permanent: true, direction: "top" });
          el.current?.focus({ preventScroll: true });
        }}
      />
      <div className="map-view-options" role="group" aria-label="Tipo de mapa">
        <button
          type="button"
          aria-pressed={basemap === "street"}
          onClick={() => setBasemap("street")}
        >
          Mapa
        </button>
        <button
          type="button"
          aria-pressed={basemap === "satellite"}
          onClick={() => setBasemap("satellite")}
        >
          Satélite
        </button>
      </div>
      {onSaveBoundary && (
        <div className="boundary-editor">
          {!editing ? (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setPoints(polygon.map((p) => [...p]));
                setSaveError("");
                setEditing(true);
              }}
            >
              Definir perímetro de la finca
            </button>
          ) : (
            <>
              <p>
                Marca los puntos en orden alrededor de la finca. Arrástralos
                para ajustar su posición o empieza de cero.
              </p>
              <div className="boundary-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={() => setPoints([])}
                >
                  Empezar de cero
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={saving || !points.length}
                  onClick={() => setPoints((p) => p.slice(0, -1))}
                >
                  Quitar último punto
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={saving || points.length < 3}
                  onClick={async () => {
                    setSaving(true);
                    setSaveError("");
                    try {
                      await onSaveBoundary(points);
                      setEditing(false);
                    } catch (error) {
                      setSaveError(
                        error.message ||
                          "No se pudo guardar el perímetro. Intenta de nuevo.",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Guardando…" : "Guardar perímetro"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </button>
              </div>
              <p role="status">
                {points.length} puntos · mínimo 3, máximo 100. Los cambios se
                aplican al guardar.
              </p>
              {saveError && (
                <p className="error" role="alert">
                  {saveError}
                </p>
              )}
              <details>
                <summary>Ver coordenadas</summary>
                <ol className="boundary-coordinates">
                  {points.map((point, index) => (
                    <li key={index}>
                      <span>
                        {point[0].toFixed(6)}, {point[1].toFixed(6)}
                      </span>
                      <button
                        type="button"
                        className="text-link"
                        disabled={saving}
                        aria-label={`Eliminar punto ${index + 1}`}
                        onClick={() =>
                          setPoints((p) => p.filter((_, i) => i !== index))
                        }
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </div>
      )}
      <div
        ref={el}
        className="map"
        tabIndex={0}
        aria-label="Mapa de ubicaciones del ganado"
      />
      {tileError && (
        <p className="map-notice" role="status">
          No se pudieron cargar algunas imágenes. Revisa la conexión y vuelve a intentarlo.
          {" "}<button type="button" className="text-link" onClick={() => {
            setTileError(false);
            (committedTiles.current || pendingTiles.current)?.redraw();
          }}>Reintentar mapa</button>
        </p>
      )}
      {basemap === "satellite" && (
        <p className="map-notice">
          Imágenes de referencia; no son en vivo ni indican límites catastrales.
        </p>
      )}
    </div>
  );
}
