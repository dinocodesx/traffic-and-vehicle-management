#!/usr/bin/env bash
# =============================================================================
# start.sh — Start the Live YOLO Cam server and expose it via ngrok
# =============================================================================
# Usage:  ./start.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PORT=8001
NGROK_TOKEN_FILE="$HOME/.config/ngrok/ngrok.yml"
NGROK_LOG="/tmp/ngrok_live_cam.log"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[live_cam]${RESET} $*"; }
ok()   { echo -e "${GREEN}[live_cam]${RESET} $*"; }
warn() { echo -e "${YELLOW}[live_cam]${RESET} $*"; }
err()  { echo -e "${RED}[live_cam]${RESET} $*"; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  🎯  Live YOLO Object Detection — Launcher${RESET}"
echo -e "  ─────────────────────────────────────────────"
echo ""

# ── Kill anything already on this port ───────────────────────────────────────
if lsof -ti tcp:$PORT &>/dev/null; then
  warn "Port $PORT already in use — killing existing process…"
  lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── Install ngrok if missing ──────────────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  log "ngrok not found. Installing via Homebrew…"
  brew install ngrok || err "Failed to install ngrok. See https://ngrok.com/download"
  ok "ngrok installed"
else
  ok "ngrok $(ngrok version 2>&1 | head -1)"
fi

# ── Authenticate ngrok (first run only) ──────────────────────────────────────
if [ ! -f "$NGROK_TOKEN_FILE" ] || ! grep -q "authtoken" "$NGROK_TOKEN_FILE" 2>/dev/null; then
  echo ""
  warn "ngrok needs a free auth token (one-time setup)."
  echo -e "  ${BOLD}→ Sign up at:${RESET}   https://dashboard.ngrok.com/signup"
  echo -e "  ${BOLD}→ Get token:${RESET}    https://dashboard.ngrok.com/get-started/your-authtoken"
  echo ""
  read -rp "  Paste your ngrok authtoken: " NGROK_TOKEN
  [ -z "$NGROK_TOKEN" ] && err "No token provided. Exiting."
  ngrok config add-authtoken "$NGROK_TOKEN"
  ok "ngrok token saved"
else
  ok "ngrok already authenticated"
fi

# ── Activate Python virtual environment ──────────────────────────────────────
VENV="$REPO_ROOT/.venv/bin/activate"
[ -f "$VENV" ] || err "Python venv not found at $VENV. Run 'uv venv' from the repo root first."
source "$VENV"
ok "Python venv activated"

# ── Start FastAPI server ──────────────────────────────────────────────────────
log "Starting live cam server on port $PORT…"
cd "$SCRIPT_DIR"
python main.py &
SERVER_PID=$!

for i in $(seq 1 15); do
  curl -sf http://localhost:$PORT/health &>/dev/null && break
  sleep 1
  [ $i -eq 15 ] && err "Server did not start within 15s — check main.py"
done
ok "Live cam server running → http://localhost:$PORT"

# ── Start ngrok ───────────────────────────────────────────────────────────────
log "Opening ngrok tunnel…"
ngrok http $PORT --log=stdout --log-level=warn > "$NGROK_LOG" 2>&1 &
NGROK_PID=$!

PUBLIC_URL=""
for i in $(seq 1 20); do
  sleep 1
  PUBLIC_URL=$(python3 - <<'PY' 2>/dev/null || true
import urllib.request, json, sys
try:
    with urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2) as r:
        data = json.load(r)
    for t in data.get("tunnels", []):
        if t.get("proto") == "https":
            print(t["public_url"]); sys.exit(0)
except Exception:
    pass
PY
)
  [[ "$PUBLIC_URL" == https://* ]] && break
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}─────────────────────────────────────────────${RESET}"
echo -e "  ${BOLD}🚀  Demo is live!${RESET}"
echo ""
echo -e "  ${BOLD}Local  ${RESET}  http://localhost:$PORT"
if [ -n "$PUBLIC_URL" ]; then
echo -e "  ${BOLD}Public ${RESET}  ${GREEN}$PUBLIC_URL${RESET}  ← open on your phone"
fi
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop everything.${RESET}"
echo -e "  ─────────────────────────────────────────────"
echo ""

# ── Cleanup on Ctrl+C ────────────────────────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down…"
  kill $SERVER_PID 2>/dev/null || true
  kill $NGROK_PID  2>/dev/null || true
  ok "All processes stopped. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM

wait $SERVER_PID
