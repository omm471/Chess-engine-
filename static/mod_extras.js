/* ============================================================================
   static/mod_extras.js (v99 - Step 4)
   - Engine vs Engine (EvE) Setup & Engine Selector Population
   - Real Multi-Depth Engine Game Report Scan (with Engine & Depth Chooser)
   - Dynamic Saved Games Archive Replay + Accurate FIDE Rating System
   ============================================================================ */

var movieReplayTimer = null;
var replaySpeedMultiplier = 1;
var availableEnginesList = [];
var activeReportScanToken = 0;

window.toggleSidebarDrawer = function(forceState) {
    let drawer = document.getElementById("chess-sidebar-drawer");
    let backdrop = document.getElementById("sidebar-backdrop");
    if (!drawer || !backdrop) return;
    let isOpen = drawer.classList.contains("open");
    let nextState = (forceState !== undefined) ? forceState : !isOpen;
    if (nextState) {
        updateCareerBannerUI();
        drawer.classList.add("open");
        backdrop.style.display = "block";
    } else {
        drawer.classList.remove("open");
        backdrop.style.display = "none";
    }
};

window.populateSetupEngineSelectors = function() {
    $.get('/list_engines', function(data) {
        if (!data || !data.engines) return;
        availableEnginesList = data.engines;
        let wSel = $('#setup-white-engine');
        let bSel = $('#setup-black-engine');
        let rSel = $('#report-engine-select');
        if (wSel.length) wSel.empty();
        if (bSel.length) bSel.empty();
        if (rSel.length) rSel.empty();

        availableEnginesList.forEach((eng, idx) => {
            let valStr = `${eng.path}|||${eng.preset || ''}|||${eng.name}`;
            if (wSel.length) wSel.append(`<option value="${valStr}" ${idx === 0 ? 'selected' : ''}>${eng.name}</option>`);
            if (bSel.length) bSel.append(`<option value="${valStr}" ${idx === 1 ? 'selected' : ''}>${eng.name}</option>`);
            if (rSel.length) rSel.append(`<option value="${valStr}" ${idx === 0 ? 'selected' : ''}>${eng.name}</option>`);
        });
    });
};

function parseEngineOptionValue(valStr) {
    if (!valStr) return { path: "", preset: "sf19", name: "Stockfish 19" };
    let parts = valStr.split('|||');
    return {
        path: parts[0] || "",
        preset: parts[1] || "",
        name: (parts[2] || "Stockfish").split('(')[0].trim()
    };
}

window.applySetupAndStart = function() {
    gameMode = (safeEl('setup-mode') || {}).value || 'pvb';
    autoFlipPvP = ((safeEl('setup-autoflip') || {}).value === 'on');
    let userNm = (safeEl('setup-username') || {}).value || 'Player';
    localStorage.setItem('chess_username', userNm);

    currentWhiteElo = (safeEl('setup-white-bot') || {}).value || '1500';
    currentBlackElo = (safeEl('setup-black-bot') || {}).value || '2500';

    let wBotName = (safeEl('setup-white-bot-name') || {}).value || getSavedBotName(currentWhiteElo);
    let bBotName = (safeEl('setup-bot-name') || {}).value || getSavedBotName(currentBlackElo);

    engineThinkTime = parseFloat((safeEl('setup-think-time') || {}).value || 0.8);
    engineMaxDepth = parseInt((safeEl('setup-depth-slider') || {}).value || 20);

    let tVal = (safeEl('setup-time') || {}).value || '10|0';
    if (tVal === '0|0') {
        isInfiniteTime = true; whiteTime = 0; blackTime = 0; whiteIncrement = 0; blackIncrement = 0;
    } else if (tVal === 'custom') {
        isInfiniteTime = false;
        let mins = parseInt((safeEl('custom-minutes') || {}).value || 10);
        let secs = parseInt((safeEl('custom-seconds') || {}).value || 0);
        let inc = parseInt((safeEl('custom-increment') || {}).value || 0);
        whiteTime = blackTime = (mins * 60) + secs;
        whiteIncrement = blackIncrement = inc;
    } else {
        isInfiniteTime = false;
        let parts = tVal.split('|');
        whiteTime = blackTime = parseInt(parts[0]) * 60;
        whiteIncrement = blackIncrement = parseInt(parts[1] || 0);
    }

    if (gameMode === 'pvb') {
        let selColor = $('input[name="play_color"]:checked').val() || 'w';
        if (selColor === 'random') selColor = Math.random() < 0.5 ? 'w' : 'b';
        playerColor = selColor;
        currentBoardOrientation = playerColor;
        if (playerColor === 'w') {
            safeText('bottom-player-label', 'White'); safeText('bottom-player-name', userNm);
            safeText('top-player-label', 'Black'); safeText('top-player-name', `${bBotName} (${currentBlackElo})`);
        } else {
            safeText('bottom-player-label', 'Black'); safeText('bottom-player-name', userNm);
            safeText('top-player-label', 'White'); safeText('top-player-name', `${bBotName} (${currentBlackElo})`);
        }
    } else if (gameMode === 'bvb') {
        playerColor = 'w';
        currentBoardOrientation = 'w';
        safeText('bottom-player-label', 'White');
        safeText('bottom-player-name', `${wBotName} (${currentWhiteElo})`);
        safeText('top-player-label', 'Black');
        safeText('top-player-name', `${bBotName} (${currentBlackElo})`);
    } else if (gameMode === 'eve') {
        playerColor = 'w';
        currentBoardOrientation = 'w';
        whiteEngineCfg = parseEngineOptionValue((safeEl('setup-white-engine') || {}).value);
        blackEngineCfg = parseEngineOptionValue((safeEl('setup-black-engine') || {}).value);
        currentWhiteElo = '2800';
        currentBlackElo = '2800';
        safeText('bottom-player-label', 'White');
        safeText('bottom-player-name', `${whiteEngineCfg.name} [D${engineMaxDepth}]`);
        safeText('top-player-label', 'Black');
        safeText('top-player-name', `${blackEngineCfg.name} [D${engineMaxDepth}]`);
    } else {
        playerColor = 'w';
        currentBoardOrientation = 'w';
        safeText('bottom-player-label', 'White'); safeText('bottom-player-name', `${userNm} 1`);
        safeText('top-player-label', 'Black'); safeText('top-player-name', `Player 2`);
    }

    closeModal('setup-modal');
    startGame(true);
};

