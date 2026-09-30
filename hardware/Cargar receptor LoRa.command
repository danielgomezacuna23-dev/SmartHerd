#!/bin/zsh
cd "$(dirname "$0")"
"$HOME/.platformio/penv/bin/python" upload_checked.py base_rx
read "?Presiona Enter para cerrar."
