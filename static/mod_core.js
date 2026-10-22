/* ============================================================================
   static/mod_core.js (v104 - Engine Core & Touch Controller)
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

window.playSoundForMove = function(moveObj) {
    let snd = detectMoveSoundType(game, moveObj);
    playSnd(snd);
};

function isAutoBotMode() { return gameMode === 'bvb' || gameMode === 'eve'; }
function isMatchOver() { 
    if (window.activePuzzle && window.activePuzzle.isRunning) return false;
    return matchEnded || game.game_over(); 
}

function stopAllActiveMatchProcesses() {
    clearInterval(timerInterval); timerInterval = null;
    if (aiMoveTimerId) { clearTimeout(aiMoveTimerId); aiMoveTimerId = null; }
    if (activeAiXhr && activeAiXhr.abort) {
        try { activeAiXhr.abort(); } catch (e) {}
        activeAiXhr = null;
    }
    premoveQueue = [];
}
window.stopAllActiveMatchProcesses = stopAllActiveMatchProcesses;

function safeEl(id) { return document.getElementById(id); }
function safeText(ids, text) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.innerText = text; }); }
function safeHtml(ids, html) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.innerHTML = html; }); }
function safeDisplay(ids, disp) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.style.display = disp; }); }
function getTextSafe(id, fallback = "") { let el = safeEl(id); return (el && el.innerText) ? el.innerText.trim() : fallback; }
function getWhiteDisplayName() { return getTextSafe('top-player-label', '') === 'White' ? getTextSafe('top-player-name', 'White') : getTextSafe('bottom-player-name', 'White'); }
function getBlackDisplayName() { return getTextSafe('top-player-label', '') === 'Black' ? getTextSafe('top-player-name', 'Black') : getTextSafe('bottom-player-name', 'Black'); }

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
    safeDisplay('setup-modal', 'flex');
};
window.openSettingsModal = function() {
    if (window.refreshEngineListInSettings) window.refreshEngineListInSettings();
    safeDisplay('settings-modal', 'flex');
};
window.toggleSetupMode = function() {
    let m = (safeEl('setup-mode') || {}).value || 'pvb';
    safeDisplay('setup-autoflip-group', m === 'pvp' ? 'flex' : 'none');
    safeDisplay('setup-username-group', (m === 'pvb' || m === 'pvp') ? 'flex' : 'none');
    safeDisplay('setup-color-group', m === 'pvb' ? 'flex' : 'none');
    safeDisplay('setup-white-bot-group', m === 'bvb' ? 'flex' : 'none');
    safeDisplay('setup-black-bot-group', (m === 'pvb' || m === 'bvb') ? 'flex' : 'none');
    safeDisplay('setup-eve-group', m === 'eve' ? 'flex' : 'none');
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

function getPieceImageUrl(color, type) {
    let pStyle = (safeEl('setting-piece-style') || {}).value || 'wikipedia';
    let urlTemplate = pieceThemeUrls[pStyle] || pieceThemeUrls['wikipedia'];
    return urlTemplate.replace('{piece}', color + type.toUpperCase());
}

function updateSelectionAndDotsInPlace() {
    $('.square').removeClass('selected');$('.legal-dot, .legal-capture').remove();
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
    let tempGame = new Chess(displayFen);
    let boardState = tempGame.board();
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let lastMove = (historyIndex > 0 && gameHistory[historyIndex]) ? gameHistory[historyIndex].move : null;

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

            let moveOption = currentLegalMoves.find(m => m.to === sqName);
            if (moveOption) {
                sqDiv.append($('<div>').addClass(moveOption.flags && (moveOption.flags.includes('c') || moveOption.flags.includes('e')) ? 'legal-capture' : 'legal-dot'));
            }
            let piece = boardState[boardRow][boardCol];
            if (piece) {
                if (piece.type === 'k' && tempGame.in_check() && tempGame.turn() === piece.color) sqDiv.addClass('in-check');
                let pieceDiv = $('<div>').addClass('piece').css('background-image', `url('${getPieceImageUrl(piece.color, piece.type)}')`);
                sqDiv.append(pieceDiv);
            }
            boardEl.append(sqDiv);
        }
    }
}

var dragPieceState = { active: false, fromSq: null, currentSq: null, isPremoveDrag: false };

function getBoardSquareFromPoint(clientX, clientY) {
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

function showGhostPiece(imgUrl, clientX, clientY) {
    let ghost = document.getElementById('drag-ghost-piece');
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'drag-ghost-piece';
        document.body.appendChild(ghost);
    }
    if (imgUrl) ghost.style.backgroundImage = `url('${imgUrl}')`;
    ghost.style.display = 'block';
    ghost.style.left = clientX + 'px';
    ghost.style.top = clientY + 'px';
}

function hideGhostPiece() {
    let ghost = document.getElementById('drag-ghost-piece');
    if (ghost) ghost.style.display = 'none';
    $('.square').removeClass('drag-target-hover');$('.square .piece').removeClass('dragging-source-piece');
}

function handleBoardPointerDown(sq, clientX, clientY) {
    if (drawModeEnabled || !sq) return false;
    if (window.clearCustomAnnotations) window.clearCustomAnnotations();

    let inPuzzle = Boolean(window.activePuzzle && window.activePuzzle.isRunning);

    if (selectedSquare && sq !== selectedSquare && currentLegalMoves.find(m => m.to === sq)) {
        executeHumanMove(selectedSquare, sq);
        return true;
    }

    let piece = game.get(sq);
    if (piece && piece.color === game.turn()) {
        if (gameMode === 'pvb' && !isAnalysisBranchMode && !inPuzzle && piece.color !== playerColor) return false;
        selectedSquare = sq;
        currentLegalMoves = game.moves({ square: sq, verbose: true });
        updateSelectionAndDotsInPlace();
        $(`.square[data-square="${sq}"] .piece`).addClass('dragging-source-piece');
        showGhostPiece(getPieceImageUrl(piece.color, piece.type), clientX, clientY);
        $(`.square[data-square="${sq}"]`).addClass('drag-target-hover');
        dragPieceState.active = true;
        dragPieceState.fromSq = sq;
        dragPieceState.currentSq = sq;
        return true;
    } else {
        selectedSquare = null;
        currentLegalMoves = [];
        updateSelectionAndDotsInPlace();
        return false;
    }
}

function handleBoardPointerMove(clientX, clientY) {
    if (!dragPieceState.active) return;
    showGhostPiece(null, clientX, clientY);
    let hoverSq = getBoardSquareFromPoint(clientX, clientY);
    if (hoverSq !== dragPieceState.currentSq) {
        dragPieceState.currentSq = hoverSq;
        $('.square').removeClass('drag-target-hover');
        if (hoverSq) $(`.square[data-square="${hoverSq}"]`).addClass('drag-target-hover');
    }
}

function handleBoardPointerUp(clientX, clientY) {
    if (!dragPieceState.active) return;
    let dropSq = getBoardSquareFromPoint(clientX, clientY) || dragPieceState.currentSq;
    let fromSq = dragPieceState.fromSq;

    dragPieceState.active = false;
    hideGhostPiece();

    if (dropSq && dropSq !== fromSq) {
        let validMove = currentLegalMoves.find(m => m.to === dropSq);
        if (validMove) {
            executeHumanMove(fromSq, dropSq);
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
        if (e.touches && e.touches.length === 1) {
            let t = e.touches[0];
            let sq = getBoardSquareFromPoint(t.clientX, t.clientY);
            if (sq) { e.preventDefault(); handleBoardPointerDown(sq, t.clientX, t.clientY); }
        }
    }, { passive: false });

    window.addEventListener('touchmove', function(e) {
        if (!dragPieceState.active) return;
        if (e.touches && e.touches.length === 1) {
            e.preventDefault();
            handleBoardPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', function(e) {
        if (!dragPieceState.active) return;
        let t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : { clientX: 0, clientY: 0 };
        handleBoardPointerUp(t.clientX, t.clientY);
    }, { passive: false });

    boardEl.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        getAudioCtx();
        let sq = getBoardSquareFromPoint(e.clientX, e.clientY);
        if (sq) { e.preventDefault(); handleBoardPointerDown(sq, e.clientX, e.clientY); }
    });

    window.addEventListener('mousemove', function(e) {
        if (!dragPieceState.active) return;
        handleBoardPointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', function(e) {
        if (!dragPieceState.active) return;
        handleBoardPointerUp(e.clientX, e.clientY);
    });
}

function executeHumanMove(fromSq, toSq, promoPiece = null) {
    let inPuzzle = Boolean(window.activePuzzle && window.activePuzzle.isRunning);
    if (!isAnalysisBranchMode && !inPuzzle && isMatchOver()) return;

    let moveObj = game.move({ from: fromSq, to: toSq, promotion: promoPiece || 'q' });
    if (!moveObj) { playSnd('illegal'); return; }
    selectedSquare = null; currentLegalMoves = []; clearArrows();

    let sndType = detectMoveSoundType(game, moveObj);
    gameHistory.push({ fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj, soundType: sndType });
    historyIndex = gameHistory.length - 1;

    // PUZZLE INTERCEPTOR: Validate move and auto-reply
    if (inPuzzle) {
        playSoundForHistoryRec(gameHistory[historyIndex]);
        renderBoard();
        let uci = moveObj.from + moveObj.to + (moveObj.promotion || '');
        if (window.checkPuzzlePlayerMove) {
            window.checkPuzzlePlayerMove(uci);
        }
        return;
    }

    processMoveVisuals(moveObj, historyIndex);

    if (!isAnalysisBranchMode && !isMatchOver() && (isAutoBotMode() || (gameMode === 'pvb' && game.turn() !== playerColor))) {
        if (aiMoveTimerId) clearTimeout(aiMoveTimerId);
        aiMoveTimerId = setTimeout(makeAiMove, 120);
    }
}

function makeAiMove() {
    if (isAnalysisBranchMode || isMatchOver() || (window.activePuzzle && window.activePuzzle.isRunning)) return;
    let turnSide = game.turn();
    let botElo = currentBlackElo;

    $.ajax({
        url: '/ai_move', method: 'POST',
        data: { fen: game.fen(), level: botElo, think_time: engineThinkTime, depth: engineMaxDepth, _t: Date.now() },
        success: function(data) {
            if (!data || !data.move || isAnalysisBranchMode || isMatchOver()) return;
            let mObj = game.move(data.move, { sloppy: true });
            if (!mObj) return;
            let sndType = detectMoveSoundType(game, mObj);
            gameHistory.push({ fen: game.fen(), move: { from: mObj.from, to: mObj.to }, moveObj: mObj, soundType: sndType });
            historyIndex = gameHistory.length - 1;
            processMoveVisuals(mObj, historyIndex);
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
}

function updateStatus() {
    if (window.activePuzzle && window.activePuzzle.isRunning) return;
    if (game.in_checkmate()) {
        let winnerName = (game.turn() === 'w') ? getBlackDisplayName() : getWhiteDisplayName();
        $('#status').text(`Checkmate! ${winnerName} Wins.`);
        triggerGameOverSequence("Checkmate!", `${winnerName} won by checkmate.`);
    } else if (game.in_draw()) {
        $('#status').text("Draw");
        triggerGameOverSequence("Match Drawn", "Game drawn.");
    } else {
        $('#status').text(game.turn() === 'w' ? "White's turn" : "Black's turn");
    }
}

function triggerGameOverSequence(title, subtitle) {
    matchEnded = true;
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

window.goToStart = function() { historyIndex = 0; renderBoard(); };
window.goBackward = function() { if (historyIndex > 0) { historyIndex--; renderBoard(); } };
window.goForward = function() { if (historyIndex < gameHistory.length - 1) { historyIndex++; renderBoard(); } };
window.goLive = function() { historyIndex = gameHistory.length - 1; renderBoard(); };

window.flipBoardUI = function() {
    currentBoardOrientation = (currentBoardOrientation === 'w') ? 'b' : 'w';
    renderBoard();
};

$(document).ready(function() {
    preloadAllSounds();
    bindPieceDragAndDropEvents();
    document.body.addEventListener('touchstart', () => getAudioCtx(), { once: true });
    document.body.addEventListener('click', () => getAudioCtx(), { once: true });
});
