let soundEnabled = true;
let premoveEnabled = false;
let liveFeedbackEnabled = false;
let coachBubbleEnabled = true;
let autoFlipPvP = true;
let pendingPremoves = []; 
let gameMode = 'pvb'; 
let playerColor = 'w'; 
let currentBoardOrientation = 'w'; 
let currentBlackElo = "2500";
let currentWhiteElo = "1500";
let isInfiniteTime = false;
let currentPieceStyle = 'wikipedia';

function safeEl(ids) {
    if (typeof ids === 'string') return document.getElementById(ids);
    for (let id of ids) {
        let el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}
function safeText(ids, text) {
    let el = safeEl(ids);
    if (el) el.innerText = text;
}
function safeHtml(ids, html) {
    let el = safeEl(ids);
    if (el) el.innerHTML = html;
}
function safeDisplay(ids, disp) {
    let el = safeEl(ids);
    if (el) el.style.display = disp;
}
function getTextSafe(ids, fallback = "") {
    let el = safeEl(ids);
    return el ? el.innerText : fallback;
}

const defaultBotNames = {
    "600": "Rookie Bot",
    "1000": "Casual Bot",
    "1500": "Club Master",
    "2000": "Grand Tactician",
    "2500": "Stockfish GM"
};

const tacticalPuzzles = [
    {
        title: "Puzzle #1: Queen Sacrifice Mate in 2",
        fen: "r1b2rk1/ppp2ppp/2n5/3q4/3P4/2PB1N2/P4PPP/R2Q1RK1 w - - 0 1",
        solution: ["d3h7", "g8h7", "f3g5"],
        hint: "Look at the weak h7 pawn! Sacrifice the Bishop to open the King."
    },
    {
        title: "Puzzle #2: Classic Back-Rank Mate",
        fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
        solution: ["d1d8"],
        hint: "Black's King is trapped behind its own pawns on the 8th rank!"
    },
    {
        title: "Puzzle #3: Smothered Knight Royal Fork",
        fen: "r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w KQkq - 0 1",
        solution: ["d5c7"],
        hint: "Use your Knight on d5 to attack King and Rook simultaneously!"
    },
    {
        title: "Puzzle #4: Scholar's Tactical Strike",
        fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        solution: ["f3f7"],
        hint: "Target the f7 square defended only by the Black King!"
    }
];
let currentPuzzleIndex = 0;
let puzzleStep = 0;

const openingsBook = [
    { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6", name: "Ruy Lopez: Morphy Defense" },
    { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5", name: "Ruy Lopez (Spanish Opening)" },
    { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5", name: "Italian Game: Giuoco Piano" },
    { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6", name: "Italian Game: Two Knights Defense" },
    { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4", name: "Italian Game" },
    { moves: "1. e4 e5 2. Nf3 d6", name: "Philidor Defense" },
    { moves: "1. e4 e5 2. Nf3 Nf6", name: "Petrov's Defense" },
    { moves: "1. e4 e5 2. f4", name: "King's Gambit" },
    { moves: "1. e4 c6 2. d4 d5", name: "Caro-Kann Defense: Main Line" },
    { moves: "1. e4 c6", name: "Caro-Kann Defense" },
    { moves: "1. e4 c5 2. Nf3 d6", name: "Sicilian Defense: Najdorf Setup" },
    { moves: "1. e4 c5 2. Nf3 Nc6", name: "Sicilian Defense: Open" },
    { moves: "1. e4 c5", name: "Sicilian Defense" },
    { moves: "1. e4 e6 2. d4 d5", name: "French Defense" },
    { moves: "1. e4 e6", name: "French Defense" },
    { moves: "1. e4 d5", name: "Scandinavian Defense" },
    { moves: "1. d4 d5 2. c4 e6", name: "Queen's Gambit Declined" },
    { moves: "1. d4 d5 2. c4 c6", name: "Slav Defense" },
    { moves: "1. d4 d5 2. c4", name: "Queen's Gambit" },
    { moves: "1. d4 d5 2. Bf4", name: "London System" },
    { moves: "1. d4 Nf6 2. c4 g6", name: "King's Indian Defense" },
    { moves: "1. c4", name: "English Opening" },
    { moves: "1. e4 e5", name: "King's Pawn Game" },
    { moves: "1. e4", name: "King's Pawn Opening" },
    { moves: "1. d4", name: "Queen's Pawn Opening" }
];

const sounds = {
    move: new Audio('/sound/move-self.mp3'),
    capture: new Audio('/sound/capture.mp3'),
    check: new Audio('/sound/move-check.mp3'),
    gameover: new Audio('/sound/game-end.webm'),
    castle: new Audio('/sound/castle.mp3'),
    promote: new Audio('/sound/promote.mp3'),
    illegal: new Audio('/sound/illegal.mp3'),
    tenseconds: new Audio('/sound/tenseconds.mp3'),
    start: new Audio('/sound/game-start.mp3'),
    premove: new Audio('/sound/premove.mp3'),
    notify: new Audio('/sound/notify.mp3')
};

var game = new Chess();
var timerInterval = null;
var lastTimerTick = null;
var whiteTime = 600; 
var blackTime = 600;
var whiteIncrement = 0;
var blackIncrement = 0;
let timerStarted = false; 
let selectedSquare = null;
let currentLegalMoves = [];
let lastMove = null;
let tenSecPlayedW = false;
let tenSecPlayedB = false;

let gameHistory = [
    { fen: game.fen(), move: null, moveObj: null, isCastle: false, isCapture: false, isPromote: false, inCheck: false, isCheckmate: false, evalScore: 50.0, evalText: "0.0", cp: 0 }
]; 
let historyIndex = 0;
let lastEvalScore = 50.0;
let lastEvalText = "0.0";

function ensureKundliAndGraphDOM() {
    // Handled cleanly by index.html & pro_features.js
}

function playSnd(t) { 
    if(!soundEnabled) return;
    let snd = sounds[t] || sounds.move;
    snd.currentTime = 0;
    snd.play().catch(() => {});
}

function getPieceImageUrl(pieceCode) {
    if (currentPieceStyle === 'wikipedia') {
        return `https://chessboardjs.com/img/chesspieces/wikipedia/${pieceCode}.png`;
    }
    return `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${currentPieceStyle}/${pieceCode}.svg`;
}

function applyThemeAndPieces() {
    let themeEl = safeEl('setting-board-theme');
    let styleEl = safeEl('setting-piece-style');
    if (themeEl) document.body.className = themeEl.value;
    if (styleEl) currentPieceStyle = styleEl.value;
    renderBoard();
}

function getSavedBotName(elo) {
    let cleanElo = String(elo).replace('+', '');
    return localStorage.getItem('chess_bot_name_' + cleanElo) || defaultBotNames[cleanElo] || "Stockfish";
}

function loadBotNameForElo(side) {
    if (side === 'black') {
        let el = safeEl('setup-black-bot');
        let nameEl = safeEl('setup-bot-name');
        if (el && nameEl) nameEl.value = getSavedBotName(el.value);
    } else {
        let el = safeEl('setup-white-bot');
        let nameEl = safeEl('setup-white-bot-name');
        if (el && nameEl) nameEl.value = getSavedBotName(el.value);
    }
}

function saveBotNameForElo(side) {
    if (side === 'black') {
        let el = safeEl('setup-black-bot');
        let nameEl = safeEl('setup-bot-name');
        if (el && nameEl && nameEl.value.trim()) {
            localStorage.setItem('chess_bot_name_' + String(el.value).replace('+', ''), nameEl.value.trim());
        }
    } else {
        let el = safeEl('setup-white-bot');
        let nameEl = safeEl('setup-white-bot-name');
        if (el && nameEl && nameEl.value.trim()) {
            localStorage.setItem('chess_bot_name_' + String(el.value).replace('+', ''), nameEl.value.trim());
        }
    }
}

function loadUsername() {
    let uname = localStorage.getItem('chess_username') || "You";
    let el = safeEl('setup-username');
    if (el) el.value = uname;
}

function saveUsername() {
    let el = safeEl('setup-username');
    if (el && el.value.trim()) localStorage.setItem('chess_username', el.value.trim());
}

function togglePremove() {
    premoveEnabled = !premoveEnabled;
    let btn = safeEl('premove-btn');
    if (btn) {
        btn.innerText = premoveEnabled ? "Premove: ON" : "Premove: OFF";
        btn.style.background = premoveEnabled ? "#81b64c" : "#555";
    }
    if(!premoveEnabled) pendingPremoves = [];
    playSnd('notify');
}

function flipBoardUI() {
    currentBoardOrientation = currentBoardOrientation === 'w' ? 'b' : 'w';
    clearArrows();
    
    let topName = getTextSafe(['top-player-name', 'black-name'], 'Black');
    let botName = getTextSafe(['bottom-player-name', 'white-name'], 'White');
    safeText(['top-player-name', 'black-name'], botName);
    safeText(['bottom-player-name', 'white-name'], topName);

    let topLbl = getTextSafe('top-player-label', '');
    let botLbl = getTextSafe('bottom-player-label', '');
    if (topLbl && botLbl) {
        safeText('top-player-label', botLbl);
        safeText('bottom-player-label', topLbl);
    }
    
    updateTimer();
    renderEvalBarVisuals(lastEvalScore, lastEvalText);
    renderBoard();
    updateMaterial(game.fen());
}

function openSetupModal() { 
    loadUsername();
    loadBotNameForElo('black');
    loadBotNameForElo('white');
    safeDisplay('setup-modal', 'flex'); 
}
function closeModal(id) { safeDisplay(id, 'none'); }
function openSettingsModal() { safeDisplay('settings-modal', 'flex'); }

function toggleSetupMode() {
    let modeEl = safeEl('setup-mode');
    let mode = modeEl ? modeEl.value : 'pvb';
    safeDisplay('setup-white-bot-group', mode === 'bvb' ? 'flex' : 'none');
    safeDisplay('setup-black-bot-group', mode === 'pvp' ? 'none' : 'flex');
    safeDisplay('setup-color-group', mode === 'pvb' ? 'flex' : 'none');
    safeDisplay('setup-username-group', mode === 'bvb' ? 'none' : 'flex');
    safeDisplay('setup-autoflip-group', mode === 'pvp' ? 'flex' : 'none');
    safeText('opponent-elo-label', mode === 'bvb' ? 'Black Bot ELO & Name:' : 'Opponent Bot ELO & Saved Name:');
}

function toggleCustomTime() {
    let tEl = safeEl('setup-time');
    let t = tEl ? tEl.value : '10|0';
    safeDisplay('custom-time-group', t === 'custom' ? 'flex' : 'none');
}

function applySetupAndStart() {
    let modeEl = safeEl('setup-mode');
    gameMode = modeEl ? modeEl.value : 'pvb';
    
    let bBotEl = safeEl('setup-black-bot');
    let wBotEl = safeEl('setup-white-bot');
    currentBlackElo = bBotEl ? String(bBotEl.value).replace('+', '') : "2500";
    currentWhiteElo = wBotEl ? String(wBotEl.value).replace('+', '') : "1500";
    
    let afEl = safeEl('setup-autoflip');
    autoFlipPvP = afEl ? (afEl.value === 'on') : true;
    
    saveBotNameForElo('black');
    saveBotNameForElo('white');
    saveUsername();

    let blackBotName = getSavedBotName(currentBlackElo) + ` (${currentBlackElo})`;
    let whiteBotName = getSavedBotName(currentWhiteElo) + ` (${currentWhiteElo})`;
    let userName = localStorage.getItem('chess_username') || "You";

    if (gameMode === 'bvb') {
        playerColor = 'w'; 
        currentBoardOrientation = 'w';
        safeText('top-player-label', "Black");
        safeText(['top-player-name', 'black-name'], blackBotName);
        safeText('bottom-player-label', "White");
        safeText(['bottom-player-name', 'white-name'], whiteBotName);
    } else if (gameMode === 'pvp') {
        playerColor = 'w';
        currentBoardOrientation = 'w';
        safeText('top-player-label', "Black");
        safeText(['top-player-name', 'black-name'], "Player 2");
        safeText('bottom-player-label', "White");
        safeText(['bottom-player-name', 'white-name'], userName);
    } else {
        let checkedRadio = document.querySelector('input[name="play_color"]:checked');
        let selColor = checkedRadio ? checkedRadio.value : 'w';
        playerColor = (selColor === 'random') ? (Math.random() < 0.5 ? 'w' : 'b') : selColor;
        currentBoardOrientation = playerColor;

        if (playerColor === 'w') {
            safeText('top-player-label', "Black");
            safeText(['top-player-name', 'black-name'], blackBotName);
            safeText('bottom-player-label', "White");
            safeText(['bottom-player-name', 'white-name'], userName);
        } else {
            currentWhiteElo = currentBlackElo;
            safeText('top-player-label', "White");
            safeText(['top-player-name', 'black-name'], blackBotName);
            safeText('bottom-player-label', "Black");
            safeText(['bottom-player-name', 'white-name'], userName);
        }
    }

    let timeEl = safeEl('setup-time');
    let timeVal = timeEl ? timeEl.value : '10|0';
    if (timeVal === '0|0') {
        isInfiniteTime = true;
        whiteTime = 0; blackTime = 0; whiteIncrement = 0; blackIncrement = 0;
    } else if (timeVal === 'custom') {
        let m = parseInt((safeEl('custom-minutes') || {}).value) || 0;
        let s = parseInt((safeEl('custom-seconds') || {}).value) || 0;
        let inc = parseInt((safeEl('custom-increment') || {}).value) || 0;
        let total = (m * 60) + s;
        if (total <= 0) total = 10;
        isInfiniteTime = false;
        whiteTime = total;
        blackTime = total;
        whiteIncrement = inc;
        blackIncrement = inc;
    } else {
        isInfiniteTime = false;
        let parts = timeVal.split('|');
        let m = parseInt(parts[0]) || 10;
        let inc = parseInt(parts[1]) || 0;
        whiteTime = m * 60;
        blackTime = m * 60;
        whiteIncrement = inc;
        blackIncrement = inc;
    }

    closeModal('setup-modal');
    startGame(true);
}

function saveSettings() {
    let lf = safeEl('setting-live-feedback');
    if (lf) liveFeedbackEnabled = (lf.value === 'on');
    let cb = safeEl('setting-coach-bubble');
    if (cb) coachBubbleEnabled = (cb.value === 'on');
    let snd = safeEl('setting-sound');
    if (snd) soundEnabled = (snd.value === 'on');
    safeDisplay('coach-bubble', coachBubbleEnabled ? 'flex' : 'none');
    applyThemeAndPieces();
    
    let hash = (safeEl('engine-hash') || {}).value || 256;
    let threads = (safeEl('engine-threads') || {}).value || 2;
    $.post('/update_engine', { hash: hash, threads: threads }, function() {
        playSnd('notify');
        closeModal('settings-modal');
        $('#status').text(`Settings Saved (${threads} Threads, ${hash}MB)`);
    });
}

function getWhiteDisplayName() {
    return currentBoardOrientation === 'w' ? getTextSafe(['bottom-player-name', 'white-name'], 'White') : getTextSafe(['top-player-name', 'black-name'], 'White');
}

function getBlackDisplayName() {
    return currentBoardOrientation === 'w' ? getTextSafe(['top-player-name', 'black-name'], 'Black') : getTextSafe(['bottom-player-name', 'white-name'], 'Black');
}

function computeInstantEvalFromFen(fen) {
    let g = new Chess(fen);
    if (g.in_checkmate()) {
        return g.turn() === 'w' ? { cp: -1000, score: 1.0, text: "-M0" } : { cp: 1000, score: 99.0, text: "M0" };
    }
    if (g.in_draw()) return { cp: 0, score: 50.0, text: "0.0" };

    const vals = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };
    let board = g.board();
    let cp = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c];
            if (!p) continue;
            let v = vals[p.type] || 0;
            if ((r >= 2 && r <= 5) && (c >= 2 && c <= 5)) v += 15;
            cp += (p.color === 'w' ? v : -v);
        }
    }
    let scorePct = Math.max(3.0, Math.min(97.0, 50.0 + (cp / 15.0)));
    let text = (cp >= 0 ? "+" : "") + (cp / 100.0).toFixed(1);
    return { cp: cp, score: Number(scorePct.toFixed(1)), text: text };
}

function findInstantBestMove(fen) {
    let g = new Chess(fen);
    let moves = g.moves({ verbose: true });
    if (moves.length === 0) return null;
    let turn = g.turn();
    let bestMove = moves[0];
    let bestVal = turn === 'w' ? -99999 : 99999;

    moves.forEach(m => {
        g.move(m);
        let ev = computeInstantEvalFromFen(g.fen()).cp;
        g.undo();
        if (turn === 'w' && ev > bestVal) { bestVal = ev; bestMove = m; }
        if (turn === 'b' && ev < bestVal) { bestVal = ev; bestMove = m; }
    });
    return { uci: bestMove.from + bestMove.to, san: bestMove.san };
}

function evalToCentipawns(scorePct, evalText) {
    if (evalText && typeof evalText === 'string') {
        if (evalText.includes('M')) return evalText.includes('-') ? -1000 : 1000;
        let parsed = parseFloat(evalText);
        if (!isNaN(parsed)) return Math.round(parsed * 100);
    }
    return Math.round((scorePct - 50) * 20);
}

function updateCoachCommentary(record, idx) {
    if (!coachBubbleEnabled || !record || !record.classification) return;
    let cls = record.classification;
    let san = record.moveObj ? record.moveObj.san : "";
    let bestSan = record.bestMoveSan || record.bestMoveUci || "solid defense";
    let msg = "";

    if (cls.label === "Brilliant") msg = `🔥 <b>Brilliant (${san}!!):</b> Kya solid tactical shot maara hai bhai!`;
    else if (cls.label === "Great") msg = `⚡ <b>Great Move (${san}!):</b> Ekdum sahi waqt par strong move!`;
    else if (cls.label === "Best") msg = `★ <b>Best Move (${san}):</b> Top engine choice! (${record.cpl} CPL)`;
    else if (cls.label === "Book") msg = `📖 <b>Book Move (${san}):</b> Standard opening theory.`;
    else if (cls.label === "Good") msg = `✓ <b>Good Move (${san}):</b> Solid positional play (${record.cpl} CPL).`;
    else if (cls.label === "Inaccuracy") msg = `?! <b>Inaccuracy (${san}):</b> Thoda advantage kam hua (-${record.cpl} CPL). <b>${bestSan}</b> behtar tha.`;
    else if (cls.label === "Mistake") msg = `? <b>Mistake (${san}):</b> Yahan <b>${bestSan}</b> khelna chahiye tha (-${record.cpl} CPL).`;
    else if (cls.label === "Blunder") msg = `?? <b>BLUNDER (${san}??):</b> Arre bhai! Bada nuksan (-${record.cpl} CPL). Best move <b>${bestSan}</b> tha!`;

    safeHtml('coach-bubble', `🤖 ${msg}`);
}

function classifyMoveByEval(idx) {
    if (idx <= 0 || idx >= gameHistory.length) return;
    let prev = gameHistory[idx - 1];
    let curr = gameHistory[idx];

    if (prev.evalScore === undefined) {
        let ev0 = computeInstantEvalFromFen(prev.fen);
        prev.evalScore = ev0.score; prev.evalText = ev0.text; prev.cp = ev0.cp;
    }
    if (curr.evalScore === undefined) {
        let ev1 = computeInstantEvalFromFen(curr.fen);
        curr.evalScore = ev1.score; curr.evalText = ev1.text; curr.cp = ev1.cp;
    }
    if (!curr.bestMoveSan) {
        let bm = findInstantBestMove(prev.fen);
        if (bm) { curr.bestMoveUci = bm.uci; curr.bestMoveSan = bm.san; }
    }

    let prevCp = evalToCentipawns(prev.evalScore, prev.evalText);
    let currCp = evalToCentipawns(curr.evalScore, curr.evalText);
    prev.cp = prevCp;
    curr.cp = currCp;

    let moveColor = curr.moveObj ? curr.moveObj.color : 'w';
    let cpGain = moveColor === 'w' ? (currCp - prevCp) : (prevCp - currCp);
    let cpl = Math.max(0, -cpGain);
    curr.cpl = cpl;

    let moveAcc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.004354 * cpl) - 3.1669));
    let cls = { label: "Best", symbol: "★", color: "#81b64c", acc: moveAcc };

    if (idx <= 6 && cpl <= 25) cls = { label: "Book", symbol: "📖", color: "#a88865", acc: 100 };
    else if (curr.isCheckmate || (cpGain >= 200 && curr.isCapture)) cls = { label: "Brilliant", symbol: "!!", color: "#1baca6", acc: 100 };
    else if (cpGain >= 110) cls = { label: "Great", symbol: "!", color: "#5c8bb0", acc: 99 };
    else if (cpl <= 20) cls = { label: "Best", symbol: "★", color: "#81b64c", acc: Math.max(96, moveAcc) };
    else if (cpl <= 55) cls = { label: "Good", symbol: "✓", color: "#95b776", acc: moveAcc };
    else if (cpl <= 115) cls = { label: "Inaccuracy", symbol: "?!", color: "#f0c15c", acc: moveAcc };
    else if (cpl <= 210) cls = { label: "Mistake", symbol: "?", color: "#e6912c", acc: moveAcc };
    else cls = { label: "Blunder", symbol: "??", color: "#ca3431", acc: moveAcc };

    curr.classification = cls;
    updateAccuracySummary();
    drawAllEvalGraphs();
    updateCoachCommentary(curr, idx);

    if (liveFeedbackEnabled && historyIndex === gameHistory.length - 1) {
        $('#status').text(`${curr.moveObj.san} is ${cls.label} (${cls.symbol}) | CPL: ${cpl}`);
    }
    renderBoard();
}

