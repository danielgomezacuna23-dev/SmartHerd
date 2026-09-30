#!/bin/zsh
cd "$(dirname "$0")"
"$HOME/.platformio/penv/bin/python" upload_checked.py gps_tx
read "?Presiona Enter para cerrar."
