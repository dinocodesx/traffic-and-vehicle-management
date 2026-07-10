#!/usr/bin/env bash
# =============================================================================
# setup.sh — Start the Traffic Light Signal API + expose it via ngrok
# =============================================================================
# Usage:
#   ./setup.sh                   # uses default port 8000
#   API_PORT=8080 ./setup.sh     # uses a custom port
#
# Prerequisites:
#   - ngrok installed and authenticated (ngrok config add-authtoken <token>)
#   - Python environment with fastapi & uvicorn available
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
API_PORT="${API_PORT:-8000}"
API_MODULE="server.api.main:app"

# Resolve project root (two directories above this script: server/api/ → /)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$PROJECT_ROOT/logs"
UVICORN_LOG="$LOG_DIR/uvicorn.log"
NGROK_LOG="$LOG_DIR/ngrok.log"
NGROK_API_URL="http://localhost:4040/api/tunnels"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# ── Cleanup on exit ───────────────────────────────────────────────────────────
UVICORN_PID=""
NGROK_PID=""

cleanup() {
    echo ""
    info "Shutting down…"
    [[ -n "$UVICORN_PID" ]] && kill "$UVICORN_PID" 2>/dev/null && info "Stopped uvicorn (PID $UVICORN_PID)"
    [[ -n "$NGROK_PID"   ]] && kill "$NGROK_PID"   2>/dev/null && info "Stopped ngrok   (PID $NGROK_PID)"
    success "All processes terminated. Goodbye!"
}
trap cleanup EXIT INT TERM

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   🚦  Traffic Light Signal API Setup     ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Preflight checks ──────────────────────────────────────────────────────────
info "Running preflight checks…"

if ! command -v uvicorn &>/dev/null; then
    error "uvicorn not found. Install it: pip install uvicorn"
    exit 1
fi
success "uvicorn found: $(uvicorn --version 2>&1 | head -1)"

if ! command -v ngrok &>/dev/null; then
    error "ngrok not found. Install it: brew install ngrok"
    exit 1
fi
success "ngrok found:   $(ngrok version 2>&1 | head -1)"

if ! ngrok config check &>/dev/null; then
    error "ngrok is not authenticated. Run: ngrok config add-authtoken <YOUR_TOKEN>"
    error "Get your token at: https://dashboard.ngrok.com/authtokens"
    exit 1
fi
success "ngrok auth OK"

# ── Prepare log directory ─────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
info "Logs → $LOG_DIR/"

# ── Start uvicorn ─────────────────────────────────────────────────────────────
info "Starting FastAPI server on port ${API_PORT}…"
(cd "$PROJECT_ROOT" && uvicorn "$API_MODULE" \
    --host 0.0.0.0 \
    --port "$API_PORT" \
    --reload \
    --log-level info \
    >"$UVICORN_LOG" 2>&1) &
UVICORN_PID=$!

# Wait until uvicorn is actually listening
MAX_WAIT=15
WAITED=0
until curl -sf "http://localhost:${API_PORT}/" &>/dev/null; do
    sleep 1
    WAITED=$((WAITED + 1))
    if [[ $WAITED -ge $MAX_WAIT ]]; then
        error "uvicorn failed to start within ${MAX_WAIT}s. Check $UVICORN_LOG"
        cat "$UVICORN_LOG"
        exit 1
    fi
done
success "FastAPI is live → http://localhost:${API_PORT}"

# ── Start ngrok ───────────────────────────────────────────────────────────────
info "Starting ngrok tunnel on port ${API_PORT}…"
ngrok http "$API_PORT" \
    --log=stdout \
    --log-format=json \
    >"$NGROK_LOG" 2>&1 &
NGROK_PID=$!

# Poll ngrok's local API for the public URL
MAX_WAIT=20
WAITED=0
PUBLIC_URL=""
until [[ -n "$PUBLIC_URL" ]]; do
    sleep 1
    WAITED=$((WAITED + 1))
    if [[ $WAITED -ge $MAX_WAIT ]]; then
        error "ngrok failed to establish a tunnel within ${MAX_WAIT}s. Check $NGROK_LOG"
        cat "$NGROK_LOG"
        exit 1
    fi
    PUBLIC_URL=$(curl -sf "$NGROK_API_URL" \
        | python3 -c "
import sys, json
data = json.load(sys.stdin)
tunnels = data.get('tunnels', [])
for t in tunnels:
    if t.get('proto') == 'https':
        print(t['public_url'])
        break
" 2>/dev/null || true)
done

# ── Print summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  🚀  API is up and publicly accessible!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Local URL   :${RESET}  http://localhost:${API_PORT}"
echo -e "  ${BOLD}Public URL  :${RESET}  ${CYAN}${PUBLIC_URL}${RESET}"
echo ""
echo -e "  ${BOLD}Endpoints   :${RESET}"
echo -e "    ${CYAN}${PUBLIC_URL}/${RESET}          → health check"
echo -e "    ${CYAN}${PUBLIC_URL}/signals${RESET}   → traffic light timings"
echo -e "    ${CYAN}http://localhost:${API_PORT}/docs${RESET}   → Swagger UI (local only)"
echo ""
echo -e "  ${BOLD}Logs        :${RESET}"
echo -e "    uvicorn → ${UVICORN_LOG}"
echo -e "    ngrok   → ${NGROK_LOG}"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services.${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Keep alive ────────────────────────────────────────────────────────────────
wait