function updateAccuracySummary() {
    let wTotal = 0, wCount = 0, bTotal = 0, bCount = 0;
    for (let i = 1; i < gameHistory.length; i++) {
        let h = gameHistory[i];
        if (!h.classification) classifyMoveByEval(i);
        if (h.classification && h.moveObj) {
            if (h.moveObj.color === 'w') { wTotal += h.classification.acc; wCount++; }
            else { bTotal += h.classification.acc; bCount++; }
        }
    }
    let wAcc = wCount > 0 ? (wTotal / wCount).toFixed(1) + "%" : "--%";
    let bAcc = bCount > 0 ? (bTotal / bCount).toFixed(1) + "%" : "--%";
    safeText('white-acc-text', wAcc);
    safeText('black-acc-text', bAcc);
    safeText('modal-p1-acc', `Accuracy: ${wAcc}`);
    safeText('modal-p2-acc', `Accuracy: ${bAcc}`);
}

function drawEvalGraphOnCanvas(canvasId) {
    let canvas = safeEl(canvasId);
    if (!canvas || !canvas.getContext) return;
    let ctx = canvas.getContext('2d');
    let w = canvas.width;
    let h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#181715";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (gameHistory.length <= 1) return;

    let n = gameHistory.length;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    for (let i = 0; i < n; i++) {
        let x = (i / (n - 1)) * w;
        let score = gameHistory[i].evalScore !== undefined ? gameHistory[i].evalScore : 50;
        let y = h - (score / 100) * h;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        let x = (i / (n - 1)) * w;
        let score = gameHistory[i].evalScore !== undefined ? gameHistory[i].evalScore : 50;
        let y = h - (score / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#81b64c";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 1; i < n; i++) {
        let x = (i / (n - 1)) * w;
        let score = gameHistory[i].evalScore !== undefined ? gameHistory[i].evalScore : 50;
        let y = h - (score / 100) * h;
        let cls = gameHistory[i].classification;
        if (cls && (cls.label === "Blunder" || cls.label === "Mistake" || cls.label === "Brilliant")) {
            ctx.fillStyle = cls.color;
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    let curX = (historyIndex / (n - 1)) * w;
    ctx.strokeStyle = "#4a8ff0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, h);
    ctx.stroke();
}

function drawAllEvalGraphs() {
    drawEvalGraphOnCanvas('main-eval-graph');
    drawEvalGraphOnCanvas('kundli-eval-graph');
}

function bindGraphClick(canvasId) {
    let canvas = safeEl(canvasId);
    if (!canvas || canvas._boundClick) return;
    canvas._boundClick = true;
    canvas.addEventListener('click', function(e) {
        if (gameHistory.length <= 1) return;
        let rect = canvas.getBoundingClientRect();
        let clickX = e.clientX - rect.left;
        let pct = Math.max(0, Math.min(1, clickX / rect.width));
        let targetIdx = Math.round(pct * (gameHistory.length - 1));
        jumpToMoveFromKundli(targetIdx, false);
    });
}

function openDeepReport() {
    bindGraphClick('main-eval-graph');
    bindGraphClick('kundli-eval-graph');

    for (let i = 1; i < gameHistory.length; i++) {
        if (!gameHistory[i].classification) {
            classifyMoveByEval(i);
        }
    }

    safeDisplay('kundli-modal', 'flex');
    safeText('kundli-w-name', getWhiteDisplayName());
    safeText('kundli-b-name', getBlackDisplayName());
    renderKundliStats();
    drawAllEvalGraphs();

    if (gameHistory.length > 1) {
        runDeepKundliScan();
    } else {
        safeText('kundli-progress-text', "⚠️ Play at least 1 move to generate Deep Report!");
    }
}

function runDeepKundliScan() {
    if (gameHistory.length <= 1) return;
    let total = gameHistory.length - 1;
    let current = 1;
    let pf = safeEl('kundli-progress-fill');
    if (pf) pf.style.width = "10%";

    function scanStep() {
        if (current > total) {
            safeText('kundli-progress-text', "✅ Deep Stockfish Report Complete!");
            if (pf) pf.style.width = "100%";
            renderKundliStats();
            drawAllEvalGraphs();
            return;
        }
        let pct = Math.round((current / total) * 100);
        safeText('kundli-progress-text', `🔍 Stockfish Deep Scan: Move ${current}/${total} (${pct}%)...`);
        if (pf) pf.style.width = pct + "%";

        let prevFen = gameHistory[current - 1].fen;
        let currFen = gameHistory[current].fen;

        $.post('/eval', { fen: currFen }).done(function(evalData) {
            if (evalData && evalData.score !== undefined) {
                gameHistory[current].evalScore = evalData.score;
                gameHistory[current].evalText = evalData.text;
            }
        }).always(function() {
            $.post('/ai_move', { fen: prevFen, level: 2500 }).done(function(bestData) {
                if (bestData && bestData.move) {
                    gameHistory[current].bestMoveUci = bestData.move;
                    let tmp = new Chess(prevFen);
                    let mObj = tmp.move(bestData.move, { sloppy: true });
                    if (mObj) gameHistory[current].bestMoveSan = mObj.san;
                }
            }).always(function() {
                classifyMoveByEval(current);
                renderKundliStats();
                current++;
                setTimeout(scanStep, 30);
            });
        });
    }
    scanStep();
}

function getPhaseGrade(acpl) {
    if (acpl === null) return "N/A";
    if (acpl <= 18) return `A+ (${acpl} CPL)`;
    if (acpl <= 38) return `A (${acpl} CPL)`;
    if (acpl <= 65) return `B (${acpl} CPL)`;
    if (acpl <= 105) return `C (${acpl} CPL)`;
    return `D (${acpl} CPL)`;
}

function renderKundliStats() {
    let stats = {
        w: { cplSum: 0, count: 0, accSum: 0, openCpl: [], midCpl: [], endCpl: [], types: { Brilliant:0, Great:0, Best:0, Book:0, Good:0, Inaccuracy:0, Mistake:0, Blunder:0 } },
        b: { cplSum: 0, count: 0, accSum: 0, openCpl: [], midCpl: [], endCpl: [], types: { Brilliant:0, Great:0, Best:0, Book:0, Good:0, Inaccuracy:0, Mistake:0, Blunder:0 } }
    };
    let blundersLog = [];
    let biggestSwing = { cpl: 0, idx: null, san: "", bestSan: "", moveNum: 0, color: 'w' };

    for (let i = 1; i < gameHistory.length; i++) {
        let h = gameHistory[i];
        if (!h.moveObj) continue;
        if (!h.classification) classifyMoveByEval(i);
        let side = h.moveObj.color === 'w' ? stats.w : stats.b;
        let cpl = h.cpl || 0;
        side.cplSum += cpl;
        side.accSum += h.classification.acc;
        side.count++;
        if (side.types[h.classification.label] !== undefined) side.types[h.classification.label]++;

        let fullMoveNum = Math.ceil(i / 2);
        if (fullMoveNum <= 10) side.openCpl.push(cpl);
        else if (fullMoveNum <= 25) side.midCpl.push(cpl);
        else side.endCpl.push(cpl);

        if (cpl > biggestSwing.cpl) {
            biggestSwing = { cpl: cpl, idx: i, san: h.moveObj.san, bestSan: h.bestMoveSan || h.bestMoveUci || "?", moveNum: fullMoveNum, color: h.moveObj.color };
        }

        if (h.classification.label === "Blunder" || h.classification.label === "Mistake" || h.classification.label === "Inaccuracy") {
            blundersLog.push({ idx: i, moveNum: fullMoveNum, color: h.moveObj.color, san: h.moveObj.san, bestSan: h.bestMoveSan || h.bestMoveUci || "?", cpl: cpl, cls: h.classification });
        }
    }

    let avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
    let wAcpl = stats.w.count ? Math.round(stats.w.cplSum / stats.w.count) : 0;
    let bAcpl = stats.b.count ? Math.round(stats.b.cplSum / stats.b.count) : 0;
    let wAcc = stats.w.count ? (stats.w.accSum / stats.w.count).toFixed(1) : "0.0";
    let bAcc = stats.b.count ? (stats.b.accSum / stats.b.count).toFixed(1) : "0.0";

    // Strict Realistic ELO Calculation
    let wElo = stats.w.count ? Math.max(250, Math.min(2900, Math.round(2750 * Math.exp(-0.028 * wAcpl) - (stats.w.types.Blunder * 130) - (stats.w.types.Mistake * 55)))) : "--";
    let bElo = stats.b.count ? Math.max(250, Math.min(2900, Math.round(2750 * Math.exp(-0.028 * bAcpl) - (stats.b.types.Blunder * 130) - (stats.b.types.Mistake * 55)))) : "--";

    safeText('k-w-acc', wAcc + "%");
    safeText('k-b-acc', bAcc + "%");
    safeText('k-w-acpl', stats.w.count ? wAcpl + " CPL" : "--");
    safeText('k-b-acpl', stats.b.count ? bAcpl + " CPL" : "--");
    safeText('k-w-elo', wElo + " ELO");
    safeText('k-b-elo', bElo + " ELO");

    safeText('k-w-open', getPhaseGrade(avg(stats.w.openCpl)));
    safeText('k-b-open', getPhaseGrade(avg(stats.b.openCpl)));
    safeText('k-w-mid', getPhaseGrade(avg(stats.w.midCpl)));
    safeText('k-b-mid', getPhaseGrade(avg(stats.b.midCpl)));
    safeText('k-w-end', getPhaseGrade(avg(stats.w.endCpl)));
    safeText('k-b-end', getPhaseGrade(avg(stats.b.endCpl)));

    if (biggestSwing.idx) {
        safeHtml('k-turning-point', `Move ${biggestSwing.moveNum} (${biggestSwing.san}): -${biggestSwing.cpl} CPL (Best: <b>${biggestSwing.bestSan}</b>)`);
    } else {
        safeText('k-turning-point', "Solid game, no major swing!");
    }

    const rows = [
        { key: "Brilliant", icon: "!!", color: "#1baca6" },
        { key: "Great", icon: "!", color: "#5c8bb0" },
        { key: "Best", icon: "★", color: "#81b64c" },
        { key: "Book", icon: "📖", color: "#a88865" },
        { key: "Good", icon: "✓", color: "#95b776" },
        { key: "Inaccuracy", icon: "?!", color: "#f0c15c" },
        { key: "Mistake", icon: "?", color: "#e6912c" },
        { key: "Blunder", icon: "??", color: "#ca3431" }
    ];
    let tbody = "";
    rows.forEach(r => {
        tbody += `<tr>
            <td><span style="color:${r.color}; font-weight:bold;">${r.icon} ${r.key}</span></td>
            <td>${stats.w.types[r.key]}</td>
            <td>${stats.b.types[r.key]}</td>
        </tr>`;
    });
    safeHtml('kundli-counts-body', tbody);

    let wOpenAvg = avg(stats.w.openCpl) || 0, wMidAvg = avg(stats.w.midCpl) || 0, wEndAvg = avg(stats.w.endCpl) || 0;
    let worstPhase = "Opening";
    let maxPhaseCpl = wOpenAvg;
    if (wMidAvg > maxPhaseCpl) { worstPhase = "Middlegame"; maxPhaseCpl = wMidAvg; }
    if (wEndAvg > maxPhaseCpl) { worstPhase = "Endgame"; maxPhaseCpl = wEndAvg; }

    let openName = getTextSafe('opening-bar', 'Standard').replace('📖 Opening: ', '');
    safeHtml('kundli-verdict-text', `
        • <b>Opening:</b> ${openName}<br>
        • <b>Weakest Phase:</b> Sabse zyada CPL loss <b>${worstPhase}</b> mein hua (${maxPhaseCpl} Avg CPL).<br>
        • <b>Summary:</b> White played at <b>${wElo} ELO</b> (${stats.w.types.Blunder} Blunders) vs Black at <b>${bElo} ELO</b> (${stats.b.types.Blunder} Blunders).
    `);

    let bListHtml = "";
    if (blundersLog.length === 0) {
        bListHtml = `<div style="font-size:11px; color:#81b64c; padding:6px;">🎉 Zero mistakes or blunders! Grandmaster precision!</div>`;
    } else {
        blundersLog.forEach(b => {
            let sideTxt = b.color === 'w' ? 'White' : 'Black';
            bListHtml += `<div class="blunder-item" style="border-left-color:${b.cls.color}" onclick="jumpToMoveFromKundli(${b.idx}, true)">
                <div>
                    <b>Move ${b.moveNum} (${sideTxt}):</b> Played <span style="color:${b.cls.color}; font-weight:bold;">${b.san} (${b.cls.symbol})</span><br>
                    <span style="color:#81b64c;">★ Best Move was: <b>${b.bestSan}</b></span> <span style="color:#aaa;">(-${b.cpl} CPL)</span>
                </div>
                <span style="background:#4a8ff0; color:#fff; padding:4px 7px; border-radius:4px; font-size:10px; font-weight:bold;">Show Arrows →</span>
            </div>`;
        });
    }
    safeHtml('kundli-blunder-list', bListHtml);
}

function jumpToMoveFromKundli(idx, closeKundli = true) {
    if (closeKundli) closeModal('kundli-modal');
    historyIndex = idx;
    selectedSquare = null;
    currentLegalMoves = [];
    renderBoard();
    drawAllEvalGraphs();
    showAnalysisStatus();

    let rec = gameHistory[idx];
    if (rec && rec.move) {
        if (rec.bestMoveUci && rec.bestMoveUci.length >= 4) {
            let bFrom = rec.bestMoveUci.substring(0, 2);
            let bTo = rec.bestMoveUci.substring(2, 4);
            drawDualArrows(rec.move.from, rec.move.to, "#ca3431", bFrom, bTo, "#81b64c");
            $('#status').text(`Move ${idx}: Played ${rec.moveObj.san} (Red) | ★ Best was ${rec.bestMoveSan || rec.bestMoveUci} (Green)`);
        } else {
            drawMoveArrow(rec.move.from, rec.move.to, "#f0c15c");
        }
    }
}

function updateOpeningExplorer() {
    let pgn = game.pgn();
    let matched = "Starting Position";
    if (pgn && pgn.trim().length > 0) {
        matched = "Custom / Middle Game";
        for (let op of openingsBook) {
            if (pgn.startsWith(op.moves)) {
                matched = op.name;
                break;
            }
        }
    }
    safeText('opening-bar', `📖 Opening: ${matched}`);
}

function updateMultiPvLines(fen) {
    let temp = new Chess(fen);
    if (temp.game_over()) {
        safeHtml('multipv-bar', `🧠 <b>Engine Lines:</b> Game Over`);
        return;
    }
    $.post('/multipv', { fen: fen }, function(data) {
        if (data && data.lines && data.lines.length > 0) {
            let parts = data.lines.map((l, i) => `<span style="color:${i===0?'#81b64c':'#ddd'};">${i+1}. ${l.san} (${l.score})</span>`);
            safeHtml('multipv-bar', `🧠 <b>Stockfish Multi-PV:</b> ` + parts.join(' | '));
            let nextIdx = historyIndex + 1;
            if (gameHistory[nextIdx] && !gameHistory[nextIdx].bestMoveUci) {
                gameHistory[nextIdx].bestMoveUci = data.lines[0].uci;
                gameHistory[nextIdx].bestMoveSan = data.lines[0].san;
            }
        }
    });
}

function loadNextPuzzle() {
    let p = tacticalPuzzles[currentPuzzleIndex % tacticalPuzzles.length];
    currentPuzzleIndex++;
    puzzleStep = 0;
    gameMode = 'puzzle';
    playerColor = 'w';
    currentBoardOrientation = 'w';
    isInfiniteTime = true;
    clearInterval(timerInterval);
    timerStarted = false;

    game.load(p.fen);
    clearArrows();
    selectedSquare = null;
    currentLegalMoves = [];
    gameHistory = [{ fen: game.fen(), move: null, moveObj: null, evalScore: 50, evalText: "0.0" }];
    historyIndex = 0;

    safeText('top-player-label', "Puzzle");
    safeText(['top-player-name', 'black-name'], "Tactical Master");
    safeText('bottom-player-label', "White");
    safeText(['bottom-player-name', 'white-name'], "You (Solver)");
    safeText('opening-bar', `🧩 ${p.title}`);
    safeHtml('coach-bubble', `🤖 <b>Puzzle Hint:</b> ${p.hint}`);
    $('#status').text(`🧩 Solve: Find the best tactical move for White!`);

    updateTimer();
    renderBoard();
    drawAllEvalGraphs();
    playSnd('start');
}

function clearArrows() {
    safeHtml('arrow-overlay', '');
}

function sqToSvgCoords(sq) {
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let isFlipped = (currentBoardOrientation === 'b');
    let f = files.indexOf(sq[0]);
    let r = parseInt(sq[1]);
    let col = isFlipped ? 7 - f : f;
    let row = isFlipped ? r - 1 : 8 - r;
    return { x: col * 40 + 20, y: row * 40 + 20 };
}

function drawMoveArrow(fromSq, toSq, color = "#81b64c") {
    let p1 = sqToSvgCoords(fromSq);
    let p2 = sqToSvgCoords(toSq);
    safeHtml('arrow-overlay', `
        <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="${color}" opacity="0.9"/>
            </marker>
        </defs>
        <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="7" stroke-linecap="round" opacity="0.85" marker-end="url(#arrowhead)" style="pointer-events:none;" />
    `);
}

function drawDualArrows(from1, to1, color1, from2, to2, color2) {
    let a1 = sqToSvgCoords(from1), a2 = sqToSvgCoords(to1);
    let b1 = sqToSvgCoords(from2), b2 = sqToSvgCoords(to2);
    safeHtml('arrow-overlay', `
        <defs>
            <marker id="arrow1" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="${color1}"/>
            </marker>
            <marker id="arrow2" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="${color2}"/>
            </marker>
        </defs>
        <line x1="${a1.x}" y1="${a1.y}" x2="${a2.x}" y2="${a2.y}" stroke="${color1}" stroke-width="6" stroke-linecap="round" opacity="0.85" marker-end="url(#arrow1)" style="pointer-events:none;" />
        <line x1="${b1.x}" y1="${b1.y}" x2="${b2.x}" y2="${b2.y}" stroke="${color2}" stroke-width="7" stroke-linecap="round" opacity="0.95" marker-end="url(#arrow2)" style="pointer-events:none;" />
    `);
}

function requestHint() {
    if (game.game_over()) return;
    $('#status').text("Calculating Best Move Hint...");
    $.post('/ai_move', { fen: game.fen(), level: 2500 }, function(data) {
        if (data.move && data.move.length >= 4) {
            let from = data.move.substring(0, 2);
            let to = data.move.substring(2, 4);
            drawMoveArrow(from, to, "#4a8ff0");
            $('#status').text(`💡 Best Move Hint: ${from} → ${to}`);
        }
    });
}

function takebackMove() {
    if (gameMode === 'bvb' || gameHistory.length <= 1 || game.game_over()) return;
    clearArrows();
    let steps = (gameMode === 'pvb' && game.turn() === playerColor && gameHistory.length >= 3) ? 2 : 1;
    for (let i = 0; i < steps; i++) {
        game.undo();
        gameHistory.pop();
    }
    historyIndex = gameHistory.length - 1;
    selectedSquare = null;
    currentLegalMoves = [];
    updateOpeningExplorer();
    updateMaterial(game.fen());
    let pgnEl = safeEl('pgn-box');
    if (pgnEl) pgnEl.value = game.pgn();
    renderBoard();
    drawAllEvalGraphs();
    updateEvalBar(historyIndex);
    playSnd('move');
    $('#status').text("Move taken back");
}

function resignGame() {
    if (game.game_over() || gameHistory.length <= 1) return;
    clearInterval(timerInterval);
    timerStarted = false;
    playSnd('gameover');
    let winnerName = playerColor === 'w' ? getBlackDisplayName() : getWhiteDisplayName();
    $('#status').text(`You resigned. ${winnerName} Wins!`);
    showGameOverModal("Resignation", `${winnerName} wins by resignation.`, "Rematch");
}

function showGameOverModal(title, subtitle, btnText) {
    safeText('modal-title', title);
    safeText('modal-subtitle', subtitle);
    safeText('modal-btn', btnText);
    safeDisplay('review-bar', 'flex');
    
    safeText('modal-p1-icon', '♔');
    safeText(['modal-p1-text', 'modal-white-text'], getWhiteDisplayName());
    safeText('modal-p2-icon', '♚');
    safeText(['modal-p2-text', 'modal-black-text'], getBlackDisplayName());
    updateAccuracySummary();
    
    safeDisplay('game-modal', 'flex');
}

function handleModalBtn() {
    closeModal('game-modal');
    openSetupModal(); 
}

function getSimulatedPremoveBoard(baseFen) {
    let simGame = new Chess(baseFen);
    for (let i = 0; i < pendingPremoves.length; i++) {
        let pm = pendingPremoves[i];
        let tokens = simGame.fen().split(' ');
        tokens[1] = playerColor; 
        tokens[3] = '-'; 
        simGame.load(tokens.join(' '));
        simGame.move({ from: pm.from, to: pm.to, promotion: 'q' });
    }
    let tokens = simGame.fen().split(' ');
    tokens[1] = playerColor;
    tokens[3] = '-';
    simGame.load(tokens.join(' '));
    return simGame;
}

function renderBoard() {
    let $board = $('#board');
    if (!$board.length) return;
    $board.empty();
    
    let tempGame = new Chess();
    if (historyIndex >= 0 && historyIndex < gameHistory.length) {
        tempGame.load(gameHistory[historyIndex].fen);
    } else {
        tempGame.load(game.fen());
    }
    
    let simGame;
    if (historyIndex === gameHistory.length - 1 && premoveEnabled && pendingPremoves.length > 0) {
        simGame = getSimulatedPremoveBoard(tempGame.fen());
    } else {
        simGame = new Chess(tempGame.fen());
    }
    
    let boardState = simGame.board();
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let isFlipped = (currentBoardOrientation === 'b');
    let activeRecord = (historyIndex > 0 && historyIndex < gameHistory.length) ? gameHistory[historyIndex] : null;
    let activeLastMove = activeRecord ? activeRecord.move : null;
    let showClassificationBadge = activeRecord && activeRecord.classification && (historyIndex < gameHistory.length - 1 || game.game_over() || liveFeedbackEnabled);
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let fileIdx = isFlipped ? 7 - c : c;
            let rankIdx = isFlipped ? r + 1 : 8 - r;
            let squareName = files[fileIdx] + rankIdx;
            
            let piece = isFlipped ? boardState[7 - r][7 - c] : boardState[r][c];
            let isLight = (r + c) % 2 === 0;
            let sqClass = 'square ' + (isLight ? 'light' : 'dark');
            
            if (historyIndex === gameHistory.length - 1 && selectedSquare === squareName) sqClass += ' selected';
            if (activeLastMove && (squareName === activeLastMove.from || squareName === activeLastMove.to)) {
                sqClass += ' last-move';
            }
            
            let isPremoved = pendingPremoves.some(p => p.from === squareName || p.to === squareName);
            if (isPremoved) sqClass += ' premove-highlight';
            
            let $sq = $('<div>').addClass(sqClass).attr('data-square', squareName);
            
            if (c === 0) $sq.append($('<span>').addClass('notation-rank ' + (isLight ? 'light-notation' : 'dark-notation')).text(rankIdx));
            if (r === 7) $sq.append($('<span>').addClass('notation-file ' + (isLight ? 'light-notation' : 'dark-notation')).text(files[fileIdx]));
            
            if (simGame.in_check() && piece && piece.type === 'k' && piece.color === simGame.turn()) {
                $sq.addClass('highlight-check');
            }
            
            if (piece) {
                let pieceCode = piece.color + piece.type.toUpperCase();
                let imgUrl = getPieceImageUrl(pieceCode);
                let $piece = $('<div>').addClass('piece').css('background-image', `url(${imgUrl})`).attr('data-square', squareName).attr('data-color', piece.color);
                $sq.append($piece);
            }

            if (showClassificationBadge && activeLastMove && squareName === activeLastMove.to) {
                let cls = activeRecord.classification;
                $sq.append(`<div class="move-badge" style="background:${cls.color}" title="${cls.label}">${cls.symbol}</div>`);
            }
            
            if (historyIndex === gameHistory.length - 1 && pendingPremoves.length === 0) {
                let legalMove = currentLegalMoves.find(m => m.to === squareName);
                if (legalMove) $sq.append(piece ? '<div class="legal-capture"></div>' : '<div class="legal-dot"></div>');
            }
            $board.append($sq);
        }
    }
}

function playRecordSound(record) {
    if (!record || !record.moveObj) { playSnd('move'); return; }
    if (record.isCheckmate) playSnd('gameover');
    else if (record.inCheck) playSnd('check');
    else if (record.isCastle) playSnd('castle');
    else if (record.isPromote) playSnd('promote');
    else if (record.isCapture) playSnd('capture');
    else playSnd('move');
}

function showAnalysisStatus() {
    safeDisplay('review-bar', 'flex');
    drawAllEvalGraphs();
    if (historyIndex === 0) {
        $('#status').text("Analysis: Start of game");
        return;
    }
    let rec = gameHistory[historyIndex];
    if (!rec.classification) classifyMoveByEval(historyIndex);
    let clsText = rec.classification ? ` — ${rec.classification.label} (${rec.classification.symbol})` : "";
    let bestTxt = rec.bestMoveSan ? ` | Best: ${rec.bestMoveSan}` : "";
    $('#status').text(`Move ${historyIndex}/${gameHistory.length - 1}: ${rec.moveObj.san}${clsText}${bestTxt}`);
    if (rec.evalScore !== undefined) renderEvalBarVisuals(rec.evalScore, rec.evalText || "0.0");
    updateCoachCommentary(rec, historyIndex);
}

function goToStart() {
    if (gameHistory.length <= 1) return;
    clearArrows();
    historyIndex = 0; selectedSquare = null; currentLegalMoves = [];
    renderBoard(); playSnd('move'); showAnalysisStatus();
}
function goBackward() {
    if (historyIndex > 0) {
        clearArrows();
        historyIndex--; selectedSquare = null; currentLegalMoves = [];
        renderBoard(); playRecordSound(historyIndex > 0 ? gameHistory[historyIndex] : null);
        showAnalysisStatus();
    }
}
function goForward() {
    if (historyIndex < gameHistory.length - 1) {
        clearArrows();
        historyIndex++; selectedSquare = null; currentLegalMoves = [];
        renderBoard(); playRecordSound(gameHistory[historyIndex]);
        if (historyIndex === gameHistory.length - 1 && !game.game_over()) {
            safeDisplay('review-bar', liveFeedbackEnabled ? 'flex' : 'none');
            $('#status').text("Live Game");
            drawAllEvalGraphs();
        } else {
            showAnalysisStatus();
        }
    }
}
function goLive() {
    clearArrows();
    historyIndex = gameHistory.length - 1; selectedSquare = null; currentLegalMoves = [];
    if (!game.game_over()) safeDisplay('review-bar', liveFeedbackEnabled ? 'flex' : 'none');
    renderBoard(); drawAllEvalGraphs(); playSnd('move'); $('#status').text("Live Game");
}

let opponentColor = () => playerColor === 'w' ? 'b' : 'w';

function handlePuzzleMove(moveObj) {
    let p = tacticalPuzzles[(currentPuzzleIndex - 1) % tacticalPuzzles.length];
    let uci = moveObj.from + moveObj.to;
    if (uci === p.solution[puzzleStep]) {
        puzzleStep++;
        processMoveVisuals(moveObj, gameHistory.length - 1);
        if (puzzleStep >= p.solution.length) {
            playSnd('gameover');
            $('#status').text("🎉 Puzzle Solved! Brilliant tactical vision!");
            safeHtml('coach-bubble', `🤖 <b>Coach:</b> Wah bhai! Ekdum accurate tactical calculation!`);
        } else {
            setTimeout(() => {
                let replyUci = p.solution[puzzleStep];
                puzzleStep++;
                let repMove = game.move({ from: replyUci.substring(0,2), to: replyUci.substring(2,4), promotion: 'q' });
                if (repMove) {
                    gameHistory.push({ fen: game.fen(), move: { from: repMove.from, to: repMove.to }, moveObj: repMove });
                    historyIndex = gameHistory.length - 1;
                    renderBoard();
                    playSnd('move');
                    $('#status').text("Your turn — find the finishing blow!");
                }
            }, 400);
        }
    } else {
        playSnd('illegal');
        game.undo();
        gameHistory.pop();
        historyIndex = gameHistory.length - 1;
        renderBoard();
        $('#status').text("❌ Incorrect tactical move! Try again or tap 💡 Hint.");
    }
}

function executeHumanMove(fromSq, toSq) {
    let prevFen = game.fen();
    let moveObj = game.move({ from: fromSq, to: toSq, promotion: 'q' });
    if (!moveObj) return false;

    selectedSquare = null;
    currentLegalMoves = [];

    if (gameMode === 'puzzle') {
        gameHistory.push({ fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj });
        historyIndex = gameHistory.length - 1;
        handlePuzzleMove(moveObj);
        return true;
    }

    if (moveObj.color === 'w') whiteTime += whiteIncrement; else blackTime += blackIncrement;

    let instEv = computeInstantEvalFromFen(game.fen());
    let instBest = findInstantBestMove(prevFen);

    gameHistory.push({ 
        fen: game.fen(), 
        move: { from: moveObj.from, to: moveObj.to }, 
        moveObj: moveObj, 
        bestMoveUci: instBest ? instBest.uci : null,
        bestMoveSan: instBest ? instBest.san : null,
        evalScore: instEv.score,
        evalText: instEv.text,
        cp: instEv.cp,
        isCastle: moveObj.flags.includes('k') || moveObj.flags.includes('q'), 
        isCapture: moveObj.flags.includes('c') || moveObj.flags.includes('e'), 
        isPromote: moveObj.flags.includes('p'), 
        inCheck: game.in_check(), 
        isCheckmate: game.in_checkmate() 
    });
    historyIndex = gameHistory.length - 1;
    classifyMoveByEval(historyIndex);

    let recordedIdx = historyIndex;
    $.post('/ai_move', { fen: prevFen, level: 2500 }, function(bData) {
        if (bData && bData.move && gameHistory[recordedIdx]) {
            gameHistory[recordedIdx].bestMoveUci = bData.move;
            let tmp = new Chess(prevFen);
            let m = tmp.move(bData.move, { sloppy: true });
            if (m) gameHistory[recordedIdx].bestMoveSan = m.san;
        }
    });

    processMoveVisuals(moveObj, historyIndex);

    if (gameMode === 'pvp') {
        if (autoFlipPvP && !game.game_over()) setTimeout(flipBoardUI, 250);
    } else if (gameMode === 'pvb' && !game.game_over()) {
        window.setTimeout(makeAiMove, 250);
    }
    return true;
}

$('#board').on('click', '.square', function(e) {
    if (historyIndex !== gameHistory.length - 1 || gameMode === 'bvb') return; 
    clearArrows();
    let clickedSq = $(this).attr('data-square');
    
    if (gameMode === 'pvb' && game.turn() === opponentColor() && premoveEnabled) {
        let simGame = getSimulatedPremoveBoard(game.fen());
        let piece = simGame.get(clickedSq);
        if (selectedSquare) {
            if (simGame.move({ from: selectedSquare, to: clickedSq, promotion: 'q' })) {
                pendingPremoves.push({ from: selectedSquare, to: clickedSq });
                playSnd('premove'); selectedSquare = clickedSq; 
            } else { selectedSquare = null; }
            currentLegalMoves = []; renderBoard(); return;
        }
        if (piece && piece.color === playerColor) {
            selectedSquare = clickedSq; renderBoard(); return;
        }
    }

    let allowedTurnColor = (gameMode === 'pvp' || gameMode === 'puzzle') ? game.turn() : playerColor;
    if (game.game_over() || game.turn() !== allowedTurnColor) return;
    
    let piece = game.get(clickedSq);
    let legalMove = currentLegalMoves.find(m => m.to === clickedSq);
    if (selectedSquare && legalMove) {
        executeHumanMove(selectedSquare, clickedSq);
        return;
    }
    
    if (piece && piece.color === allowedTurnColor) {
        selectedSquare = clickedSq; currentLegalMoves = game.moves({ square: clickedSq, verbose: true }); renderBoard();
    } else { selectedSquare = null; currentLegalMoves = []; renderBoard(); }
});

let activePiece = null;
let dragFromSq = null;

$(document).on('pointerdown', '.piece', function(e) {
    if (historyIndex !== gameHistory.length - 1 || gameMode === 'bvb') return;
    clearArrows();
    let sq = $(this).attr('data-square');
    if (gameMode === 'pvb' && game.turn() === opponentColor() && premoveEnabled) {
        let simGame = getSimulatedPremoveBoard(game.fen());
        let piece = simGame.get(sq);
        if (piece && piece.color === playerColor) {
            activePiece = $(this); dragFromSq = sq;
            activePiece.css({ position: 'fixed', zIndex: 1000, width: '56px', height: '56px', pointerEvents: 'none' });
            movePieceAt(e.clientX, e.clientY); e.stopPropagation(); return;
        }
    }
    let allowedTurnColor = (gameMode === 'pvp' || gameMode === 'puzzle') ? game.turn() : playerColor;
    if (game.game_over() || game.turn() !== allowedTurnColor || $(this).attr('data-color') !== allowedTurnColor) return;
    activePiece = $(this); dragFromSq = sq;
    activePiece.css({ position: 'fixed', zIndex: 1000, width: '56px', height: '56px', pointerEvents: 'none' });
    movePieceAt(e.clientX, e.clientY); selectedSquare = null; currentLegalMoves = []; e.stopPropagation();
});

$(document).on('pointermove', function(e) { if (!activePiece) return; movePieceAt(e.clientX, e.clientY); });$(document).on('pointerup', function(e) {
    if (!activePiece) return;
    activePiece.css({ position: 'absolute', zIndex: 2, width: '100%', height: '100%', pointerEvents: 'auto', left: '', top: '' });
    let targetSq = null;
    $('.square').each(function() {
        let r = this.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) targetSq = $(this).attr('data-square');
    });
    
    if (dragFromSq && targetSq && dragFromSq !== targetSq) {
        if (gameMode === 'pvb' && game.turn() === opponentColor() && premoveEnabled) {
            let simGame = getSimulatedPremoveBoard(game.fen());
            if (simGame.move({ from: dragFromSq, to: targetSq, promotion: 'q' })) {
                pendingPremoves.push({ from: dragFromSq, to: targetSq }); playSnd('premove');
            }
            activePiece = null; dragFromSq = null; renderBoard(); return;
        }
        executeHumanMove(dragFromSq, targetSq);
    }
    activePiece = null; dragFromSq = null; renderBoard();
});

