/* ============================================================================
   static/mod_analysis.js (v123 - Universal Canvas Graph & Blunder Dot Engine)
   - Guaranteed Graph Rendering: Chess.com style eval fill + green trendline
   - Dual Canvas Binding: Auto-detects #kundli-eval-graph and #main-eval-graph
   - Dynamic Centipawn (cp) to Eval Curve conversion (Zero Blank Graph)
   - Red Dashed Baseline at 0.0 with "0.0" indicator text
   - Blunder (Red ??), Mistake (Orange ?), and Inaccuracy (Yellow ?!) markers
   - Interactive Scrubber: Tap/Click anywhere on graph to jump to that move
   ============================================================================ */

var matchAccuracyData = { wAcc: 100, bAcc: 100, wAcpl: 12, bAcpl: 15, counts: {} };

window.activePuzzle = {
    isRunning: false,
    id: "",
    rating: 0,
    solution: [],
    plyIndex: 0,
    playerColor: 'w',
    initialFen: "",
    theme: "",
    currentTier: "1600"
};

// ============================================================================
// MOVE EVALUATION & CLASSIFICATION ENGINE (NULL-SAFE)
// ============================================================================
window.classifyMoveByEval = function(idx) {
    if (idx <= 0 || !gameHistory || idx >= gameHistory.length) return null;
    let curr = gameHistory[idx];
    let prev = gameHistory[idx - 1];
    if (!curr || !prev) return null;

    let side = (curr.moveObj && curr.moveObj.color) ? curr.moveObj.color : (idx % 2 === 1 ? 'w' : 'b');
    let prevCp = (prev.cp !== undefined && !isNaN(prev.cp)) ? Number(prev.cp) : 0;
    let currCp = (curr.cp !== undefined && !isNaN(curr.cp)) ? Number(curr.cp) : prevCp;
    let loss = (side === 'w') ? (prevCp - currCp) : (currCp - prevCp);

    if (loss <= 0 && prev.evalScore !== undefined && curr.evalScore !== undefined) {
        let scoreLoss = (side === 'w') ? (Number(prev.evalScore) - Number(curr.evalScore)) : (Number(curr.evalScore) - Number(prev.evalScore));
        if (scoreLoss > 0) loss = scoreLoss * 15;
    }

    let classification = { label: "Good", symbol: "✓", color: "#739552" };
    if ((curr.bestMoveSan && curr.moveObj && curr.moveObj.san === curr.bestMoveSan) || loss <= 15) {
        classification = { label: "Best", symbol: "★", color: "#81b64c" };
    } else if (loss > 200) {
        classification = { label: "Blunder", symbol: "??", color: "#fa4141" };
    } else if (loss > 100) {
        classification = { label: "Mistake", symbol: "?", color: "#fa8c16" };
    } else if (loss > 40) {
        classification = { label: "Inaccuracy", symbol: "?!", color: "#fadb14" };
    }
    curr.classification = classification;
    return classification;
};

window.updateAccuracySummary = function() {
    let wTotal = 0, bTotal = 0, wCount = 0, bCount = 0;
    if (!gameHistory || !Array.isArray(gameHistory)) return;

    gameHistory.forEach((rec, idx) => {
        if (idx === 0 || !rec.moveObj) return;
        let prevCp = gameHistory[idx - 1].cp || 0;
        let currCp = rec.cp !== undefined ? rec.cp : prevCp;
        let loss = (rec.moveObj.color === 'w') ? Math.max(0, prevCp - currCp) : Math.max(0, currCp - prevCp);
        let acc = Math.max(10, Math.min(100, 103.16 * Math.exp(-0.004 * loss)));
        if (rec.moveObj.color === 'w') { wTotal += acc; wCount++; }
        else { bTotal += acc; bCount++; }
    });

    let wAvg = wCount > 0 ? (Math.round((wTotal / wCount) * 10) / 10) : 100.0;
    let bAvg = bCount > 0 ? (Math.round((bTotal / bCount) * 10) / 10) : 100.0;
    matchAccuracyData.wAcc = wAvg;
    matchAccuracyData.bAcc = bAvg;

    if (typeof safeText === 'function') {
        safeText(['white-acc-text', 'k-w-acc', 'modal-p1-acc'], wAvg + '%');
        safeText(['black-acc-text', 'k-b-acc', 'modal-p2-acc'], bAvg + '%');
    }
};