// ============================================================================
// REAL MULTI-DEPTH ENGINE GAME REPORT & BLUNDER SCANNER
// ============================================================================
function computeGradeFromAcpl(acpl) {
    if (acpl <= 18) return "Excellent (A+)";
    if (acpl <= 38) return "Strong (A)";
    if (acpl <= 68) return "Solid (B)";
    if (acpl <= 110) return "Inaccurate (C)";
    return "Needs Work (D)";
}

function renderReportMetricsFromHistory() {
    let wName = getWhiteDisplayName();
    let bName = getBlackDisplayName();
    safeText('kundli-w-name', wName);
    safeText('kundli-b-name', bName);

    let counts = {
        w: { Best: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0 },
        b: { Best: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0 }
    };
    let wCplSum = 0, bCplSum = 0, wMoves = 0, bMoves = 0;
    let phaseCpl = { wOpen: [], bOpen: [], wMid: [], bMid: [], wEnd: [], bEnd: [] };
    let keyMistakes = [];
    let biggestSwing = { ply: 0, diff: 0, desc: "None" };

    for (let i = 1; i < gameHistory.length; i++) {
        let curr = gameHistory[i];
        let prev = gameHistory[i - 1];
        if (!curr || !curr.moveObj) continue;

        let side = curr.moveObj.color;
        let prevCp = (prev && prev.cp !== undefined) ? prev.cp : 0;
        let currCp = (curr.cp !== undefined) ? curr.cp : prevCp;

        // Centipawn loss from the moving side's perspective
        let loss = (side === 'w') ? Math.max(0, prevCp - currCp) : Math.max(0, currCp - prevCp);
        loss = Math.min(800, loss);

        let playedSan = curr.moveObj.san || "";
        let bestSan = curr.bestMoveSan || "";
        let cls = { label: "Good", symbol: "✓", color: "#81b64c" };

        if ((bestSan && playedSan === bestSan) || loss <= 15) {
            cls = { label: "Best", symbol: "★", color: "#81b64c" };
            counts[side].Best++;
        } else if (loss <= 55) {
            cls = { label: "Good", symbol: "✓", color: "#739552" };
            counts[side].Good++;
        } else if (loss <= 125) {
            cls = { label: "Inaccuracy", symbol: "?!", color: "#d97706" };
            counts[side].Inaccuracy++;
        } else if (loss <= 250) {
            cls = { label: "Mistake", symbol: "?", color: "#e67e22" };
            counts[side].Mistake++;
        } else {
            cls = { label: "Blunder", symbol: "??", color: "#ca3431" };
            counts[side].Blunder++;
        }
        curr.classification = cls;

        if (side === 'w') { wCplSum += loss; wMoves++; }
        else { bCplSum += loss; bMoves++; }

        if (i <= 20) (side === 'w' ? phaseCpl.wOpen : phaseCpl.bOpen).push(loss);
        else if (i <= 56) (side === 'w' ? phaseCpl.wMid : phaseCpl.bMid).push(loss);
        else (side === 'w' ? phaseCpl.wEnd : phaseCpl.bEnd).push(loss);

        if (loss > biggestSwing.diff) {
            biggestSwing = { ply: i, diff: loss, desc: `Move ${Math.ceil(i/2)} (${playedSan})` };
        }
        if (cls.label === "Blunder" || cls.label === "Mistake" || cls.label === "Inaccuracy") {
            keyMistakes.push({
                ply: i,
                moveNo: Math.ceil(i / 2) + (side === 'w' ? '.' : '...'),
                san: playedSan,
                bestSan: bestSan || "Engine Line",
                bestUci: curr.bestMoveUci || "",
                label: cls.label,
                color: cls.color,
                loss: Math.round(loss)
            });
        }
    }

    let wAcpl = wMoves > 0 ? Math.round(wCplSum / wMoves) : 0;
    let bAcpl = bMoves > 0 ? Math.round(bCplSum / bMoves) : 0;
    let wAcc = wMoves > 0 ? Math.max(12, Math.min(100, Math.round(103.16 * Math.exp(-0.004 * wAcpl) * 10) / 10)) : 100.0;
    let bAcc = bMoves > 0 ? Math.max(12, Math.min(100, Math.round(103.16 * Math.exp(-0.004 * bAcpl) * 10) / 10)) : 100.0;

    let wEstElo = Math.max(400, Math.min(2950, Math.round(2850 - wAcpl * 7.2)));
    let bEstElo = Math.max(400, Math.min(2950, Math.round(2850 - bAcpl * 7.2)));

    safeText(['white-acc-text', 'k-w-acc', 'modal-p1-acc'], wAcc + '%');
    safeText(['black-acc-text', 'k-b-acc', 'modal-p2-acc'], bAcc + '%');
    safeText('k-w-acpl', wAcpl + ' CPL');
    safeText('k-b-acpl', bAcpl + ' CPL');
    safeText('k-w-elo', wEstElo);
    safeText('k-b-elo', bEstElo);

    const avgArr = arr => arr.length ? computeGradeFromAcpl(arr.reduce((a, b) => a + b, 0) / arr.length) : "--";
    safeText('k-w-open', avgArr(phaseCpl.wOpen));
    safeText('k-b-open', avgArr(phaseCpl.bOpen));
    safeText('k-w-mid', avgArr(phaseCpl.wMid));
    safeText('k-b-mid', avgArr(phaseCpl.bMid));
    safeText('k-w-end', avgArr(phaseCpl.wEnd));
    safeText('k-b-end', avgArr(phaseCpl.bEnd));
    safeText('k-turning-point', biggestSwing.desc);

    let tbody = $('#kundli-counts-body');
    if (tbody.length) {
        tbody.html(`
            <tr><td><span style="color:#81b64c; font-weight:bold;">★ Best Move</span></td><td>${counts.w.Best}</td><td>${counts.b.Best}</td></tr>
            <tr><td><span style="color:#739552; font-weight:bold;">✓ Good Move</span></td><td>${counts.w.Good}</td><td>${counts.b.Good}</td></tr>
            <tr><td><span style="color:#d97706; font-weight:bold;">?! Inaccuracy</span></td><td>${counts.w.Inaccuracy}</td><td>${counts.b.Inaccuracy}</td></tr>
            <tr><td><span style="color:#e67e22; font-weight:bold;">? Mistake</span></td><td>${counts.w.Mistake}</td><td>${counts.b.Mistake}</td></tr>
            <tr><td><span style="color:#ca3431; font-weight:bold;">?? Blunder</span></td><td>${counts.w.Blunder}</td><td>${counts.b.Blunder}</td></tr>
        `);
    }

    safeHtml('kundli-verdict-text', `<b>Coach Summary:</b> ${wName} played at <b>${wAcc}%</b> accuracy (Est. <b>${wEstElo} ELO</b>) while ${bName} played at <b>${bAcc}%</b> accuracy (Est. <b>${bEstElo} ELO</b>).`);

    let bList = $('#kundli-blunder-list');
    if (bList.length) {
        bList.empty();
        if (keyMistakes.length === 0) {
            bList.html('<div style="color:#81b64c; font-size:11px; padding:6px;">Clean game! No major mistakes or blunders detected.</div>');
        } else {
            keyMistakes.forEach(item => {
                let row = $('<div>').addClass('blunder-item').css('border-left-color', item.color).html(`
                    <div>
                        <b style="color:${item.color};">${item.moveNo} ${item.san} (${item.label})</b>
                        <div style="color:#999; font-size:10px;">Best was <b>${item.bestSan}</b> • Loss: ${item.loss} CPL</div>
                    </div>
                    <span style="color:#5c9ded; font-weight:bold; font-size:10.5px;">View →</span>
                `);
                row.on('click', () => {
                    closeModal('kundli-modal');
                    historyIndex = item.ply;
                    renderBoard();
                    showAnalysisStatus();
                    if (item.bestUci && item.bestUci.length >= 4 && window.drawMoveArrow) {
                        window.drawMoveArrow(item.bestUci.substring(0, 2), item.bestUci.substring(2, 4), 'rgba(129, 182, 76, 0.88)');
                    }
                });
                bList.append(row);
            });
        }
    }

    if (window.drawKundliEvalGraph) window.drawKundliEvalGraph();
    if (window.drawAllEvalGraphs) window.drawAllEvalGraphs();
}

