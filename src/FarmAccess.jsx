import { useState } from "react";
import { ArrowRight, Plus, LogOut } from "lucide-react";
import FarmLocationPicker from "./FarmLocationPicker";

const parseBreeds = (value) => [...new Set(value.split(",").map((x) => x.trim()).filter(Boolean))];
export default function FarmAccess({ farms, creating, draftFarm, onCreate, onOpen, onStartCreate, onCancel, onExit, busy, error, brand, appearance }) {
  const [location, setLocation] = useState(draftFarm?.latitude == null ? null : [draftFarm.latitude, draftFarm.longitude]);
  return <div className="farm-access">
    <header className="farm-access-header"><div className="farm-access-brand">{brand}<strong>SmartHerd</strong></div>{appearance}<button type="button" className="text-link" onClick={onExit}><LogOut size={16}/> Cerrar sesión</button></header>
    <main className="farm-access-main">
      {creating ? <section className="panel farm-create-card">
        <p className="eyebrow">TU ESPACIO DE TRABAJO</p>
        <h1>Crear finca</h1>
        <p className="muted">Ubica tu finca para comenzar. Puedes dibujar sus límites con más detalle después.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <form onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          onCreate({
            name: String(f.get("name")).trim(),
            production_type: f.get("production_type"),
            breeds: parseBreeds(String(f.get("breeds"))),
            latitude: location?.[0] ?? null,
            longitude: location?.[1] ?? null,
          });
        }}>
          <div className="farm-create-fields">
            <label>Nombre de la finca<input name="name" required maxLength={100} defaultValue={draftFarm?.name === "Mi finca" ? "" : draftFarm?.name || ""} placeholder="Ej. Finca La Esperanza" /></label>
            <label>Tipo de producción<select name="production_type" defaultValue={draftFarm?.production_type || "leche"}><option value="leche">Leche</option><option value="engorde">Engorde</option><option value="doble">Doble propósito</option></select></label>
            <label className="farm-breeds">Razas presentes<input name="breeds" required maxLength={500} defaultValue={draftFarm?.breeds?.join(", ") || ""} placeholder="Ej. Holstein, Jersey, Brahman" /><small>Separa las razas con comas. Podrás cambiarlas después.</small></label>
          </div>
          <h2>Ubicación en el mapa</h2>
          <FarmLocationPicker value={location} onChange={setLocation} />
          <div className="farm-create-actions">{farms.length > 0 && (!draftFarm || farms.length > 1) && <button type="button" className="secondary" onClick={onCancel}>Volver a mis fincas</button>}<button className="primary" disabled={busy || !location}>{busy ? "Guardando…" : "Crear finca"}<ArrowRight size={18}/></button></div>
        </form>
      </section> : <section className="farm-list">
        <p className="eyebrow">SMART HERD</p><h1>Elige tu finca</h1><p className="muted">Selecciona la finca que quieres consultar o crea una nueva.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="farm-list-grid">{farms.map((farm) => <button key={farm.id} className="farm-choice panel" onClick={() => onOpen(farm.id)}><span className="farm-choice-icon">{farm.name.slice(0, 1).toUpperCase()}</span><span><strong>{farm.name}</strong><small>{farm.production_type === "doble" ? "Doble propósito" : farm.production_type === "leche" ? "Leche" : "Engorde"} · {farm.breeds?.join(", ") || "Razas por definir"}</small></span><ArrowRight size={20}/></button>)}<button className="farm-choice farm-choice-new panel" onClick={onStartCreate}><Plus size={24}/><strong>Crear otra finca</strong></button></div>
      </section>}
    </main>
  </div>;
}