function movePieceAt(x, y) { activePiece.css({ left: (x - 28) + 'px', top: (y - 28) + 'px' }); }

function updateMaterial(fen) {
    let counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 }, start = { p:8, n:2, b:2, r:2, q:1, P:8, N:2, B:2, R:2, Q:1 }, values = { p:1, n:3, b:3, r:5, q:9, P:1, N:3, B:3, R:5, Q:9 }, symbols = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', P:'♙', N:'♘', B:'♗', R:'♖', Q:'♕' };
    let pieces = fen.split(' ')[0]; for(let c of pieces) if(counts[c] !== undefined) counts[c]++;
    let wC = '', wS = 0, bC = '', bS = 0;
    ['p','n','b','r','q'].forEach(pt => { let m = start[pt] - counts[pt]; if(m>0) { wS += m*values[pt]; for(let i=0; i<m; i++) wC += symbols[pt]; } });
    ['P','N','B','R','Q'].forEach(pt => { let m = start[pt] - counts[pt]; if(m>0) { bS += m*values[pt]; for(let i=0; i<m; i++) bC += symbols[pt]; } });
    
    let wHtml = wC + (wS > bS ? `<span class="score-plus">+${wS - bS}</span>` : '');
    let bHtml = bC + (bS > wS ? `<span class="score-plus">+${bS - wS}</span>` : '');

    if (currentBoardOrientation === 'w') {
        safeHtml(['top-captured', 'black-captured'], bHtml);
        safeHtml(['bottom-captured', 'white-captured'], wHtml);
    } else {
        safeHtml(['top-captured', 'black-captured'], wHtml);
        safeHtml(['bottom-captured', 'white-captured'], bHtml);
    }
}