window.openDeepReport = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    if ($('#report-engine-select option').length === 0) {
        populateSetupEngineSelectors();
    }
    safeDisplay('kundli-modal', 'flex');
    renderReportMetricsFromHistory();
    runDeepKundliScan(false);
};

window.runDeepKundliScan = function(forceFullScan = true) {
    let totalPositions = gameHistory.length;
    if (totalPositions <= 1) {
        safeText('kundli-progress-text', 'Play at least 1 move to run Engine Analysis.');
        renderReportMetricsFromHistory();
        return;
    }

    let selEng = parseEngineOptionValue((safeEl('report-engine-select') || {}).value);
    let selDepth = parseInt((safeEl('report-depth-select') || {}).value || '14');
    let scanToken = ++activeReportScanToken;

    let wrap = safeEl('kundli-progress-wrap');
    if (wrap) wrap.style.display = 'block';
    let fill = safeEl('kundli-progress-fill');
    if (fill) fill.style.width = '5%';

    let idx = 0;
    function scanNextPosition() {
        if (scanToken !== activeReportScanToken) return;
        if (idx >= totalPositions) {
            if (fill) fill.style.width = '100%';
            safeText('kundli-progress-text', `Analysis Complete (${selEng.name} • Depth ${selDepth})`);
            renderReportMetricsFromHistory();
            renderBoard();
            return;
        }

        let rec = gameHistory[idx];
        let pct = Math.round(((idx + 1) / totalPositions) * 100);
        if (fill) fill.style.width = pct + '%';
        safeText('kundli-progress-text', `Scanning Move ${idx}/${totalPositions - 1} with ${selEng.name} (Depth ${selDepth})...`);

        // Skip re-evaluating if position already has bestMoveSan and user didn't force full re-scan
        if (!forceFullScan && idx > 0 && rec.cp !== undefined && rec.bestMoveSan) {
            idx++;
            setTimeout(scanNextPosition, 10);
            return;
        }

        $.ajax({
            url: '/eval',
            method: 'POST',
            data: {
                fen: rec.fen,
                depth: selDepth,
                time: Math.min(0.65, Math.max(0.12, selDepth * 0.022)),
                engine_path: selEng.path,
                engine_preset: selEng.preset
            },
            success: function(data) {
                if (scanToken !== activeReportScanToken) return;
                if (data) {
                    rec.evalScore = data.score;
                    rec.evalText = data.text;
                    if (data.cp !== undefined) rec.cp = data.cp;
                    if (data.best_san && idx + 1 < gameHistory.length) {
                        gameHistory[idx + 1].bestMoveSan = data.best_san;
                        gameHistory[idx + 1].bestMoveUci = data.best_uci || "";
                    }
                }
                renderReportMetricsFromHistory();
                idx++;
                scanNextPosition();
            },
            error: function() {
                idx++;
                scanNextPosition();
            }
        });
    }

    scanNextPosition();
};

