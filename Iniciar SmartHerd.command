#!/bin/zsh
cd "$(dirname "$0")/hardware"
open "https://danielgomezacuna23-dev.github.io/SmartHerd/"
exec "$HOME/.platformio/penv/bin/python" bridge.py
