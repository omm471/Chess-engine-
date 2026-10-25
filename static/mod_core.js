/* ============================================================================
   static/mod_core.js (v114 - Clean Names, Instant Resign & Safe Resume)
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

window.currentMatchSessionId = localStorage.getItem('chess_current_session_id') || ("match_" + Date.now());

var gameHistory = [{
    fen: game.fen(), move: null, moveObj: null, soundType: 'move',
    evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
}];
var historyIndex = 0;

var premoveEnabled = true;
var premoveQueue = [];
var isAnalysisBranchMode = false;
var soundEnabled = true;
var showEvalBar = true;
var engineThinkTime = 0.8;
var engineMaxDepth = 20;

const defaultBotNames = {
    "1000": "Casual Bot", "1500": "Club Master",
    "2000": "Grandmaster AI", "2500": "Stockfish GM", "2800": "Stockfish Max"
};

const pieceThemeUrls = {
    "wikipedia": "/static/img/chesspieces/wikipedia/{piece}.png"
};

function safeEl(id) { return document.getElementById(id); }
function safeText(ids, text) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.innerText = text; }); }
function safeDisplay(ids, disp) { (Array.isArray(ids) ? ids : [ids]).forEach(id => { let el = safeEl(id); if (el) el.style.display = disp; }); }
function getTextSafe(id, fallback = "") { let el = safeEl(id); return (el && el.innerText) ? el.innerText.trim() : fallback; }

function getWhiteDisplayName() {
    let lbl = getTextSafe('top-player-label', '');
    return lbl.includes('White') ? getTextSafe('top-player-name', 'Player 1') : getTextSafe('bottom-player-name', 'Player 1');
}

function getBlackDisplayName() {
    let lbl = getTextSafe('top-player-label', '');
    return lbl.includes('Black') ? getTextSafe('top-player-name', 'Stockfish 16.1') : getTextSafe('bottom-player-name', 'Stockfish 16.1');
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

window.closeModal = function(id) { safeDisplay(id, 'none'); };

window.openSetupModal = function() {
    toggleSetupMode();
    safeDisplay('setup-modal', 'flex');
};

window.toggleSetupMode = function() {
    let m = (safeEl('setup-mode') || {}).value || 'pvb';
    let isPvP = (m === 'pvp');
    safeDisplay('setup-pvp-group', isPvP ? 'flex' : 'none');
    safeDisplay('setup-autoflip-group', isPvP ? 'block' : 'none');
    safeDisplay('setup-username-group', isPvP ? 'none' : 'block');
    safeDisplay('setup-color-group', isPvP ? 'none' : 'block');
    safeDisplay('setup-black-bot-group', isPvP ? 'none' : 'block');
};

// CLEAN APPLY SETUP: Board par bina kisi ' 1' ya 'Player 2' ke sahi naam lagata hai
window.applySetupAndStart = function() {
    let m = (safeEl('setup-mode') || {}).value || 'pvb';
    gameMode = m;

    let timeVal = (safeEl('setup-time') || {}).value || "10|0";
    if (timeVal === "0|0") {
        isInfiniteTime = true;
    } else {
        isInfiniteTime = false;
        let parts = timeVal.split('|');
        whiteTime = parseInt(parts[0]) * 60;
        blackTime = whiteTime;
        whiteIncrement = parseInt(parts[1] || 0);
        blackIncrement = whiteIncrement;
    }

    if (gameMode === 'pvp') {
        let wName = (safeEl('setup-pvp-white') || {}).value || 'Player 1';
        let bName = (safeEl('setup-pvp-black') || {}).value || 'Player 2';
        playerColor = 'w';
        currentBoardOrientation = 'w';
        autoFlipPvP = ((safeEl('setup-autoflip') || {}).value === 'on');

        safeText('bottom-player-label', 'White:');
        safeText('bottom-player-name', wName.trim());
        safeText('top-player-label', 'Black:');
        safeText('top-player-name', bName.trim());
    } else {
        let uName = (safeEl('setup-username') || {}).value || 'Player';
        let selectedColor = $('input[name="play_color"]:checked').val() || 'w';
        playerColor = selectedColor;
        currentBoardOrientation = selectedColor;

        let botElo = (safeEl('setup-black-bot') || {}).value || "2500";
        currentBlackElo = botElo;
        let botName = defaultBotNames[botElo] || "Stockfish 16.1";

        if (playerColor === 'w') {
            safeText('bottom-player-label', 'White:');
            safeText('bottom-player-name', uName.trim());
            safeText('top-player-label', 'Black:');
            safeText('top-player-name', botName);
        } else {
            safeText('bottom-player-label', 'Black:');
            safeText('bottom-player-name', uName.trim());
            safeText('top-player-label', 'White:');
            safeText('top-player-name', botName);
        }
    }

    closeModal('setup-modal');
    window.startGame(true);
};

window.startGame = function(fromSetup = false) {
    stopAllActiveMatchProcesses();
    if (gameOverModalTimerId) { clearTimeout(gameOverModalTimerId); gameOverModalTimerId = null; }
    timerStarted = false; isAnalysisBranchMode = false;
    matchEnded = false; gameEndEffect = null;
    selectedSquare = null; currentLegalMoves = []; premoveQueue = [];

    window.currentMatchSessionId = "match_" + Date.now();
    localStorage.setItem('chess_current_session_id', window.currentMatchSessionId);
    localStorage.removeItem('chess_active_match');
    window.currentActiveMatchDbId = null;

    game.reset();
    gameHistory = [{
        fen: game.fen(), move: null, moveObj: null, soundType: 'move',
        evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
    }];
    historyIndex = 0;

    updateTimer();
    renderBoard();
    updateStatus();

    if (gameMode === 'pvb' && game.turn() !== playerColor) {
        timerStarted = true;
        startTimer();
        aiMoveTimerId = setTimeout(makeAiMove, 350);
    }
};

window.flipBoardUI = function() {
    currentBoardOrientation = (currentBoardOrientation === 'w') ? 'b' : 'w';
    let topLbl = getTextSafe('top-player-label'), botLbl = getTextSafe('bottom-player-label');
    let topNm = getTextSafe('top-player-name'), botNm = getTextSafe('bottom-player-name');
    safeText('top-player-label', botLbl); safeText('bottom-player-label', topLbl);
    safeText('top-player-name', botNm); safeText('bottom-player-name', topNm);
    updateTimer();
    renderBoard();
};

// RESIGN FUNCTION: Instant & Stable
window.resignGame = function() {
    if (isMatchOver()) return;
    let resigningColor = (gameMode === 'pvb') ? playerColor : game.turn();
    let winnerColor = (resigningColor === 'w') ? 'b' : 'w';
    let winnerName = (winnerColor === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
    let loserName = (resigningColor === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
    finishMatchWithAnimation(winnerColor, 'resign', "Resigned", `${loserName} resigned. ${winnerName} wins.`, false);
};

window.offerDrawToBot = function() {
    if (isMatchOver()) return;
    if (gameMode === 'pvp') {
        finishMatchWithAnimation('draw', 'draw', "Match Drawn", "Players agreed to a draw.", false);
    } else {
        let diff = Math.abs((gameHistory[historyIndex] || {}).cp || 0);
        if (diff < 60 && gameHistory.length > 25) {
            finishMatchWithAnimation('draw', 'draw', "Draw Accepted", "Stockfish accepted your draw offer.", false);
        } else {
            $('#status').text("Draw offer declined by Stockfish.");
        }
    }
};

function getPieceImageUrl(color, type) {
    return pieceThemeUrls['wikipedia'].replace('{piece}', color + type.toUpperCase());
}

function renderBoard() {
    const boardEl = $('#board');
    if (!boardEl.length) return;
    boardEl.empty();

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

function bindBoardClickEvents() {
    $('#board').off('click').on('click', '.square', function() {
        if (isMatchOver()) return;
        let sq = $(this).attr('data-square');
        if (!sq) return;

        if (selectedSquare && sq !== selectedSquare) {
            let valid = currentLegalMoves.find(m => m.to === sq);
            if (valid) {
                executeHumanMove(selectedSquare, sq);
                return;
            }
        }

        if (selectedSquare === sq) {
            selectedSquare = null;
            currentLegalMoves = [];
            renderBoard();
            return;
        }

        let piece = game.get(sq);
        if (piece && piece.color === game.turn()) {
            if (gameMode === 'pvb' && piece.color !== playerColor) return;
            selectedSquare = sq;
            currentLegalMoves = game.moves({ square: sq, verbose: true });
            renderBoard();
        } else {
            selectedSquare = null;
            currentLegalMoves = [];
            renderBoard();
        }
    });
}

function executeHumanMove(fromSq, toSq) {
    let moveObj = game.move({ from: fromSq, to: toSq, promotion: 'q' });
    if (!moveObj) return;

    selectedSquare = null;
    currentLegalMoves = [];

    if (!timerStarted) {
        startTimer();
        timerStarted = true;
    }

    gameHistory.push({
        fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj,
        soundType: 'move', evalScore: 50.0, evalText: "0.0", cp: 0
    });
    historyIndex = gameHistory.length - 1;

    renderBoard();
    updateStatus();

    if (gameMode === 'pvp' && autoFlipPvP) {
        setTimeout(flipBoardUI, 200);
    } else if (gameMode === 'pvb' && !isMatchOver() && game.turn() !== playerColor) {
        if (aiMoveTimerId) clearTimeout(aiMoveTimerId);
        aiMoveTimerId = setTimeout(makeAiMove, 200);
    }
}

function makeAiMove() {
    if (isMatchOver() || (gameMode === 'pvb' && game.turn() === playerColor)) return;

    let sideName = (game.turn() === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
    $('#status').text(`${sideName} thinking...`);

    $.ajax({
        url: '/ai_move', method: 'POST',
        data: { fen: game.fen(), level: currentBlackElo, think_time: engineThinkTime, depth: engineMaxDepth, _t: Date.now() },
        timeout: 15000,
        success: function(data) {
            if (!data || !data.move || isMatchOver()) return;
            let fromSq = data.move.substring(0, 2);
            let toSq = data.move.substring(2, 4);
            let promo = data.move.length > 4 ? data.move.substring(4, 5).toLowerCase() : 'q';

            let moveObj = game.move({ from: fromSq, to: toSq, promotion: promo });
            if (!moveObj) return;

            gameHistory.push({
                fen: game.fen(), move: { from: moveObj.from, to: moveObj.to }, moveObj: moveObj,
                soundType: 'move', evalScore: 50.0, evalText: "0.0", cp: 0
            });
            historyIndex = gameHistory.length - 1;

            renderBoard();
            updateStatus();
        }
    });
}

function startTimer() {
    clearInterval(timerInterval);
    if (isInfiniteTime) return;
    timerInterval = setInterval(() => {
        if (isMatchOver()) { clearInterval(timerInterval); return; }
        if (game.turn() === 'w') {
            whiteTime--;
            if (whiteTime <= 0) {
                whiteTime = 0;
                updateTimer();
                finishMatchWithAnimation('b', 'timeout', "Time Out!", `${getBlackDisplayName()} won on time.`, false);
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0;
                updateTimer();
                finishMatchWithAnimation('w', 'timeout', "Time Out!", `${getWhiteDisplayName()} won on time.`, false);
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
        let winColor = (game.turn() === 'w') ? 'b' : 'w';
        let winName = (winColor === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
        $('#status').text(`Checkmate! ${winName} Wins.`);
        finishMatchWithAnimation(winColor, 'checkmate', "Checkmate!", `${winName} won by checkmate.`, true);
    } else if (game.in_draw()) {
        $('#status').text("Match Drawn");
        finishMatchWithAnimation('draw', 'draw', "Match Drawn", "Draw", true);
    } else {
        let chk = game.in_check() ? " (Check)" : "";
        if (gameMode === 'pvp') {
            $('#status').text(`${game.turn() === 'w' ? 'White' : 'Black'}'s turn${chk}`);
        } else {
            $('#status').text((game.turn() === playerColor ? "Your turn" : "Opponent's turn") + chk);
        }
    }
}

function finishMatchWithAnimation(winnerColor, reasonType, title, subtitle) {
    if (matchEnded) return;
    matchEnded = true;
    stopAllActiveMatchProcesses();
    renderBoard();

    if (window.saveCurrentMatchToVault) window.saveCurrentMatchToVault(title);

    safeText('modal-title', title);
    safeText('modal-subtitle', subtitle);
    safeDisplay('game-modal', 'flex');
}

window.handleModalBtn = function() { closeModal('game-modal'); openSetupModal(); };

$(document).ready(function() {
    bindBoardClickEvents();
    renderBoard();
    updateTimer();
    updateStatus();
});
