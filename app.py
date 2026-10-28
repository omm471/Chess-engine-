import os
import math
import random
import shutil
import subprocess
import threading
import tempfile
import uuid
import urllib.request
import zipfile
from datetime import datetime
from functools import wraps

try:
    import ujson as json
except ImportError:
    import json

try:
    import requests
except ImportError:
    requests = None

import chess
import chess.engine
from flask import Flask, render_template, request, jsonify, send_from_directory, abort, render_template_string

app = Flask(__name__)
engine_lock = threading.Lock()

# ============================================================================
# SUPABASE CLOUD DATABASE CONFIGURATION (LIVE 2-WAY SYNC)
# ============================================================================
SUPABASE_URL = "https://fgywwlynrzwmjjiezqbj.supabase.co"
SUPABASE_KEY = "sb_publishable_L1C1cD_0p6L9qg0k4qHCZQ_UkJy_cGe"

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

LOCAL_MATCHES_FILE = os.path.abspath('saved_matches_local.json')

# ============================================================================
# BULLETPROOF OFFLINE BOARD THEMES EXTRACTOR
# ============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
BOARDS_DIR = os.path.join(STATIC_DIR, 'boards')
os.makedirs(BOARDS_DIR, exist_ok=True)

possible_zips = [
    os.path.join(STATIC_DIR, 'chessthemes.zip'),
    os.path.join(BASE_DIR, 'chessthemes.zip'),
    os.path.abspath('chessthemes.zip')
]

needs_extraction = not os.path.exists(os.path.join(BOARDS_DIR, 'a.png'))

if needs_extraction:
    found_zip = None
    for zp in possible_zips:
        if os.path.exists(zp):
            found_zip = zp
            break

    if found_zip:
        try:
            with zipfile.ZipFile(found_zip, 'r') as zf:
                for member in zf.infolist():
                    if member.is_dir():
                        continue
                    fname = os.path.basename(member.filename)
                    if not fname:
                        continue
                    target_file = os.path.join(BOARDS_DIR, fname.lower())
                    with zf.open(member) as src, open(target_file, 'wb') as dst:
                        shutil.copyfileobj(src, dst)
            print("[✔] Board Themes extracted and flattened successfully.", flush=True)
        except Exception as e:
            print("[!] Theme extraction error:", e, flush=True)

if os.path.exists(BOARDS_DIR):
    for root_d, _, files in os.walk(BOARDS_DIR):
        if root_d == BOARDS_DIR:
            continue
        for f in files:
            src_p = os.path.join(root_d, f)
            dst_p = os.path.join(BOARDS_DIR, f.lower())
            if not os.path.exists(dst_p):
                try:
                    shutil.copy2(src_p, dst_p)
                except Exception:
                    pass

    for char in ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']:
        target_png = os.path.join(BOARDS_DIR, f"{char}.png")
        if not os.path.exists(target_png):
            for alt_ext in ['.jpg', '.jpeg', '.webp', '.PNG', '.JPG', '.JPEG']:
                cand = os.path.join(BOARDS_DIR, f"{char}{alt_ext}")
                if os.path.exists(cand):
                    try:
                        shutil.copy2(cand, target_png)
                    except Exception:
                        pass
                    break

JS_DIR = os.path.join(os.path.abspath('static'), 'js')
os.makedirs(JS_DIR, exist_ok=True)

deps = {
    "jquery.min.js": "https://code.jquery.com/jquery-3.5.1.min.js",
    "chess.min.js": "https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"
}

for fname, url in deps.items():
    fpath = os.path.join(JS_DIR, fname)
    if not os.path.exists(fpath):
        try:
            urllib.request.urlretrieve(url, fpath)
            print(f"[✔] Downloaded dependency: {fname}", flush=True)
        except Exception as e:
            print(f"[!] Could not download {fname}:", e, flush=True)

ENGINES_DIR = os.path.abspath('engines')
os.makedirs(ENGINES_DIR, exist_ok=True)
OPENINGS_CACHE_FILE = os.path.abspath('eco_openings_full.json')
HW_CONFIG_FILE = os.path.abspath('engine_hw_config.json')

SOUND_DIR = os.path.abspath('sound')
for search_base in [os.getcwd(), '/root', '/data/data/com.termux/files/home']:
    if not os.path.exists(search_base):
        continue
    for root_dir, dirs, files in os.walk(search_base):
        low_files = [f.lower() for f in files]
        if any(k in low_files for k in ['move-self.mp3', 'capture.mp3', 'game-end.mp3']):
            SOUND_DIR = root_dir
            break
    if os.path.exists(os.path.join(SOUND_DIR, 'move-self.mp3')):
        break

DEFAULT_ENGINE_PATH = shutil.which("stockfish") or "/usr/games/stockfish"
if not os.path.exists(DEFAULT_ENGINE_PATH):
    for path in ["/usr/bin/stockfish", "/usr/local/bin/stockfish", "stockfish"]:
        if shutil.which(path) or os.path.exists(path):
            DEFAULT_ENGINE_PATH = path
            break