function renderEvalBarVisuals(whiteScorePct, evalText) {
    lastEvalScore = whiteScorePct;
    lastEvalText = evalText;
    let wrapper = safeEl('eval-wrapper');
    let fill = safeEl('eval-fill');
    if (fill) fill.style.height = whiteScorePct + "%";

    if (currentBoardOrientation === 'b') {
        if (wrapper) wrapper.classList.add('flipped');
        if (whiteScorePct > 50) { safeText(['eval-text-top', 'eval-text-black'], evalText); safeText(['eval-text-bottom', 'eval-text-white'], ""); }
        else if (whiteScorePct < 50) { safeText(['eval-text-bottom', 'eval-text-white'], String(evalText).replace('-', '')); safeText(['eval-text-top', 'eval-text-black'], ""); }
        else { safeText(['eval-text-bottom', 'eval-text-white'], "0.0"); safeText(['eval-text-top', 'eval-text-black'], ""); }
    } else {
        if (wrapper) wrapper.classList.remove('flipped');
        if (whiteScorePct > 50) { safeText(['eval-text-bottom', 'eval-text-white'], evalText); safeText(['eval-text-top', 'eval-text-black'], ""); }
        else if (whiteScorePct < 50) { safeText(['eval-text-top', 'eval-text-black'], String(evalText).replace('-', '')); safeText(['eval-text-bottom', 'eval-text-white'], ""); }
        else { safeText(['eval-text-bottom', 'eval-text-white'], "0.0"); safeText(['eval-text-top', 'eval-text-black'], ""); }
    }
}

