#!/bin/bash
# Avvia Rigo col modello VERO e lo espone su un link temporaneo https,
# protetto dal token DEMO_TOKEN del .env. Il collegamento vive finche'
# questa finestra resta aperta: chiudendola, il link smette di funzionare.
# La chiave del modello non lascia MAI questo computer.
cd "$(dirname "$0")" || exit 1

TOKEN="$(grep -m1 '^DEMO_TOKEN=' .env 2>/dev/null | cut -d= -f2)"
if [ -z "$TOKEN" ]; then
  echo "❌ Nel .env manca DEMO_TOKEN: il modello sarebbe usato da chiunque"
  echo "   trovi il link. Aggiungilo (openssl rand -hex 8) e riprova."
  exit 1
fi

lsof -nP -tiTCP:8790 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:8790" 2>/dev/null
sleep 0.4

node server/server.js > /tmp/rigo-bff.log 2>&1 &
BFF=$!
cloudflared tunnel --url http://127.0.0.1:8790 --no-autoupdate > /tmp/rigo-tunnel.log 2>&1 &
CF=$!

pulisci() { kill $BFF $CF 2>/dev/null; echo; echo "collegamento chiuso: il link non funziona piu'."; }
trap pulisci EXIT

echo "Sto attivando il collegamento sicuro a Rigo... (Ctrl+C o chiusura finestra = tutto spento)"
URL=""
for _ in $(seq 1 40); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/rigo-tunnel.log | head -1)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "❌ Il tunnel non e' partito: guarda /tmp/rigo-tunnel.log"
  exit 1
fi

LINK="$URL/?t=$TOKEN"
echo
echo "✅ Link di Rigo da mandare al collega (valido finche' questa finestra e' aperta):"
echo
echo "   $LINK"
echo
printf "%s" "$LINK" | pbcopy
echo "   (gia' copiato negli appunti: puoi incollarlo subito nella chat)"
echo "   Solo chi ha questo link col token puo' far leggere gli allegati al modello."
echo "   Il link cambia a ogni avvio: rilevalo qui, non dal messaggio scorso."
echo
open "$LINK" 2>/dev/null
wait
