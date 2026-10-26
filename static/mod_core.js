/* ============================================================================
   static/mod_core.js (v122 - Full Action Integration & 2-Player Pass-Play Engine)
   - Glitch Fix: AI strictly prevented from playing human's turn in PvB
   - Single Match ID Session: Eliminates multiple duplicate match rows
   - 2-Player Pass & Play: Independent White & Black custom name handling
   - Front Controls: Resign, Offer Draw, Hint, Flip, and Menu actions wired
   - 1.45x Enlarged Floating Tactile Touch Controls (Zero-Drift)
   - Real-time Depth, NPS (kN/s), Hardware and Engine Telemetry restored
   ============================================================================ */

var game = new Chess();
var selectedSquare = null;
var currentLegalMoves = [];
var gameMode = 'pvb';
var playerColor = 'w';
var currentBoardOrientation = 'w';
var autoFlipPvP = true;
var currentWhiteElo = "1500";
var currentBlackElo = "2500";

var whiteEngineCfg = { path: "", preset: "sf19", name: "Stockfish 19" };
var blackEngineCfg = { path: "", preset: "sf18", name: "Stockfish 18" };

var whiteTime = 600, blackTime = 600;
var whiteIncrement = 0, blackIncrement = 0;
var isInfiniteTime = false;
var timerInterval = null;
var timerStarted = false;

var matchEnded = false;
var aiMoveTimerId = null;
var activeAiXhr = null;
var gameOverModalTimerId = null;
var gameEndEffect = null;
var saveDebounceTimer = null;

// Unique Session ID for current match to prevent duplicate database rows
window.currentMatchSessionId = localStorage.getItem('chess_current_session_id') || ("match_" + Date.now());

var gameHistory = [{
    fen: game.fen(), move: null, moveObj: null, soundType: 'move',
    evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
}];
var historyIndex = 0;

var premoveEnabled = true;
var premoveQueue = [];
var heatmapEnabled = false;
var drawModeEnabled = false;
var isAnalysisBranchMode = false;
var currentMatchSaved = false;
var liveFeedbackEnabled = false;

var showEvalGraph = false;
var showEngineLines = false;
var showCoachTelemetry = false;
var showAccuracyBar = false;

var soundEnabled = true;
var showHintButton = true;
var showEvalBar = true;
var engineThinkTime = 0.8;
var engineMaxDepth = 20;

const defaultBotNames = {
    "400": "Beginner Bot", "600": "Rookie Bot", "850": "Novice Bot",
    "1000": "Casual Bot", "1200": "Club Player", "1500": "Club Master",
    "2000": "Grandmaster AI", "2500": "Stockfish GM", "2800": "Stockfish Max"
};

const pieceThemeUrls = {
    "wikipedia": "/static/img/chesspieces/wikipedia/{piece}.png",
    "cburnett": "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/{piece}.svg",
    "merida": "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/{piece}.svg"
};

var audioCtx = null;
var audioBuffers = {};
var audioPools = {};
const soundPaths = {
    move: '/sound/move-self.mp3',
    capture: '/sound/capture.mp3',
    check: '/sound/move-check.mp3',
    castle: '/sound/castle.mp3',
    promote: '/sound/promote.mp3',
    gameover: '/sound/game-end.mp3',
    start: '/sound/game-start.mp3',
    illegal: '/sound/illegal.mp3',
    notify: '/sound/notify.mp3',
    tenseconds: '/sound/tenseconds.mp3'
};

Object.keys(soundPaths).forEach(k => {
    audioPools[k] = { idx: 0, items: [new Audio(soundPaths[k]), new Audio(soundPaths[k]), new Audio(soundPaths[k])] };
    audioPools[k].items.forEach(a => { a.preload = 'auto'; });
});

function getAudioCtx() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
}

function preloadAllSounds() {
    let ctx = getAudioCtx();
    if (!ctx) return;
    Object.keys(soundPaths).forEach(key => {
        fetch(soundPaths[key])
            .then(r => (r.ok && r.status === 200) ? r.arrayBuffer() : Promise.reject())
            .then(buf => ctx.decodeAudioData(buf))
            .then(decoded => { audioBuffers[key] = decoded; })
            .catch(() => {});
    });
}

function playSnd(type) {
    if (!soundEnabled) return;
    let key = soundPaths[type] ? type : 'move';
    try {
        let ctx = getAudioCtx();
        if (ctx && audioBuffers[key]) {
            let src = ctx.createBufferSource();
            src.buffer = audioBuffers[key];
            src.connect(ctx.destination);
            src.start(0);
            return;
        }
        let pool = audioPools[key];
        if (pool) {
            let a = pool.items[pool.idx];
            pool.idx = (pool.idx + 1) % pool.items.length;
            a.currentTime = 0;
            a.play().catch(() => {});
        }
    } catch (e) {}
}

function detectMoveSoundType(chessInstanceAfterMove, moveObj) {
    if (!moveObj) return 'move';
    try {
        if (chessInstanceAfterMove.in_checkmate() || chessInstanceAfterMove.in_draw()) return 'gameover';
        if (chessInstanceAfterMove.in_check()) return 'check';
    } catch (e) {}
    let flags = moveObj.flags || "";
    if (flags.includes('k') || flags.includes('q') || moveObj.san === 'O-O' || moveObj.san === 'O-O-O') return 'castle';
    if (moveObj.captured || flags.includes('c') || flags.includes('e') || (moveObj.san && moveObj.san.includes('x'))) return 'capture';
    if (moveObj.promotion || flags.includes('p') || (moveObj.san && moveObj.san.includes('='))) return 'promote';
    return 'move';
}

function playSoundForHistoryRec(rec) {
    if (!rec) { playSnd('move'); return; }
    if (rec.soundType) { playSnd(rec.soundType); return; }
    if (rec.moveObj) {
        let temp = new Chess(rec.fen);
        rec.soundType = detectMoveSoundType(temp, rec.moveObj);
        playSnd(rec.soundType);
    } else {
        playSnd('move');
    }
}

function isAutoBotMode() { return gameMode === 'bvb' || gameMode === 'eve'; }
function isMatchOver() { return matchEnded || game.game_over(); }

function stopAllActiveMatchProcesses() {
    clearInterval(timerInterval); timerInterval = null;
    if (aiMoveTimerId) { clearTimeout(aiMoveTimerId); aiMoveTimerId = null; }
    if (activeAiXhr && activeAiXhr.abort) {
        try { activeAiXhr.abort(); } catch (e) {}
        activeAiXhr = null;
    }
    premoveQueue = [];
}

function safeEl(id) { return document.getElementById(id); }
function safeText(ids, text) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.innerText = text; }); }
function safeHtml(ids, html) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.innerHTML = html; }); }
function safeDisplay(ids, disp) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.style.display = disp; }); }
function getTextSafe(id, fallback = "") { let el = safeEl(id); return (el && el.innerText) ? el.innerText.trim() : fallback; }

// Robust substring check: Works with "White", "White:", "Player 1 (White):"
function getWhiteDisplayName() {
    let topLbl = getTextSafe('top-player-label', '').toLowerCase();
    if (topLbl.includes('white')) {
        return getTextSafe('top-player-name', 'White');
    }
    return getTextSafe('bottom-player-name', 'White');
}

function getBlackDisplayName() {
    let topLbl = getTextSafe('top-player-label', '').toLowerCase();
    if (topLbl.includes('black')) {
        return getTextSafe('top-player-name', 'Black');
    }
    return getTextSafe('bottom-player-name', 'Black');
}

window.syncEloBadgeVisibility = function() {
    let pill = safeEl('live-player-elo-pill');
    let modalBanner = safeEl('modal-elo-change-banner');
    if (gameMode === 'pvb') {
        if (pill) pill.style.display = (currentBoardOrientation === playerColor) ? 'inline-block' : 'none';
        if (modalBanner) modalBanner.style.display = 'block';
    } else {
        if (pill) pill.style.display = 'none';
        if (modalBanner) modalBanner.style.display = 'none';
    }
};

window.syncOptionalPanelsVisibility = function() {
    let isFs = Boolean(document.fullscreenElement) || document.body.classList.contains('focus-fullscreen-mode');
    safeDisplay('main-eval-graph-wrap', (!isFs && showEvalGraph) ? 'block' : 'none');
    safeDisplay('multipv-bar', (!isFs && showEngineLines) ? 'block' : 'none');
    safeDisplay('coach-bubble', (!isFs && showCoachTelemetry) ? 'flex' : 'none');
    safeDisplay('review-bar', (!isFs && (showAccuracyBar || isMatchOver())) ? 'flex' : 'none');
};