function updateEvalBar(targetHistoryIndex = null) {
    let idx = targetHistoryIndex !== null ? targetHistoryIndex : (gameHistory.length - 1);
    let targetFen = (gameHistory[idx] && gameHistory[idx].fen) ? gameHistory[idx].fen : game.fen();
    $.post('/eval', { fen: targetFen }, function(data) {
        if (gameHistory[idx] && data && data.score !== undefined) {
            gameHistory[idx].evalScore = data.score;
            gameHistory[idx].evalText = data.text;
            classifyMoveByEval(idx);
        }
        renderEvalBarVisuals(data.score, data.text);
        updateMultiPvLines(targetFen);
    });
}

function handleGameOver() {
    clearInterval(timerInterval); timerStarted = false; playSnd('gameover');
    safeDisplay('review-bar', 'flex');
    if (game.in_checkmate()) {
        let wName = game.turn() === 'w' ? getBlackDisplayName() : getWhiteDisplayName();
        $('#status').text(`Checkmate! ${wName} Wins.`);
        let pieces = game.board(), files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        let isFlipped = (currentBoardOrientation === 'b');
        for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
            let p = pieces[r][c]; if (p && p.type === 'k') {
                let fileIdx = isFlipped ? 7 - c : c;
                let rankIdx = isFlipped ? r + 1 : 8 - r;
                let sqName = files[fileIdx] + rankIdx;
                let $sq =$(`.square[data-square="${sqName}"]`);
                p.color === game.turn() ? $sq.addClass('highlight-check').append('<div class="badge-loser">♚</div>') : $sq.append('<div class="badge-winner">♔</div>');
            }
        }
        setTimeout(() => { showGameOverModal("Checkmate!", `${wName} wins by checkmate.`, "Rematch"); }, 2200);
    } else if (game.in_draw()) {
        $('#status').text("Draw!"); setTimeout(() => { showGameOverModal("Match Over", "Game ended in a draw.", "Rematch"); }, 2000);
    }
}

