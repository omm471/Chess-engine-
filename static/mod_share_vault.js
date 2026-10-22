/* ============================================================================
   static/mod_share_vault.js (Clean Vault, Resume/Replay Engine & Danger Zone)
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

window.openMatchVaultModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    window.refreshMatchVaultList();
    safeDisplay('vault-modal', 'flex');
};

// Vault List with Dynamic Resume / Replay Logic & Safe Clear All
window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) return;
    container.html('<div style="text-align:center;padding:20px;color:#aaa;">Loading Cloud Matches...</div>');

    $.get('/get_matches', function(data) {
        container.empty();
        let matches = data.matches || [];
        if (matches.length === 0) {
            container.html('<div style="text-align:center;padding:24px;color:#777;">No saved games in your archive yet.</div>');
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

        // Danger Zone: Chhupa hua Safe Delete All Button
        let dangerZoneHtml = `
        <div style="margin-top:20px;padding-top:14px;border-top:1px dashed #3a3b40;text-align:center;">
            <button onclick="window.confirmDeleteAllMatches()" style="background:transparent;border:1px solid #da3633;color:#da3633;font-size:11px;padding:6px 12px;border-radius:4px;cursor:pointer;opacity:0.65;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.65'">
                ⚠ Clear Entire Cloud Vault
            </button>
        </div>`;
        container.append(dangerZoneHtml);
    });
};

window.loadVaultMatch = function(id, fen, isResume) {
    if (!fen) return;
    closeModal('vault-modal');
    if (isResume) {
        // Active Game me Resume karein
        game.load(fen);
        gameHistory = [{ fen: fen, moveObj: null }];
        historyIndex = 0;
        matchEnded = false;
        isAnalysisBranchMode = false;
        renderBoard();
        updateStatus();
        startTimer();
        $('#status').text("Resumed match from archive.");
    } else {
        // Finished Game: Replay Mode me load karein
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

// Complicated 2-Step Confirmation for Delete All
window.confirmDeleteAllMatches = function() {
    let firstConfirm = confirm("DANGER: Are you sure you want to delete ALL matches from cloud history?");
    if (!firstConfirm) return;
    let code = prompt("Please type 'DELETE' to confirm clearing all history:");
    if (code && code.trim().toUpperCase() === "DELETE") {
        $.post('/delete_all_matches', function(res) {
            alert("All cloud games cleared.");
            window.refreshMatchVaultList();
        });
    } else {
        alert("Action cancelled. Input did not match.");
    }
};

window.saveCurrentMatchToVault = function(resultTitle) {
    if (window.updateAccuracySummary) window.updateAccuracySummary();
    let whiteName = getWhiteDisplayName();
    let blackName = getBlackDisplayName();
    let wAcc = getTextSafe('white-acc-text', '95%');
    let bAcc = getTextSafe('black-acc-text', '95%');
    let opening = getTextSafe('opening-bar', 'Standard Opening');
    let pgn = window.buildBrandedPGN ? window.buildBrandedPGN() : game.pgn();
    let fen = game.fen();

    $.post('/save_match', {
        white: whiteName,
        black: blackName,
        result: resultTitle || "Match Over",
        w_acc: wAcc,
        b_acc: bAcc,
        opening: opening,
        pgn: pgn,
        fen: fen
    });
};