window.closeModal = function(id) { safeDisplay(id, 'none'); };
window.openSetupModal = function() {
    loadBotNameForElo('white'); loadBotNameForElo('black');
    if (window.populateSetupEngineSelectors) window.populateSetupEngineSelectors();
    toggleSetupMode();
    let u = localStorage.getItem('chess_username');
    if (u && safeEl('setup-username')) safeEl('setup-username').value = u;
    safeDisplay('setup-modal', 'flex');
};
window.openSettingsModal = function() {
    if (window.refreshEngineListInSettings) window.refreshEngineListInSettings();
    safeDisplay('settings-modal', 'flex');
};

window.toggleSetupMode = function() {
    let m = (safeEl('setup-mode') || {}).value || 'pvb';
    let isPvP = (m === 'pvp');

    safeDisplay('setup-pvp-names-group', isPvP ? 'flex' : 'none');
    safeDisplay('setup-username-group', isPvP ? 'none' : 'block');
    safeDisplay('setup-autoflip-group', isPvP ? 'flex' : 'none');
    safeDisplay('setup-color-group', m === 'pvb' ? 'flex' : 'none');
    safeDisplay('setup-white-bot-group', m === 'bvb' ? 'flex' : 'none');
    safeDisplay('setup-black-bot-group', (m === 'pvb' || m === 'bvb') ? 'flex' : 'none');
    safeDisplay('setup-eve-group', m === 'eve' ? 'flex' : 'none');
    safeDisplay('setup-think-group', isPvP ? 'none' : 'flex');
    safeDisplay('setup-depth-group', isPvP ? 'none' : 'flex');
    safeDisplay('setup-personality-group', (m === 'pvb' || m === 'bvb') ? 'flex' : 'none');
    let oppLbl = safeEl('opponent-elo-label');
    if (oppLbl) oppLbl.innerText = (m === 'bvb') ? "Black Bot Level & Name:" : "Opponent Bot Level & Name:";
};

window.toggleCustomTime = function() {
    let v = (safeEl('setup-time') || {}).value;
    safeDisplay('custom-time-group', v === 'custom' ? 'flex' : 'none');
};

function getSavedBotName(elo) { return localStorage.getItem('bot_name_' + elo) || defaultBotNames[elo] || "Stockfish AI"; }
window.loadBotNameForElo = function(side) {
    let elo = (safeEl(side === 'white' ? 'setup-white-bot' : 'setup-black-bot') || {}).value || (side === 'white' ? "1500" : "2500");
    let inp = safeEl(side === 'white' ? 'setup-white-bot-name' : 'setup-bot-name');
    if (inp) inp.value = getSavedBotName(elo);
};
window.saveBotNameForElo = function(side) {
    let elo = (safeEl(side === 'white' ? 'setup-white-bot' : 'setup-black-bot') || {}).value || (side === 'white' ? "1500" : "2500");
    let val = (safeEl(side === 'white' ? 'setup-white-bot-name' : 'setup-bot-name') || {}).value;
    if (val && val.trim()) localStorage.setItem('bot_name_' + elo, val.trim());
};
window.saveUsername = function() {
    let u = (safeEl('setup-username') || {}).value;
    if (u && u.trim()) localStorage.setItem('chess_username', u.trim());
};

// ============================================================================
// APPLY SETUP AND START (PASS & PLAY 2-PLAYER, BOT, EVE & TIME CONTROLS)
// ============================================================================
window.applySetupAndStart = function() {
    let mode = (safeEl('setup-mode') || {}).value || 'pvb';
    gameMode = mode;

    if (mode === 'pvp') {
        let p1Name = (safeEl('setup-pvp-white') || {}).value || "Player 1";
        let p2Name = (safeEl('setup-pvp-black') || {}).value || "Player 2";
        autoFlipPvP = ((safeEl('setup-autoflip') || {}).value === 'on');

        playerColor = 'w';
        currentBoardOrientation = 'w';

        safeText('bottom-player-name', p1Name.trim() || "Player 1");
        safeText('bottom-player-label', 'White');
        safeText('top-player-name', p2Name.trim() || "Player 2");
        safeText('top-player-label', 'Black');
    } else if (mode === 'pvb') {
        let uName = (safeEl('setup-username') || {}).value || "You";
        let botElo = (safeEl('setup-black-bot') || {}).value || "2500";
        let botName = (safeEl('setup-bot-name') || {}).value || getSavedBotName(botElo);
        currentBlackElo = botElo;

        let colRadios = document.getElementsByName('play_color');
        let chosenCol = 'w';
        for (let i = 0; i < colRadios.length; i++) {
            if (colRadios[i].checked) { chosenCol = colRadios[i].value; break; }
        }
        if (chosenCol === 'random') {
            chosenCol = (Math.random() < 0.5) ? 'w' : 'b';
        }

        playerColor = chosenCol;
        currentBoardOrientation = chosenCol;

        if (chosenCol === 'w') {
            safeText('bottom-player-name', uName.trim() || "You");
            safeText('bottom-player-label', 'White');
            safeText('top-player-name', botName.trim() || "Stockfish GM");
            safeText('top-player-label', 'Black');
        } else {
            safeText('bottom-player-name', uName.trim() || "You");
            safeText('bottom-player-label', 'Black');
            safeText('top-player-name', botName.trim() || "Stockfish GM");
            safeText('top-player-label', 'White');
        }
    } else if (mode === 'bvb') {
        let wElo = (safeEl('setup-white-bot') || {}).value || "1500";
        let bElo = (safeEl('setup-black-bot') || {}).value || "2500";
        let wName = (safeEl('setup-white-bot-name') || {}).value || getSavedBotName(wElo);
        let bName = (safeEl('setup-bot-name') || {}).value || getSavedBotName(bElo);

        currentWhiteElo = wElo;
        currentBlackElo = bElo;
        currentBoardOrientation = 'w';

        safeText('bottom-player-name', wName.trim());
        safeText('bottom-player-label', 'White');
        safeText('top-player-name', bName.trim());
        safeText('top-player-label', 'Black');
    }

    // Time Control Settings
    let tVal = (safeEl('setup-time') || {}).value || "10|0";
    if (tVal === '0|0') {
        isInfiniteTime = true;
        whiteTime = 0; blackTime = 0;
        whiteIncrement = 0; blackIncrement = 0;
    } else if (tVal === 'custom') {
        isInfiniteTime = false;
        let cMin = parseInt((safeEl('custom-minutes') || {}).value) || 10;
        let cSec = parseInt((safeEl('custom-seconds') || {}).value) || 0;
        let cInc = parseInt((safeEl('custom-increment') || {}).value) || 0;
        whiteTime = (cMin * 60) + cSec;
        blackTime = whiteTime;
        whiteIncrement = cInc;
        blackIncrement = cInc;
    } else {
        isInfiniteTime = false;
        let parts = tVal.split('|');
        let mins = parseInt(parts[0]) || 10;
        let inc = parseInt(parts[1]) || 0;
        whiteTime = mins * 60;
        blackTime = whiteTime;
        whiteIncrement = inc;
        blackIncrement = inc;
    }

    // Bot Think & Depth Settings
    let thinkEl = safeEl('setup-think-time');
    if (thinkEl) engineThinkTime = parseFloat(thinkEl.value) || 0.8;
    let depthEl = safeEl('setup-depth-slider');
    if (depthEl) engineMaxDepth = parseInt(depthEl.value) || 20;

    closeModal('setup-modal');
    window.startGame(true);
};

window.applyThemeAndPieces = function() {
    let themeSel = safeEl('setting-board-theme');
    let theme = themeSel ? themeSel.value : 'theme-green';
    document.body.className = document.body.className.replace(/\btheme-[^\s]+\b/g, '').trim();
    document.body.classList.add(theme);
    localStorage.setItem('saved_chess_theme', theme);
    renderBoard();
};

function sqToSvgCoords(sq) {
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let f = files.indexOf(sq[0]), r = parseInt(sq[1]);
    let col = (currentBoardOrientation === 'w') ? f : (7 - f);
    let row = (currentBoardOrientation === 'w') ? (8 - r) : (r - 1);
    return { x: col * 40 + 20, y: row * 40 + 20 };
}
function clearArrows() { let svg = safeEl('arrow-overlay'); if (svg) svg.innerHTML = ""; }

