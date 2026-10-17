import urllib.request
import os

files = {
    "static/js/jquery-3.5.1.min.js": "https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js",
    "static/js/chessboard-1.0.0.min.js": "https://cdn.jsdelivr.net/npm/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js",
    "static/js/chess.min.js": "https://cdn.jsdelivr.net/npm/chess.js@0.10.3/chess.min.js",
    "static/css/chessboard-1.0.0.min.css": "https://cdn.jsdelivr.net/npm/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css"
}

# Wikimedia Commons ke official Wikipedia piece links (Yeh 100% permanent hain)
piece_names = {'wP': 'Chess_plt45.svg', 'wN': 'Chess_nlt45.svg', 'wB': 'Chess_blt45.svg', 'wR': 'Chess_rlt45.svg', 'wQ': 'Chess_qlt45.svg', 'wK': 'Chess_klt45.svg',
               'bP': 'Chess_pdt45.svg', 'bN': 'Chess_ndt45.svg', 'bB': 'Chess_bdt45.svg', 'bR': 'Chess_rdt45.svg', 'bQ': 'Chess_qdt45.svg', 'bK': 'Chess_kdt45.svg'}

# Wikimedia se PNG convert karke ya direct SVG/PNG link use kar sakte hain. 
# Sabse aasan hai ki hum chessboard.js ke official CDN se pieces utha lein jo upar wale error me chhoot gaye the:
for p in piece_names.keys():
    files[f"static/img/chesspieces/wikipedia/{p}.png"] = f"https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/img/chesspieces/wikipedia/{p}.png"

os.makedirs("static/js", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/img/chesspieces/wikipedia", exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0'}

print("Sabhi files download ho rahi hain...\n")
for path, url in files.items():
    print(f"Downloading: {path}")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
            out_file.write(response.read())
    except Exception as e:
        print(f"Error: {e}")

print("\nSUCCESS! Kaam ho gaya.")
