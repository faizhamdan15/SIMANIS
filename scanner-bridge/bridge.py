import json, os, time, uuid, logging
from pathlib import Path
from datetime import datetime, timezone
import requests, serial
from serial.tools import list_ports

BASE = Path(os.environ.get("PROGRAMDATA", str(Path.home()))) / "SIMANIS-Scanner-Bridge"
BASE.mkdir(parents=True, exist_ok=True)
CFG_PATH = BASE / "config.json"
QUEUE = BASE / "offline_queue.jsonl"
LOG = BASE / "bridge.log"

logging.basicConfig(filename=LOG, level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

def cfg():
    if not CFG_PATH.exists():
        raise RuntimeError(f"Config tidak ditemukan: {CFG_PATH}")
    x = json.loads(CFG_PATH.read_text(encoding="utf-8"))
    x.setdefault("api_url", "https://zevdqmrlcrnwkeqejbxm.supabase.co/functions/v1/scanner-bridge")
    x.setdefault("scanner_port", "auto")
    x.setdefault("baud_rate", 9600)
    x.setdefault("reconnect_seconds", 3)
    x.setdefault("http_timeout_seconds", 10)
    x.setdefault("device_name", "SIMANIS Scanner Bridge - Kiosk Utama")
    return x

C = cfg()
TOKEN = C["device_token"]
if not TOKEN: raise RuntimeError("device_token belum diisi")
API = C["api_url"]; PORT = str(C["scanner_port"]); BAUD = int(C["baud_rate"])
RECONNECT = int(C["reconnect_seconds"]); TIMEOUT = int(C["http_timeout_seconds"])
DEVICE = C["device_name"]
last_port = None
stop = False

def iso():
    return datetime.now(timezone.utc).isoformat()

def enqueue(scan_id, token):
    with QUEUE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"scan_id": scan_id, "token": token, "queued_at": iso()}) + "\n")

def send(scan_id, token):
    r = requests.post(API, json={"scan_id": scan_id, "token": token, "device_name": DEVICE},
                      headers={"x-device-token": TOKEN, "content-type": "application/json"},
                      timeout=TIMEOUT)
    if r.status_code >= 400: raise RuntimeError(f"API {r.status_code}: {r.text[:400]}")
    return r.json()

def flush_queue():
    if not QUEUE.exists(): return
    lines = QUEUE.read_text(encoding="utf-8").splitlines()
    remaining = []
    for i, line in enumerate(lines):
        try:
            x = json.loads(line); y = send(x["scan_id"], x["token"])
            logging.info("QUEUE OK %s %s", x["scan_id"], y.get("action"))
        except Exception as e:
            logging.warning("QUEUE WAIT %s", e)
            remaining = lines[i:]; break
    if remaining: QUEUE.write_text("\n".join(remaining) + "\n", encoding="utf-8")
    else:
        try: QUEUE.unlink()
        except FileNotFoundError: pass

def scan(token):
    token = "".join(ch for ch in str(token) if ord(ch) >= 32).strip()
    if not token: return
    sid = str(uuid.uuid4())
    try:
        y = send(sid, token)
        logging.info("SCAN OK %s action=%s teacher=%s", sid, y.get("action"), y.get("teacher_name"))
        print("[SCAN]", y.get("action"), "|", y.get("teacher_name",""), "|", y.get("message",""), flush=True)
    except Exception as e:
        enqueue(sid, token); logging.warning("SCAN QUEUED %s %s", sid, e)
        print("[QUEUED]", token, "|", e, flush=True)

def score(p):
    s = " ".join(str(x or "") for x in [p.description, p.manufacturer, p.product]).lower()
    return sum(10 for k in ("barcode","scanner","usb serial","usb-serial","ch340","ch341","cp210","ftdi","cdc","serial") if k in s)

def find_port():
    global last_port
    ps = list(list_ports.comports())
    if PORT.lower() != "auto":
        return next((p.device for p in ps if p.device.upper() == PORT.upper()), None)
    if last_port and any(p.device == last_port for p in ps): return last_port
    if len(ps) == 1: return ps[0].device
    ps.sort(key=score, reverse=True)
    return ps[0].device if ps and score(ps[0]) > 0 else None

def run():
    global last_port
    ser = None; buf = ""; last_rx = 0
    while True:
        if ser is None or not ser.is_open:
            port = find_port()
            if not port:
                time.sleep(RECONNECT); continue
            try:
                ser = serial.Serial(port, BAUD, bytesize=8, parity=serial.PARITY_NONE, stopbits=1, timeout=.2)
                last_port = port; buf = ""; last_rx = time.monotonic()
                logging.info("CONNECTED %s @ %s", port, BAUD); print("[CONNECTED]", port, flush=True)
                flush_queue()
            except Exception as e:
                logging.warning("CONNECT FAIL %s", e); ser = None; time.sleep(RECONNECT); continue
        try:
            data = ser.read(256)
            if data:
                buf += data.decode("utf-8", errors="ignore"); last_rx = time.monotonic()
                parts = buf.replace("\r","\n").replace("\t","\n").split("\n"); buf = parts.pop()
                for part in parts:
                    if part.strip(): scan(part)
            elif buf.strip() and time.monotonic() - last_rx >= .18:
                x = buf.strip(); buf = ""; scan(x)
        except (serial.SerialException, OSError) as e:
            logging.warning("DISCONNECTED %s", e); print("[DISCONNECTED]", e, flush=True)
            try: ser.close()
            except Exception: pass
            ser = None; time.sleep(RECONNECT)
        except Exception as e:
            logging.exception("READER ERROR"); time.sleep(1)

logging.info("SIMANIS Scanner Bridge starting")
print("SIMANIS Scanner Bridge aktif", flush=True)
print("API:", API, "| PORT:", PORT, "| BAUD:", BAUD, flush=True)
flush_queue()
run()