PRESET_NAMES = {
    "sf19": "Stockfish 19 (Next-Gen NNUE)",
    "sf18": "Stockfish 18 (Ultra Tactical)",
    "sf17": "Stockfish 17.1 (NNUE)",
    "sf16": "Stockfish 16 (Pro)",
    "sf15": "Stockfish 15 (Classical)",
    "sf14": "Stockfish 14 (Sharp)"
}

engine_state = {
    "path": DEFAULT_ENGINE_PATH,
    "protocol": "uci",
    "real_name": "Stockfish 19 (Next-Gen NNUE)",
    "preset": "sf19",
    "hash": 512,
    "threads": 8,
    "use_nnue": True,
    "last_nps": 0,
    "last_depth": 0,
    "last_seldepth": 0
}

if os.path.exists(HW_CONFIG_FILE):
    try:
        with open(HW_CONFIG_FILE, 'r') as f:
            saved_hw = json.load(f)
            engine_state["hash"] = min(4096, max(16, int(saved_hw.get("hash", 512))))
            engine_state["threads"] = min(32, max(1, int(saved_hw.get("threads", 8))))
            engine_state["use_nnue"] = bool(saved_hw.get("use_nnue", True))
            if saved_hw.get("path") and os.path.exists(saved_hw.get("path")):
                engine_state["path"] = saved_hw.get("path")
            engine_state["preset"] = saved_hw.get("preset", "sf19")
    except Exception:
        pass

def save_hw_config():
    try:
        with open(HW_CONFIG_FILE, 'w') as f:
            json.dump({
                "path": engine_state["path"],
                "preset": engine_state["preset"],
                "hash": engine_state["hash"],
                "threads": engine_state["threads"],
                "use_nnue": engine_state["use_nnue"]
            }, f)
    except Exception:
        pass

def open_any_chess_engine(bin_path):
    try: 
        os.chmod(bin_path, 0o755)
    except Exception: 
        pass
    low_name = os.path.basename(bin_path).lower()
    prefer_xboard = any(k in low_name for k in ["phalanx", "fairymax", "xphalanx", "crafty", "gnuchess"])
    if not prefer_xboard:
        try: 
            return chess.engine.SimpleEngine.popen_uci(bin_path, timeout=8.0), "uci"
        except Exception: 
            pass
        try: 
            return chess.engine.SimpleEngine.popen_xboard(bin_path, timeout=8.0), "xboard"
        except Exception as e: 
            raise RuntimeError(f"Cannot load binary: {e}")
    else:
        try: 
            return chess.engine.SimpleEngine.popen_xboard(bin_path, timeout=8.0), "xboard"
        except Exception: 
            pass
        try: 
            return chess.engine.SimpleEngine.popen_uci(bin_path, timeout=8.0), "uci"
        except Exception as e: 
            raise RuntimeError(f"Cannot load binary: {e}")

try:
    engine, proto = open_any_chess_engine(engine_state["path"])
except Exception:
    engine_state["path"] = DEFAULT_ENGINE_PATH
    engine, proto = open_any_chess_engine(DEFAULT_ENGINE_PATH)

engine_state["protocol"] = proto
engine_state["real_name"] = PRESET_NAMES.get(engine_state["preset"], engine.id.get("name", "Stockfish 19"))

def apply_hardware_settings_to_engine():
    applied = {}
    try:
        opts = engine.options
        for t_key in ["Threads", "Number of Threads", "cores"]:
            if t_key in opts:
                t_opt = opts[t_key]
                max_t = getattr(t_opt, 'max', 32) or 32
                t_val = max(1, min(max_t, int(engine_state["threads"])))
                engine.configure({t_key: t_val})
                applied["Threads"] = t_val
                engine_state["threads"] = t_val
                break
        if "Hash" in opts:
            h_opt = opts["Hash"]
            max_h = min(4096, getattr(h_opt, 'max', 4096) or 4096)
            h_val = max(16, min(max_h, int(engine_state["hash"])))
            engine.configure({"Hash": h_val})
            applied["Hash"] = h_val
            engine_state["hash"] = h_val
        if "Use NNUE" in opts:
            engine.configure({"Use NNUE": bool(engine_state["use_nnue"])})
            applied["Use NNUE"] = bool(engine_state["use_nnue"])
    except Exception:
        pass
    save_hw_config()
    return applied

with engine_lock:
    apply_hardware_settings_to_engine()

def ensure_Engine_Loaded(req_path, req_preset):
    global engine
    target_path = req_path.strip() if req_path else ""
    if not target_path or not os.path.exists(target_path):
        target_path = DEFAULT_ENGINE_PATH
    if target_path != engine_state["path"]:
        try:
            new_eng, proto = open_any_chess_engine(target_path)
            try: 
                engine.quit()
            except Exception: 
                pass
            engine = new_eng
            engine_state["path"] = target_path
            engine_state["protocol"] = proto
            apply_hardware_settings_to_engine()
        except Exception:
            pass
    if req_preset:
        engine_state["preset"] = req_preset
        engine_state["real_name"] = PRESET_NAMES.get(req_preset, engine.id.get("name", os.path.basename(engine_state["path"])))
    else:
        engine_state["real_name"] = engine.id.get("name", os.path.basename(engine_state["path"]))