function processMoveVisuals(moveObj, histIdx) {
    if (!timerStarted) startTimer();
    updateOpeningExplorer();
    let pgnEl = safeEl('pgn-box');
    if (pgnEl) pgnEl.value = game.pgn();
    updateMaterial(game.fen());
    renderBoard();
    drawAllEvalGraphs();
    if (game.game_over()) handleGameOver(); 
    else {
        if (game.in_check()) { playSnd('check'); $('#status').text("Check!"); } 
        else if (moveObj.flags.includes('p')) { playSnd('promote'); $('#status').text("Your turn"); }
        else if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) { playSnd('castle'); $('#status').text("Your turn"); }
        else { playSnd(moveObj.flags.includes('c') || moveObj.flags.includes('e') ? 'capture' : 'move'); $('#status').text("Your turn"); }
    }
    updateEvalBar(histIdx);
}

function executePremovesChain() {
    if (pendingPremoves.length === 0) return false;
    let pm = pendingPremoves.shift(); 
    let prevFen = game.fen();
    let moveObj = game.move({ from: pm.from, to: pm.to, promotion: 'q' });
    if (moveObj) {
        playerColor === 'w' ? whiteTime += whiteIncrement : blackTime += blackIncrement;
        let instEv = computeInstantEvalFromFen(game.fen());
        let instBest = findInstantBestMove(prevFen);
        gameHistory.push({ fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj, bestMoveUci: instBest ? instBest.uci : null, bestMoveSan: instBest ? instBest.san : null, evalScore: instEv.score, evalText: instEv.text, cp: instEv.cp, isCastle: moveObj.flags.includes('k') || moveObj.flags.includes('q'), isCapture: moveObj.flags.includes('c') || moveObj.flags.includes('e'), isPromote: moveObj.flags.includes('p'), inCheck: game.in_check(), isCheckmate: game.in_checkmate() });
        historyIndex = gameHistory.length - 1;
        classifyMoveByEval(historyIndex);
        processMoveVisuals(moveObj, historyIndex);
        return true;
    } else { pendingPremoves = []; return false; }
}