// ============================================================================
// CHESS.COM EVALUATION GRAPH WITH RED BASELINE & BLUNDER/MISTAKE DOTS
// ============================================================================
function renderChessComGraphOnCanvas(canvasId, isInteractive) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive Canvas Resizing: Ensures graph is never stretched or 0px
    let rect = canvas.getBoundingClientRect();
    let w = Math.round(rect.width || canvas.clientWidth || canvas.width || 310);
    let h = Math.round(rect.height || canvas.clientHeight || canvas.height || 75);

    if (w < 60) w = 310;
    if (h < 30) h = 75;

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    let len = (typeof gameHistory !== 'undefined' && gameHistory) ? gameHistory.length : 0;
    if (len === 0) {
        ctx.fillStyle = '#181715';
        ctx.fillRect(0, 0, w, h);
        return;
    }

    // 1. Dark Background
    ctx.fillStyle = '#1e1d1a';
    ctx.fillRect(0, 0, w, h);

    let midY = h / 2;
    let step = (len <= 1) ? w : (w / (len - 1));

    // Helper: Centipawns to Win Percentage (fallback if evalScore is missing)
    function getNormalizedEvalScore(rec) {
        if (!rec) return 50.0;
        if (rec.evalScore !== undefined && !isNaN(rec.evalScore)) {
            return Number(rec.evalScore);
        }
        if (rec.cp !== undefined && !isNaN(rec.cp)) {
            let cpVal = Number(rec.cp);
            return Math.max(2.0, Math.min(98.0, 50.0 + 50.0 * (2.0 / (1.0 + Math.exp(-0.00368208 * cpVal)) - 1.0)));
        }
        return 50.0;
    }

    // 2. White Advantage Fill (Under the curve)
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < len; i++) {
        let sc = getNormalizedEvalScore(gameHistory[i]);
        let clamped = Math.max(3, Math.min(97, sc));
        let x = (len === 1) ? w : (i * step);
        let y = h - (clamped / 100.0) * h;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(238, 238, 238, 0.82)';
    ctx.fill();

    // 3. RED BASELINE (0.0 Center Equal Line)
    ctx.beginPath();
    ctx.strokeStyle = '#ff3b30'; // Sharp Red Line
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Red "0.0" baseline indicator
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('0.0', 4, midY - 3);

    // 4. Green Trendline on Top
    ctx.beginPath();
    ctx.strokeStyle = '#81b64c';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < len; i++) {
        let sc = getNormalizedEvalScore(gameHistory[i]);
        let clamped = Math.max(3, Math.min(97, sc));
        let x = (len === 1) ? w : (i * step);
        let y = h - (clamped / 100.0) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 5. Active Move Scrubber Line
    let activeIdx = (typeof historyIndex !== 'undefined') ? historyIndex : (len - 1);
    if (activeIdx >= 0 && activeIdx < len && len > 1) {
        let cx = activeIdx * step;
        ctx.beginPath();
        ctx.strokeStyle = '#f0c15c';
        ctx.lineWidth = 1.6;
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
    }

    // 6. BLUNDER (Red), MISTAKE (Orange) & INACCURACY (Yellow) MARKERS
    for (let i = 1; i < len; i++) {
        let rec = gameHistory[i];
        if (!rec) continue;

        let cls = rec.classification;
        if (!cls && window.classifyMoveByEval) {
            cls = window.classifyMoveByEval(i);
        }
        if (!cls) continue;

        let sc = getNormalizedEvalScore(rec);
        let clamped = Math.max(3, Math.min(97, sc));
        let dotX = i * step;
        let dotY = h - (clamped / 100.0) * h;

        let dotColor = null;
        let radius = 3.5;

        if (cls.label === 'Blunder' || cls.symbol === '??') {
            dotColor = '#fa4141';
            radius = 5.0;
        } else if (cls.label === 'Mistake' || cls.symbol === '?') {
            dotColor = '#fa8c16';
            radius = 4.0;
        } else if (cls.label === 'Inaccuracy' || cls.symbol === '?!') {
            dotColor = '#fadb14';
            radius = 3.2;
        }

        if (dotColor) {
            ctx.beginPath();
            ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }

    // 7. Interactive Scrubber Tap (Jump to Move)
    if (!canvas.dataset.graphBound) {
        canvas.dataset.graphBound = "1";
        canvas.style.cursor = "pointer";

        function onGraphTap(e) {
            let crect = canvas.getBoundingClientRect();
            let clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
            let clickX = clientX - crect.left;
            let ratio = Math.max(0, Math.min(1, clickX / crect.width));
            let targetPly = Math.round(ratio * (gameHistory.length - 1));

            if (targetPly >= 0 && targetPly < gameHistory.length) {
                historyIndex = targetPly;
                if (typeof renderBoard === 'function') renderBoard();
                if (typeof updateStatus === 'function') updateStatus();
                if (typeof showAnalysisStatus === 'function') showAnalysisStatus();
                if (typeof playSoundForHistoryRec === 'function') playSoundForHistoryRec(gameHistory[historyIndex]);
                if (window.drawAllEvalGraphs) window.drawAllEvalGraphs();
            }
        }

        canvas.addEventListener('click', onGraphTap);
        canvas.addEventListener('touchstart', onGraphTap, { passive: true });
    }
}

// Global Hooks connecting all callers to the same reliable graph engine
window.renderChessComGraphOnCanvas = renderChessComGraphOnCanvas;
window.renderEvaluationGraphWithBaseline = function(canvasId) { renderChessComGraphOnCanvas(canvasId); };

window.drawAllEvalGraphs = function() {
    // Both Kundli Modal Canvas & Main Board Canvas are registered
    let ids = [
        'kundli-eval-graph',
        'main-eval-graph',
        'report-eval-canvas',
        'main-eval-canvas',
        'eval-graph-canvas'
    ];
    ids.forEach(id => {
        let el = document.getElementById(id);
        if (el) renderChessComGraphOnCanvas(id);
    });
};

window.drawKundliGraph = function() {
    renderChessComGraphOnCanvas('kundli-eval-graph');
};

// Auto-trigger graph render when Report Modal is opened
$(document).on('click', '#btn-deep-report, [onclick*="openDeepReport"]', function() {
    setTimeout(function() {
        renderChessComGraphOnCanvas('kundli-eval-graph');
    }, 80);
});

// ============================================================================
// HINTS, ARROWS & PUZZLE ENGINE
// ============================================================================
window.drawArrow = function(fromSq, toSq, color = 'rgba(74, 143, 240, 0.85)') {
    let svg = (typeof safeEl === 'function') ? safeEl('arrow-overlay') : document.getElementById('arrow-overlay');
    if (!svg) return;

    if (typeof sqToSvgCoords !== 'function') return;
    let p1 = sqToSvgCoords(fromSq);
    let p2 = sqToSvgCoords(toSq);

    let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let arrowLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    let endX = p1.x + (arrowLength - 6) * Math.cos(angle);
    let endY = p1.y + (arrowLength - 6) * Math.sin(angle);

    let arrowSvg = `
        <defs>
            <marker id="hint-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="${color}" />
            </marker>
        </defs>
        <line x1="${p1.x}" y1="${p1.y}" x2="${endX}" y2="${endY}" 
              stroke="${color}" stroke-width="6" stroke-linecap="round" 
              marker-end="url(#hint-arrowhead)" />
    `;
    svg.innerHTML = arrowSvg;
};

window.requestHint = function() {
    if (window.activePuzzle && window.activePuzzle.isRunning) {
        let pz = window.activePuzzle;
        let expectedUci = pz.solution[pz.plyIndex];
        if (expectedUci && expectedUci.length >= 4) {
            let from = expectedUci.slice(0, 2);
            let to = expectedUci.slice(2, 4);
            window.drawArrow(from, to, 'rgba(129, 182, 76, 0.9)');
            if (typeof safeText === 'function') safeText('status', `Hint: Move from ${from.toUpperCase()} to ${to.toUpperCase()}`);
            return;
        }
    }
    if (typeof fetchEngineHint === 'function') fetchEngineHint();
};

window.triggerPuzzleVictory = function() {
    let pz = window.activePuzzle;
    pz.isRunning = false;

    if (typeof safeText === 'function') {
        safeText('status', '🏆 Brilliant! Puzzle Solved Successfully!');
        safeText('puzzle-modal-title', 'Brilliant! Puzzle Solved');
        safeText('puzzle-modal-rating', `Rating: ${pz.rating} ELO • Puzzle #${pz.id}`);
        safeText('puzzle-modal-theme', pz.theme || 'Tactics, Endgame');
    }
    if (typeof playSound === 'function') playSound('game-end');
    
    setTimeout(() => {
        if (typeof safeDisplay === 'function') safeDisplay('puzzle-modal', 'flex');
    }, 400);
};

window.checkPuzzlePlayerMove = function(userMoveUci) {
    if (!window.activePuzzle || !window.activePuzzle.isRunning) return false;

    let pz = window.activePuzzle;
    let expectedUci = pz.solution[pz.plyIndex];

    if (userMoveUci.startsWith(expectedUci) || userMoveUci === expectedUci) {
        pz.plyIndex++;
        
        if (pz.plyIndex >= pz.solution.length) {
            window.triggerPuzzleVictory();
            return true;
        }

        if (typeof safeText === 'function') safeText('status', '✓ Best move! Opponent replying...');
        let oppUci = pz.solution[pz.plyIndex];
        pz.plyIndex++;

        setTimeout(() => {
            let from = oppUci.slice(0, 2);
            let to = oppUci.slice(2, 4);
            let promo = oppUci.length > 4 ? oppUci[4] : undefined;
            let mObj = game.move({ from: from, to: to, promotion: promo });

            if (mObj) {
                gameHistory.push({ fen: game.fen(), moveObj: mObj });
                historyIndex = gameHistory.length - 1;
                if (typeof renderBoard === 'function') renderBoard();
                if (typeof playSoundForMove === 'function') playSoundForMove(mObj);

                if (pz.plyIndex >= pz.solution.length) {
                    window.triggerPuzzleVictory();
                } else {
                    if (typeof safeText === 'function') safeText('status', 'Your turn! Find the next winning move.');
                }
            }
        }, 450);

        return true;
    } else {
        setTimeout(() => {
            game.undo();
            if (gameHistory.length > 1) {
                gameHistory.pop();
                historyIndex = gameHistory.length - 1;
            }
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof playSound === 'function') playSound('illegal');
            if (typeof safeText === 'function') safeText('status', '✘ Not the best move! Try again.');
        }, 250);
        return true;
    }
};