function getVirtualPremoveGame() {
    let vGame = new Chess(game.fen());
    for (let i = 0; i < premoveQueue.length; i++) {
        let pm = premoveQueue[i];
        let tokens = vGame.fen().split(' ');
        tokens[1] = playerColor; tokens[3] = '-';
        vGame.load(tokens.join(' '));
        let p = vGame.get(pm.from);
        if (p && p.color === playerColor) {
            vGame.remove(pm.from);
            let isPromo = (p.type === 'p' && (pm.to[1] === '8' || pm.to[1] === '1'));
            vGame.put({ type: isPromo ? 'q' : p.type, color: playerColor }, pm.to);
        }
    }
    let finalTokens = vGame.fen().split(' ');
    finalTokens[1] = playerColor; finalTokens[3] = '-';
    vGame.load(finalTokens.join(' '));
    return vGame;
}

function getPieceImageUrl(color, type) {
    let pStyle = (safeEl('setting-piece-style') || {}).value || 'wikipedia';
    let urlTemplate = pieceThemeUrls[pStyle] || pieceThemeUrls['wikipedia'];
    return urlTemplate.replace('{piece}', color + type.toUpperCase());
}

function updateSelectionAndDotsInPlace() {
    $('.square').removeClass('selected drag-target-hover');
    $('.legal-dot, .legal-capture').remove();
    if (selectedSquare) {
        $(`.square[data-square="${selectedSquare}"]`).addClass('selected');
    }
    currentLegalMoves.forEach(m => {
        let sqEl = $(`.square[data-square="${m.to}"]`);
        if (sqEl.length) {
            let cls = (m.flags && (m.flags.includes('c') || m.flags.includes('e'))) ? 'legal-capture' : 'legal-dot';
            sqEl.append($('<div>').addClass(cls));
        }
    });
}

function renderBoard() {
    const boardEl = $('#board');
    if (!boardEl.length) return;
    boardEl.empty();

    let isLiveTip = (historyIndex === gameHistory.length - 1);
    let displayFen = (historyIndex >= 0 && historyIndex < gameHistory.length) ? gameHistory[historyIndex].fen : game.fen();
    let tempGame = (isLiveTip && premoveQueue.length > 0) ? getVirtualPremoveGame() : new Chess(displayFen);
    let boardState = tempGame.board();
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let lastMove = (historyIndex > 0 && gameHistory[historyIndex]) ? gameHistory[historyIndex].move : null;
    let lastClassification = (historyIndex > 0 && gameHistory[historyIndex]) ? gameHistory[historyIndex].classification : null;

    let showBadgesNow = isMatchOver() || isAnalysisBranchMode || liveFeedbackEnabled;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let boardRow = (currentBoardOrientation === 'w') ? r : (7 - r);
            let boardCol = (currentBoardOrientation === 'w') ? c : (7 - c);
            let sqName = files[boardCol] + (8 - boardRow);
            let isLight = (boardRow + boardCol) % 2 === 0;
            let sqDiv = $('<div>').addClass('square ' + (isLight ? 'light' : 'dark')).attr('data-square', sqName);

            if (c === 0) sqDiv.append($('<span>').addClass('coord-rank').text(8 - boardRow));
            if (r === 7) sqDiv.append($('<span>').addClass('coord-file').text(files[boardCol]));

            if (selectedSquare === sqName) sqDiv.addClass('selected');
            if (lastMove && (lastMove.from === sqName || lastMove.to === sqName)) sqDiv.addClass('last-move');

            if (isLiveTip && premoveQueue.length > 0) {
                premoveQueue.forEach((pm, idx) => {
                    if (pm.from === sqName || pm.to === sqName) sqDiv.addClass('premove-sq');
                    if (pm.to === sqName) sqDiv.append($('<div>').addClass('premove-step-badge').text('#' + (idx + 1)));
                });
            }

            if (lastMove && lastMove.to === sqName && lastClassification && showBadgesNow) {
                sqDiv.append($('<div>').addClass('move-badge').css('background-color', lastClassification.color).text(lastClassification.symbol));
            }
            let moveOption = currentLegalMoves.find(m => m.to === sqName);
            if (moveOption) {
                sqDiv.append($('<div>').addClass(moveOption.flags && (moveOption.flags.includes('c') || moveOption.flags.includes('e')) ? 'legal-capture' : 'legal-dot'));
            }
            let piece = boardState[boardRow][boardCol];
            if (piece) {
                if (piece.type === 'k' && tempGame.in_check() && tempGame.turn() === piece.color) sqDiv.addClass('in-check');
                let pieceDiv = $('<div>').addClass('piece').css('background-image', `url('${getPieceImageUrl(piece.color, piece.type)}')`);

                if (isLiveTip && matchEnded && gameEndEffect && piece.type === 'k') {
                    if (gameEndEffect.winner === 'draw') {
                        sqDiv.addClass('king-draw-sq');
                    } else if (piece.color === gameEndEffect.winner) {
                        sqDiv.addClass('king-winner-sq');
                        pieceDiv.addClass('king-winner-piece');
                    } else {
                        sqDiv.addClass('king-loser-sq');
                        pieceDiv.addClass('king-fallen-piece');
                    }
                }
                sqDiv.append(pieceDiv);
            }
            boardEl.append(sqDiv);
        }
    }
}

// Vertical Promotion Popup
function showPromotionModal(color, toSq, onSelect) {
    let existing = document.getElementById('promotion-choice-modal');
    if (existing) existing.remove();
    let oldOverlay = document.getElementById('promotion-cancel-overlay');
    if (oldOverlay) oldOverlay.remove();

    let boardEl = document.getElementById('board');
    let sqEl = boardEl ? boardEl.querySelector(`[data-square="${toSq}"]`) : null;
    if (!boardEl || !sqEl) return;

    let handled = false;
    let cancelOverlay = document.createElement('div');
    cancelOverlay.id = 'promotion-cancel-overlay';
    cancelOverlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.18);';

    function doCancel(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (handled) return;
        handled = true;
        let m = document.getElementById('promotion-choice-modal');
        if (m) m.remove();
        cancelOverlay.remove();
        selectedSquare = null; currentLegalMoves = [];
        renderBoard();
    }

    cancelOverlay.addEventListener('touchend', doCancel, { passive: false });
    cancelOverlay.addEventListener('click', doCancel);
    document.body.appendChild(cancelOverlay);

    let modal = document.createElement('div');
    modal.id = 'promotion-choice-modal';
    let sqW = sqEl.clientWidth || 40, sqH = sqEl.clientHeight || 40;
    let cancelH = Math.round(sqH * 0.45), totalH = (sqH * 4) + cancelH;

    modal.style.position = 'absolute';
    modal.style.width = sqW + 'px';
    modal.style.height = totalH + 'px';
    modal.style.background = '#ffffff';
    modal.style.boxShadow = '0 6px 20px rgba(0,0,0,0.7)';
    modal.style.borderRadius = '4px';
    modal.style.overflow = 'hidden';
    modal.style.zIndex = '99999';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';

    let topPos = sqEl.offsetTop, leftPos = sqEl.offsetLeft;
    modal.style.top = (topPos > boardEl.clientHeight / 2) ? (topPos + sqH - totalH) + 'px' : topPos + 'px';
    modal.style.left = leftPos + 'px';

    function doSelect(p, e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (handled) return;
        handled = true;
        modal.remove(); cancelOverlay.remove();
        onSelect(p);
    }

    ['q', 'n', 'r', 'b'].forEach(p => {
        let btn = document.createElement('div');
        btn.style.width = '100%'; btn.style.height = sqH + 'px';
        btn.style.cursor = 'pointer'; btn.style.display = 'flex';
        btn.style.alignItems = 'center'; btn.style.justifyContent = 'center';

        let img = document.createElement('div');
        img.style.width = '84%'; img.style.height = '84%';
        img.style.backgroundImage = `url('${getPieceImageUrl(color, p)}')`;
        img.style.backgroundSize = 'contain'; img.style.backgroundRepeat = 'no-repeat'; img.style.backgroundPosition = 'center';
        img.style.pointerEvents = 'none';

        btn.appendChild(img);
        btn.addEventListener('touchend', function(e) { doSelect(p, e); }, { passive: false });
        btn.addEventListener('click', function(e) { doSelect(p, e); });
        modal.appendChild(btn);
    });

    let cancelBtn = document.createElement('div');
    cancelBtn.style.width = '100%'; cancelBtn.style.height = cancelH + 'px';
    cancelBtn.style.background = '#f2f2f2'; cancelBtn.style.borderTop = '1px solid #e0e0e0';
    cancelBtn.style.display = 'flex'; cancelBtn.style.alignItems = 'center'; cancelBtn.style.justifyContent = 'center';
    cancelBtn.innerText = '✕';
    cancelBtn.addEventListener('touchend', doCancel, { passive: false });
    cancelBtn.addEventListener('click', doCancel);
    modal.appendChild(cancelBtn);

    boardEl.appendChild(modal);
}

