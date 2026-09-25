import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import PlaceSearch from "./PlaceSearch";
import "leaflet/dist/leaflet.css";

export default function FarmLocationPicker({ value, onChange }) {
  const element = useRef(null), map = useRef(null), marker = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [basemap, setBasemap] = useState("street");
  useEffect(() => {
    const instance = L.map(element.current, { zoomAnimation: false })
      .setView(value || [10.001, -84.115], value ? 16 : 8);
    map.current = instance;
    instance.on("click", (event) => onChangeRef.current([event.latlng.lat, event.latlng.lng]));
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(element.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const layer = L.tileLayer(basemap === "satellite"
      ? "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: basemap === "satellite" ? "Imágenes © Esri" : "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map.current);
    return () => layer.remove();
  }, [basemap]);
  useEffect(() => {
    if (!value || !map.current) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker(value, { draggable: true }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current.getLatLng();
        onChangeRef.current([p.lat, p.lng]);
      });
    } else marker.current.setLatLng(value);
  }, [value?.[0], value?.[1]]);
  return <div className="farm-location-picker">
    <PlaceSearch onSelect={(place) => {
      map.current?.setView(place.coordinates, 16, { animate: false });
      onChangeRef.current(place.coordinates);
    }} />
    <div className="map-view-options" role="group" aria-label="Tipo de mapa">
      <button type="button" aria-pressed={basemap === "street"} onClick={() => setBasemap("street")}>Mapa</button>
      <button type="button" aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satélite</button>
    </div>
    <div ref={element} className="farm-location-map" aria-label="Elige la ubicación de la finca en el mapa" />
    <p className="hint">Busca un lugar y haz clic en la finca, o arrastra el marcador para precisar su ubicación. Después podrás dibujar el perímetro real en Mapa.</p>
    {value && <p className="farm-coordinates">Ubicación: {value[0].toFixed(6)}, {value[1].toFixed(6)}</p>}
  </div>;
}
