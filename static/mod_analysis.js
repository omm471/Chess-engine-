/* ============================================================================
   static/mod_analysis.js (v104 - Complete Interactive Puzzle Engine)
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
    let loss = (side === 'w') ? Math.max(0, prevCp - currCp) : Math.max(0, currCp - prevCp);

    let classification = { label: "Good", symbol: "✓", color: "#739552" };
    if ((curr.bestMoveSan && curr.moveObj.san === curr.bestMoveSan) || loss <= 15) {
        classification = { label: "Best", symbol: "★", color: "#81b64c" };
    } else if (loss > 250) {
        classification = { label: "Blunder", symbol: "??", color: "#ca3431" };
    } else if (loss > 125) {
        classification = { label: "Mistake", symbol: "?", color: "#e67e22" };
    } else if (loss > 55) {
        classification = { label: "Inaccuracy", symbol: "?!", color: "#d97706" };
    }
    curr.classification = classification;
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

function renderChessComGraphOnCanvas(canvasId, isInteractive) {
    let canvas = safeEl(canvasId);
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    let w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#262421';
    ctx.fillRect(0, 0, w, h);

    let len = gameHistory.length;
    let step = w / Math.max(1, len - 1);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < len; i++) {
        let sc = (gameHistory[i] && gameHistory[i].evalScore !== undefined) ? gameHistory[i].evalScore : 50.0;
        let clamped = Math.max(4, Math.min(96, sc));
        let x = (len === 1) ? w : (i * step);
        let y = h - (clamped / 100.0) * h;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(238, 238, 238, 0.88)';
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#81b64c';
    ctx.lineWidth = 2;
    for (let i = 0; i < len; i++) {
        let sc = (gameHistory[i] && gameHistory[i].evalScore !== undefined) ? gameHistory[i].evalScore : 50.0;
        let clamped = Math.max(4, Math.min(96, sc));
        let x = (len === 1) ? w : (i * step);
        let y = h - (clamped / 100.0) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (historyIndex >= 0 && historyIndex < len && len > 1) {
        let cx = historyIndex * step;
        ctx.beginPath();
        ctx.strokeStyle = '#f0c15c';
        ctx.lineWidth = 1.5;
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
    }
}

window.renderEvaluationGraphWithBaseline = function(canvasId, historyData) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    let W = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : 340;
    let H = canvas.height = 140;

    let points = (historyData && historyData.length > 0) ? historyData : gameHistory;
    if (!points || points.length < 2) {
        ctx.clearRect(0, 0, W, H);
        return;
    }

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, W, H);

    // 1. RED BASELINE (Center Line: 0.0 Eval)
    let midY = H / 2;
    ctx.beginPath();
    ctx.strokeStyle = "#e03131"; // Sharp Red Baseline
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); // Dashed line
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Baseline label
    ctx.fillStyle = "#e03131";
    ctx.font = "10px sans-serif";
    ctx.fillText("0.0", 4, midY - 4);

    let stepX = W / (points.length - 1);

    // Eval conversion to Y-axis coordinates (-10 to +10 range)
    function evalToY(rec) {
        let cp = (rec.cp !== undefined) ? rec.cp : 0;
        let clamped = Math.max(-1000, Math.min(1000, cp));
        // +1000 CP -> top (0px), -1000 CP -> bottom (H)
        return midY - (clamped / 1000) * (midY - 12);
    }

    // 2. Draw Eval Curve Fill & Line
    ctx.beginPath();
    ctx.moveTo(0, evalToY(points[0]));
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(i * stepX, evalToY(points[i]));
    }
    ctx.strokeStyle = "#81b64c";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. BLUNDER, MISTAKE & INACCURACY MARKERS ON GRAPH
    points.forEach((rec, idx) => {
        if (idx === 0) return;
        let x = idx * stepX;
        let y = evalToY(rec);

        // Blunder (Red Dot)
        if (rec.classification && (rec.classification.label === 'Blunder' || rec.classification.symbol === '??')) {
            ctx.beginPath();
            ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
            ctx.fillStyle = "#fa4141";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        // Mistake (Orange Dot)
        else if (rec.classification && (rec.classification.label === 'Mistake' || rec.classification.symbol === '?')) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "#fa8c16";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // Inaccuracy (Yellow Dot)
        else if (rec.classification && (rec.classification.label === 'Inaccuracy' || rec.classification.symbol === '?!')) {
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = "#fadb14";
            ctx.fill();
        }
    });
};

// Global mapper link
window.drawAllEvalGraphs = function() {
    window.renderEvaluationGraphWithBaseline('main-eval-canvas', gameHistory);
    window.renderEvaluationGraphWithBaseline('report-eval-canvas', gameHistory);
};

// Accurate Hint Arrow Calculation
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