// ============================================================================
// DYNAMIC CLASSIC SAVED GAMES ARCHIVE (With Full PGN Move History Reconstruction)
// ============================================================================
window.loadArchivedGameIntoBoard = function(pgnStr, fenStr, whiteName, blackName) {
    stopAllActiveMatchProcesses();
    isAnalysisBranchMode = true;
    matchEnded = true;
    gameEndEffect = null;

    let tempChess = new Chess();
    let loadedOk = false;
    if (pgnStr && pgnStr.trim()) {
        loadedOk = tempChess.load_pgn(pgnStr.trim(), { sloppy: true });
    }

    if (loadedOk) {
        let movesVerbose = tempChess.history({ verbose: true });
        game.reset();
        gameHistory = [{
            fen: game.fen(), move: null, moveObj: null, soundType: 'move',
            evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
        }];
        movesVerbose.forEach(mv => {
            let mObj = game.move(mv);
            if (mObj) {
                let sType = detectMoveSoundType(game, mObj);
                gameHistory.push({
                    fen: game.fen(),
                    move: { from: mObj.from, to: mObj.to },
                    moveObj: mObj,
                    soundType: sType,
                    evalScore: 50.0,
                    evalText: "0.0",
                    cp: 0,
                    bestMoveUci: "",
                    bestMoveSan: ""
                });
            }
        });
    } else if (fenStr) {
        game.load(fenStr);
        gameHistory = [{
            fen: game.fen(), move: null, moveObj: null, soundType: 'move',
            evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
        }];
    }

    historyIndex = gameHistory.length - 1;
    safeText('bottom-player-label', 'White'); safeText('bottom-player-name', whiteName || 'White');
    safeText('top-player-label', 'Black'); safeText('top-player-name', blackName || 'Black');
    syncEloBadgeVisibility();
    updateMaterial(game.fen());
    if (window.updateOpeningExplorer) window.updateOpeningExplorer();
    renderBoard();
    $('#status').text(`Archive Loaded: ${whiteName} vs ${blackName} (${gameHistory.length - 1} moves)`);
};

