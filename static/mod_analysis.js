/* ============================================================================
   static/mod_analysis.js (v102 - Interactive Puzzle Trainer & Engine Graph)
   ============================================================================ */

var matchAccuracyData = { wAcc: 100, bAcc: 100, wAcpl: 12, bAcpl: 15, counts: {} };

// Interactive Puzzle State
window.activePuzzle = {
    isRunning: false,
    id: "",
    rating: 0,
    solution: [],  // ["e2e4", "e7e5", ...]
    plyIndex: 0
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
    ctx.strokeStyle = 'rgba(129, 182, 76, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

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

    if (isInteractive && !canvas.dataset.boundClick) {
        canvas.dataset.boundClick = "1";
        canvas.addEventListener('click', function(e) {
            if (gameHistory.length <= 1) return;
            let rect = canvas.getBoundingClientRect();
            let ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            let targetIdx = Math.round(ratio * (gameHistory.length - 1));
            historyIndex = targetIdx;
            if (typeof playSoundForHistoryRec === 'function') playSoundForHistoryRec(gameHistory[historyIndex]);
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof showAnalysisStatus === 'function') showAnalysisStatus();
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

// ============================================================================
// 100% INTERACTIVE PUZZLE ENGINE (VERIFIES MOVES & REPLIES AS OPPONENT)
// ============================================================================
window.loadDailyPuzzle = function() {
    safeText('status', 'Fetching Daily Puzzle from Lichess...');
    fetch('/api/daily_puzzle')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.fen && data.solution && data.solution.length > 0) {
                game.reset();
                game.load(data.fen);
                
                gameHistory = [{ fen: data.fen, moveObj: null }];
                historyIndex = 0;
                matchEnded = false;

                window.activePuzzle = {
                    isRunning: true,
                    id: data.id,
                    rating: data.rating,
                    solution: data.solution,
                    plyIndex: 0
                };

                // Orient board to player perspective
                if (data.turn && typeof isBoardFlipped !== 'undefined' && typeof flipBoardUI === 'function') {
                    if ((data.turn === 'b' && !isBoardFlipped) || (data.turn === 'w' && isBoardFlipped)) {
                        flipBoardUI();
                    }
                }

                if (typeof renderBoard === 'function') renderBoard();
                let turnName = (data.turn === 'w') ? 'White to move' : 'Black to move';
                let themes = data.themes ? data.themes.slice(0, 3).join(', ') : 'Tactics';

                safeText('opening-bar', `Puzzle #${data.id} • Rating: ${data.rating} ELO`);
                safeText('status', `🧩 ${turnName} • Find the winning move!`);
                alert(`🧩 Puzzle Loaded (${data.rating} ELO)\n${turnName}!\nThemes: ${themes}`);
            } else {
                alert('Puzzle fetch failed: ' + (data.message || 'Check Internet'));
            }
        })
        .catch(err => {
            alert('Internet connection required to fetch daily puzzle.');
        });
};

// Puzzle Move Validator Interceptor
window.checkPuzzlePlayerMove = function(userMoveUci) {
    if (!window.activePuzzle.isRunning) return false;

    let pz = window.activePuzzle;
    let expectedUci = pz.solution[pz.plyIndex];

    if (userMoveUci.startsWith(expectedUci) || userMoveUci === expectedUci) {
        pz.plyIndex++;
        
        // Check if puzzle completed
        if (pz.plyIndex >= pz.solution.length) {
            pz.isRunning = false;
            safeText('status', '🏆 Brilliant! Puzzle Solved Successfully!');
            alert('🏆 Puzzle Solved! Excellent tactic vision!');
            if (typeof playSound === 'function') playSound('game-end');
            return true;
        }

        // Opponent counter-move reply
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
                    pz.isRunning = false;
                    safeText('status', '🏆 Brilliant! Puzzle Solved Successfully!');
                    alert('🏆 Puzzle Solved! Excellent tactic vision!');
                    if (typeof playSound === 'function') playSound('game-end');
                } else {
                    safeText('status', 'Your turn! Find the next winning move.');
                }
            }
        }, 450);

        return true;
    } else {
        // Incorrect Move -> Undo move and warn user
        setTimeout(() => {
            game.undo();
            if (gameHistory.length > 1) {
                gameHistory.pop();
                historyIndex = gameHistory.length - 1;
            }
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof playSound === 'function') playSound('illegal');
            safeText('status', '✘ Not the best move! Try again.');
            alert('✘ That is not the best move. Try again!');
        }, 200);
        return true;
    }
};
