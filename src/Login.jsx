import { useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { diagnose, ErrorPanel } from "./Errors";

export default function Login({
  brand,
  appearance,
  configured,
  configError,
  error,
  busy,
  onLogin,
}) {
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  return (
    <div className="access-page">
      <header className="access-header">
        <div className="brand">{brand} SmartHerd</div>
        {appearance}
      </header>
      <div className="access-layout">
        <section className="access-card" aria-labelledby="login-title">
          <h1 id="login-title">Iniciar sesión</h1>
          <p>Bienvenido de nuevo a SmartHerd.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              onLogin({
                email: values.get("email").trim(),
                password: values.get("password"),
              });
            }}
          >
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nombre@correo.com"
                disabled={busy}
              />
            </label>
            <label>
              Contraseña
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={
                    visible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="error" role="alert">
                {diagnose(error).cause}
              </p>
            )}
            {!configured && (
              <p className="access-info">
                No se pudo conectar con Supabase. Revisa la configuración del sitio.
              </p>
            )}
            <button className="primary" disabled={busy || !configured}>
              {busy ? "Ingresando…" : "Iniciar sesión"}
              <ArrowRight size={17} />
            </button>
          </form>
          <button
            className="text-link"
            onClick={() => setHelp(!help)}
            aria-expanded={help}
          >
            ¿Necesitas ayuda para ingresar?
          </button>
          {help && (
            <div className="access-help">
              {error || !configured ? (
                <ErrorPanel
                  error={
                    error || configError || "Configuración Supabase pendiente"
                  }
                />
              ) : (
                <p>
                  Si no tienes una cuenta o necesitas recuperar tu contraseña,
                  contacta a quien administra tu finca para que habilite tu
                  acceso.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      <footer className="access-footer">SmartHerd · Expo Técnica 2026</footer>
    </div>
  );
}
