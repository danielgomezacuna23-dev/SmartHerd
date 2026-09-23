#!/bin/zsh
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null; then
  echo 'Instala Node.js 22.12 o posterior para iniciar SmartHerd.'
  read '?Presiona Enter para cerrar.'
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci || exit 1
fi
(sleep 2; open http://127.0.0.1:5173) &
npm run dev -- --port 5173 --strictPort
