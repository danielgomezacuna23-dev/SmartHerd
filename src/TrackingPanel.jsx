import { useRef, useState } from "react";
import { Radio, MapPin, Clock3 } from "lucide-react";
import { inspectGps, inspectRadio } from "./tracking.mjs";
import { detectedModule, KNOWN_ESP32 } from "./modules.mjs";

export default function TrackingPanel({ tracking, receiver, intervalSeconds, busy, onMode, onTestReceiver, modules, devices, onAddModule, onRemoveModule, onLinkCollar, error }) {
  const [testing, setTesting] = useState("");
  const [results, setResults] = useState({});
  const [role, setRole] = useState("emisor");
  const [detectionMessage, setDetectionMessage] = useState("");
  const macInput = useRef(null);
  const nameInput = useRef(null);
  const availableCollars = devices.filter((device) => device.enabled &&
    !modules.some((module) => module.device_id === device.id));
  const detect = async () => {
    setTesting("module");
    setDetectionMessage("");
    try {
      const status = await onTestReceiver();
      const module = detectedModule(status, role);
      if (!module) throw new Error(`No se detectó el ${role} con LoRa activo en esta Mac.`);
      macInput.current.value = module.mac;
      if (!nameInput.current.value.trim()) nameInput.current.value = module.name;
      setDetectionMessage(`${module.name} detectado: ${module.mac}`);
    } catch (cause) {
      setDetectionMessage(cause.message || "No se pudo leer el ESP32 conectado. Puedes escribir su MAC manualmente.");
    } finally {
      setTesting("");
    }
  };
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
          <strong>Demostración continua</strong>
          <small>Mensajes LoRa cada 3 segundos mientras el collar está encendido</small>
          <small>{receiver?.transmitter_connected && receiver?.transmitter_interval_seconds === 3
            ? "Confirmado por mensajes LoRa recibidos"
            : "Esperando mensajes del firmware de demostración"}</small>
        </span>
      </div>
      <p className="tracking-hint">El collar puede funcionar solo con batería. La estación receptora escucha continuamente y se conecta por USB a esta Mac.</p>
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
        {receiver?.demo_mode && receiver?.transmitter_connected && <p className="tracking-hint">
          Satélites: {receiver.satellites ?? "Sin dato"} · HDOP: {receiver.hdop ?? "Sin dato"} ·
          Mensajes GPS válidos: {receiver.valid_nmea ?? "—"} · Velocidad GPS: {receiver.gps_baud ?? "—"} baud ·
          Tiempo encendido: {Math.floor((receiver.uptime_ms ?? 0) / 1000)} s
        </p>}
        {receiver?.received_at && <small>Última trama local: {new Date(receiver.received_at).toLocaleString("es-CR")}</small>}
      </div>
      <div className="tracking-tests module-registry">
        <h3>Módulos de la finca</h3>
        <p>Registra la identidad física de cada ESP32. El <strong>emisor</strong> va en el collar con GPS; el <strong>receptor</strong> es la estación que recibe LoRa.</p>
        {modules.length ? <ul className="module-list">
          {modules.map((module) => <li key={module.module_id}>
            <span><strong>{module.name}</strong><small>{module.role === "emisor" ? `Emisor · ${module.device_id}` : "Receptor · estación"} · MAC {module.module_id.match(/.{2}/g).join(":")}</small></span>
            <button type="button" className="text-link" disabled={busy} onClick={() => onRemoveModule(module.module_id)} aria-label={`Quitar ${module.name}`}>Quitar</button>
          </li>)}
        </ul> : <p>Aún no hay módulos registrados.</p>}
        <form className="module-form" onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          const saved = await onAddModule({ module_id: fields.get("module_id"), name: fields.get("name"), role,
            device_id: role === "emisor" ? fields.get("device_id") : null });
          if (saved && form.isConnected) {
            form.reset();
            setDetectionMessage("");
          }
        }}>
          <label>Función del módulo
            <select value={role} onChange={(event) => {
              setRole(event.target.value);
              setDetectionMessage("");
              if (macInput.current) macInput.current.value = "";
              if (nameInput.current) nameInput.current.value = "";
            }}>
              <option value="emisor">Emisor · collar con GPS</option>
              <option value="receptor">Receptor · estación LoRa</option>
            </select>
          </label>
          <label>Nombre para reconocerlo
            <input ref={nameInput} name="name" required maxLength={80} placeholder={role === "emisor" ? "Collar de Estrella" : "Estación del hub"} />
          </label>
          <label>MAC del ESP32
            <input ref={macInput} name="module_id" required maxLength={17} placeholder={KNOWN_ESP32[role].mac} autoCapitalize="characters" spellCheck="false" />
          </label>
          <small className="tracking-hint">Es el identificador de 12 caracteres hexadecimales de la placa; puedes escribirlo con o sin dos puntos. El emisor con GPS y el receptor tienen MAC distintas.</small>
          <button type="button" className="secondary" disabled={busy || !!testing} onClick={detect}>Detectar módulo</button>
          {detectionMessage && <p className="tracking-hint" role="status">{detectionMessage}</p>}
          {role === "emisor" && <label>Collar asociado
            <select name="device_id" required defaultValue="">
              <option value="">{availableCollars.length ? "Selecciona un collar" : "Primero vincula un collar activo"}</option>
              {availableCollars
                .map((device) => <option key={device.id} value={device.id}>{device.id}</option>)}
            </select>
          </label>}
          {role === "emisor" && !availableCollars.length && <p className="tracking-hint">Aún no hay un collar activo sin emisor en esta finca. Vincula el collar al animal antes de registrar esta placa.</p>}
          {role === "emisor" && <button type="button" className="text-link" onClick={onLinkCollar}>¿Collar nuevo? Vincularlo primero</button>}
          <button type="submit" className="secondary" disabled={busy || (role === "emisor" && !availableCollars.length)}>Registrar módulo</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="tracking-hint">Registrar un módulo no lo programa ni demuestra que esté en línea. La comunicación se confirma con mensajes LoRa, con el collar encendido y la estación conectada por USB.</p>
      </div>
      <p className="tracking-hint">Abre «Iniciar puente SmartHerd» en esta Mac y permite el acceso a la red local cuando Chrome lo solicite. Solo el receptor necesita USB. La página y Supabase requieren internet; el enlace LoRa entre módulos funciona independientemente.</p>

    </div>
  );
}