// ============================================================================
// ZERO-DRIFT TOUCH ENGINE (DOM COORDINATES + DIRECT SQUARE EXTRACTION)
// ============================================================================

var dragPieceState = { active: false, fromSq: null, currentSq: null, startX: 0, startY: 0, isDragging: false };

function getSquareAtPoint(clientX, clientY) {
    if (clientX === undefined || clientY === undefined) return null;
    let el = document.elementFromPoint(clientX, clientY);
    if (el) {
        let sqEl = el.closest('.square');
        if (sqEl) return sqEl.getAttribute('data-square');
    }
    let boardEl = document.getElementById('board');
    if (!boardEl) return null;
    let rect = boardEl.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    let col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)));
    let row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)));
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let boardRow = (currentBoardOrientation === 'w') ? row : (7 - row);
    let boardCol = (currentBoardOrientation === 'w') ? col : (7 - col);
    return files[boardCol] + (8 - boardRow);
}

// 1.45x Floating Tactile Piece Zoom
function showGhostPiece(imgUrl, clientX, clientY) {
    let ghost = document.getElementById('drag-ghost-piece');
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'drag-ghost-piece';
        document.body.appendChild(ghost);
    }
    let anySq = document.querySelector('.square');
    let sqSize = anySq ? anySq.clientWidth : 46;

    ghost.style.cssText = `
        position: fixed !important;
        pointer-events: none !important;
        z-index: 999999 !important;
        display: block !important;
        width: ${sqSize}px !important;
        height: ${sqSize}px !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        transform: translate(-50%, -65%) scale(1.45) !important;
        margin: 0 !important;
        padding: 0 !important;
        top: ${clientY}px !important;
        left: ${clientX}px !important;
        opacity: 0.98 !important;
        filter: drop-shadow(0 16px 28px rgba(0,0,0,0.75)) !important;
        transition: transform 0.06s ease-out !important;
    `;
    if (imgUrl) ghost.style.backgroundImage = `url('${imgUrl}')`;
}

function hideGhostPiece() {
    let ghost = document.getElementById('drag-ghost-piece');
    if (ghost) ghost.style.display = 'none';
    $('.square').removeClass('drag-target-hover');
    $('.square .piece').removeClass('dragging-source-piece');
}

function ensureBranchReadyForMove() {
    if (historyIndex < gameHistory.length - 1) {
        if (!isMatchOver() && !isAnalysisBranchMode) {
            $('#status').text("Viewing past move — Tap 'Live' button to continue match");
            return false;
        }
        gameHistory = gameHistory.slice(0, historyIndex + 1);
        game.load(gameHistory[historyIndex].fen);
        isAnalysisBranchMode = true;
        matchEnded = false;
        gameEndEffect = null;
        stopAllActiveMatchProcesses();
        $('#status').text("Analysis Free Play Mode");
    } else if (isMatchOver() && !isAnalysisBranchMode) {
        return false;
    }
    return true;
}

function handlePieceTouchStart(sq, clientX, clientY) {
    if (drawModeEnabled || !sq) return;
    if (document.getElementById('promotion-choice-modal')) return;
    if (!ensureBranchReadyForMove()) return;
    if (isAutoBotMode() && !isAnalysisBranchMode) return;

    if (selectedSquare && sq !== selectedSquare) {
        let validMove = currentLegalMoves.find(m => m.to === sq);
        if (validMove) {
            if (!isAnalysisBranchMode && gameMode === 'pvb' && game.turn() !== playerColor) {
                premoveQueue.push({ from: selectedSquare, to: sq });
                selectedSquare = null; currentLegalMoves = [];
                playSnd('move');
                $('#status').text(`Premove #${premoveQueue.length} queued`);
                renderBoard();
            } else {
                executeHumanMove(selectedSquare, sq);
            }
            dragPieceState.active = false;
            hideGhostPiece();
            return;
        }
    }

    if (selectedSquare === sq) {
        selectedSquare = null;
        currentLegalMoves = [];
        updateSelectionAndDotsInPlace();
        dragPieceState.active = false;
        hideGhostPiece();
        return;
    }

    if (!isAnalysisBranchMode && gameMode === 'pvb' && game.turn() !== playerColor) {
        if (!premoveEnabled) return;
        let vGame = getVirtualPremoveGame();
        let vp = vGame.get(sq);
        if (vp && vp.color === playerColor) {
            selectedSquare = sq;
            currentLegalMoves = vGame.moves({ square: sq, verbose: true });
            updateSelectionAndDotsInPlace();
            dragPieceState.active = true;
            dragPieceState.fromSq = sq;
            dragPieceState.currentSq = sq;
            dragPieceState.startX = clientX;
            dragPieceState.startY = clientY;
            dragPieceState.isDragging = false;
            showGhostPiece(getPieceImageUrl(vp.color, vp.type), clientX, clientY);
            $(`.square[data-square="${sq}"] .piece`).addClass('dragging-source-piece');
        } else {
            selectedSquare = null; currentLegalMoves = [];
            if (premoveQueue.length > 0) { premoveQueue = []; $('#status').text("Premoves cleared."); }
            renderBoard();
        }
        return;
    }

    let piece = game.get(sq);
    if (piece && piece.color === game.turn()) {
        if (gameMode === 'pvb' && !isAnalysisBranchMode && piece.color !== playerColor) return;
        selectedSquare = sq;
        currentLegalMoves = game.moves({ square: sq, verbose: true });
        updateSelectionAndDotsInPlace();

        dragPieceState.active = true;
        dragPieceState.fromSq = sq;
        dragPieceState.currentSq = sq;
        dragPieceState.startX = clientX;
        dragPieceState.startY = clientY;
        dragPieceState.isDragging = false;

        showGhostPiece(getPieceImageUrl(piece.color, piece.type), clientX, clientY);
        $(`.square[data-square="${sq}"] .piece`).addClass('dragging-source-piece');
    } else {
        selectedSquare = null;
        currentLegalMoves = [];
        updateSelectionAndDotsInPlace();
        dragPieceState.active = false;
        hideGhostPiece();
    }
}

function handlePieceTouchMove(clientX, clientY) {
    if (!dragPieceState.active) return;
    let dx = clientX - dragPieceState.startX;
    let dy = clientY - dragPieceState.startY;
    let dist = Math.hypot(dx, dy);
    if (dist > 8) {
        dragPieceState.isDragging = true;
    }

    let ghost = document.getElementById('drag-ghost-piece');
    if (ghost) {
        ghost.style.left = clientX + 'px';
        ghost.style.top = clientY + 'px';
    }

    let hoverSq = getSquareAtPoint(clientX, clientY);
    if (hoverSq !== dragPieceState.currentSq) {
        dragPieceState.currentSq = hoverSq;
        $('.square').removeClass('drag-target-hover');
        if (hoverSq) $(`.square[data-square="${hoverSq}"]`).addClass('drag-target-hover');
    }
}

function handlePieceTouchEnd(clientX, clientY) {
    if (!dragPieceState.active) return;
    let fromSq = dragPieceState.fromSq;
    let dropSq = getSquareAtPoint(clientX, clientY) || dragPieceState.currentSq;
    let wasDragged = dragPieceState.isDragging;

    dragPieceState.active = false;
    hideGhostPiece();

    if (wasDragged && dropSq && dropSq !== fromSq) {
        let validMove = currentLegalMoves.find(m => m.to === dropSq);
        if (validMove) {
            if (!isAnalysisBranchMode && gameMode === 'pvb' && game.turn() !== playerColor) {
                premoveQueue.push({ from: fromSq, to: dropSq });
                selectedSquare = null; currentLegalMoves = [];
                playSnd('move');
                $('#status').text(`Premove #${premoveQueue.length} queued`);
                renderBoard();
            } else {
                executeHumanMove(fromSq, dropSq);
            }
            return;
        }
    }
    updateSelectionAndDotsInPlace();
}