window.refreshMatchVaultList = function() {
    $.get('/get_matches', function(data) {
        let listEl = $('#vault-list');
        if (!listEl.length) return;
        listEl.empty();
        if (!data || !data.matches || data.matches.length === 0) {
            listEl.html('<div style="text-align:center; color:#888; padding:22px 10px; font-size:12px;">No saved games in your archive yet.</div>');
            return;
        }
        data.matches.forEach(m => {
            let moveCount = m.pgn ? (m.pgn.match(/\d+\./g) || []).length : 0;
            let badgeColor = (m.result && m.result.toLowerCase().includes('draw')) ? '#5c9ded' : '#f0c15c';
            let card = $('<div>').addClass('archive-card').html(`
                <div class="archive-top-row">
                    <div class="archive-players">♔ ${m.white} <span style="color:#777; font-weight:400;">vs</span> ♚ ${m.black}</div>
                    <span class="archive-badge" style="color:${badgeColor};">${m.result || 'Completed'}</span>
                </div>
                <div class="archive-meta">
                    <span style="color:#81b64c; font-weight:600; max-width:65%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.opening || 'Standard Match'}</span>
                    <span>${moveCount > 0 ? moveCount + ' moves • ' : ''}${m.date || ''}</span>
                </div>
                <div class="archive-acc-pills">
                    <span class="archive-acc-pill">White Acc: <b style="color:#81b64c;">${m.w_acc || '--%'}</b></span>
                    <span class="archive-acc-pill">Black Acc: <b style="color:#81b64c;">${m.b_acc || '--%'}</b></span>
                </div>
                <div class="archive-actions">
                    <button class="archive-btn archive-btn-load">▶ Replay</button>
                    <button class="archive-btn archive-btn-report">📊 Report</button>
                    <button class="archive-btn archive-btn-pgn">📋 PGN</button>
                    <button class="archive-btn archive-btn-del" title="Delete">✕</button>
                </div>
            `);

            card.find('.archive-btn-load').on('click', () => {
                closeModal('vault-modal');
                loadArchivedGameIntoBoard(m.pgn, m.fen, m.white, m.black);
            });

            card.find('.archive-btn-report').on('click', () => {
                closeModal('vault-modal');
                loadArchivedGameIntoBoard(m.pgn, m.fen, m.white, m.black);
                openDeepReport();
            });

            card.find('.archive-btn-pgn').on('click', () => {
                navigator.clipboard.writeText(m.pgn || m.fen || "").then(() => alert("PGN copied to clipboard!"));
            });

            card.find('.archive-btn-del').on('click', () => {
                $.post('/delete_match', { id: m.id }, function(res) {
                    if (res && res.status === 'deleted') refreshMatchVaultList();
                });
            });

            listEl.append(card);
        });
    });
};

window.openToolsMenuModal = function() { toggleSidebarDrawer(true); };

window.togglePremoveMode = function() {
    premoveEnabled = !premoveEnabled;
    if (!premoveEnabled) premoveQueue = [];
    safeText('menu-premove-btn', `Multi-Premove: ${premoveEnabled ? 'ON' : 'OFF'}`);
    safeText('sidebar-premove-val', premoveEnabled ? 'ON' : 'OFF');
    renderBoard();
};

window.toggleSquareHeatmap = function() {
    heatmapEnabled = !heatmapEnabled;
    safeText('menu-heatmap-btn', `Control Map: ${heatmapEnabled ? 'ON' : 'OFF'}`);
    renderBoard();
};

