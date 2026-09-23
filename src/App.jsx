import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  LayoutDashboard,
  MapPin,
  Radio,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ArrowLeft,
  Activity,
  Thermometer,
  Battery,
  Download,
  X,
  Check,
  LogOut,
  Leaf,
  Wifi,
  TriangleAlert,
  Heart,
  ClipboardList,
  Sun,
  Moon,
} from "lucide-react";
import { supabase, loadDemo, saveDemo, loadCloud, writeCloud } from "./data";
import {
  uid,
  today,
  defaults,
  alertsFor,
  animalReadings,
  validateSettings,
} from "./domain.mjs";
import HerdMap from "./Map";
import Login from "./Login";
import { ErrorPage, ErrorPanel } from "./Errors";
import { configurationError } from "./data";
import MotionContent from "./MotionContent";
import useReceiverStatus from "./useReceiverStatus";
import { collarStatus, PHYSICAL_COLLAR_ID } from "./collarStatus.mjs";
const nav = [
  ["overview", "Resumen", LayoutDashboard],
  ["animals", "Mi ganado", CattleIcon],
  ["map", "Mapa", MapPin],
  ["alerts", "Alertas", TriangleAlert],
  ["devices", "Collares", Radio],
  ["settings", "Mi finca", Settings],
];
const labels = {
  peso: "Peso",
  vacuna: "Vacuna",
  tratamiento: "Tratamiento",
  revision: "Revisión",
  celo: "Celo observado",
  servicio: "Servicio / inseminación",
  preniez: "Preñez confirmada",
  parto: "Parto",
};
const fmt = (d) =>
  d
    ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString(
        "es-CR",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : "Sin registrar";
const stamp = (d) => (d ? new Date(d).toLocaleString("es-CR") : "Sin lecturas");
function BrandMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 9C7 9 5 7 5 4M22 9C25 9 27 7 27 4" />
      <path d="M10 11C7 9 4 10 2 12C4 15 7 16 10 15M22 11C25 9 28 10 30 12C28 15 25 16 22 15" />
      <path d="M10 10Q16 7 22 10L21 22C21 26 19 28 16 28C13 28 11 26 11 22Z" />
      <path d="M11 22Q16 19 21 22" />
      <circle cx="13.5" cy="15.5" r=".85" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="15.5" r=".85" fill="currentColor" stroke="none" />
    </svg>
  );
}
function CattleIcon({ size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 9h14l3-3 5 1 2 5-3 2-4-1-2 4H7L4 14V9L2 7M7 17v6h3l1-6m7 0 1 6h3l-1-9M23 6l-1-3m4 4 2-3M4 9v8" />
      <circle cx="25.5" cy="10" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ThemeSwitch({ theme, onChange }) {
  return (
    <div className="theme-switch" role="group" aria-label="Apariencia">
      <button
        type="button"
        aria-label="Modo claro"
        aria-pressed={theme === "light"}
        onClick={() => onChange("light")}
        title="Tierra cálida · modo claro"
      >
        <Sun size={17} />
        <span>Claro</span>
      </button>
      <button
        type="button"
        aria-label="Modo oscuro"
        aria-pressed={theme === "dark"}
        onClick={() => onChange("dark")}
        title="Cacao y terracota · modo oscuro"
      >
        <Moon size={17} />
        <span>Oscuro</span>
      </button>
    </div>
  );
}
function Preferences({ theme, onChange, onSettings, onHelp, onExit }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    root.current.querySelector(".preferences-panel button")?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="preferences" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="icon-button preferences-trigger"
        aria-label="Abrir preferencias"
        aria-expanded={open}
        aria-controls="preferences-panel"
        onClick={() => setOpen(!open)}
        title="Preferencias"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && (
        <section
          id="preferences-panel"
          className="preferences-panel"
          aria-label="Preferencias"
        >
          <h2>Preferencias</h2>
          <p>Apariencia</p>
          <ThemeSwitch theme={theme} onChange={onChange} />
          <button
            type="button"
            className="preferences-settings"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              onSettings();
            }}
          >
            <Settings size={18} />
            Configuración de la finca
            <ArrowUpRight size={16} />
          </button>
          <button
            type="button"
            className="preferences-settings"
            onClick={() => {
              setOpen(false);
              onHelp();
            }}
          >
            Ayuda y diagnóstico
          </button>
          <button
            type="button"
            className="preferences-settings"
            onClick={() => {
              setOpen(false);
              onExit();
            }}
          >
            Volver al acceso
          </button>
        </section>
      )}
    </div>
  );
}
function FarmLandscape({ className = "" }) {
  return (
    <svg
      className={"farm-landscape " + className}
      viewBox="0 0 420 130"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
        <path d="M2 111 50 89 81 94 144 32 165 45 199 11 235 48 257 40 313 86 346 79 417 115M47 105 142 43 158 69 198 22 229 73 252 51 312 99M105 100 142 58 148 82M172 82 198 36 224 94M210 53 234 93M5 118Q80 96 145 114T279 116T417 122M14 125Q106 111 190 125M264 107 286 88 308 107M273 107V121H301V107M282 121V111H291V121" />
        <path d="M327 111V87M316 99Q304 89 317 83Q310 70 326 72Q336 59 343 75Q360 80 348 91Q355 105 327 102M67 112V92M57 101Q43 90 58 86Q58 72 70 80Q87 76 85 89Q97 103 67 102M366 115V94M356 105Q346 95 358 91Q359 80 370 86Q384 88 379 99Q386 108 366 107" />
        <path d="m105 118 6-4 13 1 5 5m-19-3-2 8m15-8 2 8m2-7 6-5 4 2m-36 6 7-2M183 120l7-3 15 1 5 4m-21-2-1 7m16-7 2 7m2-6 5-4 4 1" />
      </g>
    </svg>
  );
}
function Badge({ children, tone = "" }) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Empty({ children }) {
  return (
    <div className="empty">
      <Leaf size={28} />
      <p>{children}</p>
    </div>
  );
}
function Field({ label, children }) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  );
}
function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      [
        ...dialog.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
    (
      dialog.current.querySelector("input, select, textarea") ||
      controls()[0] ||
      dialog.current
    ).focus();
    const fn = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <div className="scrim" onClick={onClose}>
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Spark({ rows, field, label, unit }) {
  const points = rows
    .slice(0, 24)
    .reverse()
    .filter((r) => r[field] != null);
  if (points.length < 2)
    return (
      <Empty>
        Se necesitan al menos dos lecturas para mostrar {label.toLowerCase()}.
      </Empty>
    );
  const min = Math.min(...points.map((r) => r[field])),
    max = Math.max(...points.map((r) => r[field]));
  return (
    <div className="chart">
      <div className="section-head">
        <h3>{label}</h3>
        <strong>
          {points.at(-1)[field]} {unit}
        </strong>
      </div>
      <svg
        viewBox="0 0 500 110"
        role="img"
        aria-label={`${label}: mínimo ${min}, máximo ${max} ${unit}`}
      >
        <path
          d="M0 25H500 M0 65H500 M0 105H500"
          stroke="var(--line)"
          fill="none"
        />
        <polyline
          points={points
            .map(
              (r, i) =>
                `${(i / (points.length - 1)) * 500},${95 - ((r[field] - min) / (max - min || 1)) * 75}`,
            )
            .join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
        />
      </svg>
      <div className="chart-axis">
        <span>{stamp(points[0].recorded_at)}</span>
        <span>{stamp(points.at(-1).recorded_at)}</span>
      </div>
    </div>
  );
}
export default function App() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#211A17" : "#FBF7EF");
    try {
      localStorage.setItem("smartherd-theme", theme);
    } catch {
      /* The selected theme still works when browser storage is unavailable. */
    }
  }, [theme]);
  const [session, setSession] = useState(null),
    [authReady, setAuthReady] = useState(!supabase),
    [demo, setDemo] = useState(() => {
      try {
        return sessionStorage.getItem("smartherd-demo-access") === "true";
      } catch {
        return false;
      }
    }),
    [data, setData] = useState(null),
    [page, setPage] = useState("overview"),
    [selected, setSelected] = useState(null),
    [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState("activo"),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now());
  const receiver = useReceiverStatus(demo && !!data);
  const hadLiveReceiver = useRef(false);
  const refreshGeneration = useRef(0);
  if (receiver?.receiver_connected) hadLiveReceiver.current = true;
  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        setError("Network: no se pudo comprobar la sesión");
        setAuthReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        setSession(s);
        setAuthReady(true);
        return;
      }
      refreshGeneration.current += 1;
      setSession(s);
      setData(null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const next = demo ? loadDemo() : await loadCloud();
      if (generation === refreshGeneration.current) {
        setError("");
        setData(next);
      }
    } catch (e) {
      if (generation === refreshGeneration.current)
        setError("No se pudieron cargar los datos: " + e.message);
    }
  }, [demo]);
  useEffect(() => {
    refreshGeneration.current += 1;
  }, [demo]);
  useEffect(() => {
    if (demo || session) refresh();
  }, [demo, session, refresh]);
  useEffect(() => {
    const id = setInterval(() => {
      setClock(Date.now());
      if (!demo && session) refresh();
    }, 30000);
    return () => clearInterval(id);
  }, [demo, session, refresh]);
  useEffect(() => {
    if (demo || !session?.user?.id || !supabase) return;
    let timer;
    const queueRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!document.hidden) void refresh(); }, 250);
    };
    const channel = supabase.channel(`smartherd-live-${session.user.id}-${Date.now()}`);
    for (const table of ["telemetry", "devices", "animals", "events", "farm_settings", "alert_acknowledgements"])
      channel.on("postgres_changes", {
        event: "*", schema: "public", table,
        filter: `owner_id=eq.${session.user.id}`,
      }, queueRefresh);
    channel.subscribe((status) => { if (status === "SUBSCRIBED") queueRefresh(); });
    const resume = () => { if (!document.hidden) queueRefresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      void supabase.removeChannel(channel);
    };
  }, [demo, session?.user?.id, refresh]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  const save = async (table, row, key) => {
    if (demo) {
      setData((prev) => {
        const next = {
          ...prev,
          [key]: [...prev[key].filter((x) => x.id !== row.id), row],
        };
        saveDemo(next);
        return next;
      });
    } else {
      await writeCloud(table, { ...row, owner_id: session.user.id });
      await refresh();
    }
    setNotice("Cambios guardados");
  };
  const choose = useCallback((id) => {
    setSelected(id);
    setPage("animals");
  }, []);
  const allAlerts = useMemo(
    () =>
      data
        ? data.animals.flatMap((a) =>
            alertsFor(a, data.readings, data.settings, clock),
          )
        : [],
    [data, clock],
  );
  const alerts = allAlerts.filter((a) => !data?.acknowledged.includes(a.id));
  const active = useMemo(
    () => data?.animals.filter((a) => a.status === "activo") || [],
    [data?.animals],
  );
  const animal = data?.animals.find((a) => a.id === selected);
  const rows = animal ? animalReadings(animal, data.readings) : [];
  const latest = rows[0];
  const acknowledge = (alert) =>
    act(async () => {
      if (demo) {
        const next = {
          ...data,
          acknowledged: [...data.acknowledged, alert.id],
        };
        saveDemo(next);
        setData(next);
      } else {
        await writeCloud("alert_acknowledgements", {
          owner_id: session.user.id,
          alert_id: alert.id,
        });
        await refresh();
      }
    });
  const simulate = () =>
    act(async () => {
      const additions = data.devices
        .filter((d) => d.enabled && d.animal_id)
        .map((d, i) => ({
          id: uid(),
          device_id: d.id,
          animal_id: d.animal_id,
          packet_id: uid(),
          recorded_at: new Date().toISOString(),
          temperature_c: Math.round((33 + Math.random() * 1.2) * 10) / 10,
          activity: Math.round(23 + Math.random() * 12),
          battery_pct: 70,
          latitude: 10.001 + i * 0.0006,
          longitude: -84.116 + i * 0.0007,
        }));
      const next = {
        ...data,
        readings: [...data.readings, ...additions].slice(-5000),
      };
      saveDemo(next);
      setData(next);
      setNotice(`${additions.length} lecturas simuladas recibidas`);
    });
  const exportCSV = () => {
    const fields = [
      "animal",
      "arete",
      "fecha",
      "temperatura_c",
      "actividad",
      "bateria_pct",
      "latitud",
      "longitud",
    ];
    const csv = [
      fields,
      ...data.readings.map((r) => {
        const a = data.animals.find((a) => a.id === r.animal_id);
        return [
          a?.name,
          a?.ear_tag,
          r.recorded_at,
          r.temperature_c,
          r.activity,
          r.battery_pct,
          r.latitude,
          r.longitude,
        ];
      }),
    ]
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const u = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = `smartherd-lecturas-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  };
  if (!authReady) return <div className="loading">Cargando SmartHerd…</div>;
  const leaveAccess = async () => {
    if (session && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message);
        return;
      }
    }
    try {
      sessionStorage.removeItem("smartherd-demo-access");
    } catch {}
    setDemo(false);
    setData(null);
    setError("");
    setPage("overview");
    setSelected(null);
    setModal(null);
  };
  if (!demo && !session)
    return (
      <Login
        brand={<BrandMark />}
        appearance={<ThemeSwitch theme={theme} onChange={setTheme} />}
        configured={!!supabase}
        configError={configurationError}
        error={error}
        busy={busy}
        onLogin={(credentials) =>
          act(async () => {
            if (!supabase) throw new Error("Configuración Supabase pendiente");
            const { error } =
              await supabase.auth.signInWithPassword(credentials);
            if (error) throw error;
          })
        }
        onDemo={() => {
          try {
            sessionStorage.setItem("smartherd-demo-access", "true");
          } catch {}
          setDemo(true);
          setError("");
        }}
      />
    );
  if (!data)
    return error ? (
      <ErrorPage error={error} onRetry={refresh} onBack={leaveAccess} />
    ) : (
      <div className="loading" role="status">
        Cargando tu finca…
      </div>
    );
  const connected = data.devices.filter(
    (d) =>
      d.enabled &&
      data.readings.some(
        (r) =>
          r.device_id === d.id &&
          clock - Date.parse(r.recorded_at) <
            data.settings.offline_minutes * 60000,
      ),
  ).length;
  const physicalDevice = data.devices.find((device) => device.id === PHYSICAL_COLLAR_ID);
  const physicalStatus = physicalDevice && collarStatus(physicalDevice, receiver);
  const title = nav.find((n) => n[0] === page)?.[1];
  const alertList = (list, compact = false) =>
    list.length ? (
      <div className={"alert-list" + (compact ? " compact-alerts" : "")}>
        {list.map((a) => (
          <div className="alert-row" key={a.id}>
            <div className={"alert-icon " + (a.kind === "fence" ? "red" : "")}>
              <TriangleAlert size={19} />
            </div>
            <div className="grow">
              <button className="text-link" onClick={() => choose(a.animal_id)}>
                {data.animals.find((x) => x.id === a.animal_id)?.name}
              </button>
              <h3>{a.title}</h3>
              <p>
                {compact
                  ? {
                      offline: `Último reporte: ${stamp(a.recorded_at)}`,
                      temperature:
                        "Variación de temperatura. Revisar al animal.",
                      activity: "Actividad por encima de su promedio.",
                      fence: "La última posición está fuera de la cerca.",
                    }[a.kind] || a.detail
                  : a.detail}
              </p>
            </div>
            <button
              className="review-button"
              aria-label={`Marcar revisada: ${a.title}`}
              title="Marcar revisada"
              disabled={busy}
              onClick={() => acknowledge(a)}
            >
              <Check size={18} />
              <span>Revisada</span>
            </button>
          </div>
        ))}
      </div>
    ) : (
      <Empty>No hay alertas pendientes de revisión.</Empty>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-icon">
            <BrandMark />
          </span>
          <span>
            SmartHerd<small>GANADERÍA CONECTADA</small>
          </span>
        </a>
        <div className="farm-label">
          <span className="farm-avatar">{data.settings.name.slice(0, 1)}</span>
          <div>
            <strong>{data.settings.name}</strong>
            <small>
              {demo ? "Finca de demostración" : "Mi espacio de trabajo"}
            </small>
          </div>
        </div>
        <p className="nav-caption">ADMINISTRACIÓN</p>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              aria-current={page === key ? "page" : undefined}
              onClick={() => {
                setPage(key);
                setSelected(null);
              }}
            >
              <Icon size={19} />
              {label}
              {key === "alerts" && alerts.length > 0 && <b>{alerts.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <FarmLandscape />
          <div className="connection">
            <span className="dot" />
            {demo ? "Demostración local" : "Supabase conectado"}
          </div>
          <p>
            {demo
              ? "Datos de ejemplo guardados en este navegador."
              : "Actualización automática cada 30 segundos."}
          </p>
          {supabase && (
            <button
              className="text-link"
              onClick={() =>
                act(async () => {
                  if (demo) {
                    try {
                      sessionStorage.removeItem("smartherd-demo-access");
                    } catch {}
                    setDemo(false);
                    setData(null);
                  } else {
                    await supabase.auth.signOut();
                    setData(null);
                  }
                })
              }
            >
              <LogOut size={15} />
              {demo ? "Volver al acceso" : "Cerrar sesión"}
            </button>
          )}
          <small>EXPO TÉCNICA · 2026</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Mi finca <span className="muted">/ {title}</span>
          </span>
          <div>
            <span className="date">
              {new Date(clock).toLocaleDateString("es-CR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="profile">
              {data.settings.name.slice(0, 2).toUpperCase()}
            </span>
            <Preferences
              theme={theme}
              onChange={setTheme}
              onHelp={() => setModal({ type: "diagnostics" })}
              onExit={() => act(leaveAccess)}
              onSettings={() => {
                setSelected(null);
                setPage("settings");
              }}
            />
          </div>
        </header>
        <MotionContent key={`${page}-${selected || ""}`}>
          <div className="workspace-toolbar">
            {page === "overview" && <h1 className="sr-only">Resumen</h1>}
            <span className="workspace-status">
              <span className="dot" />
              {demo ? "Demostración · datos ficticios" : data.settings.name}
            </span>
            <div className="toolbar-actions">
              {demo && (
                <button
                  className="secondary simulate-button"
                  onClick={simulate}
                  disabled={busy}
                >
                  <Radio size={17} /> Simular lecturas
                </button>
              )}
              {page === "overview" && (
                <button
                  className="primary"
                  onClick={() => setModal({ type: "animal" })}
                >
                  <Plus size={18} /> Registrar animal
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="text-link"
                onClick={() => setModal({ type: "diagnostics" })}
              >
                Ver cómo resolverlo
              </button>
              <button aria-label="Cerrar error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {page !== "overview" && (
            <div className="page-heading">
              <div>
                <h1>{animal && page === "animals" ? animal.name : title}</h1>
              </div>
              {page === "animals" && !animal ? (
                <button
                  className="primary"
                  onClick={() => setModal({ type: "animal" })}
                >
                  <Plus size={17} /> Registrar animal
                </button>
              ) : page === "devices" ? (
                <button
                  className="primary"
                  onClick={() => setModal({ type: "device" })}
                >
                  <Plus size={17} /> Vincular collar
                </button>
              ) : null}
            </div>
          )}
          {page === "overview" && (
            <>
              <div
                className="stats dashboard-stats"
                aria-label="Indicadores de la finca"
              >
                {[
                  [
                    CattleIcon,
                    "Animales activos",
                    active.length,
                    "Ver ganado",
                    () => {
                      setSelected(null);
                      setQuery("");
                      setStatusFilter("activo");
                      setPage("animals");
                    },
                  ],
                  [
                    Wifi,
                    demo ? "Collar físico" : "Collares con señal",
                    demo ? (physicalStatus?.label || "Sin vincular") : `${connected} / ${data.devices.length}`,
                    "Ver collares",
                    () => setPage("devices"),
                  ],
                  [
                    TriangleAlert,
                    "Por revisar",
                    alerts.length,
                    "Revisar alertas",
                    () => setPage("alerts"),
                  ],
                  [
                    Heart,
                    "Eventos registrados",
                    data.events.length,
                    "Ver historial",
                    () => setModal({ type: "history" }),
                  ],
                ].map(([Icon, label, value, action, onClick]) => (
                  <button
                    className={
                      "stat stat-link" +
                      (demo && label === "Collar físico" ? " stat-connection" : "") +
                      (label === "Por revisar" && alerts.length
                        ? " stat-attention"
                        : "")
                    }
                    key={label}
                    onClick={onClick}
                    aria-label={`${label}: ${value}. ${action}`}
                  >
                    <span className="stat-top">
                      <span className="stat-icon">
                        <Icon size={22} />
                      </span>
                      <span>{label}</span>
                    </span>
                    <strong>{value}</strong>
                    <span className="stat-action">
                      {action}
                      <ArrowUpRight size={17} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel map-panel">
                  <div className="section-head">
                    <div>
                      <h2>Ubicación del ganado</h2>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => setPage("map")}
                    >
                      Abrir mapa <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <HerdMap
                    animals={active}
                    readings={data.readings}
                    polygon={data.settings.polygon}
                    onSelect={choose}
                    isDemo={demo}
                    receiver={receiver}
                    collarEnabled={physicalDevice?.enabled ?? false}
                    hideDemoLocations={hadLiveReceiver.current}
                  />
                  <div className="map-legend">
                    <span>
                      <i /> Cerca de la finca
                    </span>
                    <span>● {demo ? "Ubicaciones de demostración o GPS recibido" : "Última posición recibida"}</span>
                  </div>
                </section>
                <section className="panel attention-panel">
                  <div className="section-head">
                    <h2>Por revisar</h2>
                    <Badge tone="amber">{alerts.length}</Badge>
                  </div>
                  {alertList(alerts.slice(0, 3), true)}
                  {alerts.length > 0 && (
                    <button
                      className="wide-link"
                      onClick={() => setPage("alerts")}
                    >
                      Ver todas las alertas <ArrowUpRight size={16} />
                    </button>
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Mi ganado</h2>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setSelected(null);
                      setPage("animals");
                    }}
                  >
                    Ver ganado <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="animal-cards">
                  {active.slice(0, 4).map((a) => (
                    <AnimalCard
                      key={a.id}
                      animal={a}
                      data={data}
                      alerts={alerts}
                      choose={choose}
                    />
                  ))}
                  {!active.length && (
                    <Empty>Registra tu primer animal para comenzar.</Empty>
                  )}
                </div>
              </section>
            </>
          )}
          {page === "animals" && !animal && (
            <>
              <div className="filters">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Buscar animal"
                    placeholder="Buscar por nombre o arete…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filtrar por estado"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="activo">Activos</option>
                  <option value="todos">Todos los estados</option>
                  <option value="vendido">Vendidos</option>
                  <option value="baja">Bajas</option>
                </select>
              </div>
              <div className="herd-grid">
                {data.animals
                  .filter(
                    (a) =>
                      (statusFilter === "todos" || a.status === statusFilter) &&
                      (a.name + " " + a.ear_tag)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((a) => (
                    <AnimalCard
                      key={a.id}
                      animal={a}
                      data={data}
                      alerts={alerts}
                      choose={choose}
                    />
                  ))}
              </div>
              {!data.animals.some(
                (a) =>
                  (statusFilter === "todos" || a.status === statusFilter) &&
                  (a.name + " " + a.ear_tag)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              ) && (
                <Empty>No hay animales que coincidan con la búsqueda.</Empty>
              )}
            </>
          )}
          {page === "animals" && animal && (
            <>
              <div className="detail-actions">
                <button className="secondary" onClick={() => setSelected(null)}>
                  <ArrowLeft size={16} /> Volver al ganado
                </button>
                <div>
                  <button
                    className="secondary"
                    onClick={() => setModal({ type: "animal", animal })}
                  >
                    Editar ficha
                  </button>
                  <button
                    className="primary"
                    onClick={() => setModal({ type: "event", animal })}
                  >
                    <Plus size={16} /> Registrar evento
                  </button>
                </div>
              </div>
              <section className="panel animal-summary">
                <div className="tag large">{animal.ear_tag.slice(-4)}</div>
                <div>
                  <h2>
                    {animal.name} <Badge>{animal.status}</Badge>
                  </h2>
                  <p>
                    {animal.ear_tag} · {animal.breed} · {animal.sex} ·{" "}
                    {animal.purpose}
                  </p>
                  <p>Nacimiento: {fmt(animal.birth_date)}</p>
                </div>
                <div className="summary-right">
                  <small>Última lectura</small>
                  <strong>{stamp(latest?.recorded_at)}</strong>
                  <small>{rows.length} lecturas disponibles</small>
                </div>
              </section>
              <div className="stats">
                {[
                  [
                    Thermometer,
                    "Temperatura del collar",
                    latest?.temperature_c,
                    "°C",
                  ],
                  [Activity, "Índice de actividad", latest?.activity, "/100"],
                  [Battery, "Batería", latest?.battery_pct, "%"],
                ].map(([Icon, label, value, unit]) => (
                  <div className="stat" key={label}>
                    <div>
                      <span>{label}</span>
                      <Icon size={19} />
                    </div>
                    <strong>{value == null ? "—" : `${value}${unit}`}</strong>
                    <small>Último reporte recibido</small>
                  </div>
                ))}
              </div>
              <p className="hint">
                La temperatura es superficial o del entorno del collar. Las
                variaciones y la actividad requieren observación; no confirman
                enfermedad ni celo.
              </p>
              {alertList(alerts.filter((a) => a.animal_id === animal.id))}
              <div className="two-col">
                <section className="panel">
                  <Spark
                    rows={rows}
                    field="temperature_c"
                    label="Tendencia de temperatura"
                    unit="°C"
                  />
                </section>
                <section className="panel">
                  <Spark
                    rows={rows}
                    field="activity"
                    label="Actividad"
                    unit="/100"
                  />
                </section>
              </div>
              <section className="panel">
                <div className="section-head">
                  <h2>Historial sanitario y reproductivo</h2>
                  <ClipboardList size={20} />
                </div>
                {data.events.filter((e) => e.animal_id === animal.id).length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Evento</th>
                          <th>Detalle</th>
                          <th>Próximo control</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.events
                          .filter((e) => e.animal_id === animal.id)
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((e) => (
                            <tr key={e.id}>
                              <td>{fmt(e.date)}</td>
                              <td>
                                <Badge>{labels[e.type]}</Badge>
                              </td>
                              <td>
                                {e.value != null ? `${e.value} kg · ` : ""}
                                {e.notes || "—"}
                              </td>
                              <td>{fmt(e.next_date)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>
                    Aún no hay eventos. Registra un peso, una revisión o un
                    evento reproductivo.
                  </Empty>
                )}
                <p className="hint">
                  Un servicio registrado no confirma preñez. Registra la
                  confirmación por separado.
                </p>
              </section>
            </>
          )}
          {page === "map" && (
            <section className="panel full-map">
              <HerdMap
                isDemo={demo}
                receiver={receiver}
                collarEnabled={physicalDevice?.enabled ?? false}
                hideDemoLocations={hadLiveReceiver.current}
                onSaveBoundary={async (polygon) => {
                  const settings = { ...data.settings, polygon };
                  validateSettings(settings);
                  if (demo) {
                    const next = { ...data, settings };
                    saveDemo(next);
                    setData(next);
                  } else {
                    await writeCloud("farm_settings", {
                      ...settings,
                      owner_id: session.user.id,
                    });
                    await refresh();
                  }
                  setNotice("Perímetro de la finca guardado");
                }}
                animals={active}
                readings={data.readings}
                polygon={data.settings.polygon}
                onSelect={choose}
              />
              <div className="map-legend">
                {demo
                  ? "Las ubicaciones de ejemplo aparecen antes de conectar el receptor. Una ubicación real requiere GPS válido."
                  : "Selecciona un marcador para abrir la ficha. Consulta la hora del reporte."}
              </div>
              {!data.readings.some((r) => r.latitude != null) && (
                <Empty>Todavía no se han recibido coordenadas GPS.</Empty>
              )}
            </section>
          )}
          {page === "alerts" && (
            <>
              <section className="panel">
                <div className="section-head">
                  <h2>Pendientes de revisión</h2>
                  <Badge tone="amber">{alerts.length}</Badge>
                </div>
                {alertList(alerts)}
              </section>
              <p className="hint">
                Al marcar una señal como revisada, se reconoce únicamente esa
                lectura. Una nueva lectura puede generar otra alerta. Las
                alertas se calculan al abrir el panel y cada 30 segundos; no se
                envían por SMS o correo.
              </p>
            </>
          )}
          {page === "devices" && (
            <>
              <div className="flow">
                <span>Collar + sensores</span>
                <ArrowUpRight size={18} />
                <span>LoRa → estación ESP32</span>
                <ArrowUpRight size={18} />
                <span>Supabase</span>
                <ArrowUpRight size={18} />
                <span>Tu finca</span>
              </div>
              <section className="panel">
                <div className="section-head">
                  <h2>Collares vinculados</h2>
                  <Radio size={21} />
                </div>
                {demo && <p className="hint" role="status" aria-live="polite">Estado local actualizado cada 3 segundos. El collar {PHYSICAL_COLLAR_ID} corresponde al ESP32 con GPS; los demás son ejemplos.</p>}
                {data.devices.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Collar</th>
                          <th>Animal</th>
                          <th>Último reporte</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.devices.map((d) => {
                          const r = data.readings
                            .filter((r) => r.device_id === d.id)
                            .sort(
                              (a, b) =>
                                Date.parse(b.recorded_at) -
                                Date.parse(a.recorded_at),
                            )[0];
                          const live = demo ? collarStatus(d, receiver) : null;
                          return (
                            <tr key={d.id}>
                              <td>
                                <strong>{d.id}</strong>
                              </td>
                              <td>
                                {data.animals.find((a) => a.id === d.animal_id)
                                  ?.name || "Sin animal"}
                              </td>
                              <td>{demo ? d.id === PHYSICAL_COLLAR_ID ? stamp(receiver?.received_at) : "Solo ejemplo" : stamp(r?.recorded_at)}</td>
                              <td>
                                <Badge
                                  tone={
                                    live ? live.tone : !d.enabled
                                      ? "neutral"
                                      : !r ||
                                          clock - Date.parse(r.recorded_at) >
                                            data.settings.offline_minutes *
                                              60000
                                        ? "amber"
                                        : ""
                                  }
                                >
                                  {live ? live.label : !d.enabled
                                    ? "Desactivado"
                                    : !r
                                      ? "Sin lecturas"
                                      : clock - Date.parse(r.recorded_at) >
                                          data.settings.offline_minutes * 60000
                                        ? "Sin señal reciente"
                                        : "Con señal"}
                                </Badge>
                                {live && <small className="collar-status-detail">{live.detail}</small>}
                              </td>
                              <td>
                                <button
                                  className="text-link"
                                  disabled={busy}
                                  onClick={() =>
                                    act(() =>
                                      save(
                                        "devices",
                                        {
                                          id: d.id,
                                          animal_id: d.animal_id,
                                          enabled: !d.enabled,
                                        },
                                        "devices",
                                      ),
                                    )
                                  }
                                >
                                  {d.enabled ? "Desactivar" : "Activar"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>Vincula tu primer collar a un animal.</Empty>
                )}
              </section>
              <p className="hint">
                La estación base necesita acceso a internet para enviar datos.
                Vincular un collar aquí no configura físicamente el ESP32. La
                guía incluye el contrato de envío y un simulador.
              </p>
            </>
          )}
          {page === "settings" && (
            <SettingsForm
              settings={data.settings}
              busy={busy}
              onSave={(s) =>
                act(async () => {
                  validateSettings(s);
                  if (demo) {
                    const next = { ...data, settings: s };
                    saveDemo(next);
                    setData(next);
                  } else {
                    await writeCloud("farm_settings", {
                      ...s,
                      owner_id: session.user.id,
                    });
                    await refresh();
                  }
                  setNotice("Configuración guardada");
                })
              }
            />
          )}
          <footer>
            <span>
              <Leaf size={14} /> SmartHerd
            </span>
            <button className="text-link" onClick={exportCSV}>
              <Download size={15} /> Exportar lecturas CSV
            </button>
          </footer>
        </MotionContent>
      </main>
      {modal?.type === "diagnostics" && (
        <Modal title="Ayuda y diagnóstico" onClose={() => setModal(null)}>
          {error ? (
            <ErrorPanel error={error} />
          ) : (
            <div className="diagnostic-help">
              <p>No hay un error registrado en este momento.</p>
              <p>
                <strong>Modo:</strong>{" "}
                {demo ? "Demostración local" : "Cuenta de finca"}
              </p>
              <p>
                <strong>Acceso con cuenta:</strong>{" "}
                {supabase ? "Configurado" : "Pendiente de configurar Supabase"}
              </p>
              <h3>Si algo no funciona</h3>
              <ul>
                <li>
                  Mapa o búsqueda: comprueba internet y vuelve a intentar.
                </li>
                <li>
                  Sin lecturas: revisa la hora del último reporte y la conexión
                  del collar.
                </li>
                <li>
                  No puedes ingresar: revisa tus credenciales o contacta al
                  administrador de la finca.
                </li>
                <li>
                  Datos locales: permite el almacenamiento del navegador. No
                  borres los datos del sitio sin respaldo.
                </li>
              </ul>
            </div>
          )}
        </Modal>
      )}
      {modal?.type === "history" && (
        <Modal title="Eventos registrados" onClose={() => setModal(null)}>
          {data.events.length ? (
            <div className="event-history">
              {[...data.events]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((event) => {
                  const owner = data.animals.find(
                    (a) => a.id === event.animal_id,
                  );
                  return (
                    <button
                      className="history-row"
                      key={event.id}
                      onClick={() => {
                        setModal(null);
                        choose(event.animal_id);
                      }}
                    >
                      <span className="history-icon">
                        <ClipboardList size={20} />
                      </span>
                      <span>
                        <strong>{owner?.name || "Animal"}</strong>
                        <span>
                          {labels[event.type]}
                          {event.value != null ? ` · ${event.value} kg` : ""}
                        </span>
                        <time dateTime={event.date}>{fmt(event.date)}</time>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  );
                })}
            </div>
          ) : (
            <Empty>
              Aún no hay eventos. Selecciona un animal para registrar el
              primero.
            </Empty>
          )}
        </Modal>
      )}
      {modal?.type === "animal" && (
        <Modal
          title={modal.animal ? "Editar animal" : "Registrar animal"}
          onClose={() => setModal(null)}
        >
          <AnimalForm
            animal={modal.animal}
            busy={busy}
            onSave={(row) =>
              act(async () => {
                if (
                  data.animals.some(
                    (a) =>
                      a.ear_tag.toLowerCase() === row.ear_tag.toLowerCase() &&
                      a.id !== row.id,
                  )
                )
                  throw new Error("Este arete ya está registrado.");
                await save("animals", row, "animals");
                setModal(null);
                choose(row.id);
              })
            }
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {modal?.type === "event" && (
        <Modal
          title={`Nuevo evento · ${modal.animal.name}`}
          onClose={() => setModal(null)}
        >
          <EventForm
            animal={modal.animal}
            busy={busy}
            onSave={(row) =>
              act(async () => {
                await save("events", row, "events");
                setModal(null);
              })
            }
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {modal?.type === "device" && (
        <Modal title="Vincular collar" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              act(async () => {
                const id = f.get("id").trim().toUpperCase();
                if (!/^SH-[A-Z0-9-]{3,40}$/.test(id))
                  throw new Error(
                    "Usa SH- seguido de al menos 3 letras o números.",
                  );
                if (data.devices.some((d) => d.id === id))
                  throw new Error("El collar ya existe.");
                if (
                  data.devices.some((d) => d.animal_id === f.get("animal_id"))
                )
                  throw new Error("El animal ya tiene un collar vinculado.");
                await save(
                  "devices",
                  { id, animal_id: f.get("animal_id"), enabled: true },
                  "devices",
                );
                setModal(null);
              });
            }}
          >
            <Field label="Identificador del collar">
              <input
                name="id"
                placeholder="SH-COLLAR-005"
                required
                maxLength={43}
              />
            </Field>
            <Field label="Animal">
              <select name="animal_id" required>
                <option value="">Selecciona un animal</option>
                {active
                  .filter(
                    (a) => !data.devices.some((d) => d.animal_id === a.id),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.ear_tag}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="hint">
              Este identificador debe coincidir con el que envía la estación
              base.
            </p>
            <button className="primary" disabled={busy}>
              Guardar vínculo
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
function AnimalCard({ animal: a, data, alerts, choose }) {
  const count = alerts.filter((x) => x.animal_id === a.id).length;
  const d = data.devices.find((d) => d.animal_id === a.id);
  return (
    <button className="animal-card" onClick={() => choose(a.id)}>
      <div className="card-top">
        <div className={"tag " + (a.sex === "macho" ? "tan" : "")}>
          {a.ear_tag.slice(-4)}
        </div>
        <ArrowUpRight size={18} />
      </div>
      <h3>{a.name}</h3>
      <p>
        {a.ear_tag} · {a.breed}
      </p>
      <div className="card-bottom">
        <Badge tone={count ? "amber" : ""}>
          {count
            ? `${count} por revisar`
            : a.status === "activo"
              ? "Activo"
              : a.status}
        </Badge>
        <span>
          <Radio size={13} />
          {d ? "Con collar" : "Sin collar"}
        </span>
      </div>
    </button>
  );
}
function AnimalForm({ animal: a, busy, onSave }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        onSave({
          id: a?.id || uid(),
          name: f.get("name").trim(),
          ear_tag: f.get("ear_tag").trim().toUpperCase(),
          breed: f.get("breed").trim(),
          sex: f.get("sex"),
          purpose: f.get("purpose"),
          birth_date: f.get("birth_date"),
          status: f.get("status"),
        });
      }}
    >
      <div className="form-grid">
        <Field label="Nombre">
          <input
            name="name"
            defaultValue={a?.name}
            required
            maxLength={80}
            pattern=".*\S.*"
          />
        </Field>
        <Field label="Arete / identificación">
          <input
            name="ear_tag"
            defaultValue={a?.ear_tag}
            required
            maxLength={50}
            pattern=".*\S.*"
          />
        </Field>
        <Field label="Raza">
          <input
            name="breed"
            defaultValue={a?.breed}
            required
            maxLength={80}
            pattern=".*\S.*"
          />
        </Field>
        <Field label="Nacimiento">
          <input
            name="birth_date"
            type="date"
            defaultValue={a?.birth_date}
            max={today()}
            required
          />
        </Field>
        <Field label="Sexo">
          <select name="sex" defaultValue={a?.sex || "hembra"}>
            <option value="hembra">Hembra</option>
            <option value="macho">Macho</option>
          </select>
        </Field>
        <Field label="Propósito">
          <select name="purpose" defaultValue={a?.purpose || "doble"}>
            <option value="doble">Doble propósito</option>
            <option value="leche">Leche</option>
            <option value="engorde">Engorde</option>
          </select>
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={a?.status || "activo"}>
            <option value="activo">Activo</option>
            <option value="vendido">Vendido</option>
            <option value="baja">Baja</option>
          </select>
        </Field>
      </div>
      <button className="primary" disabled={busy}>
        Guardar animal
      </button>
    </form>
  );
}
function EventForm({ animal, busy, onSave }) {
  const [type, setType] = useState("revision");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        onSave({
          id: uid(),
          animal_id: animal.id,
          type,
          date: f.get("date"),
          value: type === "peso" ? Number(f.get("value")) : null,
          notes: f.get("notes").trim(),
          next_date: f.get("next_date") || null,
        });
      }}
    >
      <Field label="Tipo de evento">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(labels)
            .filter(
              ([k]) =>
                animal.sex === "hembra" ||
                !["celo", "servicio", "preniez", "parto"].includes(k),
            )
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Fecha">
          <input
            name="date"
            type="date"
            defaultValue={today()}
            min={animal.birth_date}
            max={today()}
            required
          />
        </Field>
        <Field label="Próximo control (opcional)">
          <input name="next_date" type="date" min={today()} />
        </Field>
      </div>
      {type === "peso" && (
        <Field label="Peso en kilogramos">
          <input
            name="value"
            type="number"
            min="1"
            max="2000"
            step="0.1"
            required
          />
        </Field>
      )}
      <Field label="Notas">
        <textarea name="notes" maxLength={2000} rows={3} />
      </Field>
      <button className="primary" disabled={busy}>
        Guardar evento
      </button>
    </form>
  );
}
function SettingsForm({ settings: s, busy, onSave }) {
  return (
    <form
      className="settings-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        let polygon;
        try {
          polygon = f
            .get("polygon")
            .trim()
            .split("\n")
            .map((line) => line.split(",").map((x) => Number(x.trim())));
        } catch {
          polygon = [];
        }
        onSave({
          name: f.get("name").trim(),
          polygon,
          offline_minutes: Number(f.get("offline_minutes")),
          temperature_delta: Number(f.get("temperature_delta")),
          activity_ratio: Number(f.get("activity_ratio")),
          battery_min: Number(f.get("battery_min")),
        });
      }}
    >
      <section className="panel">
        <h2>La finca y su cerca</h2>
        <Field label="Nombre de la finca">
          <input name="name" defaultValue={s.name} maxLength={100} required />
        </Field>
        <Field label="Vértices de la cerca · latitud, longitud">
          <textarea
            name="polygon"
            rows={7}
            defaultValue={s.polygon.map((p) => p.join(", ")).join("\n")}
            required
            placeholder="10.005, -84.120"
          />
        </Field>
        <p className="hint">
          Un vértice por línea, en orden alrededor del perímetro, sin cruzar los
          lados. Mínimo 3 puntos. También puedes dibujar el perímetro en Mapa.
        </p>
      </section>
      <section className="panel">
        <h2>Criterios para revisar</h2>
        <p className="hint">
          Valores iniciales de demostración. Ajustar con observaciones de campo;
          no son umbrales clínicos.
        </p>
        <Field label="Sin lecturas durante (minutos)">
          <input
            name="offline_minutes"
            type="number"
            defaultValue={s.offline_minutes}
            min="1"
            max="10080"
            required
          />
        </Field>
        <Field label="Cambio de temperatura respecto al promedio (°C)">
          <input
            name="temperature_delta"
            type="number"
            defaultValue={s.temperature_delta}
            min="0.1"
            max="20"
            step="0.1"
            required
          />
        </Field>
        <Field label="Actividad respecto al promedio (multiplicador)">
          <input
            name="activity_ratio"
            type="number"
            defaultValue={s.activity_ratio}
            min="1.1"
            max="20"
            step="0.1"
            required
          />
        </Field>
        <Field label="Batería menor a (%)">
          <input
            name="battery_min"
            type="number"
            defaultValue={s.battery_min}
            min="0"
            max="100"
            required
          />
        </Field>
        <p className="hint">
          La línea base usa al menos 5 lecturas previas del animal dentro de los
          últimos 7 días. Historial visible en nube: últimas 5000 lecturas de la
          finca.
        </p>
        <button className="primary" disabled={busy}>
          Guardar configuración
        </button>
      </section>
    </form>
  );
}
