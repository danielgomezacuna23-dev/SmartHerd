import { useState } from "react";
import { Radio, MapPin, Clock3 } from "lucide-react";
import { inspectGps, inspectRadio, LIVE_INTERVAL_SECONDS } from "./tracking.mjs";

export default function TrackingPanel({ tracking, receiver, intervalSeconds, busy, onMode, onTestReceiver, modules, devices, onAddModule, onRemoveModule, onLinkCollar, error }) {
  const [testing, setTesting] = useState("");
  const [results, setResults] = useState({});
  const [role, setRole] = useState("emisor");
  const live = intervalSeconds === LIVE_INTERVAL_SECONDS;
  const test = async (kind) => {
    setTesting(kind);
    setResults((previous) => ({ ...previous, [kind]: null }));
    try {
      const value = await onTestReceiver();
      const result = kind === "lora"
        ? inspectRadio(value, intervalSeconds)
        : inspectGps(value, intervalSeconds);
      setResults((previous) => ({ ...previous, [kind]: result }));
    } catch {
      setResults((previous) => ({
        ...previous,
        [kind]: {
          ok: false,
          message: "No se pudo consultar el receptor de esta Mac. Revisa el puente USB y el permiso de red local del navegador.",
        },
      }));
    } finally {
      setTesting("");
    }
  };

  return (
    <div className="tracking-panel">
      <p>La posición aparece en el mapa cuando el receptor entrega coordenadas GPS válidas. Cada marcador indica la hora de su última lectura.</p>
      <div className="tracking-status" role="status">
        <Clock3 size={19} />
        <span>
          <strong>{live ? "Rastrear en tiempo real" : "Modo habitual"}</strong>
          <small>{live ? "Consulta cada 5 segundos" : "Consulta cada 5 minutos"}</small>
          <small>{receiver?.transmitter_interval_seconds === intervalSeconds
            ? "Intervalo confirmado en el emisor"
            : "Intervalo físico pendiente de confirmar"}</small>
        </span>
      </div>
      <div className="tracking-mode-actions" role="group" aria-label="Frecuencia de rastreo">
        <button type="button" className={live ? "secondary" : "primary"}
          aria-pressed={!live} disabled={busy || (!live && receiver?.transmitter_interval_seconds === 300)} onClick={() => onMode(300)}>
          Habitual · 5 min
        </button>
        <button type="button" className={live ? "primary" : "secondary"}
          aria-pressed={live} disabled={busy || (live && receiver?.transmitter_interval_seconds === 5)} onClick={() => onMode(5)}>
          Rastrear en tiempo real · 5 s
        </button>
      </div>
      {live && <p className="tracking-hint">El modo rápido vuelve al habitual a las {new Date(tracking.live_until).toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" })} para limitar el consumo.</p>}
      <div className="tracking-tests">
        <h3>Comprobar los módulos</h3>
        <p>Estas pruebas leen el último estado real del receptor conectado a esta Mac para <strong>SH-COLLAR-001</strong>. No crean posiciones ficticias.</p>
        <div className="tracking-test-row">
          <button type="button" className="secondary" disabled={!!testing}
            onClick={() => test("lora")}><Radio size={17} /> {testing === "lora" ? "Comprobando…" : "Probar comunicación LoRa"}</button>
          {results.lora && <p role="status" className={results.lora.ok ? "tracking-result success" : "tracking-result"}>{results.lora.message}</p>}
        </div>
        <div className="tracking-test-row">
          <button type="button" className="secondary" disabled={!!testing}
            onClick={() => test("gps")}><MapPin size={17} /> {testing === "gps" ? "Comprobando…" : "Probar recepción GPS"}</button>
          {results.gps && <p role="status" className={results.gps.ok ? "tracking-result success" : "tracking-result"}>{results.gps.message}</p>}
        </div>
        {receiver?.received_at && <small>Última trama local: {new Date(receiver.received_at).toLocaleString("es-CR")}</small>}
      </div>
      <div className="tracking-tests module-registry">
        <h3>Módulos de la finca</h3>
        <p>Registra la identidad física de cada ESP32. El <strong>emisor</strong> va en el collar con GPS; el <strong>receptor</strong> es la estación que recibe LoRa.</p>
        {modules.length ? <ul className="module-list">
          {modules.map((module) => <li key={module.module_id}>
            <span><strong>{module.name}</strong><small>{module.role === "emisor" ? `Emisor · ${module.device_id}` : "Receptor · estación"} · {module.module_id}</small></span>
            <button type="button" className="text-link" disabled={busy} onClick={() => onRemoveModule(module.module_id)} aria-label={`Quitar ${module.name}`}>Quitar</button>
          </li>)}
        </ul> : <p>Aún no hay módulos registrados.</p>}
        <form className="module-form" onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          onAddModule({ module_id: fields.get("module_id"), name: fields.get("name"), role,
            device_id: role === "emisor" ? fields.get("device_id") : null });
        }}>
          <label>Función del módulo
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="emisor">Emisor · collar con GPS</option>
              <option value="receptor">Receptor · estación LoRa</option>
            </select>
          </label>
          <label>Nombre para reconocerlo
            <input name="name" required maxLength={80} placeholder={role === "emisor" ? "Collar de Estrella" : "Estación del hub"} />
          </label>
          <label>MAC del ESP32 (12 caracteres)
            <input name="module_id" required maxLength={17} placeholder="68:EE:8F:4F:32:20" autoCapitalize="characters" />
          </label>
          {role === "emisor" && <label>Collar asociado
            <select name="device_id" required defaultValue="">
              <option value="">Selecciona un collar</option>
              {devices.filter((device) => !modules.some((module) => module.device_id === device.id))
                .map((device) => <option key={device.id} value={device.id}>{device.id}</option>)}
            </select>
          </label>}
          {role === "emisor" && <button type="button" className="text-link" onClick={onLinkCollar}>¿Collar nuevo? Vincularlo primero</button>}
          <button type="submit" className="secondary" disabled={busy}>Registrar módulo</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="tracking-hint">Registrar un módulo no lo programa ni demuestra que esté en línea. La comunicación se confirma con las pruebas cuando los ESP32 estén conectados.</p>
      </div>
      <p className="tracking-hint">Con ambos ESP32 conectados a esta Mac y el puente local activo, el botón envía la orden por LoRa y espera confirmación del emisor. Sin puente local, la preferencia queda guardada para la estación, pero el intervalo físico no cambia.</p>
    </div>
  );
}
