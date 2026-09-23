import React from "react";
import { TriangleAlert, RefreshCw } from "lucide-react";

export function diagnose(error) {
  const text = String(error?.message || error || "").toLowerCase();
  if (text === "route-not-found")
    return {
      code: "WEB-404",
      title: "Esta página no existe",
      cause:
        "El enlace puede estar incompleto o apuntar a una página que ya no está disponible.",
      steps: [
        "Revisa la dirección del enlace o vuelve al acceso de SmartHerd.",
      ],
    };
  if (/invalid login|invalid_credentials/.test(text))
    return {
      code: "AUTH-01",
      title: "No pudimos iniciar sesión",
      cause: "El correo o la contraseña no coinciden.",
      steps: [
        "Revisa el correo y vuelve a escribir la contraseña.",
        "Si no recuerdas tus datos, solicita ayuda a quien administra tu finca.",
      ],
    };
  if (/email not confirmed/.test(text))
    return {
      code: "AUTH-02",
      title: "Confirma tu correo",
      cause: "La cuenta todavía no tiene el correo confirmado.",
      steps: [
        "Busca el mensaje de confirmación, también en correo no deseado.",
        "Si el enlace venció, solicita uno nuevo al administrador.",
      ],
    };
  if (/jwt|session expired|refresh.token|401/.test(text))
    return {
      code: "AUTH-03",
      title: "Necesitas volver a ingresar",
      cause: "La sesión puede haber vencido.",
      steps: ["Vuelve al acceso e inicia sesión nuevamente."],
    };
  if (/network|fetch|offline|conexión|timeout|timed out/.test(text))
    return {
      code: "NET-01",
      title: "No se pudo conectar",
      cause: "Puede haber un problema con internet o con el servicio.",
      steps: [
        "Comprueba tu conexión a internet.",
        "Espera unos segundos y vuelve a intentar.",
        "Si continúa, pide al administrador revisar que el proyecto Supabase esté activo.",
      ],
    };
  if (/config|supabase.*url|api.key/.test(text))
    return {
      code: "CONFIG-01",
      title: "El acceso a cuentas aún no está configurado",
      cause: "Falta una configuración válida de Supabase.",
      steps: [
        "Puedes explorar la demostración mientras se configura el acceso.",
        "El administrador debe revisar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y reiniciar o volver a publicar la aplicación.",
      ],
    };
  if (/json|storage|quota|datos locales/.test(text))
    return {
      code: "LOCAL-01",
      title: "No se pudieron leer o guardar los datos locales",
      cause:
        "El almacenamiento del navegador puede estar bloqueado, lleno o contener datos dañados.",
      steps: [
        "Permite el almacenamiento de este sitio en el navegador.",
        "No borres los datos del sitio sin una copia de respaldo.",
        "Solicita ayuda al administrador si el problema continúa.",
      ],
    };
  if (/permission|policy|row.level|403|relation|schema|pgrst/.test(text))
    return {
      code: "DATA-01",
      title: "No se pudo acceder a los datos",
      cause:
        "Puede faltar permiso o parte de la configuración de la base de datos.",
      steps: [
        "Comprueba que ingresaste con la cuenta correcta.",
        "El administrador debe revisar las migraciones y los permisos de la finca en Supabase; no debe desactivar la seguridad para resolverlo.",
      ],
    };
  return {
    code: "APP-01",
    title: "Algo salió mal",
    cause:
      "No se pudo completar esta acción. No hay información suficiente para confirmar la causa.",
    steps: [
      "Vuelve a intentar la acción.",
      "Si se repite, comparte el código de referencia y qué estabas haciendo con el administrador.",
    ],
  };
}
export function ErrorPanel({ error, onRetry, onBack }) {
  const info = diagnose(error);
  return (
    <section className="error-panel" aria-labelledby="error-heading">
      <TriangleAlert size={32} aria-hidden="true" />
      <p className="eyebrow">AYUDA PARA RESOLVER EL PROBLEMA</p>
      <h1 id="error-heading">{info.title}</h1>
      <p role="alert">{info.cause}</p>
      <h2>Qué puedes hacer</h2>
      <ol>
        {info.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="diagnostic-code">
        Referencia: <strong>{info.code}</strong>
      </p>
      <div className="boundary-actions">
        {onRetry && (
          <button className="primary" onClick={onRetry}>
            <RefreshCw size={16} />
            Reintentar
          </button>
        )}
        {onBack && (
          <button className="secondary" onClick={onBack}>
            Volver al acceso
          </button>
        )}
      </div>
    </section>
  );
}
export function ErrorPage(props) {
  return (
    <div className="error-page">
      <div className="access-wordmark">SmartHerd</div>
      <ErrorPanel {...props} />
    </div>
  );
}
export class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <ErrorPage
          error={this.state.error}
          onRetry={() => window.location.reload()}
          onBack={() => {
            try {
              sessionStorage.removeItem("smartherd-demo-access");
            } catch {}
            window.location.reload();
          }}
        />
      );
    return this.props.children;
  }
}
