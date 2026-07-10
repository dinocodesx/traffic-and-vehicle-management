#!/usr/bin/env bash
# =============================================================================
# start.sh — Start the Traffic Light Signal API and expose it via ngrok
# =============================================================================
# Usage:
#   ./start.sh                   # default port 8000
#   API_PORT=8080 ./start.sh     # custom port
#
# Prerequisites:
#   - uvicorn  : pip install "fastapi[standard]" uvicorn
#   - ngrok    : brew install ngrok/ngrok/ngrok
#   - auth     : ngrok config add-authtoken <YOUR_TOKEN>
#                https://dashboard.ngrok.com/authtokens
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
API_PORT="${API_PORT:-8002}"
API_MODULE="server.api.main:app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
UVICORN_LOG="$LOG_DIR/uvicorn.log"
NGROK_LOG="$LOG_DIR/ngrok.log"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info() { echo -e "${CYAN}[api]${RESET}  $*"; }
ok()   { echo -e "${GREEN}[api]${RESET}  $*"; }
fail() { echo -e "${RED}[api]${RESET}  $*" >&2; exit 1; }

# ── Cleanup ───────────────────────────────────────────────────────────────────
UVICORN_PID=""; NGROK_PID=""
cleanup() {
    echo ""
    info "Shutting down…"
    [[ -n "$UVICORN_PID" ]] && kill "$UVICORN_PID" 2>/dev/null && info "Stopped uvicorn (PID $UVICORN_PID)"
    [[ -n "$NGROK_PID"   ]] && kill "$NGROK_PID"   2>/dev/null && info "Stopped ngrok   (PID $NGROK_PID)"
    echo -e "${GREEN}Done. Goodbye!${RESET}"
}
trap cleanup EXIT INT TERM

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}  ╔════════════════════════════════════════════╗"
echo -e "  ║   🚦  Traffic Light Signal API  ·  start  ║"
echo -e "  ╚════════════════════════════════════════════╝${RESET}"
echo ""

# ── Preflight ─────────────────────────────────────────────────────────────────
info "Checking dependencies…"

command -v uvicorn &>/dev/null \
    && ok "uvicorn  $(uvicorn --version 2>&1 | head -1)" \
    || fail "uvicorn not found — run: pip install 'fastapi[standard]' uvicorn"

command -v ngrok &>/dev/null \
    && ok "ngrok    $(ngrok version 2>&1 | head -1)" \
    || fail "ngrok not found — run: brew install ngrok/ngrok/ngrok"

ngrok config check &>/dev/null \
    && ok "ngrok auth token present" \
    || fail "ngrok not authenticated — run: ngrok config add-authtoken <TOKEN>"

# ── Log dir ───────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Kill anything already on this port ───────────────────────────────────────
if lsof -ti tcp:"$API_PORT" &>/dev/null; then
    info "Port $API_PORT in use — freeing it…"
    lsof -ti tcp:"$API_PORT" | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# ── Start uvicorn ─────────────────────────────────────────────────────────────
info "Starting FastAPI on port ${API_PORT}…"
(cd "$PROJECT_ROOT" && uvicorn "$API_MODULE" \
    --host 0.0.0.0 \
    --port "$API_PORT" \
    --reload \
    --log-level info \
    >> "$UVICORN_LOG" 2>&1) &
UVICORN_PID=$!

for i in $(seq 1 20); do
    curl -sf "http://localhost:${API_PORT}/" &>/dev/null && break
    sleep 1
    [[ $i -eq 20 ]] && { cat "$UVICORN_LOG"; fail "uvicorn didn't start — see $UVICORN_LOG"; }
done
ok "FastAPI running → http://localhost:${API_PORT}"

# ── Start ngrok ───────────────────────────────────────────────────────────────
info "Opening ngrok tunnel…"
ngrok http "$API_PORT" \
    --log=stdout \
    --log-format=json \
    >> "$NGROK_LOG" 2>&1 &
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
    [[ -n "$PUBLIC_URL" ]] && break
    [[ $i -eq 20 ]] && { cat "$NGROK_LOG"; fail "ngrok tunnel failed — see $NGROK_LOG"; }
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  🌐  Public API is live!"
echo -e "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Local  ${RESET}  http://localhost:${API_PORT}"
echo -e "  ${BOLD}Public ${RESET}  ${CYAN}${PUBLIC_URL}${RESET}"
echo ""
echo -e "  ${BOLD}Endpoints${RESET}"
echo -e "    ${CYAN}${PUBLIC_URL}/${RESET}"
echo -e "    ${CYAN}${PUBLIC_URL}/signals${RESET}"
echo -e "    http://localhost:${API_PORT}/docs  ${YELLOW}(Swagger — local only)${RESET}"
echo ""
echo -e "  ${BOLD}Logs${RESET}"
echo -e "    uvicorn → ${UVICORN_LOG}"
echo -e "    ngrok   → ${NGROK_LOG}"
echo ""
echo -e "  ${YELLOW}Ctrl+C to stop.${RESET}"
echo -e "${GREEN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

wait
