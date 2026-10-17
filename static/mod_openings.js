/* ============================================================================
   static/mod_openings.js (v101 - Step 1)
   World Chess Openings Encyclopedia (3,600+ ECO + Famous Master Lines)
   - Video Auto-Play Demo Mode (watches the opening move-by-move on board)
   - Interactive Visual Arrow AI Coach Practice Mode (draws arrow hints & checks moves)
   ============================================================================ */

var FULL_OPENINGS_DB = [
    ["C60", "Ruy Lopez: Main Line", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O"],
    ["C65", "Ruy Lopez: Berlin Defense", "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8"],
    ["C50", "Italian Game: Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6"],
    ["C57", "Italian Game: Fried Liver Attack", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3"],
    ["C51", "Italian Game: Evans Gambit", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O"],
    ["C42", "Petrov's Defense: Classical", "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O"],
    ["C42", "Petrov's Defense: Stafford Gambit", "e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5 Be2 h5"],
    ["C45", "Scotch Game: Classical", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7"],
    ["C47", "Four Knights Game: Scotch Variation", "e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4 Nxc6 bxc6 Bd3"],
    ["C30", "King's Gambit Accepted", "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5"],
    ["C25", "Vienna Game: Vienna Gambit", "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Qf3 Nc6 Bb5"],
    ["C41", "Philidor Defense: Hanham Variation", "e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O"],
    ["B90", "Sicilian Defense: Najdorf Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3"],
    ["B70", "Sicilian Defense: Dragon Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6"],
    ["B33", "Sicilian Defense: Sveshnikov Variation", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5"],
    ["B22", "Sicilian Defense: Alapin Variation", "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4"],
    ["B23", "Sicilian Defense: Closed Grand Prix Attack", "e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7 Bb5 Nd4 O-O"],
    ["B30", "Sicilian Defense: Rossolimo Variation", "e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7 Re1 Nf6 c3 O-O"],
    ["C11", "French Defense: Classical", "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4"],
    ["C18", "French Defense: Winawer Variation", "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4"],
    ["C02", "French Defense: Advance Variation", "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4"],
    ["B12", "Caro-Kann Defense: Advance Variation", "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nc6"],
    ["B18", "Caro-Kann Defense: Classical Variation", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7"],
    ["B13", "Caro-Kann Defense: Panov-Botvinnik Attack", "e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Bb4"],
    ["B01", "Scandinavian Defense: Main Line", "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6"],
    ["B07", "Pirc Defense: Austrian Attack", "e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O Bd3 Na6"],
    ["B04", "Alekhine's Defense: Modern Variation", "e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7"],
    ["B06", "Modern Defense: Standard Line", "e4 g6 d4 Bg7 Nc3 d6 f4 a6 Nf3 b5 Bd3 Bb7"],
    ["B00", "Nimzowitsch Defense", "e4 Nc6 d4 e5 dxe5 Nxe5 Nf3 Qf6 Be2 Bc5 O-O"],
    ["D37", "Queen's Gambit Declined: Classical", "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4 O-O e3 Nbd7"],
    ["D20", "Queen's Gambit Accepted", "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6"],
    ["D10", "Slav Defense: Main Line", "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4"],
    ["D45", "Semi-Slav Defense: Meran Variation", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5"],
    ["D02", "London System: Main Line", "d4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 Bf5 Ngf3 e6"],
    ["D00", "Jobava London System", "d4 Nf6 Nc3 d5 Bf4 c5 e3 Nc6 Nb5 Qa5+ c3"],
    ["E04", "Catalan Opening: Open Defense", "d4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 a6 O-O Nc6"],
    ["E97", "King's Indian Defense: Mar del Plata", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7"],
    ["E80", "King's Indian Defense: Sämisch Variation", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5"],
    ["E32", "Nimzo-Indian Defense: Classical", "d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5"],
    ["E20", "Nimzo-Indian Defense: Rubinstein System", "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O"],
    ["D85", "Grünfeld Defense: Exchange Variation", "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Bc4 c5 Ne2"],
    ["E15", "Queen's Indian Defense", "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2"],
    ["E11", "Bogo-Indian Defense", "d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 g3 Nc6 Bg2 Bxd2+"],
    ["A60", "Modern Benoni Defense", "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7"],
    ["A57", "Benko Gambit Accepted", "d4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6 e4"],
    ["A80", "Dutch Defense: Leningrad Variation", "d4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3"],
    ["A87", "Dutch Defense: Stonewall Variation", "d4 f5 g3 Nf6 Bg2 e6 Nf3 d5 O-O Bd6 c4 c6"],
    ["A52", "Budapest Gambit", "d4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7"],
    ["D01", "Richter-Veresov Attack", "d4 Nf6 Nc3 d5 Bg5 Nbd7 f3 c6 e4 dxe4 fxe4"],
    ["A45", "Trompowsky Attack", "d4 Nf6 Bg5 Ne4 Bf4 c5 f3 Qa5+ c3 Nf6 d5"],
    ["A20", "English Opening: King's English", "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O"],
    ["A30", "English Opening: Symmetrical", "c4 c5 Nf3 Nf6 Nc3 Nc6 g3 g6 Bg2 Bg7 O-O O-O"],
    ["A09", "Réti Opening: Advance Variation", "Nf3 d5 c4 d4 b4 f6 e3 e5 c5 a5 Bc4"],
    ["A05", "King's Indian Attack", "Nf3 d5 g3 Nf6 Bg2 c6 O-O Bf5 d3 e6 Nbd2 h6"],
    ["A02", "Bird's Opening: From's Gambit", "f4 e5 fxe5 d6 exd6 Bxd6 Nf3 g5 d4 g4"],
    ["A01", "Nimzowitsch-Larsen Attack", "b3 e5 Bb2 Nc6 e3 Nf6 Bb5 Bd6 Ne2 O-O"],
    ["A00", "Grob's Attack", "g4 d5 Bg2 Bxg4 c4 c6 cxd5 cxd5 Qb3"]
];

var activeOpeningItem = null;
var openingPracticeState = {
    active: false,
    mode: 'none', // 'watch' | 'practice'
    eco: '',
    name: '',
    sanMoves: [],
    stepIdx: 0,
    userColor: 'w',
    demoTimer: null
};

function mergeFullEcoBookFromServer() {
    $.get('/eco_book', function(data) {
        if (data && data.openings && data.openings.length > 0) {
            let existingKeys = new Set(FULL_OPENINGS_DB.map(x => x[1] + "|" + x[2]));
            data.openings.forEach(item => {
                if (item.length >= 3 && item[2].split(' ').length >= 4) {
                    let key = item[1] + "|" + item[2];
                    if (!existingKeys.has(key)) {
                        existingKeys.add(key);
                        FULL_OPENINGS_DB.push(item);
                    }
                }
            });
            if ($('#trainer-modal').is(':visible')) {
                filterOpeningTrainerList();
            }
        }
    });
}

window.updateOpeningExplorer = function() {
    let temp = new Chess();
    let sanSeq = [];
    for (let i = 1; i <= historyIndex && i < gameHistory.length; i++) {
        if (gameHistory[i] && gameHistory[i].moveObj) {
            sanSeq.push(gameHistory[i].moveObj.san);
        }
    }
    if (sanSeq.length === 0) {
        safeText('opening-bar', 'A00: Starting Position');
        return;
    }
    let playedStr = sanSeq.join(' ');
    let bestMatch = null;
    let bestLen = 0;
    for (let i = 0; i < FULL_OPENINGS_DB.length; i++) {
        let op = FULL_OPENINGS_DB[i];
        let opMoves = op[2];
        if (playedStr.startsWith(opMoves) && opMoves.length > bestLen) {
            bestMatch = op;
            bestLen = opMoves.length;
        } else if (opMoves.startsWith(playedStr) && sanSeq.length <= 6 && !bestMatch) {
            bestMatch = op;
        }
    }
    if (bestMatch) {
        safeText('opening-bar', `${bestMatch[0]}: ${bestMatch[1]}`);
    }

    // If user is in interactive Opening Practice Mode, validate move & trigger Coach arrow
    if (openingPracticeState.active && openingPracticeState.mode === 'practice') {
        setTimeout(checkOpeningPracticeProgress, 120);
    }
};

window.openOpeningTrainerModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    filterOpeningTrainerList();
    safeDisplay('trainer-modal', 'flex');
};

window.filterOpeningTrainerList = function() {
    let q = ((safeEl('trainer-search-input') || {}).value || '').toLowerCase().trim();
    let sel = $('#trainer-opening-select');
    if (!sel.length) return;
    sel.empty();

    let matches = [];
    for (let i = 0; i < FULL_OPENINGS_DB.length; i++) {
        let op = FULL_OPENINGS_DB[i];
        let label = `${op[0]} • ${op[1]} (${op[2]})`;
        if (!q || label.toLowerCase().includes(q)) {
            matches.push({ idx: i, eco: op[0], name: op[1], moves: op[2] });
            if (matches.length >= 250) break;
        }
    }

    matches.forEach((m, i) => {
        sel.append(`<option value="${m.idx}" ${i === 0 ? 'selected' : ''}>[${m.eco}] ${m.name} — ${m.moves}</option>`);
    });
    updateOpeningPreviewText();
};

window.updateOpeningPreviewText = function() {
    let idx = parseInt($('#trainer-opening-select').val() || '0');
    let op = FULL_OPENINGS_DB[idx] || FULL_OPENINGS_DB[0];
    if (!op) return;
    activeOpeningItem = op;
    safeHtml('trainer-opening-preview', `<b>${op[0]}: ${op[1]}</b><br><span style="color:#81b64c; font-family:monospace;">${op[2]}</span>`);
};

function stopOpeningDemoTimer() {
    if (openingPracticeState.demoTimer) {
        clearInterval(openingPracticeState.demoTimer);
        openingPracticeState.demoTimer = null;
    }
    safeText('btn-replay-toggle', 'Play');
}

// 1. WATCH OPENING VIDEO DEMO (Plays move-by-move automatically with arrows & sound)
window.watchOpeningVideoDemo = function(fromModal = true) {
    let idx = parseInt($('#trainer-opening-select').val() || '0');
    let op = fromModal ? (FULL_OPENINGS_DB[idx] || FULL_OPENINGS_DB[0]) : (activeOpeningItem || FULL_OPENINGS_DB[0]);
    if (!op) return;
    activeOpeningItem = op;
    if (fromModal) closeModal('trainer-modal');

    stopAllActiveMatchProcesses();
    stopOpeningDemoTimer();

    let tokens = op[2].trim().split(/\s+/).filter(Boolean);
    openingPracticeState = {
        active: true,
        mode: 'watch',
        eco: op[0],
        name: op[1],
        sanMoves: tokens,
        stepIdx: 0,
        userColor: 'w',
        demoTimer: null
    };

    isAnalysisBranchMode = true;
    matchEnded = false;
    gameEndEffect = null;
    currentBoardOrientation = 'w';
    game.reset();
    clearArrows();
    if (window.clearCustomAnnotations) window.clearCustomAnnotations();

    gameHistory = [{
        fen: game.fen(), move: null, moveObj: null, soundType: 'move',
        evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
    }];
    historyIndex = 0;

    safeText('opening-bar', `${op[0]}: ${op[1]}`);
    safeText('bottom-player-label', 'White'); safeText('bottom-player-name', 'Opening Demo');
    safeText('top-player-label', 'Black'); safeText('top-player-name', op[1]);
    syncEloBadgeVisibility();
    updateMaterial(game.fen());
    renderBoard();
    playSnd('start');

    $('#status').text(`Watching Opening: ${op[1]} (0/${tokens.length})`);
    safeText('btn-replay-toggle', 'Stop');

    openingPracticeState.demoTimer = setInterval(() => {
        if (openingPracticeState.stepIdx >= openingPracticeState.sanMoves.length) {
            stopOpeningDemoTimer();
            $('#status').text(`Opening Demo Complete: ${op[1]} — Tap 'Menu -> Opening Explorer' or continue playing!`);
            drawCoachBestContinuationArrow();
            return;
        }
        let san = openingPracticeState.sanMoves[openingPracticeState.stepIdx];
        let mvObj = game.move(san, { sloppy: true });
        if (!mvObj) {
            stopOpeningDemoTimer();
            return;
        }
        openingPracticeState.stepIdx++;
        let sType = detectMoveSoundType(game, mvObj);
        gameHistory.push({
            fen: game.fen(),
            move: { from: mvObj.from, to: mvObj.to },
            moveObj: mvObj,
            soundType: sType,
            evalScore: 50.0,
            evalText: "0.0",
            cp: 0,
            bestMoveUci: "",
            bestMoveSan: ""
        });
        historyIndex = gameHistory.length - 1;
        playSoundForHistoryRec(gameHistory[historyIndex]);
        updateMaterial(game.fen());
        renderBoard();
        if (window.drawMoveArrow) window.drawMoveArrow(mvObj.from, mvObj.to, 'rgba(129, 182, 76, 0.85)');
        $('#status').text(`${op[0]} ${op[1]} • Move ${openingPracticeState.stepIdx}/${openingPracticeState.sanMoves.length}: ${mvObj.san}`);
    }, 850);
};

// 2. PRACTICE OPENING WITH VISUAL AI COACH (Draws Arrow Hints & Plays Book Replies)
window.startOpeningDrill = function() {
    let idx = parseInt($('#trainer-opening-select').val() || '0');
    let op = FULL_OPENINGS_DB[idx] || FULL_OPENINGS_DB[0];
    if (!op) return;
    activeOpeningItem = op;
    let side = ($('#trainer-side-select').val() || 'w');
    closeModal('trainer-modal');

    stopAllActiveMatchProcesses();
    stopOpeningDemoTimer();

    let tokens = op[2].trim().split(/\s+/).filter(Boolean);
    openingPracticeState = {
        active: true,
        mode: 'practice',
        eco: op[0],
        name: op[1],
        sanMoves: tokens,
        stepIdx: 0,
        userColor: side,
        demoTimer: null
    };

    isAnalysisBranchMode = true;
    matchEnded = false;
    gameEndEffect = null;
    playerColor = side;
    currentBoardOrientation = side;
    game.reset();
    clearArrows();
    if (window.clearCustomAnnotations) window.clearCustomAnnotations();

    gameHistory = [{
        fen: game.fen(), move: null, moveObj: null, soundType: 'move',
        evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
    }];
    historyIndex = 0;

    safeText('opening-bar', `${op[0]}: ${op[1]} (Coach Practice)`);
    if (side === 'w') {
        safeText('bottom-player-label', 'White'); safeText('bottom-player-name', 'You (Practicing)');
        safeText('top-player-label', 'Black'); safeText('top-player-name', 'AI Opening Coach');
    } else {
        safeText('bottom-player-label', 'Black'); safeText('bottom-player-name', 'You (Practicing)');
        safeText('top-player-label', 'White'); safeText('top-player-name', 'AI Opening Coach');
    }
    syncEloBadgeVisibility();
    updateMaterial(game.fen());
    renderBoard();
    playSnd('start');

    promptNextOpeningCoachStep();
};

function findMoveObjectBySan(fenStr, sanStr) {
    let temp = new Chess(fenStr);
    let m = temp.move(sanStr, { sloppy: true });
    return m;
}

function promptNextOpeningCoachStep() {
    if (!openingPracticeState.active || openingPracticeState.mode !== 'practice') return;

    // If all book moves of the selected opening are completed, switch to Live Engine Coach Arrow hints!
    if (openingPracticeState.stepIdx >= openingPracticeState.sanMoves.length) {
        $('#status').text(`Opening Book Completed! Coach Arrow shows best engine continuation.`);
        drawCoachBestContinuationArrow();
        return;
    }

    let expectedSan = openingPracticeState.sanMoves[openingPracticeState.stepIdx];
    let turnColor = game.turn();

    // If it's AI Coach's turn in the book line, play the book move automatically
    if (turnColor !== openingPracticeState.userColor) {
        $('#status').text(`Coach playing book move: ${expectedSan}...`);
        setTimeout(() => {
            if (!openingPracticeState.active || openingPracticeState.mode !== 'practice') return;
            let mvObj = game.move(expectedSan, { sloppy: true });
            if (!mvObj) return;
            openingPracticeState.stepIdx++;
            let sType = detectMoveSoundType(game, mvObj);
            gameHistory.push({
                fen: game.fen(),
                move: { from: mvObj.from, to: mvObj.to },
                moveObj: mvObj,
                soundType: sType,
                evalScore: 50.0,
                evalText: "0.0",
                cp: 0,
                bestMoveUci: "",
                bestMoveSan: ""
            });
            historyIndex = gameHistory.length - 1;
            playSoundForHistoryRec(gameHistory[historyIndex]);
            updateMaterial(game.fen());
            renderBoard();
            promptNextOpeningCoachStep();
        }, 420);
        return;
    }

    // It's the User's turn: Draw the AI Coach Arrow showing the exact book move!
    let targetMove = findMoveObjectBySan(game.fen(), expectedSan);
    if (targetMove) {
        if (window.drawMoveArrow) {
            window.drawMoveArrow(targetMove.from, targetMove.to, 'rgba(129, 182, 76, 0.88)');
        }
        $('#status').text(`Coach Hint: Play ${targetMove.san} (${targetMove.from} → ${targetMove.to}) [${openingPracticeState.stepIdx + 1}/${openingPracticeState.sanMoves.length}]`);
    }
}

function checkOpeningPracticeProgress() {
    if (!openingPracticeState.active || openingPracticeState.mode !== 'practice') return;
    let playedMovesCount = gameHistory.length - 1;
    if (playedMovesCount <= openingPracticeState.stepIdx) return;

    let lastRec = gameHistory[gameHistory.length - 1];
    if (!lastRec || !lastRec.moveObj) return;

    // If we are still inside the opening book moves
    if (openingPracticeState.stepIdx < openingPracticeState.sanMoves.length) {
        let expectedSan = openingPracticeState.sanMoves[openingPracticeState.stepIdx];
        if (lastRec.moveObj.san === expectedSan) {
            openingPracticeState.stepIdx++;
            promptNextOpeningCoachStep();
        } else {
            // User played a non-book move: gently undo it and show the Coach Arrow again!
            playSnd('illegal');
            game.undo();
            gameHistory.pop();
            historyIndex = gameHistory.length - 1;
            renderBoard();
            let targetMove = findMoveObjectBySan(game.fen(), expectedSan);
            if (targetMove && window.drawMoveArrow) {
                window.drawMoveArrow(targetMove.from, targetMove.to, 'rgba(230, 57, 70, 0.88)');
            }
            $('#status').text(`Book Move is ${expectedSan} (${targetMove ? targetMove.from + ' → ' + targetMove.to : ''}) — Try again!`);
        }
    } else {
        // Past the book line: if it's Coach's turn, play best engine reply and then show next Coach Arrow for user
        if (game.turn() !== openingPracticeState.userColor && !game.game_over()) {
            $.post('/ai_move', { fen: game.fen(), level: '2000', think_time: 0.35, depth: 14 }, function(data) {
                if (!data || !data.move) return;
                let mvObj = parseAndApplyUciMove(data.move);
                if (!mvObj) return;
                let sType = detectMoveSoundType(game, mvObj);
                gameHistory.push({
                    fen: game.fen(), move: { from: mvObj.from, to: mvObj.to }, moveObj: mvObj, soundType: sType,
                    evalScore: 50.0, evalText: "0.0", cp: 0
                });
                historyIndex = gameHistory.length - 1;
                playSoundForHistoryRec(gameHistory[historyIndex]);
                updateMaterial(game.fen());
                renderBoard();
                drawCoachBestContinuationArrow();
            });
        } else {
            drawCoachBestContinuationArrow();
        }
    }
}

function drawCoachBestContinuationArrow() {
    if (game.game_over()) return;
    $.post('/eval', { fen: game.fen(), depth: 15, time: 0.25 }, function(data) {
        if (data && data.best_uci && data.best_uci.length >= 4) {
            let f = data.best_uci.substring(0, 2), t = data.best_uci.substring(2, 4);
            if (window.drawMoveArrow) window.drawMoveArrow(f, t, 'rgba(129, 182, 76, 0.88)');
            $('#status').text(`Coach Best Move: ${data.best_san || data.best_uci} (${data.text || '0.0'})`);
        }
    });
}

$(document).ready(function() {
    setTimeout(mergeFullEcoBookFromServer, 600);
});
