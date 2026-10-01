import json, os, sys, time, uuid, logging, traceback
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

DEFAULT_CONFIG = {
    "api_url": "https://zevdqmrlcrnwkeqejbxm.supabase.co/functions/v1/scanner-bridge",
    "device_token": "",
    "device_name": "SIMANIS Scanner Bridge - Kiosk Utama",
    "scanner_port": "auto",
    "baud_rate": 9600,
    "reconnect_seconds": 3,
    "http_timeout_seconds": 10
}

def write_default_config():
    if not CFG_PATH.exists():
        CFG_PATH.write_text(json.dumps(DEFAULT_CONFIG, indent=2), encoding="utf-8")

def cfg():
    write_default_config()
    try:
        x = json.loads(CFG_PATH.read_text(encoding="utf-8-sig"))
    except Exception as e:
        logging.exception("CONFIG ERROR")
        raise RuntimeError(f"Config tidak bisa dibaca: {e}")
    for k, v in DEFAULT_CONFIG.items():
        x.setdefault(k, v)
    return x

try:
    C = cfg()
    TOKEN = str(C.get("device_token") or "").strip()
    API = str(C["api_url"])
    PORT = str(C["scanner_port"])
    BAUD = int(C["baud_rate"])
    RECONNECT = int(C["reconnect_seconds"])
    TIMEOUT = int(C["http_timeout_seconds"])
    DEVICE = str(C["device_name"])
except Exception as e:
    logging.exception("STARTUP CONFIG ERROR")
    print("SIMANIS Scanner Bridge gagal membaca konfigurasi.")
    print("Periksa:", CFG_PATH)
    print("Error:", e)
    input("Tekan ENTER untuk menutup...")
    raise SystemExit(1)

def iso():
    return datetime.now(timezone.utc).isoformat()

def enqueue(scan_id, token):
    with QUEUE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"scan_id": scan_id, "token": token, "queued_at": iso()}) + "\n")

def send(scan_id, token):
    if not TOKEN:
        raise RuntimeError(f"device_token belum diisi. Edit {CFG_PATH}")
    r = requests.post(
        API,
        json={"scan_id": scan_id, "token": token, "device_name": DEVICE},
        headers={"x-device-token": TOKEN, "content-type": "application/json"},
        timeout=TIMEOUT
    )
    if r.status_code >= 400:
        raise RuntimeError(f"API {r.status_code}: {r.text[:400]}")
    return r.json()

def flush_queue():
    if not QUEUE.exists():
        return
    lines = QUEUE.read_text(encoding="utf-8").splitlines()
    remaining = []
    for i, line in enumerate(lines):
        try:
            x = json.loads(line)
            y = send(x["scan_id"], x["token"])
            logging.info("QUEUE OK %s %s", x["scan_id"], y.get("action"))
        except Exception as e:
            logging.warning("QUEUE WAIT %s", e)
            remaining = lines[i:]
            break
    if remaining:
        QUEUE.write_text("\n".join(remaining) + "\n", encoding="utf-8")
    else:
        try:
            QUEUE.unlink()
        except FileNotFoundError:
            pass

def scan(token):
    token = "".join(ch for ch in str(token) if ord(ch) >= 32).strip()
    if not token:
        return
    sid = str(uuid.uuid4())
    try:
        y = send(sid, token)
        logging.info("SCAN OK %s action=%s teacher=%s", sid, y.get("action"), y.get("teacher_name"))
        print("[SCAN]", y.get("action"), "|", y.get("teacher_name", ""), "|", y.get("message", ""), flush=True)
    except Exception as e:
        enqueue(sid, token)
        logging.warning("SCAN QUEUED %s %s", sid, e)
        print("[QUEUED]", token, "|", e, flush=True)

def score(p):
    s = " ".join(str(x or "") for x in [p.description, p.manufacturer, p.product]).lower()
    return sum(10 for k in ("barcode", "scanner", "usb serial", "usb-serial", "ch340", "ch341", "cp210", "ftdi", "cdc", "serial") if k in s)

def find_port():
    global last_port
    ps = list(list_ports.comports())
    if PORT.lower() != "auto":
        return next((p.device for p in ps if p.device.upper() == PORT.upper()), None)
    if last_port and any(p.device == last_port for p in ps):
        return last_port
    if len(ps) == 1:
        return ps[0].device
    ps.sort(key=score, reverse=True)
    return ps[0].device if ps and score(ps[0]) > 0 else None

last_port = None

def run():
    global last_port
    ser = None
    buf = ""
    last_rx = 0
    while True:
        if ser is None or not ser.is_open:
            port = find_port()
            if not port:
                print("[WAIT] Scanner USB-COM belum ditemukan...", flush=True)
                time.sleep(RECONNECT)
                continue
            try:
                ser = serial.Serial(port, BAUD, bytesize=8, parity=serial.PARITY_NONE, stopbits=1, timeout=.2)
                last_port = port
                buf = ""
                last_rx = time.monotonic()
                logging.info("CONNECTED %s @ %s", port, BAUD)
                print("[CONNECTED]", port, "@", BAUD, flush=True)
                flush_queue()
            except Exception as e:
                logging.warning("CONNECT FAIL %s", e)
                print("[CONNECT FAIL]", e, flush=True)
                ser = None
                time.sleep(RECONNECT)
                continue
        try:
            data = ser.read(256)
            if data:
                buf += data.decode("utf-8", errors="ignore")
                last_rx = time.monotonic()
                parts = buf.replace("\r", "\n").replace("\t", "\n").split("\n")
                buf = parts.pop()
                for part in parts:
                    if part.strip():
                        scan(part)
            elif buf.strip() and time.monotonic() - last_rx >= .18:
                x = buf.strip()
                buf = ""
                scan(x)
        except (serial.SerialException, OSError) as e:
            logging.warning("DISCONNECTED %s", e)
            print("[DISCONNECTED]", e, flush=True)
            try:
                ser.close()
            except Exception:
                pass
            ser = None
            time.sleep(RECONNECT)
        except Exception as e:
            logging.exception("READER ERROR")
            print("[READER ERROR]", e, flush=True)
            time.sleep(1)

print("==============================================")
print(" SIMANIS SCANNER BRIDGE")
print(" HC-T58 USB-COM -> Supabase -> Absensi Guru")
print("==============================================")
print("Config :", CFG_PATH)
print("Log    :", LOG)
print("API    :", API)
print("Port   :", PORT)
print("Baud   :", BAUD)

if not TOKEN:
    print("")
    print("DEVICE TOKEN BELUM DIISI.")
    print("Buka file berikut:")
    print(CFG_PATH)
    print("Isi nilai device_token, simpan, lalu jalankan Bridge lagi.")
    print("")
    input("Tekan ENTER untuk menutup...")
    raise SystemExit(2)

logging.info("SIMANIS Scanner Bridge starting")
flush_queue()
run()