ELO_CONFIG = {
    "400":  {"skill": 0,  "uci_elo": 400,  "depth": 1,  "multipv": 5, "weights": [10, 20, 25, 25, 20], "random_blunder": 0.40},
    "600":  {"skill": 1,  "uci_elo": 600,  "depth": 2,  "multipv": 5, "weights": [15, 25, 25, 20, 15], "random_blunder": 0.28},
    "850":  {"skill": 3,  "uci_elo": 850,  "depth": 3,  "multipv": 4, "weights": [25, 30, 25, 20],     "random_blunder": 0.18},
    "1000": {"skill": 4,  "uci_elo": 1000, "depth": 4,  "multipv": 4, "weights": [35, 30, 20, 15],     "random_blunder": 0.12},
    "1200": {"skill": 6,  "uci_elo": 1200, "depth": 5,  "multipv": 3, "weights": [45, 35, 20],         "random_blunder": 0.06},
    "1500": {"skill": 9,  "uci_elo": 1500, "depth": 8,  "multipv": 3, "weights": [60, 25, 15],         "random_blunder": 0.03},
    "1800": {"skill": 12, "uci_elo": 1800, "depth": 11, "multipv": 2, "weights": [75, 25],             "random_blunder": 0.0},
    "2000": {"skill": 15, "uci_elo": 2000, "depth": 14, "multipv": 1, "weights": [100],                "random_blunder": 0.0},
    "2300": {"skill": 18, "uci_elo": 2300, "depth": 18, "multipv": 1, "weights": [100],                "random_blunder": 0.0},
    "2500": {"skill": 20, "uci_elo": 2850, "depth": 22, "multipv": 1, "weights": [100],                "random_blunder": 0.0},
    "2800": {"skill": 20, "uci_elo": 3100, "depth": 26, "multipv": 1, "weights": [100],                "random_blunder": 0.0}
}

def score_to_cp_and_winpct(sc):
    if sc.is_mate():
        m = sc.mate()
        cp_val = (10000 - abs(m) * 100) if m > 0 else (-10000 + abs(m) * 100)
        win_pct = 99.5 if m > 0 else 0.5
        text = f"M{m}" if m > 0 else f"-M{abs(m)}"
    else:
        cp_val = sc.score() or 0
        win_pct = 50.0 + 50.0 * (2.0 / (1.0 + math.exp(-0.00368208 * cp_val)) - 1.0)
        win_pct = max(1.0, min(99.0, win_pct))
        text = f"{cp_val / 100.0:+.1f}"
    return cp_val, round(win_pct, 1), text

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/boards/<path:filename>')
def serve_board_theme_file(filename):
    direct = os.path.join(BOARDS_DIR, filename.lower())
    if os.path.exists(direct):
        return send_from_directory(BOARDS_DIR, filename.lower())

    base_name = os.path.splitext(filename)[0].lower()
    if os.path.exists(BOARDS_DIR):
        for f in os.listdir(BOARDS_DIR):
            if os.path.splitext(f)[0].lower() == base_name:
                return send_from_directory(BOARDS_DIR, f)
    return send_from_directory(BOARDS_DIR, filename)

# ============================================================================
# DEVICE-SCOPED ARCHIVE (existing Supabase + JSON storage, no engine changes)
# Supabase one-time migration (run as database owner, not with the public API key):
# ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS device_id text;
# CREATE INDEX IF NOT EXISTS matches_device_id_idx ON public.matches(device_id);
# Unowned legacy rows are retained, never automatically claimed by a new device.
# ============================================================================

vault_storage_lock = threading.RLock()


def archive_device_id():
    value = request.args.get('device_id') if request.method == 'GET' else request.form.get('device_id')
    if not isinstance(value, str) or not 8 <= len(value) <= 128:
        return None
    if any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in value):
        return None
    return value


def get_local_matches():
    with vault_storage_lock:
        if os.path.exists(LOCAL_MATCHES_FILE):
            with open(LOCAL_MATCHES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, list):
                raise ValueError('Local archive must be a list; refusing to overwrite it.')
            return data
        return []


def save_local_matches(matches_list):
    # Atomic replacement prevents torn JSON; callers hold the same RLock for RMW.
    # Keep the previous 60-row retention per device, not 60 rows across all phones.
    # Legacy/unowned entries are kept intact, outside the per-device retention cap.
    with vault_storage_lock:
        counts, kept = {}, []
        for item in matches_list:
            owner = item.get('device_id') if isinstance(item, dict) else None
            if isinstance(owner, str) and owner:
                counts[owner] = counts.get(owner, 0) + 1
                if counts[owner] > 60:
                    continue
            kept.append(item)
        folder = os.path.dirname(LOCAL_MATCHES_FILE) or '.'
        os.makedirs(folder, exist_ok=True)
        handle, temp_path = tempfile.mkstemp(prefix='.matches-', suffix='.tmp', dir=folder)
        try:
            with os.fdopen(handle, 'w', encoding='utf-8') as f:
                json.dump(kept, f)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, LOCAL_MATCHES_FILE)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


