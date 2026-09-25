#!/bin/zsh
cd "$(dirname "$0")"
PYTHON_BIN="$HOME/.platformio/penv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  echo 'No se encontró Python de PlatformIO. Instala PlatformIO para iniciar el puente.'
  read '?Presiona Enter para cerrar.'
  exit 1
fi
"$PYTHON_BIN" bridge.py
