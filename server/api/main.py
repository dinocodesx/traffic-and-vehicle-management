import random
import threading
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Traffic Light Signal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- State ---
_signal_state: dict = {}
_cycle_start: float = 0.0
_cycle_duration: float = 0.0
_lock = threading.Lock()


def _new_cycle() -> dict:
    """Generate a new set of signal timings for a cycle."""
    red = random.randint(15, 60)
    green = random.randint(15, 60)
    orange = 10  # fixed
    return {"red": red, "orange": orange, "green": green}


def _cycle_runner():
    """Background thread that resets signal timings after every cycle."""
    global _signal_state, _cycle_start, _cycle_duration

    while True:
        with _lock:
            _signal_state = _new_cycle()
            _cycle_duration = sum(_signal_state.values())
            _cycle_start = time.time()

        # Sleep for the exact cycle duration, then loop
        time.sleep(_cycle_duration)


# Start the background thread on startup
_thread = threading.Thread(target=_cycle_runner, daemon=True)
_thread.start()


@app.get("/signals", summary="Get current traffic signal timings")
def get_signals():
    """
    Returns the current traffic light durations (in seconds) for the active cycle.

    - **red**: 15–60 s (randomised each cycle)
    - **orange**: fixed at 10 s
    - **green**: 15–60 s (randomised each cycle)

    Values reset automatically once the cycle (red + orange + green) completes.
    """
    with _lock:
        state = dict(_signal_state)
        cycle_duration = _cycle_duration
        elapsed = round(time.time() - _cycle_start, 2)
        remaining = round(max(cycle_duration - elapsed, 0), 2)

    return {
        "signals": state,
        "cycle": {
            "duration_seconds": cycle_duration,
            "elapsed_seconds": elapsed,
            "remaining_seconds": remaining,
        },
    }


@app.get("/", summary="Health check")
def root():
    return {"status": "ok", "message": "Traffic Light Signal API is running"}
