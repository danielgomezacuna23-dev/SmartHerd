"""Local, identity-checked bridge for the SmartHerd LoRa bench setup."""
import json
import math
import re
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial
from serial.tools import list_ports

COLLAR_ID = "SH-COLLAR-001"
ALLOWED_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://danielgomezacuna23-dev.github.io",
}
MODULES = {
    "transmitter": {"usb": "68:EE:8F:4F:32:20", "chip": "20324F8FEE68", "prefix": "SHGPS_TX"},
    "receiver": {"usb": "68:EE:8F:4F:50:20", "chip": "20504F8FEE68", "prefix": "SHGPS_RX"},
}
state = {
    "device_id": COLLAR_ID,
    "transmitter_connected": False,
    "receiver_connected": False,
    "transmitter_radio_ready": False,
    "receiver_radio_ready": False,
    "last_tx_at": None,
    "received_at": None,
    "signal": "waiting",
    "latitude": None,
    "longitude": None,
    "rssi": None,
    "snr": None,
    "transmitter_interval_seconds": None,
}
lock = threading.Lock()
mode_request_lock = threading.Lock()
mode_ack = threading.Event()
mode_target_interval = None
receiver_serial = None


def now():
    return datetime.now(timezone.utc).isoformat()


def parse_packet(line):
    fields = line.strip().split("|")
    if len(fields) != 8 or fields[0] != "SHRX" or fields[1] != COLLAR_ID or not fields[2].isdigit():
        return None
    if fields[3] not in ("FIX", "NO_FIX"):
        return None
    try:
        rssi, snr = int(fields[6]), float(fields[7])
        if not math.isfinite(snr) or not (-160 <= rssi <= 0):
            return None
        lat = lon = None
        if fields[3] == "FIX":
            lat, lon = float(fields[4]), float(fields[5])
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                return None
        elif fields[4] or fields[5]:
            return None
    except ValueError:
        return None
    return {"sequence": int(fields[2]), "signal": "fix" if lat is not None else "no_fix",
            "latitude": lat, "longitude": lon, "rssi": rssi, "snr": snr, "received_at": now()}


def find_port(role):
    expected = MODULES[role]["usb"]
    for port in list_ports.comports():
        if port.serial_number == expected and port.device.startswith("/dev/cu."):
            return port.device
    return None


def identity_ok(line, role):
    expected = MODULES[role]
    if not line.startswith(expected["prefix"] + " "):
        return False
    match = re.search(r"\bchip=([0-9A-F]{12})\b", line)
    if not match or match.group(1) != expected["chip"] or not re.search(r"\bRADIO_READY=[01]\b", line):
        return False
    if role == "transmitter" and f"collar={COLLAR_ID}" not in line:
        return False
    return True


def serial_loop(role):
    global receiver_serial
    connected_key = role + "_connected"
    while True:
        port = find_port(role)
        if not port:
            with lock:
                state[connected_key] = False
                state[role + "_radio_ready"] = False
            time.sleep(2)
            continue
        try:
            with serial.Serial(port, 115200, timeout=1) as connection:
                verified = False
                last_probe = 0
                print(f"{role}: USB {MODULES[role]['usb']} en {port}; verificando firmware", flush=True)
                while find_port(role) == port:
                    if not verified and time.monotonic() - last_probe >= 1:
                        connection.write(b"I\n")
                        last_probe = time.monotonic()
                    line = connection.readline().decode("ascii", "replace").strip()
                    if not verified:
                        if identity_ok(line, role):
                            verified = True
                            with lock:
                                state[connected_key] = True
                                state[role + "_radio_ready"] = "RADIO_READY=1" in line
                                if role == "transmitter":
                                    interval = re.search(r"\binterval=(5|300)\b", line)
                                    state["transmitter_interval_seconds"] = int(interval.group(1)) if interval else None
                                else:
                                    receiver_serial = connection
                            print(f"{role}: identidad y radio verificadas: {line}", flush=True)
                        continue
                    if role == "transmitter":
                        mode = re.match(r"^MODE interval=(5|300)\b", line)
                        if mode:
                            with lock:
                                state["transmitter_interval_seconds"] = int(mode.group(1))
                                if state["transmitter_interval_seconds"] == mode_target_interval:
                                    mode_ack.set()
                        match = re.match(r"^TX seq=(\d+) status=(FIX|NO_FIX)\b", line)
                        if match:
                            with lock:
                                state["last_tx_at"] = now()
                    else:
                        packet = parse_packet(line)
                        if packet:
                            with lock:
                                state.update(packet)
                            print(f"LoRa: {packet['signal']} seq={packet['sequence']} rssi={packet['rssi']}", flush=True)
        except (serial.SerialException, OSError) as error:
            print(f"{role}: desconectado: {error}", flush=True)
        with lock:
            state[connected_key] = False
            state[role + "_radio_ready"] = False
            if role == "receiver":
                receiver_serial = None
            else:
                state["transmitter_interval_seconds"] = None
        time.sleep(2)


class Handler(BaseHTTPRequestHandler):
    def cors_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")

    def do_OPTIONS(self):
        if self.path not in ("/status", "/mode") or self.headers.get("Origin") not in ALLOWED_ORIGINS:
            self.send_error(403)
            return
        self.send_response(204)
        self.cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def json_response(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        global mode_target_interval
        if self.path != "/mode":
            self.send_error(404)
            return
        if self.headers.get("Origin") not in ALLOWED_ORIGINS:
            self.send_error(403)
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            self.json_response(415, {"error": "Se requiere JSON"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 128:
                raise ValueError()
            payload = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            self.json_response(400, {"error": "Solicitud inválida"})
            return
        interval = payload.get("interval_seconds") if isinstance(payload, dict) else None
        if type(interval) is not int or interval not in (5, 300):
            self.json_response(400, {"error": "Intervalo inválido"})
            return
        if not mode_request_lock.acquire(blocking=False):
            self.json_response(409, {"error": "Ya se está cambiando el intervalo"})
            return
        try:
            with lock:
                if not (state["receiver_connected"] and state["receiver_radio_ready"] and
                        state["transmitter_connected"] and state["transmitter_radio_ready"] and receiver_serial):
                    self.json_response(503, {"error": "Los dos módulos deben estar conectados y con radio activa"})
                    return
                already_applied = state["transmitter_interval_seconds"] == interval
                mode_target_interval = interval
                mode_ack.clear()
                try:
                    receiver_serial.write(f"M|{interval}|{900 if interval == 5 else 0}\n".encode("ascii"))
                except (serial.SerialException, OSError):
                    self.json_response(503, {"error": "No se pudo escribir al receptor"})
                    return
            confirmed = already_applied or mode_ack.wait(15)
            self.json_response(200 if confirmed else 504, {
                "confirmed": bool(confirmed),
                "interval_seconds": interval,
                "message": "Cambio confirmado por el emisor" if confirmed else "El receptor envió la orden, pero el emisor no la confirmó",
            })
        finally:
            with lock:
                mode_target_interval = None
            mode_request_lock.release()

    def do_GET(self):
        if self.path != "/status":
            self.send_error(404)
            return
        with lock:
            payload = state.copy()
        # Keep the timestamped packet. The web app evaluates its age against
        # the selected 5-second or 300-second interval; clearing it here after
        # 45 seconds would falsely report a normal collar as disconnected.
        self.json_response(200, payload)


if __name__ == "__main__":
    for module in MODULES:
        threading.Thread(target=serial_loop, args=(module,), daemon=True).start()
    print("Puente local: http://127.0.0.1:8765/status", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