function makeAiMove() {
    if (game.game_over() || gameMode === 'pvp' || gameMode === 'puzzle') return;
    if (!timerStarted) startTimer();

    if (gameMode !== 'bvb' && premoveEnabled && pendingPremoves.length > 0 && game.turn() === playerColor) {
        if (executePremovesChain()) {
            if (!game.game_over() && game.turn() === opponentColor()) window.setTimeout(makeAiMove, 250);
            return;
        }
    }
    
    let aiElo = game.turn() === 'w' ? currentWhiteElo : currentBlackElo;
    let prevFen = game.fen();

    $.post('/ai_move', { fen: prevFen, level: aiElo }, function(data) {
        if (game.game_over() || (!isInfiniteTime && (whiteTime <= 0 || blackTime <= 0))) return;
        if (data.move) {
            var move = game.move(data.move, { sloppy: true });
            if (move) {
                if (game.turn() === 'w') blackTime += blackIncrement; else whiteTime += whiteIncrement; 
                updateTimer();
                let instEv = computeInstantEvalFromFen(game.fen());
                let instBest = findInstantBestMove(prevFen);
                gameHistory.push({ fen: game.fen(), move: { from: move.from, to: move.to }, moveObj: move, bestMoveUci: instBest ? instBest.uci : data.move, bestMoveSan: instBest ? instBest.san : move.san, evalScore: instEv.score, evalText: instEv.text, cp: instEv.cp, isCastle: move.flags.includes('k') || move.flags.includes('q'), isCapture: move.flags.includes('c') || move.flags.includes('e'), isPromote: move.flags.includes('p'), inCheck: game.in_check(), isCheckmate: game.in_checkmate() });
                let movedIdx = gameHistory.length - 1;
                classifyMoveByEval(movedIdx);
                if (historyIndex === gameHistory.length - 2) { historyIndex = movedIdx; renderBoard(); }
                
                updateOpeningExplorer();
                if (game.game_over()) handleGameOver();
                else if (game.in_check()) { playSnd('check'); $('#status').text("Check!"); } 
                else if (move.flags.includes('c') || move.flags.includes('e')) { playSnd('capture'); $('#status').text(gameMode === 'bvb' ? "Bot vs Bot Live" : "Your turn"); } 
                else { playSnd('move'); $('#status').text(gameMode === 'bvb' ? "Bot vs Bot Live" : "Your turn"); }
                
                updateMaterial(game.fen());
                let pgnEl = safeEl('pgn-box');
                if (pgnEl) pgnEl.value = game.pgn();
                drawAllEvalGraphs();
                updateEvalBar(movedIdx);
                
                if (gameMode === 'bvb') {
                    if (!game.game_over()) window.setTimeout(makeAiMove, 600);
                } else if (premoveEnabled && pendingPremoves.length > 0 && game.turn() === playerColor) {
                    setTimeout(() => { if (executePremovesChain() && !game.game_over()) window.setTimeout(makeAiMove, 250); }, 50);
                }
            }
        }
    });
}