window.renderHeatmapOverlay = function() {
    $('.heat-overlay').remove();
    if (!heatmapEnabled) return;
    let displayFen = (historyIndex >= 0 && historyIndex < gameHistory.length) ? gameHistory[historyIndex].fen : game.fen();
    let temp = new Chess(displayFen);
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    files.forEach(f => {
        for (let r = 1; r <= 8; r++) {
            let sq = f + r;
            let p = temp.get(sq);
            if (p && p.color === temp.turn()) {
                let el = $(`.square[data-square="${sq}"]`);
                if (el.length) el.append($('<div>').addClass('heat-overlay').css('background', 'rgba(129, 182, 76, 0.22)'));
            }
        }
    });
};

window.toggleBlindfoldMode = function() {
    document.body.classList.toggle('blindfold-mode');
    let isB = document.body.classList.contains('blindfold-mode');
    safeText('menu-blindfold-btn', `Blindfold: ${isB ? 'ON' : 'OFF'}`);
};

window.toggleHintOption = function() {
    showHintButton = !showHintButton;
    safeDisplay('btn-board-hint', showHintButton ? 'inline-block' : 'none');
    safeText('menu-hint-opt-btn', `Hint Button: ${showHintButton ? 'ON' : 'OFF'}`);
};

window.toggleFlipOption = function() {
    let el = safeEl('btn-front-flip');
    let vis = (el && el.style.display !== 'none');
    safeDisplay('btn-front-flip', vis ? 'none' : 'inline-block');
    safeText('menu-flip-opt-btn', `Flip Button: ${!vis ? 'ON' : 'OFF'}`);
};

window.toggleEvalOption = function() {
    showEvalBar = !showEvalBar;
    safeDisplay('eval-wrapper', showEvalBar ? 'flex' : 'none');
    safeText('menu-eval-opt-btn', `Eval Bar: ${showEvalBar ? 'ON' : 'OFF'}`);
};

window.requestHint = function() {
    let targetFen = (historyIndex >= 0 && gameHistory[historyIndex]) ? gameHistory[historyIndex].fen : game.fen();
    let tempBoard = new Chess(targetFen);
    if (tempBoard.game_over()) {
        $('#status').text("Position is already Checkmate/Draw — step back (<) to see earlier hints.");
        return;
    }
    $('#status').text("Engine calculating best solution move...");
    $.post('/eval', { fen: targetFen, depth: Math.max(16, engineMaxDepth), time: 0.35 }, function(data) {
        if (data && data.best_uci && data.best_uci.length >= 4) {
            let f = data.best_uci.substring(0, 2), t = data.best_uci.substring(2, 4);
            if (window.drawMoveArrow) window.drawMoveArrow(f, t, 'rgba(129, 182, 76, 0.88)');
            let turnSide = tempBoard.turn() === 'w' ? 'White' : 'Black';
            $('#status').text(`Best for ${turnSide}: ${data.best_san || data.best_uci} (Eval: ${data.text || '0.0'})`);
        }
    });
};

window.resignGame = function() {
    if (isMatchOver()) return;
    if (!confirm("Are you sure you want to resign this match?")) return;
    let winnerColor = (playerColor === 'w') ? 'b' : 'w';
    let winner = (winnerColor === 'w') ? getWhiteDisplayName() : getBlackDisplayName();
    $('#status').text(`Resigned — ${winner} Wins.`);
    finishMatchWithAnimation(winnerColor, 'resign', "Match Resigned", `${winner} won by resignation.`, false);
};

window.offerDrawToBot = function() {
    if (isMatchOver()) return;
    let rec = gameHistory[gameHistory.length - 1] || { cp: 0 };
    if (Math.abs(rec.cp || 0) <= 65) {
        $('#status').text("Draw Offer Accepted.");
        finishMatchWithAnimation('draw', 'draw', "Draw Agreed", "Match drawn by mutual agreement.", false);
    } else {
        playSnd('notify');
        $('#status').text("Bot declined the draw offer — position is unbalanced!");
    }
};

window.toggleFocusMode = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
};

window.toggleMovieReplay = function() {
    if (movieReplayTimer) {
        clearInterval(movieReplayTimer);
        movieReplayTimer = null;
        safeText('btn-replay-toggle', 'Play');
        return;
    }
    if (historyIndex >= gameHistory.length - 1) historyIndex = 0;
    safeText('btn-replay-toggle', 'Stop');
    movieReplayTimer = setInterval(() => {
        if (historyIndex < gameHistory.length - 1) {
            goForward();
        } else {
            clearInterval(movieReplayTimer);
            movieReplayTimer = null;
            safeText('btn-replay-toggle', 'Play');
        }
    }, Math.round(900 / replaySpeedMultiplier));
};

window.cycleReplaySpeed = function() {
    replaySpeedMultiplier = replaySpeedMultiplier === 1 ? 2 : (replaySpeedMultiplier === 2 ? 4 : 1);
    safeText('btn-replay-speed', replaySpeedMultiplier + 'x');
};

