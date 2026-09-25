# SmartHerd

Aplicación web de gestión ganadera para la ExpoTécnica 2026. La [página pública](https://danielgomezacuna23-dev.github.io/SmartHerd/) usa Supabase para iniciar sesión, guardar datos de la finca y recibir telemetría; ya no incluye acceso ni registros de demostración.

## Funciones

- Registro de animales, eventos sanitarios y reproductivos, collares, lecturas y alertas. Un collar se vincula a un animal activo.
- Mapa normal o satelital con ubicación recibida, hora de lectura y perímetro poligonal editable. La búsqueda de lugares usa Photon.
- El menú de **tres puntos junto al perfil → Rastreo y diagnóstico** contiene el modo habitual (consulta cada 5 minutos), **Rastrear en tiempo real** (consulta cada 5 segundos durante 15 minutos), pruebas de LoRa/GPS y registro de módulos.
- En el registro de módulos, **emisor** significa ESP32 del collar con GPS y debe asociarse a un collar; **receptor** significa estación LoRa. Se guarda la MAC de 12 dígitos hexadecimales para no confundirlos. Registrar un módulo no programa el ESP32 ni demuestra que esté conectado.
- El historial reproductivo puede generar la alerta **Potencialmente en Celo** en la web. Después de un celo observado estima una ventana de 18 a 24 días; después de un parto muestra una ventana más amplia de 40 a 60 días. Una preñez confirmada posterior suspende esa estimación. No extrapola ciclos sucesivos sin una nueva observación. No genera avisos push ni diagnósticos automáticos.
- Los temas aprobados son **Tierra cálida** para claro y **Cacao y terracota** para oscuro.

Las vacas son poliéstricas todo el año: la estación del año no da una fecha de celo fiable por sí sola. El ciclo típico es de unos 21 días (rango 18–24) y el retorno posparto depende de nutrición, amamantamiento y condición corporal; un celo temprano incluso puede pasar inadvertido. Por eso la alerta indica una **posibilidad que requiere observación o consulta veterinaria**, no una confirmación ni una recomendación de inseminación. Fuentes: [Merck Veterinary Manual, ciclo reproductivo](https://www.merckvetmanual.com/multimedia/table/features-of-the-reproductive-cycle), [University of Florida IFAS, anestro posparto](https://ask.ifas.ufl.edu/publication/AN277), [Merck, control del celo en bovinos](https://www.merckvetmanual.com/management-and-nutrition/hormonal-control-of-estrus/hormonal-control-of-estrus-in-cattle).

## Estado de la conexión LoRa

La página muestra telemetría real guardada en Supabase cuando una estación autorizada la envía a `ingest-telemetry`. También puede leer el puente local `http://127.0.0.1:8765/status` en la **misma Mac** para el collar `SH-COLLAR-001` cuando los dos ESP32 están conectados allí. Las pruebas de LoRa/GPS del menú consultan ese puente; no inventan resultados si no está disponible. Para utilizar esas pruebas desde otro dispositivo, hay que instalar un puente o diagnóstico remoto autenticado.

La preferencia de 5 minutos/5 segundos se guarda en `tracking_mode` y la estación puede consultarla mediante `GET /functions/v1/ingest-telemetry` con su clave de estación. La web ajusta su frecuencia de consulta. **El firmware actual todavía transmite cada 15 segundos y no obedece esta preferencia**: para conseguir el ahorro de batería real y el cambio físico a 5 segundos será necesario actualizar y probar ambos ESP32 cuando vuelvan a conectarse. Esta sesión solo preparó software y web; no se realizó una prueba física nueva ni una prueba de posición GPS bajo cielo abierto.

El emisor con GPS probado anteriormente es la placa conectada directamente, MAC `68:EE:8F:4F:32:20`; el receptor sin GPS es la placa del hub, MAC `68:EE:8F:4F:50:20`. Esos datos históricos sirven para identificarlas, pero hay que verificar de nuevo las placas al conectarlas. Consulta la [guía de hardware](../smartherd-hardware/README.md) y el [contrato de telemetría](docs/ESP32.md).

## Instalación y Supabase

```sh
npm ci
cp .env.example .env
npm run dev
```

Completa `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto dedicado. Solo se usa una clave pública en el navegador; **nunca** coloques `service_role` ni la clave de estación en variables `VITE`.

En un proyecto nuevo aplica, en orden, las migraciones `202609160001_initial.sql`, `202609230001_realtime.sql`, `202609250001_tracking_mode.sql` y `202609250002_module_registry.sql` de `supabase/migrations/`. Para la función:

```sh
supabase functions deploy ingest-telemetry --no-verify-jwt
```

Solo `ingest-telemetry` desactiva la validación JWT del gateway porque comprueba obligatoriamente una clave propia de estación de 64 caracteres contra un hash SHA-256. La función utiliza `SUPABASE_SERVICE_ROLE_KEY` **solo en el servidor**. Crea usuarios desde Supabase Auth y registra la estación con `scripts/create-gateway-key.mjs`. Las tablas de finca tienen políticas RLS por propietario; la telemetría se escribe solo desde la función.

Para publicar la web, compila con las dos variables públicas y el prefijo de ruta `/SmartHerd/` para GitHub Pages:

```sh
npm run build -- --base=/SmartHerd/
```

Supabase aloja Auth, datos y función; GitHub Pages aloja la interfaz. Las teselas del mapa y la búsqueda requieren internet. Se cargan las 5000 lecturas más recientes, de modo que para despliegues grandes habrá que añadir paginación. Las alertas aparecen con la aplicación abierta y al reabrirla; no se envían por SMS/correo.

## Verificación

```sh
npm test
npm run build
```

La batería de pruebas incluye aislamiento de fincas y RLS en PostgreSQL embebido, validación de paquetes, API de estación, modos de rastreo, registro de módulos y ventanas reproductivas. Los scripts antiguos de navegador basados en el acceso de demostración ya no son aplicables y deberán adaptarse a una cuenta autenticada. La prueba del flujo de una cuenta real y las pruebas físicas de LoRa/GPS requieren una sesión y los módulos conectados.
