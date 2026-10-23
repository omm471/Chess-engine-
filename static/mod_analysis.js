/* ============================================================================
   static/mod_analysis.js (v105 - Red Baseline & Blunder/Mistake Graph Engine)
   - Red 0.0 Eval Baseline with center equality marker
   - Real-time Blunder (Red), Mistake (Orange) & Inaccuracy (Yellow) Graph Dots
   - Interactive Canvas Scrubber: Tap on graph to jump directly to any move
   - Interactive Tactics & Puzzle Engine with Hint Arrows
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

window.classifyMoveByEval = function(idx) {
    if (idx <= 0 || idx >= gameHistory.length) return;
    let curr = gameHistory[idx];
    let prev = gameHistory[idx - 1];
    if (!curr || !prev || !curr.moveObj) return;

    let side = curr.moveObj.color;
    let prevCp = (prev.cp !== undefined) ? prev.cp : 0;
    let currCp = (curr.cp !== undefined) ? curr.cp : prevCp;
    let loss = (side === 'w') ? (prevCp - currCp) : (currCp - prevCp);

    // Score fallback agar CP flat ho
    if (loss <= 0 && prev.evalScore !== undefined && curr.evalScore !== undefined) {
        let scoreLoss = (side === 'w') ? (prev.evalScore - curr.evalScore) : (curr.evalScore - prev.evalScore);
        if (scoreLoss > 0) loss = scoreLoss * 15;
    }

    let classification = { label: "Good", symbol: "✓", color: "#739552" };
    if ((curr.bestMoveSan && curr.moveObj.san === curr.bestMoveSan) || loss <= 15) {
        classification = { label: "Best", symbol: "★", color: "#81b64c" };
    } else if (loss > 220) {
        classification = { label: "Blunder", symbol: "??", color: "#fa4141" };
    } else if (loss > 110) {
        classification = { label: "Mistake", symbol: "?", color: "#fa8c16" };
    } else if (loss > 45) {
        classification = { label: "Inaccuracy", symbol: "?!", color: "#fadb14" };
    }
    curr.classification = classification;
    return classification;
};

window.updateAccuracySummary = function() {
    let wTotal = 0, bTotal = 0, wCount = 0, bCount = 0;
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
    safeText(['white-acc-text', 'k-w-acc', 'modal-p1-acc'], wAvg + '%');
    safeText(['black-acc-text', 'k-b-acc', 'modal-p2-acc'], bAvg + '%');
};

// ============================================================================
// UNIFIED EVALUATION GRAPH ENGINE (RED BASELINE + BLUNDER & MISTAKE MARKERS)
// ============================================================================

function drawUnifiedEvalGraph(canvasTarget, customHistory) {
    let canvas = (typeof canvasTarget === 'string') ? document.getElementById(canvasTarget) : canvasTarget;
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (!ctx) return;

    let parent = canvas.parentElement;
    let W = canvas.width = (parent && parent.clientWidth > 50) ? parent.clientWidth : (canvas.width || 340);
    let H = canvas.height = (canvas.height > 50) ? canvas.height : 140;

    let points = (customHistory && customHistory.length > 0) ? customHistory : gameHistory;
    if (!points || points.length === 0) {
        ctx.clearRect(0, 0, W, H);
        return;
    }

    let len = points.length;

    // Dark Background
    ctx.fillStyle = '#21201d';
    ctx.fillRect(0, 0, W, H);

    let midY = H / 2;

    // Coordinate mapping: 50% / 0.0 eval is exactly at midY
    function getYForPoint(rec) {
        if (!rec) return midY;
        let score = rec.evalScore;
        if (score === undefined && rec.cp !== undefined) {
            score = 50.0 + 50.0 * (2.0 / (1.0 + Math.exp(-0.00368208 * rec.cp)) - 1.0);
        }
        if (score === undefined) score = 50.0;
        let clamped = Math.max(3, Math.min(97, score));
        return H - (clamped / 100.0) * H;
    }

    let stepX = len <= 1 ? W : (W / (len - 1));

    // 1. Advantage Fill
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < len; i++) {
        let x = i * stepX;
        let y = getYForPoint(points[i]);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(235, 235, 235, 0.88)'; // White advantage fill
    ctx.fill();

    // Dark tint below baseline for Black advantage
    ctx.fillStyle = 'rgba(33, 32, 29, 0.75)';
    ctx.fillRect(0, midY, W, H - midY);

    // 2. RED BASELINE (0.0 Center Equal Line)
    ctx.beginPath();
    ctx.strokeStyle = '#ff3b30'; // Sharp Red Line
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid

    // Red Baseline Label: "0.0"
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('0.0', 6, midY - 4);

    // 3. Green Eval Trend Curve
    ctx.beginPath();
    ctx.strokeStyle = '#81b64c';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < len; i++) {
        let x = i * stepX;
        let y = getYForPoint(points[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. Current Move Scrubber
    let activeIdx = (typeof historyIndex !== 'undefined') ? historyIndex : (len - 1);
    if (activeIdx >= 0 && activeIdx < len && len > 1) {
        let cx = activeIdx * stepX;
        ctx.beginPath();
        ctx.strokeStyle = '#f0c15c';
        ctx.lineWidth = 1.8;
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, H);
        ctx.stroke();
    }

    // 5. BLUNDER, MISTAKE & INACCURACY DOTS ON GRAPH
    for (let i = 1; i < len; i++) {
        let rec = points[i];
        if (!rec) continue;

        if (!rec.classification && window.classifyMoveByEval) {
            window.classifyMoveByEval(i);
        }

        let cls = rec.classification;
        if (!cls) continue;

        let dotX = i * stepX;
        let dotY = getYForPoint(rec);
        let dotColor = null;
        let radius = 4;

        if (cls.label === 'Blunder' || cls.symbol === '??') {
            dotColor = '#fa4141'; // Bright Red
            radius = 5.2;
        } else if (cls.label === 'Mistake' || cls.symbol === '?') {
            dotColor = '#fa8c16'; // Orange
            radius = 4.4;
        } else if (cls.label === 'Inaccuracy' || cls.symbol === '?!') {
            dotColor = '#fadb14'; // Yellow
            radius = 3.6;
        }

        if (dotColor) {
            ctx.beginPath();
            ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }
    }

    // Interactive Tap to Jump
    if (!canvas.dataset.graphBound) {
        canvas.dataset.graphBound = "1";
        canvas.style.cursor = "pointer";

        function onGraphTap(e) {
            let rect = canvas.getBoundingClientRect();
            let clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            let clickX = clientX - rect.left;
            let ratio = Math.max(0, Math.min(1, clickX / rect.width));
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

// Dono purane functions ko naye engine se link kar diya gaya hai
function renderChessComGraphOnCanvas(canvasId, isInteractive) {
    drawUnifiedEvalGraph(canvasId, gameHistory);
}

window.renderEvaluationGraphWithBaseline = function(canvasId, historyData) {
    drawUnifiedEvalGraph(canvasId, historyData || gameHistory);
};

window.drawAllEvalGraphs = function() {
    ['main-eval-canvas', 'report-eval-canvas', 'eval-graph-canvas', 'review-eval-canvas'].forEach(id => {
        let el = document.getElementById(id);
        if (el) drawUnifiedEvalGraph(el, gameHistory);
    });
};

// ============================================================================
// HINTS, ARROWS & PUZZLE ENGINE
// ============================================================================

window.drawArrow = function(fromSq, toSq, color = 'rgba(74, 143, 240, 0.85)') {
    let svg = safeEl('arrow-overlay');
    if (!svg) return;

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
            safeText('status', `Hint: Move from ${from.toUpperCase()} to ${to.toUpperCase()}`);
            return;
        }
    }
    if (typeof fetchEngineHint === 'function') fetchEngineHint();
};

window.triggerPuzzleVictory = function() {
    let pz = window.activePuzzle;
    pz.isRunning = false;

    safeText('status', '🏆 Brilliant! Puzzle Solved Successfully!');
    if (typeof playSound === 'function') playSound('game-end');

    safeText('puzzle-modal-title', 'Brilliant! Puzzle Solved');
    safeText('puzzle-modal-rating', `Rating: ${pz.rating} ELO • Puzzle #${pz.id}`);
    safeText('puzzle-modal-theme', pz.theme || 'Tactics, Endgame');
    
    setTimeout(() => { safeDisplay('puzzle-modal', 'flex'); }, 400);
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

        safeText('status', '✓ Best move! Opponent replying...');
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
                    safeText('status', 'Your turn! Find the next winning move.');
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
            safeText('status', '✘ Not the best move! Try again.');
        }, 250);
        return true;
    }
};

window.fetchNextPuzzle = function() {
    closeModal('puzzle-modal');
    let pz = window.activePuzzle;
    if (pz && pz.currentTier) {
        window.loadPuzzleByLevel(pz.currentTier);
    } else {
        window.loadDailyPuzzle();
    }
};

window.retryCurrentPuzzle = function() {
    closeModal('puzzle-modal');
    let pz = window.activePuzzle;
    if (pz && pz.initialFen) {
        game.reset();
        game.load(pz.initialFen);
        gameHistory = [{ fen: pz.initialFen, moveObj: null }];
        historyIndex = 0;
        pz.plyIndex = 0;
        pz.isRunning = true;
        clearArrows();
        if (typeof renderBoard === 'function') renderBoard();
        safeText('status', `🧩 Puzzle Restarted! Find the winning move.`);
    }
};

window.analyzeCurrentPuzzlePosition = function() {
    closeModal('puzzle-modal');
    window.activePuzzle.isRunning = false;
    isAnalysisBranchMode = true;
    safeText('status', 'Analysis Free Play Mode — Move pieces freely or tap Hint.');
    if (typeof openDeepReport === 'function') openDeepReport();
};
