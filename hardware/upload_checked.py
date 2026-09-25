"""Flash only the physically identified ESP32 for the requested role."""
import argparse
import subprocess
from pathlib import Path

from serial.tools import list_ports

MODULES = {
    "gps_tx": ("68:EE:8F:4F:32:20", "emisor con GPS, USB directo"),
    "base_rx": ("68:EE:8F:4F:50:20", "receptor sin GPS, hub"),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("role", choices=MODULES)
    args = parser.parse_args()
    serial_number, description = MODULES[args.role]
    matches = [port for port in list_ports.comports()
               if port.serial_number == serial_number and port.device.startswith("/dev/cu.")]
    if len(matches) != 1:
        raise SystemExit(f"Carga cancelada: se esperaban 1 {description} con serie {serial_number}; encontrados {len(matches)}.")
    pio = Path.home() / ".platformio/penv/bin/pio"
    if not pio.is_file():
        raise SystemExit(f"Carga cancelada: falta PlatformIO en {pio}")
    port = matches[0].device
    print(f"Identidad verificada: {description}; serie {serial_number}; puerto {port}", flush=True)
    subprocess.run([str(pio), "run", "-e", args.role, "-t", "upload", "--upload-port", port],
                   cwd=Path(__file__).resolve().parent, check=True)


if __name__ == "__main__":
    main()