function bindPieceDragAndDropEvents() {
    let boardEl = document.getElementById('board');
    if (!boardEl || boardEl.dataset.pieceDragBound === "1") return;
    boardEl.dataset.pieceDragBound = "1";

    boardEl.addEventListener('touchstart', function(e) {
        getAudioCtx();
        if (document.getElementById('promotion-choice-modal')) return;
        if (e.touches && e.touches.length === 1) {
            let t = e.touches[0];
            let sq = getSquareAtPoint(t.clientX, t.clientY);
            if (sq) {
                e.preventDefault();
                handlePieceTouchStart(sq, t.clientX, t.clientY);
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', function(e) {
        if (!dragPieceState.active) return;
        if (e.touches && e.touches.length === 1) {
            e.preventDefault();
            handlePieceTouchMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', function(e) {
        if (!dragPieceState.active) return;
        let t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : { clientX: 0, clientY: 0 };
        handlePieceTouchEnd(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchcancel', function() {
        dragPieceState.active = false;
        hideGhostPiece();
    });

    boardEl.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        getAudioCtx();
        let sq = getSquareAtPoint(e.clientX, e.clientY);
        if (sq) {
            e.preventDefault();
            handlePieceTouchStart(sq, e.clientX, e.clientY);
        }
    });

    window.addEventListener('mousemove', function(e) {
        if (!dragPieceState.active) return;
        handlePieceTouchMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', function(e) {
        if (!dragPieceState.active) return;
        handlePieceTouchEnd(e.clientX, e.clientY);
    });
}

function parseAndApplyUciMove(uciStr) {
    if (!uciStr || uciStr.length < 4) return null;
    let fromSq = uciStr.substring(0, 2);
    let toSq = uciStr.substring(2, 4);
    let promo = uciStr.length > 4 ? uciStr.substring(4, 5).toLowerCase() : 'q';
    let m = game.move({ from: fromSq, to: toSq, promotion: promo });
    if (!m) m = game.move(uciStr, { sloppy: true });
    return m;
}

function executeHumanMove(fromSq, toSq, promoPiece = null) {
    if (!isAnalysisBranchMode && isMatchOver()) return;

    let movingPiece = game.get(fromSq);
    let isPromotion = false;
    if (movingPiece && movingPiece.type === 'p') {
        let toRank = toSq.charAt(1);
        if ((movingPiece.color === 'w' && toRank === '8') || (movingPiece.color === 'b' && toRank === '1')) {
            isPromotion = true;
        }
    }

    if (isPromotion && !promoPiece) {
        let legals = game.moves({ square: fromSq, verbose: true });
        let isValid = legals.some(m => m.to === toSq);
        if (isValid) {
            showPromotionModal(movingPiece.color, toSq, function(chosenPiece) {
                executeHumanMove(fromSq, toSq, chosenPiece);
            });
            return;
        }
    }

    let finalPromo = promoPiece || 'q';
    let prevRec = gameHistory[gameHistory.length - 1];
    let moveObj = game.move({ from: fromSq, to: toSq, promotion: finalPromo });
    if (!moveObj) { playSnd('illegal'); return; }
    selectedSquare = null; currentLegalMoves = []; clearArrows();

    if (!timerStarted && !isAnalysisBranchMode) { startTimer(); timerStarted = true; }
    if (!isInfiniteTime && !isAnalysisBranchMode) {
        if (moveObj.color === 'w') whiteTime += whiteIncrement; else blackTime += blackIncrement;
        updateTimer();
    }
    let sndType = detectMoveSoundType(game, moveObj);
    let instantEv = window.computeInstantEvalFromFen ? window.computeInstantEvalFromFen(game.fen()) : { score: 50.0, text: "0.0", cp: 0 };
    gameHistory.push({
        fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj,
        soundType: sndType,
        bestMoveUci: prevRec && prevRec.nextBestUci ? prevRec.nextBestUci : "",
        bestMoveSan: prevRec && prevRec.nextBestSan ? prevRec.nextBestSan : "",
        evalScore: instantEv.score, evalText: instantEv.text, cp: instantEv.cp
    });
    historyIndex = gameHistory.length - 1;
    let movedIdx = historyIndex;

    processMoveVisuals(moveObj, movedIdx);

    if (gameMode === 'pvp' && autoFlipPvP && !isAnalysisBranchMode) {
        setTimeout(() => flipBoardUI(), 150);
    }

    // Only trigger AI if it's NOT human turn!
    if (!isAnalysisBranchMode && !isMatchOver() && (isAutoBotMode() || (gameMode === 'pvb' && game.turn() !== playerColor))) {
        if (aiMoveTimerId) clearTimeout(aiMoveTimerId);
        aiMoveTimerId = setTimeout(makeAiMove, 120);
    }
}

function makeAiMove() {
    if (isAnalysisBranchMode || isMatchOver()) return;

    // CRITICAL GLITCH FIX: Player vs Bot mode me AI kabhi bhi human ka turn nahi chalega!
    if (gameMode === 'pvb' && game.turn() === playerColor) {
        return;
    }

    let turnSide = game.turn();
    let botElo = isAutoBotMode() ? (turnSide === 'w' ? currentWhiteElo : currentBlackElo) : currentBlackElo;
    let sideName = (turnSide === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
    $('#status').text(`${sideName} thinking...`);

    let postData = {
        fen: game.fen(), level: botElo, think_time: engineThinkTime,
        depth: engineMaxDepth, _t: Date.now()
    };

    if (gameMode === 'eve') {
        let engCfg = (turnSide === 'w') ? whiteEngineCfg : blackEngineCfg;
        postData.engine_path = engCfg.path || "";
        postData.engine_preset = engCfg.preset || "";
        postData.level = "2800";
    }

    activeAiXhr = $.ajax({
        url: '/ai_move', method: 'POST', data: postData, timeout: 18000,
        success: function(data) {
            activeAiXhr = null;
            if (!data || !data.move || isAnalysisBranchMode || isMatchOver()) return;

            let prevIdx = gameHistory.length - 1;
            if (data.prev_cp !== undefined && gameHistory[prevIdx]) gameHistory[prevIdx].cp = data.prev_cp;

            let moveObj = parseAndApplyUciMove(data.move);
            if (!moveObj) {
                let legals = game.moves({ verbose: true });
                if (legals.length > 0) moveObj = game.move(legals[0]);
            }
            if (!moveObj) return;

            if (!isInfiniteTime && !isMatchOver()) {
                if (moveObj.color === 'w') whiteTime += whiteIncrement; else blackTime += blackIncrement;
                updateTimer();
            }

            let sndType = detectMoveSoundType(game, moveObj);
            let instantEv = window.computeInstantEvalFromFen ? window.computeInstantEvalFromFen(game.fen()) : { score: 50.0, text: "0.0", cp: 0 };
            gameHistory.push({
                fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj,
                soundType: sndType,
                bestMoveUci: data.best_uci || "", bestMoveSan: data.best_san || "",
                evalScore: instantEv.score, evalText: instantEv.text, cp: instantEv.cp
            });
            historyIndex = gameHistory.length - 1;
            let newIdx = historyIndex;

            if (data.depth || data.nps) {
                let knps = data.nps ? Math.round(data.nps / 1000) + " kN/s" : "";
                let dInfo = data.depth ? `Depth ${data.depth}` : "";
                safeHtml('coach-bubble', `<b>Engine:</b>&nbsp;${data.engine || 'Stockfish'} • ${dInfo} ${knps ? '• ' + knps : ''}`);
            }

            processMoveVisuals(moveObj, newIdx);

            if (!isMatchOver() && !isAnalysisBranchMode && isAutoBotMode()) {
                if (aiMoveTimerId) clearTimeout(aiMoveTimerId);
                aiMoveTimerId = setTimeout(makeAiMove, 250);
                return;
            }

            if (!isMatchOver() && !isAnalysisBranchMode && gameMode === 'pvb' && game.turn() === playerColor && premoveQueue.length > 0) {
                let nextPm = premoveQueue.shift();
                let legalCheck = game.moves({ square: nextPm.from, verbose: true }).find(m => m.to === nextPm.to);
                if (legalCheck) {
                    setTimeout(() => executeHumanMove(nextPm.from, nextPm.to), 80);
                } else {
                    premoveQueue = []; renderBoard();
                }
            }
        },
        error: function() {
            activeAiXhr = null;
            if (!isMatchOver() && !isAnalysisBranchMode && isAutoBotMode()) {
                aiMoveTimerId = setTimeout(makeAiMove, 500);
            }
        }
    });
}

function processMoveVisuals(moveObj, targetIndex) {
    let rec = gameHistory[targetIndex];
    playSoundForHistoryRec(rec);
    renderBoard();
    updateStatus();

    try { syncOptionalPanelsVisibility(); } catch (e) {}
    try { $('#pgn-box').val(game.pgn()); } catch (e) {}
    try { updateMaterial(gameHistory[historyIndex].fen); } catch (e) {}
    try { if (window.updateOpeningExplorer) window.updateOpeningExplorer(); } catch (e) {}
    try { if (window.classifyMoveByEval) window.classifyMoveByEval(targetIndex); } catch (e) {}

    $.post('/eval', { fen: rec.fen, depth: (isAutoBotMode() ? 12 : 15), time: 0.14, _t: Date.now() }, function(data) {
        if (data && gameHistory[targetIndex]) {
            gameHistory[targetIndex].evalScore = data.score;
            gameHistory[targetIndex].evalText = data.text;
            if (data.cp !== undefined) gameHistory[targetIndex].cp = data.cp;
            if (data.best_san) {
                gameHistory[targetIndex].nextBestSan = data.best_san;
                gameHistory[targetIndex].nextBestUci = data.best_uci || "";
            }
            if (historyIndex === targetIndex) updateEvalBar(targetIndex);
            try { if (window.classifyMoveByEval) window.classifyMoveByEval(targetIndex); } catch (e) {}
            try { if (window.drawAllEvalGraphs) window.drawAllEvalGraphs(); } catch (e) {}
        }
    });

    autoSaveCurrentState();
}

function updateEvalBar(idx) {
    if (!showEvalBar) return;
    let rec = gameHistory[idx] || { evalScore: 50.0, evalText: "0.0", cp: 0 };
    let whitePct = rec.evalScore !== undefined ? rec.evalScore : 50.0;
    let txt = rec.evalText || "0.0";

    if (currentBoardOrientation === 'w') {
        $('#eval-fill').css({ top: 'auto', bottom: '0', height: whitePct + '%' });
        $('#eval-text-bottom').text(whitePct >= 50 ? txt : '').css('color', '#161512');
        $('#eval-text-top').text(whitePct < 50 ? txt : '').css('color', '#e0e0e0');
    } else {
        $('#eval-fill').css({ top: '0', bottom: 'auto', height: whitePct + '%' });
        $('#eval-text-top').text(whitePct >= 50 ? txt : '').css('color', '#161512');
        $('#eval-text-bottom').text(whitePct < 50 ? txt : '').css('color', '#e0e0e0');
    }
}

function updateMaterial(fen) {
    let temp = new Chess(fen);
    let board = temp.board();
    let vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let startCounts = { w: { p:8, n:2, b:2, r:2, q:1 }, b: { p:8, n:2, b:2, r:2, q:1 } };
    let currCounts = { w: { p:0, n:0, b:0, r:0, q:0 }, b: { p:0, n:0, b:0, r:0, q:0 } };
    let wScore = 0, bScore = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c];
            if (p && p.type !== 'k') { currCounts[p.color][p.type]++; if (p.color === 'w') wScore += vals[p.type]; else bScore += vals[p.type]; }
        }
    }
    const icons = { w: { p:'♙', n:'♘', b:'♗', r:'♖', q:'♕' }, b: { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛' } };
    let capByWhite = "", capByBlack = "";
    ['p', 'n', 'b', 'r', 'q'].forEach(t => {
        capByWhite += icons.b[t].repeat(Math.max(0, startCounts.b[t] - currCounts.b[t]));
        capByBlack += icons.w[t].repeat(Math.max(0, startCounts.w[t] - currCounts.w[t]));
    });
    let diff = wScore - bScore;
    if (diff > 0) capByWhite += ` <span class="adv-badge">+${diff}</span>`;
    if (diff < 0) capByBlack += ` <span class="adv-badge">+${Math.abs(diff)}</span>`;
    if (currentBoardOrientation === 'w') { safeHtml('bottom-captured', capByWhite); safeHtml('top-captured', capByBlack); }
    else { safeHtml('top-captured', capByWhite); safeHtml('bottom-captured', capByBlack); }
}

function finishMatchWithAnimation(winnerColor, reasonType, title, subtitle, alreadyPlayedGameEndSound = false) {
    if (matchEnded) return;
    matchEnded = true;
    stopAllActiveMatchProcesses();
    gameEndEffect = { winner: winnerColor, reason: reasonType };
    if (!alreadyPlayedGameEndSound) playSnd('gameover');
    syncOptionalPanelsVisibility();
    renderBoard();
    if (window.updateCareerRatingOnGameEnd) window.updateCareerRatingOnGameEnd(winnerColor);
    localStorage.removeItem('chess_active_match');
    if (gameOverModalTimerId) clearTimeout(gameOverModalTimerId);
    gameOverModalTimerId = setTimeout(() => {
        playSnd('notify');
        triggerGameOverSequence(title, subtitle);
    }, 1250);
}

function startTimer() {
    clearInterval(timerInterval);
    if (isInfiniteTime) return;
    timerInterval = setInterval(() => {
        if (isMatchOver() || isAnalysisBranchMode) { clearInterval(timerInterval); return; }
        if (game.turn() === 'w') {
            whiteTime--;
            if (whiteTime === 10) playSnd('tenseconds');
            if (whiteTime <= 0) {
                whiteTime = 0; updateTimer();
                let bName = getBlackDisplayName();
                $('#status').text(`Time Out! ${bName} Wins on Time.`);
                finishMatchWithAnimation('b', 'timeout', "Time Out!", `${bName} won on time.`, false);
                return;
            }
        } else {
            blackTime--;
            if (blackTime === 10) playSnd('tenseconds');
            if (blackTime <= 0) {
                blackTime = 0; updateTimer();
                let wName = getWhiteDisplayName();
                $('#status').text(`Time Out! ${wName} Wins on Time.`);
                finishMatchWithAnimation('w', 'timeout', "Time Out!", `${wName} won on time.`, false);
                return;
            }
        }
        updateTimer();
    }, 1000);
}

function formatSec(sec) {
    if (isInfiniteTime) return "∞";
    let m = Math.floor(sec / 60), s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}
function updateTimer() {
    let wStr = formatSec(whiteTime), bStr = formatSec(blackTime);
    if (currentBoardOrientation === 'w') { safeText('bottom-timer', wStr); safeText('top-timer', bStr); }
    else { safeText('top-timer', wStr); safeText('bottom-timer', bStr); }
}

function updateStatus() {
    if (matchEnded) return;
    if (game.in_checkmate()) {
        let winnerColor = (game.turn() === 'w') ? 'b' : 'w';
        let winnerName = (winnerColor === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
        $('#status').text(`Checkmate! ${winnerName} Wins.`);
        finishMatchWithAnimation(winnerColor, 'checkmate', "Checkmate!", `${winnerName} won by checkmate.`, true);
    } else if (game.in_draw()) {
        let reason = "Draw";
        if (game.in_stalemate()) reason = "Stalemate";
        else if (game.in_threefold_repetition()) reason = "Threefold Repetition";
        else if (game.insufficient_material()) reason = "Insufficient Material";
        $('#status').text(reason);
        finishMatchWithAnimation('draw', 'draw', "Match Drawn", reason, true);
    } else {
        let chk = game.in_check() ? " (Check)" : "";
        if (isAnalysisBranchMode) {
            $('#status').text(`Analysis Mode (${game.turn() === 'w' ? 'White' : 'Black'} to move)${chk}`);
        } else if (isAutoBotMode()) {
            $('#status').text(`${game.turn() === 'w' ? getWhiteDisplayName() : getBlackDisplayName()} to move${chk}`);
        } else if (gameMode === 'pvp') {
            $('#status').text(`${game.turn() === 'w' ? 'White' : 'Black'}'s turn${chk}`);
        } else {
            $('#status').text((game.turn() === playerColor ? "Your turn" : "Opponent's turn") + chk);
        }
    }
}

function triggerGameOverSequence(title, subtitle) {
    syncEloBadgeVisibility();
    if (window.updateAccuracySummary) window.updateAccuracySummary();
    if (window.saveCurrentMatchToVault) window.saveCurrentMatchToVault(title);
    safeText('modal-title', title);
    safeText('modal-subtitle', subtitle);
    safeText('modal-p1-text', getWhiteDisplayName());
    safeText('modal-p2-text', getBlackDisplayName());
    safeDisplay('game-modal', 'flex');
}

window.handleModalBtn = function() { closeModal('game-modal'); openSetupModal(); };

window.startGame = function(fromSetup = false) {
    if (window.openingPracticeState) {
        if (openingPracticeState.demoTimer) clearInterval(openingPracticeState.demoTimer);
        openingPracticeState.active = false;
        openingPracticeState.mode = "none";
    }
    stopAllActiveMatchProcesses();
    if (gameOverModalTimerId) { clearTimeout(gameOverModalTimerId); gameOverModalTimerId = null; }
    timerStarted = false; isAnalysisBranchMode = false; currentMatchSaved = false;
    matchEnded = false; gameEndEffect = null;
    selectedSquare = null; currentLegalMoves = []; premoveQueue = []; clearArrows();
    hideGhostPiece();

    // Reset to Player vs Bot if started directly from New Game
    if (!fromSetup) {
        gameMode = 'pvb';
        playerColor = 'w';
        currentBoardOrientation = 'w';
    }

    // Naye match ka unique session ID lock
    window.currentMatchSessionId = "match_" + Date.now();
    localStorage.setItem('chess_current_session_id', window.currentMatchSessionId);
    localStorage.removeItem('chess_active_match');
    window.currentActiveMatchDbId = null;
    localStorage.removeItem('chess_current_db_id');

    game.reset();
    let initEv = window.computeInstantEvalFromFen ? window.computeInstantEvalFromFen(game.fen()) : { score: 50.0, text: "0.0", cp: 0 };
    gameHistory = [{
        fen: game.fen(), move: null, moveObj: null, soundType: 'move',
        evalScore: initEv.score, evalText: initEv.text, cp: 0, bestMoveUci: "", bestMoveSan: ""
    }];
    historyIndex = 0;
    syncEloBadgeVisibility();
    syncOptionalPanelsVisibility();
    if (window.updateOpeningExplorer) window.updateOpeningExplorer();
    updateTimer(); updateEvalBar(0); updateMaterial(game.fen()); renderBoard();
    if (window.drawAllEvalGraphs) window.drawAllEvalGraphs();
    updateStatus(); playSnd('start');

    if (isAutoBotMode() || (gameMode === 'pvb' && game.turn() !== playerColor)) {
        timerStarted = true; startTimer();
        aiMoveTimerId = setTimeout(makeAiMove, 300);
    }
};

window.flipBoardUI = function() {
    currentBoardOrientation = (currentBoardOrientation === 'w') ? 'b' : 'w';
    let topLbl = getTextSafe('top-player-label'), botLbl = getTextSafe('bottom-player-label');
    let topNm = getTextSafe('top-player-name'), botNm = getTextSafe('bottom-player-name');
    safeText('top-player-label', botLbl); safeText('bottom-player-label', topLbl);
    safeText('top-player-name', botNm); safeText('bottom-player-name', topNm);
    syncEloBadgeVisibility();
    updateTimer(); updateEvalBar(historyIndex); updateMaterial(gameHistory[historyIndex].fen); renderBoard();
};

window.takebackMove = function() {
    if (gameHistory.length <= 1) return;
    premoveQueue = []; matchEnded = false; gameEndEffect = null;
    let steps = (gameMode === 'pvb' && game.turn() === playerColor && gameHistory.length >= 3) ? 2 : 1;
    for (let i = 0; i < steps; i++) { game.undo(); gameHistory.pop(); }
    historyIndex = gameHistory.length - 1; selectedSquare = null; currentLegalMoves = []; clearArrows();
    playSoundForHistoryRec(gameHistory[historyIndex]);
    updateEvalBar(historyIndex); updateMaterial(game.fen());
    if (window.updateOpeningExplorer) window.updateOpeningExplorer();
    renderBoard(); if (window.drawAllEvalGraphs) window.drawAllEvalGraphs(); updateStatus();
    autoSaveCurrentState();
};

window.goToStart = function() {
    historyIndex = 0; selectedSquare = null; currentLegalMoves = [];
    playSnd('move'); renderBoard(); showAnalysisStatus();
    if (window.drawAllEvalGraphs) window.drawAllEvalGraphs();
};

window.goBackward = function() {
    if (historyIndex > 0) {
        historyIndex--;
        selectedSquare = null; currentLegalMoves = [];
        let rec = gameHistory[historyIndex];
        playSoundForHistoryRec(rec);
        renderBoard();
        showAnalysisStatus();
        if (window.drawAllEvalGraphs) window.drawAllEvalGraphs();
    }
};

window.goForward = function() {
    if (historyIndex < gameHistory.length - 1) {
        historyIndex++;
        selectedSquare = null; currentLegalMoves = [];
        let rec = gameHistory[historyIndex];
        playSoundForHistoryRec(rec);
        renderBoard();
        showAnalysisStatus();
        if (window.drawAllEvalGraphs) window.drawAllEvalGraphs();
    }
};

window.goLive = function() {
    historyIndex = gameHistory.length - 1; selectedSquare = null; currentLegalMoves = []; clearArrows();
    let rec = gameHistory[historyIndex];
    playSoundForHistoryRec(rec);
    renderBoard();
    updateEvalBar(historyIndex); updateMaterial(game.fen());
    if (window.drawAllEvalGraphs) window.drawAllEvalGraphs(); updateStatus();
};

function showAnalysisStatus() {
    clearArrows(); updateEvalBar(historyIndex); updateMaterial(gameHistory[historyIndex].fen);
    if (window.updateOpeningExplorer) window.updateOpeningExplorer();
    if (historyIndex === 0) { $('#status').text("Start of Game (Tap Hint or move a piece to analyze)"); return; }
    let rec = gameHistory[historyIndex];
    if (rec && rec.moveObj) {
        let clsTxt = rec.classification ? ` (${rec.classification.label})` : "";
        let bestTxt = rec.bestMoveSan ? ` • Best was ${rec.bestMoveSan}` : "";
        $('#status').text(`Move ${historyIndex}: ${rec.moveObj.san}${clsTxt}${bestTxt}`);
    }
}

// ============================================================================
// FRONT CONTROLS: RESIGN, OFFER DRAW, HINT, MENU & FULLSCREEN
// ============================================================================

window.resignGame = function() {
    if (isMatchOver()) return;
    let winnerColor = (game.turn() === 'w') ? 'b' : 'w';
    let winnerName = (winnerColor === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
    let loserName = (winnerColor === 'w') ? getBlackDisplayName() : getWhiteDisplayName();
    $('#status').text(`${loserName} resigned. ${winnerName} Wins.`);
    finishMatchWithAnimation(winnerColor, 'resignation', "Resignation", `${loserName} resigned. ${winnerName} won.`, false);
    if (window.AndroidBridge && window.AndroidBridge.handleResign) {
        try { window.AndroidBridge.handleResign(); } catch (e) {}
    }
};

window.offerDrawToBot = function() {
    if (isMatchOver()) return;
    if (gameMode === 'pvp') {
        $('#status').text("Draw agreed between players.");
        finishMatchWithAnimation('draw', 'draw', "Match Drawn", "Draw agreed between players.", false);
        if (window.AndroidBridge && window.AndroidBridge.handleOfferDraw) {
            try { window.AndroidBridge.handleOfferDraw(true); } catch (e) {}
        }
        return;
    }
    // In PvB mode: bot evaluates position
    let currCp = 0;
    let lastRec = gameHistory[gameHistory.length - 1];
    if (lastRec && lastRec.cp !== undefined) currCp = lastRec.cp;
    if (Math.abs(currCp) <= 120 || gameHistory.length >= 50) {
        $('#status').text("Draw offer accepted by opponent.");
        finishMatchWithAnimation('draw', 'draw', "Match Drawn", "Opponent accepted the draw offer.", false);
    } else {
        $('#status').text("Opponent declined the draw offer.");
        if (typeof showAndroidToast === 'function') showAndroidToast("Opponent declined the draw offer.");
    }
    if (window.AndroidBridge && window.AndroidBridge.handleOfferDraw) {
        try { window.AndroidBridge.handleOfferDraw(false); } catch (e) {}
    }
};

window.requestHint = function() {
    if (isMatchOver() || (gameMode === 'pvb' && game.turn() !== playerColor)) return;
    let lastRec = gameHistory[gameHistory.length - 1];
    if (lastRec && lastRec.bestMoveUci && lastRec.bestMoveUci.length >= 4) {
        let from = lastRec.bestMoveUci.substring(0, 2);
        let to = lastRec.bestMoveUci.substring(2, 4);
        selectedSquare = from;
        currentLegalMoves = game.moves({ square: from, verbose: true });
        updateSelectionAndDotsInPlace();
        let fromCoord = sqToSvgCoords(from), toCoord = sqToSvgCoords(to);
        let svg = safeEl('arrow-overlay');
        if (svg) {
            svg.innerHTML = `<line x1="${fromCoord.x}" y1="${fromCoord.y}" x2="${toCoord.x}" y2="${toCoord.y}" stroke="#f0c15c" stroke-width="4.5" stroke-linecap="round" opacity="0.9" />`;
        }
        $('#status').text(`Hint: ${lastRec.bestMoveSan || lastRec.bestMoveUci}`);
    } else {
        $.post('/eval', { fen: game.fen(), depth: 14, time: 0.15 }, function(data) {
            if (data && data.best_uci && data.best_uci.length >= 4) {
                let from = data.best_uci.substring(0, 2);
                let to = data.best_uci.substring(2, 4);
                selectedSquare = from;
                currentLegalMoves = game.moves({ square: from, verbose: true });
                updateSelectionAndDotsInPlace();
                let fromCoord = sqToSvgCoords(from), toCoord = sqToSvgCoords(to);
                let svg = safeEl('arrow-overlay');
                if (svg) {
                    svg.innerHTML = `<line x1="${fromCoord.x}" y1="${fromCoord.y}" x2="${toCoord.x}" y2="${toCoord.y}" stroke="#f0c15c" stroke-width="4.5" stroke-linecap="round" opacity="0.9" />`;
                }
                $('#status').text(`Hint: ${data.best_san || data.best_uci}`);
            }
        });
    }
};

window.openToolsMenuModal = function() {
    if (window.toggleSidebarDrawer) window.toggleSidebarDrawer(true);
};

window.openDeepReport = function() {
    safeDisplay('kundli-modal', 'flex');
    if (window.runDeepKundliScan) window.runDeepKundliScan(false);
};

window.toggleSidebarDrawer = function(force) {
    let drawer = safeEl('chess-sidebar-drawer');
    let backdrop = safeEl('sidebar-backdrop');
    if (!drawer) return;
    let isOpen = drawer.classList.contains('open');
    let shouldOpen = (force !== undefined) ? force : !isOpen;
    if (shouldOpen) {
        drawer.classList.add('open');
        if (backdrop) backdrop.style.display = 'block';
    } else {
        drawer.classList.remove('open');
        if (backdrop) backdrop.style.display = 'none';
    }
};

window.toggleDrawMode = function() {
    drawModeEnabled = !drawModeEnabled;
    safeDisplay('draw-palette-bar', drawModeEnabled ? 'flex' : 'none');
    let canvas = safeEl('custom-draw-overlay');
    if (canvas) {
        if (drawModeEnabled) canvas.classList.add('drawing-active');
        else canvas.classList.remove('drawing-active');
    }
};

window.toggleFocusMode = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        document.body.classList.add('focus-fullscreen-mode');
    } else {
        document.exitFullscreen().catch(() => {});
        document.body.classList.remove('focus-fullscreen-mode');
    }
    syncOptionalPanelsVisibility();
};

window.togglePremoveMode = function() {
    premoveEnabled = !premoveEnabled;
    safeText('sidebar-premove-val', premoveEnabled ? 'ON' : 'OFF');
    let vEl = safeEl('sidebar-premove-val');
    if (vEl) vEl.style.color = premoveEnabled ? '#81b64c' : '#ca3431';
    if (!premoveEnabled) premoveQueue = [];
};

window.resetCareerRating = function() {
    localStorage.setItem('chess_player_elo', "1200");
    safeText('sidebar-elo-val', "1200 ELO");
    safeText('live-player-elo-pill', "1200 ELO");
    if (typeof showAndroidToast === 'function') showAndroidToast("Rating reset to 1200 ELO");
};

// ============================================================================
// SINGLE-MATCH IN-PLACE STATE SAVE (NO CLOUD DUPLICATE SPAM)
// ============================================================================

function autoSaveCurrentState() {
    if (isMatchOver()) {
        localStorage.removeItem('chess_active_match');
        return;
    }
    let state = {
        sessionId: window.currentMatchSessionId || ("match_" + Date.now()),
        fen: game.fen(),
        gameHistory: gameHistory,
        historyIndex: historyIndex,
        whiteTime: whiteTime,
        blackTime: blackTime,
        playerColor: playerColor,
        currentBoardOrientation: currentBoardOrientation,
        gameMode: gameMode,
        timerStarted: timerStarted
    };
    window.currentMatchSessionId = state.sessionId;
    localStorage.setItem('chess_current_session_id', state.sessionId);
    localStorage.setItem('chess_active_match', JSON.stringify(state));

    // Debounce save: fast moves hone par multiple cloud calls nahi hongi, sirf 1 clean call jayegi
    if (gameHistory.length >= 2 && window.saveCurrentMatchToVault) {
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            window.saveCurrentMatchToVault("In Progress");
        }, 700);
    }
}

