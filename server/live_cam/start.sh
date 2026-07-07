#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  start.sh  —  Live YOLO Object Detection Demo Launcher
#  Starts the FastAPI server on port 8001 and exposes it via ngrok.
#
#  Usage:  ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PORT=8001
NGROK_TOKEN_FILE="$HOME/.config/ngrok/ngrok.yml"

# ── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[demo]${RESET} $*"; }
ok()   { echo -e "${GREEN}[✔]${RESET} $*"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }
err()  { echo -e "${RED}[✘]${RESET} $*"; exit 1; }

# ── Banner ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  🎯  Live YOLO Object Detection — Demo Launcher${RESET}"
echo -e "  ─────────────────────────────────────────────"
echo ""

# ── 1. Kill any processes still holding port 8001 ─────────────────────────
if lsof -ti tcp:$PORT &>/dev/null; then
  warn "Port $PORT already in use — killing existing process..."
  lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── 2. Install ngrok if missing ────────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  log "ngrok not found. Installing via Homebrew..."
  brew install ngrok || err "Failed to install ngrok. Please install it manually: https://ngrok.com/download"
  ok "ngrok installed"
else
  ok "ngrok already installed ($(ngrok version 2>&1 | head -1))"
fi

# ── 3. Authenticate ngrok (first run only) ─────────────────────────────────
if [ ! -f "$NGROK_TOKEN_FILE" ] || ! grep -q "authtoken" "$NGROK_TOKEN_FILE" 2>/dev/null; then
  echo ""
  warn "ngrok needs a free auth token (one-time setup)."
  echo -e "  ${BOLD}→ Sign up / log in at:${RESET}  https://dashboard.ngrok.com/signup"
  echo -e "  ${BOLD}→ Copy your token from:${RESET} https://dashboard.ngrok.com/get-started/your-authtoken"
  echo ""
  read -rp "  Paste your ngrok authtoken: " NGROK_TOKEN
  if [ -z "$NGROK_TOKEN" ]; then
    err "No token provided. Exiting."
  fi
  ngrok config add-authtoken "$NGROK_TOKEN"
  ok "ngrok token saved"
else
  ok "ngrok already authenticated"
fi

# ── 4. Activate Python virtual environment ─────────────────────────────────
VENV="$REPO_ROOT/.venv/bin/activate"
if [ ! -f "$VENV" ]; then
  err "Python venv not found at $VENV. Run 'uv venv' from the repo root first."
fi
source "$VENV"
ok "Python venv activated"

# ── 5. Start FastAPI server in background ──────────────────────────────────
log "Starting FastAPI server on port $PORT..."
cd "$SCRIPT_DIR"
python main.py &
SERVER_PID=$!

# Wait until the server is accepting connections (up to 15s)
MAX_WAIT=15
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf http://localhost:$PORT/health &>/dev/null; then
    break
  fi
  if [ $i -eq $MAX_WAIT ]; then
    err "Server did not start within ${MAX_WAIT}s. Check main.py for errors."
  fi
  sleep 1
done
ok "FastAPI server running  →  http://localhost:$PORT"

# ── 6. Start ngrok in background ──────────────────────────────────────────
log "Opening ngrok tunnel..."
ngrok http $PORT --log=stdout --log-level=warn > /tmp/ngrok_yolo.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to print a public URL
PUBLIC_URL=""
for i in $(seq 1 20); do
  sleep 1
  PUBLIC_URL=$(curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels']; print(t[0]['public_url'])" 2>/dev/null || true)
  if [[ "$PUBLIC_URL" == https://* ]]; then
    break
  fi
done

if [ -z "$PUBLIC_URL" ]; then
  warn "Could not read ngrok URL from API. Check /tmp/ngrok_yolo.log for details."
else
  ok "ngrok tunnel active"
fi

# ── 7. Print summary ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ─────────────────────────────────────────────${RESET}"
echo -e "${BOLD}  🚀  Demo is live!${RESET}"
echo ""
echo -e "  ${BOLD}Local  (this machine):${RESET}  http://localhost:$PORT"
if [ -n "$PUBLIC_URL" ]; then
echo -e "  ${BOLD}Public (any device):  ${RESET}  ${GREEN}$PUBLIC_URL${RESET}  ← open on your phone"
fi
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop everything.${RESET}"
echo -e "  ─────────────────────────────────────────────"
echo ""

# ── 8. Trap Ctrl+C → clean shutdown ───────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down..."
  kill $SERVER_PID 2>/dev/null || true
  kill $NGROK_PID  2>/dev/null || true
  ok "All processes stopped. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 9. Keep script alive (tail server output so user sees logs) ────────────
wait $SERVER_PID
