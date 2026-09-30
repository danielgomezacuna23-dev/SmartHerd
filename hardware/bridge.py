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
last_received_monotonic = float("-inf")


def now():
    return datetime.now(timezone.utc).isoformat()


def parse_packet(line):
    fields = line.strip().split("|")
    if fields[0] == "SHRX3":
        return parse_demo_packet(fields)
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


def parse_demo_packet(fields):
    if (len(fields) != 18 or fields[1] != COLLAR_ID or
            fields[2] != MODULES["transmitter"]["chip"] or
            not re.fullmatch(r"[0-9A-F]{8}", fields[3]) or
            fields[5] not in ("FIX", "NO_FIX", "NO_DATA")):
        return None
    try:
        sequence, sats, age, nmea, uart, uptime, interval, baud = [int(fields[i]) for i in (4, 8, 10, 11, 12, 13, 14, 15)]
        hdop, rssi, snr = float(fields[9]), int(fields[16]), float(fields[17])
        if (interval != 3 or baud not in (9600, 4800, 38400, 115200) or
                not 0 <= sequence <= 0xffffffff or not -1 <= sats <= 99 or not -1 <= age <= 15000 or
                any(not 0 <= v <= 0xffffffff for v in (nmea, uart, uptime)) or
                not math.isfinite(hdop) or not -1 <= hdop <= 999 or
                not -160 <= rssi <= 0 or not math.isfinite(snr) or not -30 <= snr <= 30):
            return None
        lat = lon = None
        if fields[5] == "FIX":
            lat, lon = float(fields[6]), float(fields[7])
            if age < 0 or not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                return None
        elif fields[6] or fields[7] or age != -1:
            return None
    except (ValueError, OverflowError):
        return None
    return dict(sequence=sequence, boot_id=fields[3], transmitter_chip=fields[2],
                signal=fields[5].lower(), latitude=lat, longitude=lon,
                satellites=None if sats < 0 else sats, hdop=None if hdop < 0 else hdop,
                gps_age_ms=None if age < 0 else age, valid_nmea=nmea, gps_bytes=uart,
                uptime_ms=uptime, gps_baud=baud, transmitter_interval_seconds=interval,
                rssi=rssi, snr=snr, received_at=now())


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


def snapshot(at=None):
    """Emitter liveness is proved by radio reception, never by a USB cable."""
    with lock:
        payload = state.copy()
        age = (time.monotonic() if at is None else at) - last_received_monotonic
    alive = payload["receiver_connected"] and payload["receiver_radio_ready"] and 0 <= age <= 15
    payload.update(transmitter_connected=bool(alive), transmitter_radio_ready=bool(alive),
                   transmitter_usb_connected=bool(find_port("transmitter")),
                   demo_mode=True, status_source="lora", transmitter_interval_seconds=3)
    return payload


def accept_packet(packet):
    global last_received_monotonic
    with lock:
        state.update(packet)
        state["last_tx_at"] = packet["received_at"]
        last_received_monotonic = time.monotonic()


def serial_loop(role="receiver"):
    while True:
        port = find_port("receiver")
        if not port:
            with lock:
                state["receiver_connected"] = False
                state["receiver_radio_ready"] = False
            time.sleep(1)
            continue
        try:
            with serial.Serial(port, 115200, timeout=0.5) as connection:
                verified = False
                last_probe = 0
                while find_port("receiver") == port:
                    if not verified and time.monotonic() - last_probe >= 1:
                        connection.write(b"I\n")
                        last_probe = time.monotonic()
                    line = connection.readline().decode("ascii", "replace").strip()
                    if identity_ok(line, "receiver"):
                        verified = "firmware=expo3" in line
                        with lock:
                            state["receiver_connected"] = verified
                            state["receiver_radio_ready"] = verified and "RADIO_READY=1" in line
                        continue
                    if verified:
                        packet = parse_packet(line)
                        if packet:
                            accept_packet(packet)
                            print(f"LoRa: {packet['signal']} seq={packet['sequence']} rssi={packet['rssi']}", flush=True)
        except (serial.SerialException, OSError) as error:
            print(f"receiver: {error}", flush=True)
        with lock:
            state["receiver_connected"] = False
            state["receiver_radio_ready"] = False
        time.sleep(1)


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
        if self.path != "/mode":
            self.send_error(404)
            return
        self.json_response(409, {"error": "La demostración transmite cada 3 segundos de forma continua; no requiere órdenes al emisor."})

    def do_GET(self):
        if self.path != "/status":
            self.send_error(404)
            return
        self.json_response(200, snapshot())


if __name__ == "__main__":
    threading.Thread(target=serial_loop, daemon=True).start()
    print("Puente USB/LoRa: http://127.0.0.1:8765/status; solo el receptor requiere USB", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
