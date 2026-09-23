# SmartHerd

Prototipo funcional de gestión ganadera, basado en Hato-Ganaderia y en `SmartHerd ExpoTecnica2026.docx`. Está preparado para Supabase y para recibir mediciones de una estación ESP32 que concentre datos de collares LoRa.

## Probar ahora

```sh
npm ci
npm run dev
```

Abre la dirección local indicada. La página de **Iniciar sesión** permite ingresar con una cuenta Supabase o pulsar **Explorar demostración**: cinco animales ficticios, cuatro collares y lecturas de ejemplo. Sin variables de Supabase, el acceso con cuenta queda deshabilitado y la demostración sigue disponible. La elección de demo dura la sesión de la pestaña; los datos se conservan en el almacenamiento local. “Simular lecturas” agrega reportes ficticios; no transmite a Supabase ni a hardware. Si quieres reiniciar esta demostración, respalda antes los datos y borra únicamente la entrada `smartherd-demo-v1` del almacenamiento local del sitio.

## Acceso y diagnóstico

- El formulario usa Supabase Auth con correo y contraseña. Las cuentas y su recuperación las gestiona el administrador de la finca; la aplicación no crea cuentas ni simula un inicio de sesión real.
- Los tres puntos junto al perfil incluyen **Volver al acceso** y **Ayuda y diagnóstico**. Salir no elimina los datos guardados.
- Los errores de carga muestran una pantalla con causa probable, pasos y una referencia: `AUTH-01/02/03` (credenciales, confirmación o sesión), `NET-01` (conexión), `CONFIG-01` (configuración), `LOCAL-01` (almacenamiento), `DATA-01` (base de datos), `APP-01` (error no identificado). Las causas son orientativas; los códigos no sustituyen los registros del servidor.
- Los errores de renderizado tienen una pantalla de recuperación y las rutas desconocidas muestran `WEB-404`. Los mensajes de diagnóstico no incluyen contraseñas ni claves.
- `node tests/access.mjs` verifica acceso local, temas, demo, salida sin pérdida de datos y recuperación de almacenamiento. El acceso con cuentas reales requiere un proyecto Supabase configurado y una cuenta habilitada; estas pruebas locales no lo validan en producción.

## Apariencia

La interfaz incluye **Tierra cálida** como modo claro y **Cacao y terracota** como modo oscuro. Abre los tres puntos junto al perfil para cambiar la apariencia o acceder a la configuración de la finca; la elección se conserva en este navegador y no modifica los datos de la finca. Ambos temas se aplican a formularios, fichas, gráficas, tablas y mapa. Se mantienen los datos y las funciones del prototipo; las imágenes conceptuales no se utilizan como un mapa ficticio.

Los mapas permiten alternar **Mapa / Satélite**, con la preferencia guardada en el navegador. La vista satelital utiliza [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer); necesita internet y su detalle y antigüedad dependen de la zona. Conserva marcadores y cerca configurada, pero no muestra límites catastrales ni imágenes en vivo. Al cambiar de fondo mantiene visible el anterior hasta que cargue el nuevo; si falla el satélite durante el zoom, vuelve al mapa normal y muestra un aviso con opción de reintento.

