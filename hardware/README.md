# Enlace local ESP32 → LoRa → SmartHerd

Este montaje usa dos ESP32-S3. El transmisor lee el GPS y envía una trama LoRa `SHGPS2` cada cinco minutos en modo habitual o cada cinco segundos en modo rápido. La trama lleva el identificador `SH-COLLAR-001`, secuencia y `FIX` con coordenadas válidas, o `NO_FIX` sin coordenadas. El receptor publica las tramas recibidas por su puerto serie. `bridge.py` supervisa los puertos USB y expone `http://127.0.0.1:8765/status` y `POST /mode` en esta Mac. La página pública usa el segundo para ordenar el cambio de intervalo y esperar la confirmación del emisor. El puente no escribe en Supabase ni convierte una falta de GPS en una ubicación ficticia. La web evalúa la antigüedad de cada lectura según el intervalo seleccionado.

## Identificación de los equipos observada el 23/9/2026

| Función | Puerto observado | Serie USB | ID interno del chip |
| --- | --- | --- | --- |
| Transmisor con GPS, conectado directamente | `/dev/cu.usbmodem1101` | `68:EE:8F:4F:32:20` | `20324F8FEE68` |
| Receptor sin GPS, conectado al hub | `/dev/cu.usbmodem31101` | `68:EE:8F:4F:50:20` | `20504F8FEE68` |

`upload_checked.py` busca la placa por serie USB y cancela la carga si no coincide; el puente verifica **serie USB, rol e ID interno del chip** antes de aceptar mensajes. Esto tolera cambios en el nombre del puerto y evita invertir los módulos. Para identificar uno manualmente, abre su puerto serie a 115200 baudios y envía `I`: responde `SHGPS_TX` (emisor) o `SHGPS_RX` (receptor) con su chip y estado de radio. Los dos LoRa deben tener antena instalada antes de transmitir; esto fue confirmado por el usuario para esta prueba.

## Configuración y ejecución

Desde esta carpeta, con PlatformIO instalado:

```sh
~/.platformio/penv/bin/python upload_checked.py gps_tx
~/.platformio/penv/bin/python upload_checked.py base_rx
~/.platformio/penv/bin/python bridge.py
```

También puedes abrir `Iniciar puente SmartHerd.command` para mantener el puente en marcha. Deja ambos ESP32 conectados y con antena. El botón **Rastrear en tiempo real** de la web requiere este puente local en la misma Mac; desde otro dispositivo solo se guardará la preferencia en Supabase.

En otra terminal, desde la raíz de este proyecto web:

```sh
npm run dev -- --port 5173 --strictPort
```

Abre `http://127.0.0.1:5173/`, inicia sesión y ve a **Collares** o **Mapa**. El puente y la página deben seguir ejecutándose en esta Mac. El estado se decide así:

| Mensaje web | Evidencia |
| --- | --- |
| **GPS y LoRa activos** | Trama reciente `FIX` recibida. |
| **Sin señal GPS** | Trama reciente `NO_FIX` recibida por LoRa: la radio funciona, pero no hay posición válida. |
| **Sin señal LoRa** | El emisor transmite por serie USB pero no llegan tramas al receptor dentro del margen del intervalo elegido, o la radio del emisor no inició. |
| **Desconectado** | El emisor con GPS ya no está presente por USB. |
| **Desactivado** | El collar fue desactivado en la configuración de la web. |
| **Sin transmisión / Receptor desconectado / LoRa no disponible / Monitoreo no disponible** | Diagnósticos adicionales para evitar atribuir incorrectamente el problema al GPS o al collar. |

Los collares `SH-COLLAR-002` a `004` son ejemplos sin módulo físico. El diagnóstico **Desconectado** requiere que el emisor siga conectado por USB a esta Mac: si en el futuro funciona con batería lejos de la computadora, una ausencia de paquetes LoRa **no permite saber** si perdió enlace o si se apagó. Para un despliegue remoto se necesita un canal de estado independiente o un protocolo de acuse de recibo, además de transporte autenticado y persistencia en Supabase.

## LoRa y GPS

- Radio SX1276/LoRa: SCK 12, MISO 13, MOSI 11, CS 10, RESET 16, DIO0 15; 915 MHz, 2 dBm, SF7, BW125, CR4/5, preámbulo 8, sync `0x12`, CRC.
- GPS: NMEA RMC en ESP32 GPIO18 (pin confirmado por el usuario). El firmware comienza a 9600 baudios y, si no recibe una trama RMC válida, prueba 4800, 38400 y 115200 cada ocho segundos. Una lectura válida debe tener checksum correcto, estado `A` y latitud/longitud válidas. Una solución vencida deja de enviarse tras 15 segundos.
- Control de intervalo: el receptor acepta por serie `M|5|900` para solicitar rastreo rápido durante hasta 15 minutos y `M|300|0` para volver al modo habitual. Repite el comando por LoRa durante 20 segundos para coincidir con la ventana de escucha del emisor. El emisor vuelve automáticamente a cinco minutos al vencer el plazo. `POST /mode` en el puente envía la orden y espera hasta 15 segundos una confirmación serie del emisor. El endpoint solo acepta el origen de la web pública o el servidor local. El puente todavía no consulta Supabase por sí mismo ni envía telemetría a la nube: funciona mientras la página, el puente y ambos módulos estén disponibles en esta Mac.
- Las coordenadas no están protegidas criptográficamente en el aire; esta prueba de banco no debe usarse como sistema de ubicación de producción sin autenticación de tramas y protección contra reproducción.

## Resultado observado

El 23/9/2026 se corrigió una identificación inicial invertida de los equipos. Las comprobaciones de pocos bytes y cero tramas NMEA correspondían al ESP32 del hub, que **no tiene GPS**; no describen el estado del emisor. En esa prueba se cargó `gps_tx` en el equipo directo `68:EE:8F:4F:32:20` y `base_rx` en el del hub `68:EE:8F:4F:50:20`; el receptor recibió tramas `NO_FIX` con RSSI de −56 dBm. El 25/9/2026 se cargaron ambas versiones nuevas en las placas correctas, verificadas por serie USB e ID interno. Con ambas alimentadas, el emisor recibió `SHCTRL1|SH-COLLAR-001|5|30`, transmitió dos tramas `NO_FIX` separadas por cinco segundos y el receptor recibió ambas con RSSI −43 dBm y SNR 9,5–9,8 dB. Luego el emisor confirmó la vuelta a 300 segundos. A través de `POST /mode`, el puente confirmó los cambios 5 → 300 y recibió nuevas tramas `NO_FIX`. Falta probar una posición GPS real bajo cielo abierto y una estación que persista las lecturas en Supabase.
