/* ============================================================================
   static/mod_share_vault.js (Single In-Progress Cloud Sync & Delete All)
   ============================================================================ */

window.activeCloudMatchId = localStorage.getItem('active_cloud_match_id') || null;

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

window.openMatchVaultModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    window.refreshMatchVaultList();
    safeDisplay('vault-modal', 'flex');
};

// Vault Modal Renderer with Resume, Replay, and Delete All
window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) {
        container = $('.vault-modal-content, #vault-modal .modal-body, .archive-container');
    }
    if (!container.length) return;

    container.html('<div style="text-align:center;padding:20px;color:#aaa;">Loading Cloud Matches...</div>');

    $.get('/get_matches', function(data) {
        container.empty();
        let matches = data.matches || [];

        if (matches.length === 0) {
            container.html('<div style="text-align:center;padding:24px;color:#777;">No saved games in your archive yet.</div>');
        } else {
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
        }

        // Danger Zone: Always Visible Delete All Button
        let dangerZone = `
        <div style="margin-top:18px;padding:14px;border-top:1px solid #333;text-align:center;">
            <button onclick="window.confirmDeleteAllMatches()" style="background:#2a1215;border:1px solid #da3633;color:#ff7b72;font-size:12px;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;">
                🗑 Delete All Cloud Game History
            </button>
        </div>`;
        container.append(dangerZone);
    });
};

window.loadVaultMatch = function(id, fen, isResume) {
    if (!fen) return;
    closeModal('vault-modal');
    if (isResume) {
        window.activeCloudMatchId = id;
        localStorage.setItem('active_cloud_match_id', id);
        game.load(fen);
        gameHistory = [{ fen: fen, moveObj: null }];
        historyIndex = 0;
        matchEnded = false;
        isAnalysisBranchMode = false;
        renderBoard();
        updateStatus();
        startTimer();
        $('#status').text("Resumed match from cloud.");
    } else {
        game.load(fen);
        gameHistory = [{ fen: fen, moveObj: null }];
        historyIndex = 0;
        matchEnded = true;
        isAnalysisBranchMode = true;
        stopAllActiveMatchProcesses();
        renderBoard();
        $('#status').text("Replay Mode (Finished Match)");
    }
};

window.deleteSingleMatch = function(id) {
    if (!confirm("Are you sure you want to delete this match?")) return;
    $.post('/delete_match', { id: id }, function(res) {
        window.refreshMatchVaultList();
    });
};

window.confirmDeleteAllMatches = function() {
    let first = confirm("⚠ DANGER: Are you sure you want to delete ALL matches from cloud history?");
    if (!first) return;
    let input = prompt("Type 'DELETE' to confirm clearing all history:");
    if (input && input.trim().toUpperCase() === "DELETE") {
        $.post('/delete_all_matches', function(res) {
            localStorage.removeItem('active_cloud_match_id');
            localStorage.removeItem('chess_active_match');
            window.activeCloudMatchId = null;
            alert("All games deleted successfully.");
            window.refreshMatchVaultList();
        });
    }
};

// Active Match ko bar-bar new create karne ki jagah ek hi row update karein
window.saveActiveMatchStateToCloud = function() {
    let pgn = window.buildBrandedPGN ? window.buildBrandedPGN() : game.pgn();
    let payload = {
        white: getWhiteDisplayName(),
        black: getBlackDisplayName(),
        result: `In Progress (Move ${historyIndex})`,
        w_acc: getTextSafe('white-acc-text', '95%'),
        b_acc: getTextSafe('black-acc-text', '95%'),
        opening: getTextSafe('opening-bar', 'Standard Opening'),
        pgn: pgn,
        fen: game.fen()
    };
    if (window.activeCloudMatchId) {
        payload.id = window.activeCloudMatchId;
    }

    $.post('/save_match', payload, function(res) {
        if (res && res.id) {
            window.activeCloudMatchId = res.id;
            localStorage.setItem('active_cloud_match_id', res.id);
        }
    });
};

window.saveCurrentMatchToVault = function(resultTitle) {
    let pgn = window.buildBrandedPGN ? window.buildBrandedPGN() : game.pgn();
    let payload = {
        white: getWhiteDisplayName(),
        black: getBlackDisplayName(),
        result: resultTitle || "Match Over",
        w_acc: getTextSafe('white-acc-text', '95%'),
        b_acc: getTextSafe('black-acc-text', '95%'),
        opening: getTextSafe('opening-bar', 'Standard Opening'),
        pgn: pgn,
        fen: game.fen()
    };
    if (window.activeCloudMatchId) {
        payload.id = window.activeCloudMatchId;
    }

    $.post('/save_match', payload, function() {
        if (resultTitle !== "In Progress") {
            window.activeCloudMatchId = null;
            localStorage.removeItem('active_cloud_match_id');
            localStorage.removeItem('chess_active_match');
        }
    });
};