def owned_archive_rows(rows, device_id):
    if not isinstance(rows, list):
        return []
    return [m for m in rows if isinstance(m, dict) and m.get('device_id') == device_id]


def archive_schema_missing(response):
    # No unsafe global-query fallback when a deployed Supabase schema is old.
    try:
        error = response.json()
        text = str(error).lower()
        return response.status_code >= 400 and 'device_id' in text and (
            '42703' in text or 'pgrst204' in text or 'does not exist' in text or 'schema cache' in text)
    except Exception:
        return False


def device_archive_matches(device_id):
    cloud = []
    if requests is not None:
        try:
            res = requests.get(
                f'{SUPABASE_URL}/rest/v1/matches', headers=SUPABASE_HEADERS,
                params={'device_id': 'eq.' + device_id, 'select': '*', 'order': 'id.desc', 'limit': 50}, timeout=5)
            if res.status_code == 200:
                cloud = owned_archive_rows(res.json(), device_id)
        except Exception:
            pass
    local = owned_archive_rows(get_local_matches(), device_id)
    combined, seen_ids, seen_pgns = [], set(), set()
    # A recent offline local update takes precedence over an older cloud mirror.
    for match in local + cloud:
        mid = str(match.get('id', ''))
        pgn = (match.get('pgn') or '').strip()
        sig = pgn if len(pgn) > 10 else f"{match.get('date')}_{match.get('white')}_{match.get('black')}"
        if (mid and mid in seen_ids) or sig in seen_pgns:
            continue
        if mid:
            seen_ids.add(mid)
        seen_pgns.add(sig)
        combined.append(match)
    return combined


@app.route('/save_match', methods=['POST'])
def save_match():
    device_id = archive_device_id()
    if not device_id:
        return jsonify({'status': 'error', 'message': 'A valid device_id is required.'}), 400
    match_id = request.form.get('id', '').strip()
    if match_id in ('null', 'undefined', '0'):
        match_id = ''
    user_local_date = request.form.get('date', '').strip() or datetime.now().strftime('%d %b %Y • %I:%M %p')
    match_payload = {
        'device_id': device_id, 'date': user_local_date,
        'white': request.form.get('white', 'White'), 'black': request.form.get('black', 'Black'),
        'result': request.form.get('result', 'Match Over'),
        'w_acc': request.form.get('w_acc', '--%'), 'b_acc': request.form.get('b_acc', '--%'),
        'opening': request.form.get('opening', 'Standard'),
        'pgn': request.form.get('pgn', ''), 'fen': request.form.get('fen', '')
    }
    with vault_storage_lock:
        try:
            local = get_local_matches()
        except Exception:
            app.logger.exception('Local archive could not be read; no existing data was overwritten.')
            return jsonify({'status': 'error', 'message': 'Local archive could not be read.'}), 500
        existing = next((m for m in owned_archive_rows(local, device_id)
                         if str(m.get('id')) == match_id), None) if match_id else None
        # An ID found under another owner (including an unowned legacy row) is not claimable.
        if match_id and existing is None and any(isinstance(m, dict) and str(m.get('id')) == match_id for m in local):
            return jsonify({'status': 'error', 'message': 'Match not found for this device.'}), 404
        assigned_id = match_id or ('local_' + uuid.uuid4().hex)
        cloud_synced = False
        numeric_id = bool(match_id and match_id.isdigit() and int(match_id) > 0)
        if requests is not None:
            try:
                headers = {**SUPABASE_HEADERS, 'Prefer': 'return=representation'}
                if numeric_id:
                    res = requests.patch(
                        f'{SUPABASE_URL}/rest/v1/matches', headers=headers,
                        params={'id': 'eq.' + match_id, 'device_id': 'eq.' + device_id},
                        json=match_payload, timeout=5)
                    if res.status_code in (200, 204):
                        rows = owned_archive_rows(res.json() if res.text else [], device_id)
                        if rows:
                            assigned_id = str(rows[0]['id'])
                            cloud_synced = True
                        elif existing is None:
                            return jsonify({'status': 'error', 'message': 'Match not found for this device.'}), 404
                    elif existing is None:
                        return jsonify({'status': 'error', 'message': 'Match ownership could not be verified.'}), 503
                else:
                    # Never update the global "latest in-progress" game. Only an explicit
                    # owned ID can update a session; fresh saves create a separate record.
                    res = requests.post(f'{SUPABASE_URL}/rest/v1/matches', headers=headers,
                                        json=match_payload, timeout=5)
                    if res.status_code in (200, 201):
                        rows = owned_archive_rows(res.json(), device_id)
                        if rows:
                            assigned_id = str(rows[0]['id'])
                            cloud_synced = True
            except Exception:
                if numeric_id and existing is None:
                    return jsonify({'status': 'error', 'message': 'Match ownership could not be verified.'}), 503
        elif numeric_id and existing is None:
            return jsonify({'status': 'error', 'message': 'Match ownership could not be verified.'}), 503
        match_payload['id'] = assigned_id
        # Replace only this owner's matching local session, retaining every other device.
        local = [m for m in local if not (isinstance(m, dict) and m.get('device_id') == device_id
                 and str(m.get('id')) in {match_id, assigned_id})]
        local.insert(0, match_payload)
        try:
            save_local_matches(local)
        except Exception:
            app.logger.exception('Could not persist the local archive.')
            if not cloud_synced:
                return jsonify({'status': 'error', 'message': 'The match could not be saved.'}), 500
    return jsonify({'status': ('updated' if existing else 'saved') if cloud_synced else 'saved_locally',
                    'id': assigned_id, 'device_id': device_id, 'cloud_synced': cloud_synced})


