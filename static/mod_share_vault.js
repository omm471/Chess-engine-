/* ============================================================================
   static/mod_share_vault.js (v106 - Single PGN Archiving, Resume/Replay & Safe Vault)
   - Clean single-match PGN generation and cloud storage
   - Dynamic 'Resume' (for in-progress) vs 'Replay' (for completed) actions
   - Instant single match delete & 1-tap "Delete All Games History"
   - Branded PGN export and Master Multi-PGN sync
   ============================================================================ */

window.buildBrandedPGN = function() {
    let wName = getWhiteDisplayName();
    let bName = getBlackDisplayName();
    let wAcc = getTextSafe('white-acc-text', '100%');
    let bAcc = getTextSafe('black-acc-text', '100%');
    let opening = getTextSafe('opening-bar', 'Standard Opening');
    let dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    let resCode = "*";
    if (game.in_checkmate()) resCode = (game.turn() === 'w') ? "0-1" : "1-0";
    else if (game.in_draw()) resCode = "1/2-1/2";
    else if (matchEnded && gameEndEffect) {
        if (gameEndEffect.winner === 'w') resCode = "1-0";
        else if (gameEndEffect.winner === 'b') resCode = "0-1";
        else if (gameEndEffect.winner === 'draw') resCode = "1/2-1/2";
    }

    let movesText = "";
    for (let i = 1; i < gameHistory.length; i++) {
        let rec = gameHistory[i];
        if (!rec || !rec.moveObj) continue;
        if (i % 2 === 1) movesText += `${Math.ceil(i / 2)}. ${rec.moveObj.san} `;
        else movesText += `${rec.moveObj.san} `;
    }
    if (!movesText.trim()) movesText = game.pgn() || "";

    let headers = [
        `[Event "Chess AI Pro Match"]`,
        `[Site "Chess AI Pro • Android PRoot"]`,
        `[Date "${dateStr}"]`,
        `[White "${wName}"]`,
        `[Black "${bName}"]`,
        `[Result "${resCode}"]`,
        `[Opening "${opening}"]`,
        `[WhiteAccuracy "${wAcc}"]`,
        `[BlackAccuracy "${bAcc}"]`,
        `[FEN "${gameHistory[0] ? gameHistory[0].fen : game.fen()}"]`
    ].join('\n');

    return `${headers}\n\n${movesText.trim()} ${resCode}`.trim();
};

window.openShareModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    if (window.updateAccuracySummary) window.updateAccuracySummary();
    let box = safeEl('branded-pgn-box');
    if (box) box.value = window.buildBrandedPGN();
    safeDisplay('share-modal', 'flex');
};

window.copyBrandedPGN = function() {
    let box = safeEl('branded-pgn-box');
    if (!box) return;
    box.select();
    navigator.clipboard.writeText(box.value).then(() => {
        alert("Branded PGN copied to clipboard!");
    }).catch(() => {
        document.execCommand('copy');
        alert("Branded PGN copied!");
    });
};

window.shareBrandedGameNative = function() {
    let pgn = window.buildBrandedPGN();
    if (navigator.share) {
        navigator.share({ title: 'Chess AI Pro Match PGN', text: pgn }).catch(() => {});
    } else {
        copyBrandedPGN();
    }
};

window.copyCurrentFEN = function() {
    let fen = (historyIndex >= 0 && gameHistory[historyIndex]) ? gameHistory[historyIndex].fen : game.fen();
    navigator.clipboard.writeText(fen).then(() => {
        alert("FEN copied: " + fen);
    }).catch(() => {
        prompt("Copy FEN:", fen);
    });
};

// 1. SAVE SINGLE MATCH PGN
window.saveSingleMatchPGN = function() {
    let pgnText = window.buildBrandedPGN();
    let cleanWhite = getWhiteDisplayName().replace(/[^a-zA-Z0-9]/g, '_');
    let cleanBlack = getBlackDisplayName().replace(/[^a-zA-Z0-9]/g, '_');
    let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + "_" + Date.now().toString().slice(-4);
    let fileName = `Match_${cleanWhite}_vs_${cleanBlack}_${timeStamp}.pgn`;

    if (window.AndroidBridge && typeof window.AndroidBridge.savePgnNative === 'function') {
        window.AndroidBridge.savePgnNative(pgnText, fileName, false);
    } else {
        let blob = new Blob([pgnText], { type: 'application/x-chess-pgn' });
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
    }
};

// 2. EXPORT ALL MATCHES MULTI-PGN
window.exportAllMatchesMultiPGN = function() {
    safeText('status', 'Combining all matches into Master Multi-PGN...');
    fetch('/api/export_all_pgn')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.multi_pgn) {
                let fileName = `ChessAIPro_All_Matches_${data.count}_Games.pgn`;
                if (window.AndroidBridge && typeof window.AndroidBridge.savePgnNative === 'function') {
                    window.AndroidBridge.savePgnNative(data.multi_pgn, fileName, true);
                } else {
                    let blob = new Blob([data.multi_pgn], { type: 'application/x-chess-pgn' });
                    let a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = fileName;
                    a.click();
                }
            } else {
                alert("No saved matches found in vault yet!");
            }
        })
        .catch(err => {
            alert("Error exporting Multi-PGN: " + err);
        });
};