function autoResumePreviousMatch() {
    let raw = localStorage.getItem('chess_active_match');
    if (!raw) return false;
    try {
        let state = JSON.parse(raw);
        if (!state || !state.fen) return false;

        gameMode = state.gameMode || 'pvb';
        playerColor = state.playerColor || 'w';
        currentBoardOrientation = state.currentBoardOrientation || playerColor;

        game.load(state.fen);
        gameHistory = state.gameHistory || [{ fen: state.fen, moveObj: null }];
        historyIndex = state.historyIndex !== undefined ? state.historyIndex : gameHistory.length - 1;
        whiteTime = state.whiteTime || 600;
        blackTime = state.blackTime || 600;
        timerStarted = state.timerStarted || false;
        window.currentMatchSessionId = state.sessionId || ("match_" + Date.now());
        localStorage.setItem('chess_current_session_id', window.currentMatchSessionId);

        renderBoard();
        updateTimer();
        updateEvalBar(historyIndex);
        updateMaterial(game.fen());
        updateStatus();
        syncEloBadgeVisibility();

        if (timerStarted && !isMatchOver()) {
            startTimer();
        }
        $('#status').text("Game resumed from active session.");

        // AI move ONLY if it's bot's turn!
        if (!isMatchOver() && !isAnalysisBranchMode) {
            if (isAutoBotMode()) {
                aiMoveTimerId = setTimeout(makeAiMove, 600);
            } else if (gameMode === 'pvb' && game.turn() !== playerColor) {
                aiMoveTimerId = setTimeout(makeAiMove, 600);
            }
        }
        return true;
    } catch (e) {
        localStorage.removeItem('chess_active_match');
        return false;
    }
}

