# Demostración ExpoTécnica: collar GPS → LoRa → receptor USB → web

El firmware `expo3` transmite **cada 3 segundos**, continuamente mientras esté encendido. El emisor puede usar únicamente batería: no espera USB ni Wi-Fi y no recibe órdenes de la computadora. El receptor usa recepción LoRa continua; no transmite controles ni alterna ventanas de escucha. El firmware utiliza [recepción continua y transmisión asíncrona de arduino-LoRa](https://github.com/sandeepmistry/arduino-LoRa/blob/master/API.md).

| Equipo | Serie USB / MAC | ID interno del chip | Programa |
| --- | --- | --- | --- |
| Collar emisor con GPS | `68:EE:8F:4F:32:20` | `20324F8FEE68` | `gps_tx` |
| Estación receptora sin GPS | `68:EE:8F:4F:50:20` | `20504F8FEE68` | `base_rx` |

El nombre del puerto puede cambiar. `upload_checked.py` verifica la serie USB antes de cargar para impedir invertir las placas. Envía `I` a 115200 baudios para consultar rol, chip y versión.

## Cargar después

Los dos programas están compilados; **no fueron cargados ni probados físicamente el 30/9/2026**, porque los ESP32 están desconectados. Conecta cada placa y abre `Cargar emisor GPS.command` o `Cargar receptor LoRa.command`, o ejecuta:

```sh
~/.platformio/penv/bin/python upload_checked.py gps_tx
~/.platformio/penv/bin/python upload_checked.py base_rx
```

Cierra el puente antes de programar el receptor. Después alimenta el collar con batería y conecta **solo el receptor** por USB a la Mac. Ambos módulos LoRa deben tener antena.

## Usar la página publicada

Abre `Iniciar puente SmartHerd.command`, o `Iniciar SmartHerd.command` en la carpeta web, que abre la página pública y ejecuta el puente. Inicia sesión, elige la finca y conserva el collar `SH-COLLAR-001` activo y vinculado. En los tres puntos junto al perfil abre **Rastreo y diagnóstico**. Permite el acceso a red local cuando Chrome lo solicite. La web consulta el puente cada 3 segundos cuando está visible; al volver a la pestaña consulta de inmediato.

La interfaz, cuentas y fincas usan Supabase; la página está alojada en GitHub Pages. El mapa y Supabase requieren internet. Este puente entrega los paquetes a la página de **esta misma Mac**; todavía no los persiste en Supabase ni proporciona rastreo desde otros dispositivos. No hace falta una copia offline ni un servidor de página local.

## Estados reales

- **GPS y LoRa activos:** posición GPS válida y reciente, recibida por LoRa.
- **Sin señal GPS:** llegan tramas NMEA válidas pero todavía no hay posición; LoRa funciona.
- **GPS sin datos:** no llegaron mensajes NMEA válidos recientemente; revisar alimentación, cableado y baudios del GPS.
- **Sin señal LoRa:** pasan más de 15 segundos sin recibir mensajes del collar. Puede estar apagado, sin batería o fuera de alcance; el silencio por sí solo no permite diferenciar esas causas.
- **Receptor desconectado / LoRa no disponible / Monitoreo no disponible:** revisar USB, inicio de radio o ejecución/permisos del puente respectivamente.
- **Desactivado:** el collar está desactivado desde la página.

La conexión USB del emisor **no determina** si está en línea. El puente comprueba el chip del emisor en los paquetes LoRa y la identidad USB/firmware del receptor. Esta identificación evita confusiones de placas; no es autenticación criptográfica de radio.

## Protocolo expo3

Radio (16 campos):

`SHGPS3|collar|chip|boot|secuencia|FIX/NO_FIX/NO_DATA|lat|lon|satélites|hdop|edadGPSms|nmeaVálidos|bytesGPS|uptimeMs|3|baud`

USB (18 campos): el receptor cambia `SHGPS3` por `SHRX3` y añade `|RSSI|SNR`, medidos en recepción. `boot` identifica cada arranque, por lo que la secuencia reiniciada no se confunde con la sesión anterior. Sin posición, latitud/longitud van vacías y edad GPS es `-1`; satélites/HDOP desconocidos usan `-1`, no datos inventados. No hay sensor de batería: no se transmite un porcentaje ficticio. RSSI/SNR describen la trama recibida, no un acuse de recibo al collar.

- GPS NMEA a GPIO18, UART inicial 9600; búsqueda 4800/38400/115200 si no llega ninguna trama válida. Se preservan campos NMEA vacíos, se valida checksum y estado RMC `A`, límites y hemisferios. Posición vencida a los 15 segundos.
- LoRa: SPI SCK12/MISO13/MOSI11, CS10/RESET16/DIO0 15; 915MHz, 2dBm, SF7, BW125kHz, CR4/5, preámbulo8, sync0x12, CRC.
- `bridge.py`: `127.0.0.1:8765/status`, sin caché. Reconecta el receptor por serie USB estable. El modo de 3 segundos es fijo; `/mode` informa que no admite cambios durante esta demostración.

## Verificar software

```sh
~/.platformio/penv/bin/pio run -e gps_tx -e base_rx
~/.platformio/penv/bin/python -m unittest test_bridge.py
```

Las pruebas de software validan paquetes, identidad, GPS sin datos/sin posición y pérdida de enlace sin exigir USB al emisor. La prueba de campo con batería, una posición GPS bajo cielo abierto y el alcance real quedan pendientes.