window.openMatchVaultModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    window.refreshMatchVaultList();
    safeDisplay('vault-modal', 'flex');
};

// Vault Modal List Renderer (Resume / Replay + Danger Zone)
window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) return;

    container.html('<div style="text-align:center;padding:20px;color:#aaa;">Loading Cloud Matches...</div>');

    $.get('/get_matches', function(data) {
        container.empty();
        let matches = data.matches || [];

        // Top Action: Delete All Games History
        let clearHeader = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <button onclick="window.confirmDeleteAllMatches()" style="background:#2d1517;border:1px solid #da3633;color:#ff7b72;font-size:11px;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">
                🗑 Delete All Games History
            </button>
        </div>`;
        container.append(clearHeader);

        if (matches.length === 0) {
            container.append('<div style="text-align:center;padding:24px;color:#777;">No saved games in your archive yet.</div>');
            return;
        }

        matches.forEach(m => {
            let isInProgress = m.result && m.result.toLowerCase().includes("in progress");
            let actionBtnText = isInProgress ? "▶ Resume" : "▶ Replay";
            let actionBtnColor = isInProgress ? "#2ea043" : "#81b64c";

            let itemHtml = `
            <div class="vault-card" style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:12px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:bold;color:#eee;">♔ ${m.white} <span style="color:#777;font-size:12px;">vs</span> ♚ ${m.black}</div>
                    <span style="font-size:11px;background:#2a2b2e;padding:2px 8px;border-radius:4px;color:${isInProgress ? '#e3b341' : '#81b64c'};">${m.result}</span>
                </div>
                <div style="font-size:11px;color:#888;margin:4px 0;">${m.opening || 'Standard'} • ${m.date}</div>
                <div style="margin-top:8px;display:flex;gap:6px;">
                    <button onclick="window.loadVaultMatch('${m.id}', '${m.fen}', ${isInProgress})" style="flex:1;background:${actionBtnColor};color:#fff;border:none;padding:6px;border-radius:4px;font-weight:bold;cursor:pointer;">${actionBtnText}</button>
                    <button onclick="window.deleteSingleMatch('${m.id}')" style="background:#da3633;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">✕</button>
                </div>
            </div>`;
            container.append(itemHtml);
        });
    });
};

window.loadVaultMatch = function(id, fen, isResume) {
    if (!fen) return;
    closeModal('vault-modal');
    game.load(fen);
    gameHistory = [{ fen: fen, moveObj: null }];
    historyIndex = 0;
    selectedSquare = null;
    currentLegalMoves = [];

    if (isResume) {
        matchEnded = false;
        isAnalysisBranchMode = false;
        renderBoard();
        updateStatus();
        startTimer();
        $('#status').text("Resumed match from archive.");
    } else {
        matchEnded = true;
        isAnalysisBranchMode = true;
        stopAllActiveMatchProcesses();
        renderBoard();
        $('#status').text("Replay Mode (Finished Match)");
    }
};

window.deleteSingleMatch = function(id) {
    if (!confirm("Are you sure you want to delete this match?")) return;
    $.post('/delete_match', { id: id }, function() {
        window.refreshMatchVaultList();
    });
};

window.confirmDeleteAllMatches = function() {
    if (!confirm("DANGER: Are you sure you want to delete ALL matches from cloud history?")) return;
    $.post('/delete_all_matches', function(res) {
        if (res.status === 'cleared') {
            alert("All cloud games deleted successfully.");
            window.refreshMatchVaultList();
        } else {
            alert("Failed to delete: " + (res.message || "Error"));
        }
    });
};

// Match sirf game over hone par ya manual click par 1 baar complete PGN ke roop me save hoga
window.saveCurrentMatchToVault = function(resultTitle) {
    let pgn = window.buildBrandedPGN();
    let fen = game.fen();

    $.post('/save_match', {
        white: getWhiteDisplayName(),
        black: getBlackDisplayName(),
        result: resultTitle || "Match Over",
        w_acc: getTextSafe('white-acc-text', '95%'),
        b_acc: getTextSafe('black-acc-text', '95%'),
        opening: getTextSafe('opening-bar', 'Standard Opening'),
        pgn: pgn,
        fen: fen
    }, function() {
        localStorage.removeItem('chess_active_match');
    });
};

window.manualSaveToVault = function() {
    window.saveCurrentMatchToVault("Manual Save");
    alert("Current match saved as a single complete PGN!");
    window.refreshMatchVaultList();
};