@app.route('/get_matches', methods=['POST', 'GET'])
def get_matches():
    device_id = archive_device_id()
    if not device_id:
        return jsonify({'matches': []})
    try:
        return jsonify({'matches': device_archive_matches(device_id)})
    except Exception:
        app.logger.exception('Could not read the local archive.')
        return jsonify({'status': 'error', 'matches': [], 'message': 'Archive unavailable.'}), 500


def delete_device_cloud_matches(device_id, match_id=None):
    if requests is None:
        return True
    params = {'device_id': 'eq.' + device_id}
    if match_id is not None:
        if not match_id.isdigit():
            return True  # local-only IDs have never been inserted as cloud primary keys
        params['id'] = 'eq.' + match_id
    try:
        res = requests.delete(f'{SUPABASE_URL}/rest/v1/matches', headers=SUPABASE_HEADERS,
                              params=params, timeout=5)
        return res.status_code in (200, 204) or archive_schema_missing(res)
    except Exception:
        return False


@app.route('/delete_match', methods=['POST'])
def delete_match():
    device_id = archive_device_id()
    if not device_id:
        return jsonify({'status': 'error', 'message': 'A valid device_id is required.'}), 400
    match_id = request.form.get('id', '').strip()
    if not match_id:
        return jsonify({'status': 'error', 'message': 'No match ID provided.'}), 400
    with vault_storage_lock:
        try:
            local = get_local_matches()
            if not delete_device_cloud_matches(device_id, match_id):
                return jsonify({'status': 'error', 'message': 'Cloud deletion was not confirmed. Please retry.'}), 503
            save_local_matches([m for m in local if not (isinstance(m, dict) and
                m.get('device_id') == device_id and str(m.get('id')) == match_id)])
        except Exception:
            app.logger.exception('Could not delete the local match.')
            return jsonify({'status': 'error', 'message': 'Match deletion failed.'}), 500
    return jsonify({'status': 'deleted'})


@app.route('/delete_all_matches', methods=['POST'])
def delete_all_matches():
    device_id = archive_device_id()
    if not device_id:
        return jsonify({'status': 'error', 'message': 'A valid device_id is required.'}), 400
    with vault_storage_lock:
        try:
            local = get_local_matches()
            if not delete_device_cloud_matches(device_id):
                return jsonify({'status': 'error', 'message': 'Cloud deletion was not confirmed. Please retry.'}), 503
            save_local_matches([m for m in local if not (isinstance(m, dict) and m.get('device_id') == device_id)])
        except Exception:
            app.logger.exception('Could not clear the device archive.')
            return jsonify({'status': 'error', 'message': 'Archive deletion failed.'}), 500
    return jsonify({'status': 'cleared'})


@app.route('/api/export_all_pgn', methods=['GET'])
def export_all_pgn():
    device_id = archive_device_id()
    if not device_id:
        return jsonify({'status': 'success', 'count': 0, 'multi_pgn': ''})
    try:
        matches = device_archive_matches(device_id)
    except Exception:
        return jsonify({'status': 'error', 'count': 0, 'multi_pgn': '', 'message': 'Archive unavailable.'}), 500
    all_pgns = [r.get('pgn', '').strip() for r in matches if r.get('pgn', '').strip()]
    return jsonify({'status': 'success', 'count': len(all_pgns), 'multi_pgn': '\n\n\n'.join(all_pgns)})

@app.route('/sound/<path:filename>')
def serve_sound(filename):
    direct = os.path.join(SOUND_DIR, filename)
    if os.path.exists(direct): 
        return send_from_directory(SOUND_DIR, filename)
    if os.path.exists(SOUND_DIR):
        files = os.listdir(SOUND_DIR)
        base_req = os.path.splitext(filename)[0].lower()
        aliases = {
            "game-end": ["game-end", "game_end", "gameover", "checkmate", "win"],
            "notify": ["notify", "popup", "achievement", "lesson-pass"],
            "move-self": ["move-self", "move"],
            "capture": ["capture", "takes"],
            "move-check": ["move-check", "check"],
            "castle": ["castle"],
            "promote": ["promote"],
            "game-start": ["game-start", "start"],
            "illegal": ["illegal", "error"],
            "tenseconds": ["tenseconds", "clock"]
        }
        for cand in aliases.get(base_req, [base_req]):
            for f in files:
                if cand in f.lower(): 
                    return send_from_directory(SOUND_DIR, f)
    return ('', 204)

