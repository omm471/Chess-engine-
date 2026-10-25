/* ============================================================================
   static/mod_share_vault.js (v120 - Full Device Storage & Complete Vault Engine)
   ============================================================================ */

window.currentActiveMatchDbId = localStorage.getItem('chess_current_db_id') || null;

function showAndroidToast(message) {
    if (window.AndroidBridge && window.AndroidBridge.savePgnNative) return;

    let existing = document.getElementById('android-toast-pill');
    if (existing) existing.remove();

    let toast = document.createElement('div');
    toast.id = 'android-toast-pill';
    toast.style.cssText = `
        position: fixed !important; bottom: 34px !important; left: 50% !important;
        transform: translateX(-50%) !important; background: #232429 !important;
        color: #ffffff !important; padding: 9px 18px !important; border-radius: 24px !important;
        border: 1px solid #3e404a !important; box-shadow: 0 8px 24px rgba(0,0,0,0.8) !important;
        font-size: 12.5px !important; z-index: 99999999 !important; pointer-events: none !important;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
}

window.buildBrandedPGN = function() {
    let wName = getWhiteDisplayName();
    let bName = getBlackDisplayName();
    let dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    let resCode = "*";
    if (game.in_checkmate()) resCode = (game.turn() === 'w') ? "0-1" : "1-0";
    else if (game.in_draw()) resCode = "1/2-1/2";
    else if (matchEnded) resCode = "1-0";

    let headers = [
        `[Event "Chess AI Pro Match"]`,
        `[Site "Chess AI Pro • Offline"]`,
        `[Date "${dateStr}"]`,
        `[White "${wName}"]`,
        `[Black "${bName}"]`,
        `[Result "${resCode}"]`
    ].join('\n');

    let movesText = game.pgn() || "";
    return `${headers}\n\n${movesText.trim()} ${resCode}`.trim();
};

window.saveSingleMatchPGN = function() {
    let pgnText = window.buildBrandedPGN ? window.buildBrandedPGN() : game.pgn();
    if (!pgnText || !pgnText.trim()) {
        showAndroidToast("No PGN moves recorded to save!");
        return;
    }

    let w = getWhiteDisplayName().replace(/[^a-zA-Z0-9]/g, '_');
    let b = getBlackDisplayName().replace(/[^a-zA-Z0-9]/g, '_');
    let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + "_" + Date.now().toString().slice(-4);
    let fileName = `Match_${w}_vs_${b}_${timeStamp}.pgn`;

    if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
        window.AndroidBridge.savePgnNative(pgnText, fileName, false);
    } else {
        triggerBrowserFileDownload(pgnText, fileName);
        showAndroidToast(`💾 Saved: ${fileName}`);
    }
};

window.exportAllMatchesMultiPGN = function() {
    $.get('/get_matches', function(data) {
        let matches = data.matches || [];
        let pgnCollection = [];

        if (matches.length > 0) {
            matches.forEach((m, idx) => {
                let mPgn = m.pgn || "";
                if (mPgn.trim()) {
                    if (!mPgn.includes("[Event ")) {
                        mPgn = `[Event "Match ${idx + 1}"]\n[White "${m.white || 'Player'}"]\n[Black "${m.black || 'Opponent'}"]\n[Result "${m.result || '*'}"]\n\n${mPgn}`;
                    }
                    pgnCollection.push(mPgn.trim());
                }
            });
        }

        let currentPgn = window.buildBrandedPGN();
        if (currentPgn && !pgnCollection.includes(currentPgn)) {
            pgnCollection.push(currentPgn);
        }

        let fullMasterPgn = pgnCollection.join('\n\n\n');
        let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let fileName = `Master_All_Matches_${timeStamp}.pgn`;

        if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
            window.AndroidBridge.savePgnNative(fullMasterPgn, fileName, true);
        } else {
            triggerBrowserFileDownload(fullMasterPgn, fileName);
            showAndroidToast(`📚 Master PGN saved (${pgnCollection.length} games)`);
        }
    }).fail(function() {
        let cur = window.buildBrandedPGN();
        if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
            window.AndroidBridge.savePgnNative(cur, "Master_All_Matches.pgn", true);
        }
    });
};

function triggerBrowserFileDownload(text, filename) {
    try {
        let blob = new Blob([text], { type: 'application/x-chess-pgn;charset=utf-8' });
        let link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(link.href); }, 500);
    } catch (e) {}
}

window.openShareModal = function() {
    let box = safeEl('branded-pgn-box');
    if (box) box.value = window.buildBrandedPGN();
    safeDisplay('share-modal', 'flex');
};

window.copyBrandedPGN = function() {
    let box = safeEl('branded-pgn-box');
    if (!box) return;
    box.select();
    navigator.clipboard.writeText(box.value).then(() => {
        showAndroidToast("📋 PGN copied to clipboard");
    });
};

window.shareBrandedGameNative = function() {
    let pgn = window.buildBrandedPGN();
    if (navigator.share) {
        navigator.share({ title: 'Chess AI Match PGN', text: pgn }).catch(() => {});
    } else {
        copyBrandedPGN();
    }
};

window.copyCurrentFEN = function() {
    let fen = (historyIndex >= 0 && gameHistory[historyIndex]) ? gameHistory[historyIndex].fen : game.fen();
    navigator.clipboard.writeText(fen).then(() => {
        showAndroidToast("📋 FEN copied to clipboard");
    });
};

window.openMatchVaultModal = function() {
    window.refreshMatchVaultList();
    safeDisplay('vault-modal', 'flex');
};

window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) return;
    container.html('<div style="text-align:center;padding:20px;color:#aaa;">Loading Archive...</div>');

    $.get('/get_matches', function(data) {
        container.empty();
        let matches = data.matches || [];

        if (matches.length === 0) {
            container.html('<div style="text-align:center;padding:24px;color:#777;">No saved games yet.</div>');
            return;
        }

        matches.forEach(m => {
            let isInProgress = (m.result || "").toLowerCase().includes("progress");
            let actionBtnText = isInProgress ? "▶ Resume" : "▶ Replay";
            let actionBtnColor = isInProgress ? "#2ea043" : "#81b64c";

            let itemHtml = `
            <div style="background:#1e1e1e;border:1px solid #333;border-radius:6px;padding:10px;margin-bottom:8px;text-align:left;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:bold;color:#eee;font-size:12.5px;">♔ ${m.white} <span style="color:#777;">vs</span> ♚ ${m.black}</div>
                    <span style="font-size:10px;background:#2a2b2e;padding:2px 6px;border-radius:3px;color:#f0c15c;">${m.result}</span>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;">
                    <button onclick="window.loadVaultMatch('${m.id}', '${m.fen}', ${isInProgress}, '${m.white}', '${m.black}')" style="flex:1;background:${actionBtnColor};color:#fff;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">${actionBtnText}</button>
                    <button onclick="window.deleteSingleMatch('${m.id}')" style="background:#da3633;color:#fff;border:none;padding:7px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>
                </div>
            </div>`;
            container.append(itemHtml);
        });
    });
};

window.loadVaultMatch = function(id, fen, isResume, whiteName, blackName) {
    if (!fen) return;
    closeModal('vault-modal');

    game.load(fen);
    gameHistory = [{ fen: fen, moveObj: null }];
    historyIndex = 0;
    selectedSquare = null;
    currentLegalMoves = [];

    safeText('bottom-player-label', 'White:');
    safeText('bottom-player-name', whiteName || 'Player');
    safeText('top-player-label', 'Black:');
    safeText('top-player-name', blackName || 'Stockfish 16.1');

    if (isResume) {
        window.currentActiveMatchDbId = id;
        matchEnded = false;
        isAnalysisBranchMode = false;

        let blackStr = (blackName || getTextSafe('top-player-name', '')).toLowerCase();
        if (blackStr.includes('stockfish') || blackStr.includes('bot') || blackStr.includes('ai') || blackStr.includes('gm')) {
            gameMode = 'pvb';
            playerColor = 'w';
        } else {
            gameMode = 'pvp';
        }

        renderBoard();
        updateStatus();
        startTimer();

        if (gameMode === 'pvb' && game.turn() === 'b') {
            setTimeout(makeAiMove, 300);
        }
    } else {
        matchEnded = true;
        isAnalysisBranchMode = true;
        stopAllActiveMatchProcesses();
        renderBoard();
        $('#status').text("Replay Mode");
    }
};

window.deleteSingleMatch = function(id) {
    $.post('/delete_match', { id: id }, function() {
        window.refreshMatchVaultList();
        showAndroidToast("Match deleted");
    });
};

window.saveCurrentMatchToVault = function(resultTitle) {
    let pgn = window.buildBrandedPGN();
    let fen = game.fen();
    let now = new Date();
    let localDate = now.toLocaleDateString() + ' • ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let payload = {
        id: window.currentActiveMatchDbId || "",
        date: localDate,
        white: getWhiteDisplayName(),
        black: getBlackDisplayName(),
        result: resultTitle || "In Progress",
        pgn: pgn,
        fen: fen
    };

    $.post('/save_match', payload, function(data) {
        if (data && data.id) {
            window.currentActiveMatchDbId = data.id;
            localStorage.setItem('chess_current_db_id', data.id);
        }
    });
};

window.manualSaveToVault = function() {
    window.saveCurrentMatchToVault("Saved Match");
    showAndroidToast("💾 Saved to Vault");
    window.refreshMatchVaultList();
};
