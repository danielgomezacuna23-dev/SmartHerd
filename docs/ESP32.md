# Conexión futura con la estación ESP32

La estación recibe las tramas LoRa, identifica el collar y hace un POST HTTPS. El collar no necesita conectarse directamente a internet. Este documento define el contrato de datos; no presupone pines, cableado, protocolo LoRa ni sensores físicamente validados.

Antes de solicitar una posición, la estación puede consultar `GET` a la misma URL con la misma cabecera `Authorization`. Recibe `{"interval_seconds":300,"live_until":null}` en modo habitual o `interval_seconds:5` mientras el usuario haya activado **Rastrear en tiempo real**. El modo rápido caduca a los 15 minutos. El firmware del emisor ya transmite cada 300 segundos normalmente y acepta por LoRa `SHCTRL1|SH-COLLAR-001|5|900` para activar cinco segundos, o `SHCTRL1|SH-COLLAR-001|300|0` para volver al modo habitual. El receptor actualizado acepta los comandos serie `M|5|900` y `M|300|0` para retransmitirlos por LoRa. Se verificó la emisión del comando por el receptor, pero con una sola fuente USB no se pudo comprobar que el emisor lo reciba. Falta que la estación consulte Supabase y envíe esos comandos automáticamente; el botón web aún no controla físicamente el intervalo.

## Solicitud

`POST https://TU_PROYECTO.supabase.co/functions/v1/ingest-telemetry`

Cabeceras:

```text
Content-Type: application/json
Authorization: Bearer CLAVE_DE_ESTACION
```

Cuerpo de ejemplo (actualiza la fecha al instante de medición):

```json
{
  "device_id": "SH-COLLAR-001",
  "packet_id": "boot-8347-seq-000012",
  "recorded_at": "2026-09-16T16:00:00.000Z",
  "temperature_c": 33.5,
  "activity": 28,
  "battery_pct": 80,
  "latitude": 10.001,
  "longitude": -84.115
}
```

- `device_id`: el identificador registrado en la web; patrón `SH-` seguido de 3 a 40 caracteres A–Z, 0–9 o guion. Debe estar habilitado y vinculado a un animal activo.
- `packet_id`: identificador único y estable por collar/medición, 1–80 letras/números/guiones/guiones bajos. Incluye identificador de arranque y contador, o un UUID. Conserva el mismo valor y cuerpo en cada reintento.
- `recorded_at`: fecha ISO 8601 UTC de adquisición. Sincroniza la estación mediante NTP/GPS y preserva la fecha original cuando haya retrasos.
- `temperature_c`: número entre −55 y 125, o `null` si no hay una medición válida. Es el rango técnico de admisión, no un rango clínico.
- `activity`: índice normalizado 0–100, o `null`. El firmware debe definir una ventana y un método reproducible para transformar las mediciones del MPU-6050. No envíes aceleración en g como si fuera este índice.
- `battery_pct`: porcentaje 0–100, o `null`. Debe calcularse mediante un método calibrado; no enviar voltios en este campo.
- `latitude` / `longitude`: números en grados, ambos presentes o ambos `null` cuando no hay solución GPS. No uses 0,0 para indicar “sin GPS”.
- Debe haber al menos una medición. El cuerpo máximo es 4096 bytes. Campos adicionales de propietario/animal se ignoran: el servidor obtiene esos vínculos desde la base de datos.

## Respuestas y reintentos

- `201`: guardado, `{"ok":true,"duplicate":false,"packet_id":"..."}`.
- `200`: ya recibido, `duplicate:true`; se considera entregado, no se vuelve a insertar. Si reutilizas un identificador con otro cuerpo, el primero se conserva.
- `400`: contenido inválido; corrige el paquete.
- `401`: clave ausente, inválida o revocada.
- `403`: collar no autorizado, desactivado o animal inactivo.
- `413` / `415`: tamaño o tipo de contenido incorrecto.
- `503`, error de red u otros fallos transitorios: guarda el paquete y reintenta con espera creciente y el mismo identificador. No descartes la cola ante un fallo de internet.

## Seguridad e integración física

La estación utiliza únicamente su clave de acceso. Nunca incorpora una clave service_role de Supabase. Configura validación de certificado TLS en el ESP32; no uses `setInsecure()` en el despliegue. Mantén la credencial fuera de archivos públicos y limita acceso físico a la estación.

El formato LoRa puede ser compacto/binario; la estación lo convierte a este JSON. El hardware debe validar CRC, ID y formato de la trama. La clave HTTPS protege el ingreso a Supabase, no autentica por sí sola las tramas de radio: antes de uso real, añade autenticación de mensajes y protección contra reproducción en el enlace LoRa. Comprueba experimentalmente posicionamiento, pérdida de paquetes, consumo, montaje térmico y significado del índice de actividad.

El proyecto Supabase está configurado. El 25/9/2026 se actualizaron ambos módulos, uno por uno, comprobando sus series USB e ID internos antes de grabarlos. El emisor se verificó con intervalo habitual de 300 segundos, radio iniciada y tramas RMC válidas; en interiores reportó `NO_FIX`. El receptor se verificó con radio iniciada y transmisión de la orden de modo rápido. Faltan la prueba de recepción de esa orden en el emisor con ambos módulos alimentados, la conexión automática de la estación con Supabase y una posición GPS real bajo cielo abierto.