@app.route('/eco_book', methods=['GET'])
def get_eco_book():
    if os.path.exists(OPENINGS_CACHE_FILE):
        try:
            with open(OPENINGS_CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify({"count": len(data), "openings": data})
        except Exception: 
            pass
    return jsonify({"count": 0, "openings": []})

@app.route('/ai_move', methods=['POST'])
def ai_move():
    fen = request.form.get('fen')
    level = str(request.form.get('level', '2500')).replace('+', '')
    think_time = float(request.form.get('think_time', 0.8))
    user_depth = int(request.form.get('depth', 20))
    req_engine_path = request.form.get('engine_path', '')
    req_engine_preset = request.form.get('engine_preset', '')

    config = ELO_CONFIG.get(level, ELO_CONFIG["2500"])
    board = chess.Board(fen)
    if board.is_game_over(): 
        return jsonify({'move': None})

    chosen_move, best_eval_move, prev_cp = None, None, None

    with engine_lock:
        try:
            if req_engine_path or req_engine_preset:
                ensure_Engine_Loaded(req_engine_path, req_engine_preset)

            is_uci = (engine_state["protocol"] == "uci")
            opts = engine.options if is_uci else {}

            if is_uci:
                cfg = {}
                if "Skill Level" in opts: 
                    cfg["Skill Level"] = config["skill"]
                if "UCI_LimitStrength" in opts and "UCI_Elo" in opts:
                    cfg["UCI_LimitStrength"] = (int(level) < 2300)
                    if int(level) < 2300:
                        cfg["UCI_Elo"] = max(1320, min(2850, config["uci_elo"]))
                if cfg:
                    try: 
                        engine.configure(cfg)
                    except Exception: 
                        pass

            eff_depth = min(config["depth"], user_depth) if int(level) < 2300 else max(user_depth, config["depth"])
            eff_time = min(think_time, 0.25) if int(level) <= 1200 else think_time
            mpv = config["multipv"]

            if not is_uci or int(level) >= 2000:
                if is_uci:
                    info = engine.analyse(board, chess.engine.Limit(time=eff_time, depth=eff_depth))
                    if isinstance(info, list): 
                        info = info[0]
                    if "nps" in info: 
                        engine_state["last_nps"] = info["nps"]
                    if "depth" in info: 
                        engine_state["last_depth"] = info["depth"]
                    if "pv" in info and len(info["pv"]) > 0:
                        chosen_move = info["pv"][0]
                        best_eval_move = chosen_move
                    if "score" in info:
                        prev_cp, _, _ = score_to_cp_and_winpct(info["score"].white())
                if not chosen_move:
                    res = engine.play(board, chess.engine.Limit(time=eff_time, depth=eff_depth))
                    chosen_move = res.move
                    best_eval_move = res.move
            else:
                info = engine.analyse(board, chess.engine.Limit(time=eff_time, depth=eff_depth), multipv=mpv if ("MultiPV" in opts and mpv > 1) else 1)
                if isinstance(info, dict): 
                    info = [info]
                if info and len(info) > 0:
                    top_info = info[0]
                    if "nps" in top_info: 
                        engine_state["last_nps"] = top_info["nps"]
                    if "depth" in top_info: 
                        engine_state["last_depth"] = top_info["depth"]
                    if "pv" in top_info and len(top_info["pv"]) > 0:
                        best_eval_move = top_info["pv"][0]
                    if "score" in top_info:
                        prev_cp, _, _ = score_to_cp_and_winpct(top_info["score"].white())

                if config["random_blunder"] > 0 and random.random() < config["random_blunder"]:
                    chosen_move = random.choice(list(board.legal_moves))
                elif info and len(info) > 0:
                    candidates = [item["pv"][0] for item in info if "pv" in item and len(item["pv"]) > 0]
                    if candidates:
                        w_list = config["weights"][:len(candidates)]
                        chosen_move = random.choices(candidates, weights=w_list, k=1)[0]

                if not chosen_move:
                    res = engine.play(board, chess.engine.Limit(time=eff_time, depth=eff_depth))
                    chosen_move = res.move

            if is_uci:
                if "Skill Level" in opts:
                    try: 
                        engine.configure({"Skill Level": 20})
                    except Exception: 
                        pass
                if "UCI_LimitStrength" in opts:
                    try: 
                        engine.configure({"UCI_LimitStrength": False})
                    except Exception: 
                        pass
        except Exception:
            try:
                res = engine.play(board, chess.engine.Limit(time=0.3))
                chosen_move = res.move
            except Exception:
                if list(board.legal_moves): 
                    chosen_move = list(board.legal_moves)[0]

    if chosen_move:
        best_uci = best_eval_move.uci() if best_eval_move else chosen_move.uci()
        best_san = board.san(best_eval_move) if best_eval_move else board.san(chosen_move)
        resp = {
            'move': chosen_move.uci(), 
            'best_uci': best_uci, 
            'best_san': best_san,
            'engine': engine_state["real_name"], 
            'nps': engine_state["last_nps"], 
            'depth': engine_state["last_depth"]
        }
        if prev_cp is not None: 
            resp['prev_cp'] = prev_cp
        return jsonify(resp)
    return jsonify({'move': None})

@app.route('/eval', methods=['POST'])
def evaluate_position():
    fen = request.form.get('fen')
    req_depth = int(request.form.get('depth', 16))
    req_time = float(request.form.get('time', 0.18))
    req_engine_path = request.form.get('engine_path', '')
    req_engine_preset = request.form.get('engine_preset', '')
    try:
        board = chess.Board(fen)
        if board.is_checkmate():
            cp_val = -10000 if board.turn == chess.WHITE else 10000
            return jsonify({'score': 0.0 if board.turn == chess.WHITE else 100.0, 'text': '-M0' if board.turn == chess.WHITE else 'M0', 'cp': cp_val, 'best_uci': '', 'best_san': '', 'depth': req_depth, 'nps': engine_state["last_nps"], 'engine': engine_state["real_name"]})
        if board.is_game_over():
            return jsonify({'score': 50.0, 'text': '0.0', 'cp': 0, 'best_uci': '', 'best_san': '', 'depth': req_depth, 'nps': engine_state["last_nps"], 'engine': engine_state["real_name"]})

        with engine_lock:
            if req_engine_path or req_engine_preset: 
                ensure_Engine_Loaded(req_engine_path, req_engine_preset)
            if engine_state["protocol"] != "uci": 
                ensure_Engine_Loaded(DEFAULT_ENGINE_PATH, "sf19")
            info = engine.analyse(board, chess.engine.Limit(time=req_time, depth=req_depth))

        if isinstance(info, list): 
            info = info[0]
        if "nps" in info: 
            engine_state["last_nps"] = info["nps"]
        if "depth" in info: 
            engine_state["last_depth"] = info["depth"]

        best_uci, best_san = "", ""
        if "pv" in info and len(info["pv"]) > 0:
            bm = info["pv"][0]
            best_uci = bm.uci()
            best_san = board.san(bm)

        cp_val, score_pct, text = score_to_cp_and_winpct(info["score"].white())
        return jsonify({
            'score': score_pct, 
            'text': text, 
            'cp': cp_val,
            'best_uci': best_uci, 
            'best_san': best_san,
            'nps': engine_state["last_nps"], 
            'depth': engine_state["last_depth"],
            'engine': engine_state["real_name"]
        })
    except Exception:
        return jsonify({'score': 50.0, 'text': '0.0', 'cp': 0, 'best_uci': '', 'best_san': '', 'depth': 0, 'nps': 0})

@app.route('/multipv', methods=['POST'])
def multipv():
    fen = request.form.get('fen')
    req_depth = int(request.form.get('depth', 16))
    req_time = float(request.form.get('time', 0.20))
    try:
        board = chess.Board(fen)
        if board.is_game_over(): 
            return jsonify({"lines": []})
        with engine_lock:
            if engine_state["protocol"] != "uci": 
                ensure_Engine_Loaded(DEFAULT_ENGINE_PATH, "sf19")
            supports_mpv = "MultiPV" in engine.options
            info = engine.analyse(board, chess.engine.Limit(time=req_time, depth=req_depth), multipv=3 if supports_mpv else 1)
        lines = []
        if isinstance(info, dict): 
            info = [info]
        for item in info:
            if "nps" in item: 
                engine_state["last_nps"] = item["nps"]
            if "depth" in item: 
                engine_state["last_depth"] = item["depth"]
            if "pv" in item and len(item["pv"]) > 0:
                move = item["pv"][0]
                cp_val, win_pct, score_txt = score_to_cp_and_winpct(item["score"].white())
                lines.append({"uci": move.uci(), "san": board.san(move), "score": score_txt, "cp": cp_val, "win_pct": win_pct})
        return jsonify({
            "lines": lines, 
            "engine": engine_state["real_name"],
            "nps": engine_state["last_nps"], 
            "depth": engine_state["last_depth"]
        })
    except Exception:
        return jsonify({"lines": []})

@app.route('/update_engine', methods=['POST'])
def update_engine():
    if 'hash' in request.form: 
        engine_state["hash"] = min(4096, max(16, int(request.form.get('hash', 512))))
    if 'threads' in request.form: 
        engine_state["threads"] = min(32, max(1, int(request.form.get('threads', 8))))
    if 'use_nnue' in request.form: 
        engine_state["use_nnue"] = (str(request.form.get('use_nnue')).lower() in ['true', 'on', '1'])
    with engine_lock:
        applied = apply_hardware_settings_to_engine()
        return jsonify({
            "status": "success", 
            "engine_name": engine_state["real_name"],
            "protocol": engine_state["protocol"].upper(), 
            "applied": applied,
            "hash": engine_state["hash"], 
            "threads": engine_state["threads"], 
            "use_nnue": engine_state["use_nnue"]
        })

@app.route('/list_engines', methods=['GET'])
def list_engines():
    found = [
        {"id": "sf19", "name": "Stockfish 19 (Next-Gen NNUE)", "desc": "Ultra Deep NNUE + Multi-Core Search", "path": DEFAULT_ENGINE_PATH, "proto": "UCI", "preset": "sf19"},
        {"id": "sf18", "name": "Stockfish 18 (Ultra Tactical)", "desc": "Aggressive GM Tactical Engine", "path": DEFAULT_ENGINE_PATH, "proto": "UCI", "preset": "sf18"},
        {"id": "sf17", "name": "Stockfish 17.1 (in-built NNUE)", "desc": "Tournament GM Strength", "path": DEFAULT_ENGINE_PATH, "proto": "UCI", "preset": "sf17"},
        {"id": "sf16", "name": "Stockfish 16 (Pro Universal)", "desc": "Balanced Grandmaster Engine", "path": DEFAULT_ENGINE_PATH, "proto": "UCI", "preset": "sf16"},
        {"id": "sf15", "name": "Stockfish 15 (Classical)", "desc": "Solid Positional Engine", "path": DEFAULT_ENGINE_PATH, "proto": "UCI", "preset": "sf15"},
        {"id": "sf14", "name": "Stockfish 14 (Sharp)", "desc": "Fast Attacking Engine", "path": DEFAULT_ENGINE_PATH, "proto": "UCI", "preset": "sf14"}
    ]
    scan_paths = [ENGINES_DIR, "/usr/games", "/usr/bin", "/usr/local/bin"]
    seen = {DEFAULT_ENGINE_PATH}
    for sdir in scan_paths:
        if os.path.exists(sdir):
            for fname in sorted(os.listdir(sdir)):
                low = fname.lower()
                if low in ["xphalanx", "gamazons"]: 
                    continue
                if sdir == ENGINES_DIR or any(k in low for k in ["stockfish", "fairy", "toga", "phalanx", "fruit"]):
                    fpath = os.path.join(sdir, fname)
                    if os.path.isfile(fpath) and fpath not in seen:
                        seen.add(fpath)
                        p_type = "XBoard" if any(x in low for x in ["phalanx", "fairymax"]) else "UCI"
                        found.append({"id": fname, "name": f"{fname.capitalize()}", "desc": f"{fpath} ({p_type})", "path": fpath, "proto": p_type, "preset": fname})
    return jsonify({
        "engines": found, 
        "current": engine_state["path"], 
        "preset": engine_state["preset"],
        "real_name": engine_state["real_name"], 
        "protocol": engine_state["protocol"].upper(),
        "hash": engine_state["hash"], 
        "threads": engine_state["threads"], 
        "use_nnue": engine_state["use_nnue"]
    })

@app.route('/switch_engine', methods=['POST'])
def switch_engine():
    new_path = request.form.get('path', '').strip() or DEFAULT_ENGINE_PATH
    preset = request.form.get('preset', '').strip()
    if not os.path.exists(new_path):
        resolved = shutil.which(new_path)
        if resolved: 
            new_path = resolved
        else: 
            return jsonify({"status": "error", "message": f"Path not found: {new_path}"})
    with engine_lock:
        try:
            ensure_Engine_Loaded(new_path, preset)
            save_hw_config()
            return jsonify({"status": "success", "current": engine_state["path"], "real_name": engine_state["real_name"], "protocol": engine_state["protocol"].upper()})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)})

