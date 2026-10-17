/* ============================================================================
   static/mod_analysis.js (v100 - Step 3)
   Chess.com Style White/Black Evaluation Graph + Click-to-Jump + Move Badges
   ============================================================================ */

var matchAccuracyData = { wAcc: 100, bAcc: 100, wAcpl: 12, bAcpl: 15, counts: {} };

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

    // 1. Black Advantage Background (Top Half Dark) & Base
    ctx.fillStyle = '#262421';
    ctx.fillRect(0, 0, w, h);

    let len = gameHistory.length;
    let step = w / Math.max(1, len - 1);

    // 2. White Advantage Filled Area (Chess.com White Fill under curve)
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

    // 3. Center 0.0 Equal Evaluation Dashed Line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(129, 182, 76, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Evaluation Curve Stroke
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

    // 5. Current Viewed Move Vertical Cursor Line
    if (historyIndex >= 0 && historyIndex < len && len > 1) {
        let cx = historyIndex * step;
        ctx.beginPath();
        ctx.strokeStyle = '#f0c15c';
        ctx.lineWidth = 1.5;
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
    }

    // 6. Plot Key Move Quality Dots (Blunders, Mistakes, Inaccuracies)
    for (let i = 1; i < len; i++) {
        let rec = gameHistory[i];
        if (!rec || !rec.classification) continue;
        let lbl = rec.classification.label;
        if (lbl === 'Blunder' || lbl === 'Mistake' || lbl === 'Inaccuracy') {
            let sc = rec.evalScore !== undefined ? rec.evalScore : 50.0;
            let clamped = Math.max(6, Math.min(94, sc));
            let x = i * step;
            let y = h - (clamped / 100.0) * h;
            ctx.beginPath();
            ctx.arc(x, y, lbl === 'Blunder' ? 3.5 : 2.8, 0, Math.PI * 2);
            ctx.fillStyle = rec.classification.color;
            ctx.fill();
            ctx.strokeStyle = '#141311';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // 7. Bind click/tap on graph to jump to that move
    if (isInteractive && !canvas.dataset.boundClick) {
        canvas.dataset.boundClick = "1";
        canvas.addEventListener('click', function(e) {
            if (gameHistory.length <= 1) return;
            let rect = canvas.getBoundingClientRect();
            let ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            let targetIdx = Math.round(ratio * (gameHistory.length - 1));
            historyIndex = targetIdx;
            playSoundForHistoryRec(gameHistory[historyIndex]);
            renderBoard();
            showAnalysisStatus();
            drawAllEvalGraphs();
            drawKundliEvalGraph();
        });
    }
}

window.drawKundliEvalGraph = function() {
    renderChessComGraphOnCanvas('kundli-eval-graph', true);
};

window.drawAllEvalGraphs = function() {
    renderChessComGraphOnCanvas('main-eval-graph', true);
};