window.refreshEngineListInSettings = function() {
    $.get('/list_engines', function(data) {
        if (!data) return;
        availableEnginesList = data.engines || [];
        safeText('active-engine-realname', data.real_name || 'Stockfish 19');
        safeText('active-engine-proto', data.protocol || 'UCI');
        let threads = data.threads || 4;
        let hash = Math.min(4096, data.hash || 256);
        let nnue = data.use_nnue !== false;
        if (safeEl('engine-threads')) safeEl('engine-threads').value = String(threads);
        if (safeEl('engine-hash')) safeEl('engine-hash').value = String(hash);
        if (safeEl('setting-use-nnue')) safeEl('setting-use-nnue').checked = nnue;
        updateHardwarePillsUI(data.real_name || 'Stockfish 19', threads, hash, nnue);

        let listEl = $('#engine-radio-list');
        listEl.empty();
        availableEnginesList.forEach(eng => {
            let isAct = (eng.preset && eng.preset === data.preset) || (!eng.preset && !data.preset && eng.path === data.current);
            let row = $('<div>').addClass('engine-radio-item' + (isAct ? ' active-eng' : '')).html(`
                <div>
                    <div style="color:#fff; font-weight:700; font-size:12px;">${eng.name}</div>
                    <div style="color:#8c8c8c; font-size:10px;">${eng.desc}</div>
                </div>
                <span style="color:${isAct ? '#81b64c' : '#666'}; font-size:11px; font-weight:bold;">${isAct ? 'ACTIVE' : 'Select'}</span>
            `);
            row.on('click', () => {
                $.post('/switch_engine', { path: eng.path, preset: eng.preset || '' }, function(res) {
                    if (res && res.status === 'success') refreshEngineListInSettings();
                });
            });
            listEl.append(row);
        });
    });
};

function updateHardwarePillsUI(name, threads, hash, nnue) {
    let shortName = (name || 'Stockfish').split('(')[0].trim();
    safeText('live-hw-status', `${threads} Cores • ${hash} MB Hash • NNUE ${nnue ? 'ON' : 'OFF'}`);
    safeText('top-engine-pill', `${shortName} • ${threads}C/${hash}MB`);
}

window.applyLiveEngineHardware = function() {
    let threads = parseInt((safeEl('engine-threads') || {}).value || 4);
    let hash = Math.min(4096, parseInt((safeEl('engine-hash') || {}).value || 256));
    let nnue = safeEl('setting-use-nnue') ? safeEl('setting-use-nnue').checked : true;
    localStorage.setItem('pro_chess_hw_threads', String(threads));
    localStorage.setItem('pro_chess_hw_hash', String(hash));
    $.post('/update_engine', { threads: threads, hash: hash, use_nnue: nnue }, function(res) {
        if (res && res.status === 'success') {
            updateHardwarePillsUI(res.engine_name, res.threads, res.hash, res.use_nnue);
        }
    });
};

window.saveSettings = function() {
    soundEnabled = ((safeEl('setting-sound') || {}).value !== 'off');
    liveFeedbackEnabled = ((safeEl('setting-live-feedback') || {}).value === 'on');
    showEvalGraph = ((safeEl('setting-show-graph') || {}).value === 'on');
    showEngineLines = ((safeEl('setting-show-lines') || {}).value === 'on');
    showCoachTelemetry = ((safeEl('setting-show-telemetry') || {}).value === 'on');
    if (window.syncOptionalPanelsVisibility) window.syncOptionalPanelsVisibility();
    applyThemeAndPieces();
    applyLiveEngineHardware();
    closeModal('settings-modal');
};

window.installExtraEnginesOneClick = function() {
    safeText('engine-import-hint', 'Installing extra engines... please wait...');
    $.post('/install_extra_engines', {}, function(res) {
        safeText('engine-import-hint', res.message || 'Done!');
        refreshEngineListInSettings();
        populateSetupEngineSelectors();
    });
};

function updateCareerBannerUI() {
    let elo = parseInt(localStorage.getItem('career_elo') || '1200');
    let w = parseInt(localStorage.getItem('career_w') || '0');
    let l = parseInt(localStorage.getItem('career_l') || '0');
    let d = parseInt(localStorage.getItem('career_d') || '0');
    safeText(['career-elo-val', 'live-player-elo-pill', 'sidebar-elo-val'], `${elo} ELO`);
    safeText('career-wld-val', `W: ${w} | L: ${l} | D: ${d}`);
}

window.resetCareerRating = function() {
    if (!confirm("Reset your career rating back to 1200 ELO?")) return;
    localStorage.setItem('career_elo', '1200');
    localStorage.setItem('career_w', '0');
    localStorage.setItem('career_l', '0');
    localStorage.setItem('career_d', '0');
    updateCareerBannerUI();
};

