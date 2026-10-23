import os
import math
import random
import shutil
import subprocess
import threading
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

ZIP_THEMES_PATH = os.path.join(os.path.abspath('static'), 'chessthemes.zip')
BOARDS_DIR = os.path.join(os.path.abspath('static'), 'boards')

if os.path.exists(ZIP_THEMES_PATH) and not os.path.exists(BOARDS_DIR):
    try:
        os.makedirs(BOARDS_DIR, exist_ok=True)
        with zipfile.ZipFile(ZIP_THEMES_PATH, 'r') as zf:
            zf.extractall(BOARDS_DIR)
        print("[✔] Board Themes extracted successfully.", flush=True)
    except Exception as e:
        print("[!] Theme extraction error:", e, flush=True)

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
    "hash": 256,
    "threads": 4,
    "use_nnue": True,
    "last_nps": 0,
    "last_depth": 0,
    "last_seldepth": 0
}

if os.path.exists(HW_CONFIG_FILE):
    try:
        with open(HW_CONFIG_FILE, 'r') as f:
            saved_hw = json.load(f)
            engine_state["hash"] = min(4096, max(16, int(saved_hw.get("hash", 256))))
            engine_state["threads"] = min(32, max(1, int(saved_hw.get("threads", 4))))
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

# ============================================================================
# SUPABASE DATABASE ROUTES (CLOUD MATCHES & ARCHIVES)
# ============================================================================

@app.route('/save_match', methods=['POST'])
def save_match():
    match_id = request.form.get('id', '').strip()

    # User ke device/country ka real local time frontend se aayega
    user_local_date = request.form.get('date', '').strip()
    if not user_local_date:
        user_local_date = datetime.now().strftime("%d %b %Y • %I:%M %p")

    match_payload = {
        "date": user_local_date,
        "white": request.form.get('white', 'White'),
        "black": request.form.get('black', 'Black'),
        "result": request.form.get('result', 'Match Over'),
        "w_acc": request.form.get('w_acc', '--%'),
        "b_acc": request.form.get('b_acc', '--%'),
        "opening": request.form.get('opening', 'Standard'),
        "pgn": request.form.get('pgn', ''),
        "fen": request.form.get('fen', '')
    }

    try:
        # Agar match already in-progress hai toh usi row ko update (PATCH) karein
        if match_id and match_id not in ['null', 'undefined', '0']:
            res = requests.patch(
                f"{SUPABASE_URL}/rest/v1/matches?id=eq.{match_id}",
                headers=SUPABASE_HEADERS,
                json=match_payload,
                timeout=8
            )
            return jsonify({"status": "updated", "id": match_id})
        else:
            # Naya match start hone par insert karein aur uski unique ID return karein
            headers = {**SUPABASE_HEADERS, "Prefer": "return=representation"}
            res = requests.post(
                f"{SUPABASE_URL}/rest/v1/matches",
                headers=headers,
                json=match_payload,
                timeout=8
            )
            created = res.json()
            new_id = created[0]["id"] if isinstance(created, list) and len(created) > 0 else None
            return jsonify({"status": "saved", "id": new_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/get_matches', methods=['POST', 'GET'])
def get_matches():
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/matches?select=*&order=id.desc&limit=50",
            headers=SUPABASE_HEADERS,
            timeout=8
        )
        if res.status_code == 200:
            return jsonify({"matches": res.json()})
        return jsonify({"matches": []})
    except Exception:
        return jsonify({"matches": []})

@app.route('/delete_match', methods=['POST'])
def delete_match():
    match_id = request.form.get('id', '').strip()
    if not match_id:
        return jsonify({"status": "error", "message": "No match ID provided"}), 400
    try:
        res = requests.delete(
            f"{SUPABASE_URL}/rest/v1/matches?id=eq.{match_id}",
            headers=SUPABASE_HEADERS,
            timeout=8
        )
        if res.status_code in [200, 204]:
            return jsonify({"status": "deleted"})
        return jsonify({"status": "error", "message": res.text}), res.status_code
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/delete_all_matches', methods=['POST'])
def delete_all_matches():
    try:
        res = requests.delete(
            f"{SUPABASE_URL}/rest/v1/matches?id=gt.0",
            headers=SUPABASE_HEADERS,
            timeout=8
        )
        if res.status_code in [200, 204]:
            return jsonify({"status": "cleared"})
        return jsonify({"status": "error", "message": res.text}), res.status_code
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Cloud Multi-Match PGN Vault Exporter
@app.route('/api/export_all_pgn', methods=['GET'])
def export_all_pgn():
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/matches?select=pgn&order=id.asc",
            headers=SUPABASE_HEADERS,
            timeout=8
        )
        if res.status_code == 200:
            rows = res.json()
            all_pgns = [r.get("pgn", "").strip() for r in rows if r.get("pgn", "").strip()]
            combined_text = "\n\n\n".join(all_pgns)
            return jsonify({
                "status": "success",
                "count": len(all_pgns),
                "multi_pgn": combined_text
            })
        return jsonify({"status": "error", "message": "Failed to fetch cloud records"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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
        engine_state["hash"] = min(4096, max(16, int(request.form.get('hash', 256))))
    if 'threads' in request.form: 
        engine_state["threads"] = min(32, max(1, int(request.form.get('threads', 4))))
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