function formatClock(sec) {
    let s = Math.max(0, sec);
    if (s < 10 && s > 0) return "00:0" + s.toFixed(1);
    let totalSec = Math.ceil(s);
    let m = Math.floor(totalSec / 60);
    let rem = totalSec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (rem < 10 ? "0" : "") + rem;
}

function updateTimer() {
    if (isInfiniteTime) {
        safeText(['top-timer', 'black-timer'], "∞");
        safeText(['bottom-timer', 'white-timer'], "∞");
        return;
    }
    if (currentBoardOrientation === 'w') {
        safeText(['bottom-timer', 'white-timer'], formatClock(whiteTime));
        safeText(['top-timer', 'black-timer'], formatClock(blackTime));
    } else {
        safeText(['top-timer', 'black-timer'], formatClock(whiteTime));
        safeText(['bottom-timer', 'white-timer'], formatClock(blackTime));
    }
}

function startTimer() {
    if (timerStarted || isInfiniteTime) return;
    
    timerStarted = true;
    lastTimerTick = Date.now();
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if(game.game_over()) { clearInterval(timerInterval); timerStarted = false; return; }
        
        let now = Date.now();
        let dt = (now - lastTimerTick) / 1000;
        lastTimerTick = now;
        
        if (game.turn() === 'w') {
            whiteTime = Math.max(0, whiteTime - dt);
            if (whiteTime <= 10 && !tenSecPlayedW) { tenSecPlayedW = true; playSnd('tenseconds'); }
        } else {
            blackTime = Math.max(0, blackTime - dt);
            if (blackTime <= 10 && !tenSecPlayedB) { tenSecPlayedB = true; playSnd('tenseconds'); }
        }
        
        updateTimer();
        
        if (whiteTime <= 0 || blackTime <= 0) { 
            clearInterval(timerInterval); 
            timerStarted = false;
            $('#status').text("Time Out!"); 
            playSnd('gameover');
            let winnerName = whiteTime <= 0 ? getBlackDisplayName() : getWhiteDisplayName();
            setTimeout(() => { showGameOverModal("Time Out!", `${winnerName} wins on time.`, "Rematch"); }, 1500);
        }
    }, 100);
}

function startGame(silent = false) {
    game.reset();
    clearArrows();
    
    let fenInput = safeEl('setup-fen-pgn');
    let customInput = fenInput ? fenInput.value.trim() : "";
    if (customInput) {
        let loaded = game.load(customInput);
        if (!loaded && game.load_pgn) game.load_pgn(customInput);
    }

    selectedSquare = null; currentLegalMoves = []; lastMove = null; pendingPremoves = [];
    tenSecPlayedW = false; tenSecPlayedB = false;
    gameHistory = [{ fen: game.fen(), move: null, moveObj: null, isCastle: false, isCapture: false, isPromote: false, inCheck: false, isCheckmate: false, evalScore: 50.0, evalText: "0.0", cp: 0 }];
    historyIndex = 0;
    
    let pgnEl = safeEl('pgn-box');
    if (pgnEl) pgnEl.value = game.pgn();
    safeDisplay('review-bar', liveFeedbackEnabled ? 'flex' : 'none');
    safeHtml('coach-bubble', `🤖 <b>Coach:</b> Match shuru! Apna best opening chalo bhai.`);
    updateAccuracySummary();
    updateOpeningExplorer();
    
    $('#status').text(gameMode === 'bvb' ? "Engine match started" : "Make a move to start timer");
    timerStarted = false; clearInterval(timerInterval);
    
    updateTimer();
    updateMaterial(game.fen());
    renderEvalBarVisuals(50.0, "0.0");
    renderBoard();
    updateEvalBar(0);
    drawAllEvalGraphs();
    
    if (gameMode === 'bvb') {
        startTimer();
        window.setTimeout(makeAiMove, 500);
    } else if (gameMode === 'pvb' && game.turn() !== playerColor) {
        startTimer();
        window.setTimeout(makeAiMove, 500); 
    }
}

function toggleEval() {
    let wrap = safeEl('eval-wrapper');
    if (!wrap) return;
    wrap.style.display = (wrap.style.display === 'none') ? 'block' : 'none';
    if(wrap.style.display === 'block') updateEvalBar(historyIndex);
}
function copyPGN() { let pgn = safeEl('pgn-box'); if (pgn) { pgn.select(); document.execCommand("copy"); alert("PGN Copied!"); } }

$(document).ready(function() {
    bindGraphClick('main-eval-graph');
    bindGraphClick('kundli-eval-graph');
    updateTimer();
    updateMaterial(game.fen());
    renderBoard();
    drawAllEvalGraphs();
});