// ============================================================================
// INITIALIZATION ON READY
// ============================================================================

$(document).ready(function() {
    preloadAllSounds();
    bindPieceDragAndDropEvents();
    document.body.addEventListener('touchstart', () => getAudioCtx(), { once: true });
    document.body.addEventListener('click', () => getAudioCtx(), { once: true });

    $('head').append(`
        <style>
            .square.selected .piece {
                transform: scale(1.20) !important;
                transition: transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1.4) !important;
                filter: drop-shadow(0 6px 12px rgba(0,0,0,0.55)) !important;
            }
            .dragging-source-piece {
                opacity: 0.20 !important;
                filter: grayscale(60%) !important;
            }
        </style>
    `);

    let savedTheme = localStorage.getItem('saved_chess_theme');
    if (savedTheme) {
        let sel = safeEl('setting-board-theme');
        if (sel) sel.value = savedTheme;
        document.body.className = document.body.className.replace(/\btheme-[^\s]+\b/g, '').trim();
        document.body.classList.add(savedTheme);
    }

    let savedPieces = localStorage.getItem('saved_chess_piece_style');
    if (savedPieces) {
        let pSel = safeEl('setting-piece-style');
        if (pSel) pSel.value = savedPieces;
    }

    let resumed = autoResumePreviousMatch();
    if (!resumed) {
        renderBoard();
        updateTimer();
        updateEvalBar(0);
        updateMaterial(game.fen());
        updateStatus();
    }
});