window.updateCareerRatingOnGameEnd = function(forcedWinner) {
    if (gameMode !== 'pvb') {
        if (window.syncEloBadgeVisibility) window.syncEloBadgeVisibility();
        return;
    }
    let playerElo = parseInt(localStorage.getItem('career_elo') || '1200');
    let botElo = parseInt(String(currentBlackElo || '1500').replace('+', '')) || 1500;
    let w = parseInt(localStorage.getItem('career_w') || '0');
    let l = parseInt(localStorage.getItem('career_l') || '0');
    let d = parseInt(localStorage.getItem('career_d') || '0');

    let actualScore = 0.5;
    if (forcedWinner === 'w' || forcedWinner === 'b') {
        if (forcedWinner === playerColor) { actualScore = 1.0; w++; }
        else { actualScore = 0.0; l++; }
    } else {
        actualScore = 0.5; d++;
    }

    let expectedScore = 1.0 / (1.0 + Math.pow(10, (botElo - playerElo) / 400.0));
    let K = 32;
    let delta = Math.round(K * (actualScore - expectedScore));
    if (actualScore === 1.0 && delta < 4) delta = 4;
    if (actualScore === 0.0 && delta > -4) delta = -4;

    let newElo = Math.max(200, playerElo + delta);
    localStorage.setItem('career_elo', String(newElo));
    localStorage.setItem('career_w', String(w));
    localStorage.setItem('career_l', String(l));
    localStorage.setItem('career_d', String(d));

    let sign = delta >= 0 ? `+${delta}` : `${delta}`;
    safeText('modal-elo-change-banner', `Rating: ${newElo} ELO (${sign} vs ${botElo} Bot)`);
    updateCareerBannerUI();
};

const TACTICAL_PUZZLES = [
    { title: "Queen Sacrifice Mate", fen: "r1b1kb1r/pppp1ppp/5q2/4n3/3KP3/2N3PN/PPP4P/R1BQ1B1R b kq - 0 1" },
    { title: "Back Rank Strike", fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1" },
    { title: "Smothered Mate Motif", fen: "6rk/5Npp/8/8/8/8/8/4Q2K w - - 0 1" }
];
var puzzleIdx = 0;
window.loadNextPuzzle = function() {
    let p = TACTICAL_PUZZLES[puzzleIdx % TACTICAL_PUZZLES.length];
    puzzleIdx++;
    game.load(p.fen);
    playerColor = game.turn();
    currentBoardOrientation = playerColor;
    gameHistory = [{ fen: game.fen(), move: null, moveObj: null, soundType: 'move', evalScore: 50.0, evalText: "0.0", cp: 0 }];
    historyIndex = 0;
    renderBoard();
    $('#status').text(`Puzzle: ${p.title} (${playerColor === 'w' ? 'White' : 'Black'} to move)`);
};

const ENDGAME_DRILLS = [
    { name: "King + Queen vs King", fen: "8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1" },
    { name: "King + Rook vs King", fen: "8/8/8/4k3/8/8/4R3/4K3 w - - 0 1" },
    { name: "Lucena Rook Endgame", fen: "1K6/1P1k4/8/8/8/8/2R5/4r3 w - - 0 1" }
];
window.openEndgameModal = function() {
    let sel = $('#endgame-select');
    sel.empty();
    ENDGAME_DRILLS.forEach((d, idx) => sel.append(`<option value="${idx}" ${idx===0?'selected':''}>${d.name}</option>`));
    safeDisplay('endgame-modal', 'flex');
};
window.startEndgameDrill = function() {
    let idx = parseInt($('#endgame-select').val() || '0');
    let d = ENDGAME_DRILLS[idx] || ENDGAME_DRILLS[0];
    closeModal('endgame-modal');
    game.load(d.fen);
    gameMode = 'pvb'; playerColor = 'w'; currentBoardOrientation = 'w';
    gameHistory = [{ fen: game.fen(), move: null, moveObj: null, soundType: 'move', evalScore: 50.0, evalText: "0.0", cp: 0 }];
    historyIndex = 0;
    renderBoard();
    $('#status').text(`Endgame Drill: ${d.name}`);
};

$(document).ready(function() {
    if (parseInt(localStorage.getItem('pro_chess_hw_hash') || '256') > 4096) {
        localStorage.setItem('pro_chess_hw_hash', '256');
    }
    safeDisplay('btn-board-hint', showHintButton ? 'inline-block' : 'none');
    updateCareerBannerUI();
    refreshEngineListInSettings();
    populateSetupEngineSelectors();
    startGame(false);
});