El buscador de lugares consulta [Photon](https://github.com/komoot/photon) únicamente al pulsar **Buscar** o Enter. Selecciona un resultado para centrar el mapa; buscar no cambia la cerca ni guarda coordenadas en la finca. Incluye provincia y país para precisar lugares con nombres similares. Requiere internet, reutiliza búsquedas en memoria y muestra errores o ausencia de resultados. El servidor público de Photon permite uso moderado sin garantía de disponibilidad; para mayor tráfico, configura un servidor propio compatible mediante `VITE_GEOCODER_URL`.

En **Mapa → Definir perímetro de la finca**, puedes ajustar los vértices actuales o empezar de cero. Haz clic alrededor del terreno para añadir entre 3 y 100 puntos y arrastra los marcadores numerados para corregir su posición. Puedes consultar las coordenadas, eliminar puntos y guardar el perímetro; cancelar conserva la cerca anterior. Se valida que el polígono encierre un área y no tenga lados cruzados. El guardado utiliza los datos locales en demostración y `farm_settings` en modo Supabase.

Las secciones y tarjetas aparecen con transiciones breves (160–220 ms), también al entrar en pantalla al desplazarse. Se respeta la preferencia del dispositivo de reducir movimiento y el contenido permanece accesible sin animaciones.

La revisión del 18 de septiembre simplifica el resumen, convierte los cuatro indicadores en accesos directos y utiliza botones rectangulares con esquinas suaves. Consulta la [lista de cambios y criterios de diseño](docs/REVISION_INTERFAZ.md). Para verificar navegación, foco de formularios y distribución en cinco tamaños de pantalla, ejecuta `node tests/usability.mjs` con el servidor local iniciado.

## Funciones incluidas

- Registro, búsqueda y edición del ganado: arete único, raza, propósito, sexo, nacimiento y estado activo/vendido/baja.
- Historial individual de pesos, vacunas, tratamientos, revisiones, celo observado, servicio, preñez confirmada y parto. Fecha opcional para el próximo control.
- Mapa OpenStreetMap con posiciones GPS y cerca virtual poligonal configurable.
- Temperatura del collar, índice de actividad, batería, hora del reporte y gráficas del historial.
- Alertas por salida de la cerca, cambio de temperatura, actividad elevada, batería baja y ausencia de reportes después de haber recibido datos.
- Reconocimiento de alertas por lectura. Una nueva lectura puede generar una señal nueva.
- Asociación y activación/desactivación de collares. Un collar por animal; el vínculo se mantiene fijo para conservar la trazabilidad.
- Exportación CSV de las lecturas cargadas.
- Acceso con correo/contraseña al usar Supabase; aislamiento de datos por cuenta.

Los datos del collar **no equivalen a diagnósticos**. La temperatura es superficial o del entorno; la actividad no confirma celo; el servicio no confirma preñez. Los criterios iniciales son valores de demostración que requieren calibración en campo. No se implementan las estimaciones reproductivas por raza del archivo original porque sus reglas no estaban validadas para este proyecto.

## Preparar Supabase

Usa un **proyecto nuevo dedicado a SmartHerd**. No ejecutes esta migración en EcoPoints.

1. Crea el proyecto en Supabase.
2. Ejecuta `supabase/migrations/202609160001_initial.sql` una vez desde SQL Editor, o aplica la migración con Supabase CLI. Crea tablas, restricciones y políticas RLS.
3. Ejecuta `supabase/migrations/202609230001_realtime.sql` en el mismo proyecto para publicar las tablas del panel en Supabase Realtime. La migración puede repetirse sin duplicar tablas en la publicación.
4. En Authentication → Users, crea un usuario de finca con correo y contraseña. El prototipo no incluye alta pública ni recuperación de contraseña. Una cuenta representa una finca; no hay equipos/roles compartidos en esta versión.
5. Copia `.env.example` a `.env` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con la URL y la clave pública/anon del proyecto. **Nunca pongas la clave service_role en variables VITE**.
6. Reinicia `npm run dev`, inicia sesión y registra animales, collares y la cerca de la finca. En nube no se cargan animales ni mediciones ficticias automáticamente. La cerca inicial está vacía: configúrala antes de usar alertas de salida.
7. Para publicar el receptor de telemetría con Supabase CLI:

```sh
supabase login
supabase link --project-ref TU_REFERENCIA
supabase functions deploy ingest-telemetry --no-verify-jwt
```

La verificación JWT del gateway se desactiva **solo para esta función**, que realiza su propia autenticación obligatoria mediante una clave de estación. El acceso sin credencial es rechazado. La función utiliza `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Supabase; estas variables no van al navegador ni al ESP32.

### Autorizar una estación

Copia el UUID del usuario de la finca desde Authentication. Genera una clave aleatoria y guarda el archivo **fuera del proyecto**:

```sh
node scripts/create-gateway-key.mjs UUID_DEL_USUARIO /ruta/privada/estacion.env
```

El script crea el archivo con permisos privados y muestra un SQL que contiene solamente el **hash SHA-256**. Ejecuta ese SQL para registrar la estación. Carga la clave secreta del archivo en la estación base. Para revocarla, cambia `enabled` a `false` en `gateway_credentials`. Nunca publiques el archivo ni subas la clave a un repositorio.

Una estación autorizada puede enviar reportes de los collares habilitados de su finca, pero no de otras fincas. La clave de estación no permite leer ni gestionar la finca.

### Probar el receptor publicado

Exporta `SUPABASE_URL`, `GATEWAY_TOKEN` y `DEVICE_ID` en tu terminal local (el collar debe estar vinculado a un animal activo) y ejecuta:

```sh
npm run simulate
```

Ese simulador sí envía un reporte al proyecto configurado. Las coordenadas son de ejemplo: ajústalas antes de utilizarlo con una finca real. El JSON y las reglas para ESP32 están en [docs/ESP32.md](docs/ESP32.md).

## Publicar la página

Supabase aloja la base de datos, autenticación y función receptora de esta solución. La interfaz se construye como sitio estático y se sirve desde un alojamiento web (por ejemplo, el mismo tipo de despliegue usado para la interfaz de EcoPoints).

```sh
npm run build
npm run preview
```

Configura las dos variables públicas VITE en el alojamiento **antes** de construir. Comando de compilación: `npm ci && npm run build`; carpeta a publicar: `dist`. No necesita servidor Node permanente para la interfaz ni rutas especiales. Configura Site URL y dominios permitidos en Supabase Auth para el dominio final. Usa HTTPS. No se ha publicado un sitio remoto ni creado/configurado un proyecto Supabase como parte de la entrega local.

## Prueba local con dos ESP32

La carpeta hermana [smartherd-hardware](../smartherd-hardware/README.md) contiene el firmware GPS/transmisor y receptor LoRa, un cargador que verifica la serie USB de cada placa y un puente local para esta Mac. El emisor con GPS es el equipo conectado **directamente**; el receptor sin GPS está conectado al **hub**. En **Collares**, **Resumen** y **Mapa** el estado del collar físico `SH-COLLAR-001` se actualiza cada tres segundos con la pestaña visible y se consulta al volver a ella: distingue **Sin señal GPS** (LoRa recibió `NO_FIX`), **Sin señal LoRa** (el emisor transmitió pero no llegó la trama en 45 s), **Desconectado** (falta el emisor por USB) y **Desactivado** (configuración de la web), además de fallos del receptor o del monitoreo. Los otros tres collares son solo ejemplos sin ESP32 asociado. El emisor correcto entregó más de 13 000 bytes GPS y 44 tramas RMC válidas, y el receptor recibió `NO_FIX` por LoRa; la web lo mostró correctamente. Aún falta comprobar una posición real bajo cielo abierto. Este enlace USB local no envía lecturas a Supabase ni estará disponible automáticamente en un sitio remoto.

## Arquitectura y límites

`Collar ESP32 + sensores → LoRa punto a punto → estación base ESP32 + internet → Edge Function autenticada → PostgreSQL → React`

- En modo Supabase, el panel se actualiza al recibir cambios de la finca por Realtime cuando se aplica la segunda migración. Conserva una consulta cada 30 segundos y otra al volver a la pestaña para recuperarse de cortes o eventos perdidos. Esta ruta aún requiere prueba con un proyecto Supabase real.
- Las alertas se calculan con el panel abierto; no hay notificaciones push, SMS, correo ni análisis programado en servidor.
- Los umbrales de actividad/temperatura usan al menos 5 reportes anteriores dentro de 7 días. No es un modelo fisiológico validado ni ajustado a horas del día.
- Se cargan las últimas 5000 lecturas de la finca. Gráficas: hasta 24 por animal. Los datos anteriores permanecen en Supabase, pero esta interfaz y su CSV no los descargan. Para grandes hatos, añadir paginación y agregación por animal antes del uso prolongado.
- La hora de medición proviene de la estación; se admite una demora de hasta 30 días para reenviar datos almacenados y hasta 5 minutos de desfase futuro. La recepción también queda registrada en el servidor.
- Las lecturas antiguas generan una señal de falta de comunicación, no señales sanitarias actuales. Un collar que nunca reportó muestra “Sin lecturas”.
- El mapa, las teselas y las fuentes web necesitan internet; la demo conserva registros localmente, pero no ofrece un mapa offline.
- No hay borrado físico desde la interfaz: usa vendido/baja para conservar el historial.
- Las fechas de próximo control se registran y consultan; no generan recordatorios automáticos.
- El firmware local incluye únicamente GPS y LoRa; faltan sensores de temperatura/actividad, cola de retransmisión y autenticación de tramas de radio. Sí hay una prueba física de recepción LoRa `NO_FIX`, pero no una prueba de posición GPS válida ni un despliegue remoto de telemetría. Tampoco incorpora limitación de solicitudes por estación; añadirla y probar carga antes de un despliegue de producción expuesto.

## Verificación

```sh
npm test
npm run build
node tests/browser.mjs
node tests/map-zoom.mjs
node tests/map-resilience.mjs
node tests/map-live-stability.mjs
node tests/map-search.mjs
node tests/collar-live.mjs
```

Las pruebas de base de datos ejecutan la migración en PostgreSQL embebido (PGlite), con roles que simulan Supabase Auth. Verifican aislamiento, referencias entre fincas, bloqueo de escritura directa y duplicados. No sustituyen la prueba final en un proyecto Supabase real. La prueba de navegador usa Chrome instalado en macOS; cambia `executablePath` o instala Chromium con Playwright en otros equipos. Las capturas se guardan en `test-results/` (no forman parte de la distribución).

Referencias técnicas: [React con Supabase Auth](https://supabase.com/docs/guides/auth/quickstarts/react), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth), [configuración de funciones](https://supabase.com/docs/guides/functions/function-configuration).