@app.route('/install_extra_engines', methods=['POST'])
def install_extra_engines():
    try:
        subprocess.run(["apt-get", "update"], timeout=30)
        subprocess.run(["apt-get", "install", "-y", "fairy-stockfish", "toga2", "phalanx", "fruit"], timeout=90)
        return jsonify({"status": "success", "message": "Extra engines installed!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# ============================================================================
# DIRECT DEVICE INTERNAL STORAGE PGN SAVER
# ============================================================================
@app.route('/save_to_device_storage', methods=['POST'])
def save_to_device_storage():
    pgn_content = request.form.get('pgn', '').strip()
    file_name = request.form.get('filename', '').strip()

    if not pgn_content:
        return jsonify({"status": "error", "message": "No PGN data received"}), 400

    if not file_name:
        file_name = f"Match_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pgn"

    possible_dirs = [
        "/storage/emulated/0/ChessAIPro",
        "/sdcard/ChessAIPro",
        os.path.expanduser("~/storage/shared/ChessAIPro")
    ]

    target_dir = None
    for d in possible_dirs:
        try:
            os.makedirs(d, exist_ok=True)
            if os.path.exists(d) and os.access(d, os.W_OK):
                target_dir = d
                break
        except Exception:
            continue

    if not target_dir:
        target_dir = os.path.abspath('saved_pgn_matches')
        os.makedirs(target_dir, exist_ok=True)

    file_path = os.path.join(target_dir, file_name)

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(pgn_content)
        return jsonify({
            "status": "success",
            "folder": target_dir,
            "filename": file_name,
            "path": file_path
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    try:
        import logging
        logging.getLogger('waitress.queue').setLevel(logging.ERROR)
        logging.getLogger('waitress').setLevel(logging.ERROR)
        from waitress import serve
        print("[✔] Production WSGI Server (Waitress) active!", flush=True)
        print("* Running on http://127.0.0.1:5000", flush=True)
        serve(app, host='0.0.0.0', port=5000, threads=8, channel_timeout=120)
    except ImportError:
        app.run(host='0.0.0.0', port=5000, debug=False)