window.fetchNextPuzzle = function() {
    if (typeof closeModal === 'function') closeModal('puzzle-modal');
    let pz = window.activePuzzle;
    if (pz && pz.currentTier && typeof window.loadPuzzleByLevel === 'function') {
        window.loadPuzzleByLevel(pz.currentTier);
    } else if (typeof window.loadDailyPuzzle === 'function') {
        window.loadDailyPuzzle();
    }
};

window.retryCurrentPuzzle = function() {
    if (typeof closeModal === 'function') closeModal('puzzle-modal');
    let pz = window.activePuzzle;
    if (pz && pz.initialFen) {
        game.reset();
        game.load(pz.initialFen);
        gameHistory = [{ fen: pz.initialFen, moveObj: null }];
        historyIndex = 0;
        pz.plyIndex = 0;
        pz.isRunning = true;
        if (typeof clearArrows === 'function') clearArrows();
        if (typeof renderBoard === 'function') renderBoard();
        if (typeof safeText === 'function') safeText('status', `🧩 Puzzle Restarted! Find the winning move.`);
    }
};

window.analyzeCurrentPuzzlePosition = function() {
    if (typeof closeModal === 'function') closeModal('puzzle-modal');
    window.activePuzzle.isRunning = false;
    isAnalysisBranchMode = true;
    if (typeof safeText === 'function') safeText('status', 'Analysis Free Play Mode — Move pieces freely or tap Hint.');
    if (typeof openDeepReport === 'function') openDeepReport();
};
