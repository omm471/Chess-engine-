/* ============================================================================
   static/mod_share_vault.js (v111 - Client-Local Time, Single PGN & 3-Dot Vault)
   - Auto-detects device/country local timezone for match timestamps
   - Single-match in-place update (prevents multiple move-by-move file spam)
   - Three-dot (⋮) menu toggle for secure "Delete All Game History"
   - Complete card actions: Resume/Replay, Report, Copy PGN, and Delete
   ============================================================================ */

window.currentActiveMatchDbId = localStorage.getItem('chess_current_db_id') || null;

// User ke device/country ka exact local date aur time format nikalne ka helper
function getUserDeviceFormattedDate() {
    let now = new Date();
    let datePart = now.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    let timePart = now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return `${datePart} • ${timePart}`;
}

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

window.openMatchVaultModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    setupVaultThreeDotMenu();
    window.refreshMatchVaultList();
    safeDisplay('vault-modal', 'flex');
};

// ============================================================================
// THREE-DOT (⋮) MENU (ATTACHED NEXT TO REFRESH BUTTON)
// ============================================================================
function setupVaultThreeDotMenu() {
    let refreshBtn = $('#vault-modal button:contains("↻"), .vault-refresh-btn');
    if (!refreshBtn.length) {
        refreshBtn = $('#vault-modal').find('button').filter(function() {
            return $(this).text().trim() === '↻';
        });
    }

    if (refreshBtn.length && !$('#vault-threedot-wrap').length) {
        let menuHtml = `
        <div id="vault-threedot-wrap" style="position:relative; display:inline-block; margin-left:6px;">
            <button id="vault-threedot-btn" onclick="window.toggleVaultDropdown(event)" style="background:#2a2b2e; color:#eee; border:1px solid #444; border-radius:6px; width:38px; height:38px; font-size:18px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">
                ⋮
            </button>
            <div id="vault-dropdown-menu" style="display:none; position:absolute; right:0; top:44px; background:#1e1e24; border:1px solid #da3633; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.85); z-index:999999; min-width:215px; overflow:hidden;">
                <div onclick="window.confirmDeleteAllMatches()" style="color:#ff6b6b; padding:12px 14px; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#2d1517'" onmouseout="this.style.background='transparent'">
                    🗑 Delete All Game History
                </div>
            </div>
        </div>`;
        refreshBtn.after(menuHtml);

        document.addEventListener('click', function(e) {
            if (!$(e.target).closest('#vault-threedot-wrap').length) {
                $('#vault-dropdown-menu').hide();
            }
        });
    }
}

window.toggleVaultDropdown = function(e) {
    if (e) e.stopPropagation();
    $('#vault-dropdown-menu').toggle();
};

// ============================================================================
// CLOUD VAULT LIST RENDERER
// ============================================================================
window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) {
        container = $('#vault-modal .modal-body, .vault-modal-content, .archive-container');
    }
    if (!container.length) return;

    container.html('<div style="text-align:center;padding:24px;color:#aaa;">Loading Cloud Archive...</div>');

    $.get('/get_matches', function(data) {
        container.empty();
        let matches = data.matches || [];

        if (matches.length === 0) {
            container.html('<div style="text-align:center;padding:34px;color:#777;">No saved games in your archive yet.</div>');
            return;
        }

        matches.forEach(m => {
            let isInProgress = m.result && m.result.toLowerCase().includes("in progress");
            let actionBtnText = isInProgress ? "▶ Resume" : "▶ Replay";
            let actionBtnColor = isInProgress ? "#2ea043" : "#81b64c";

            // Move count calculation
            let moveCount = "1 move";
            if (m.fen) {
                let parts = m.fen.split(' ');
                if (parts.length >= 6) {
                    let fullMoves = parseInt(parts[5]);
                    if (!isNaN(fullMoves)) moveCount = `${fullMoves} moves`;
                }
            }

            let itemHtml = `
            <div class="vault-card" style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:12px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:bold;color:#eee;">♔ ${m.white} <span style="color:#777;font-size:12px;">vs</span> ♚ ${m.black}</div>
                    <span style="font-size:11px;background:#2a2b2e;padding:2px 8px;border-radius:4px;color:${isInProgress ? '#e3b341' : '#81b64c'};">${m.result}</span>
                </div>
                <div style="font-size:11px;color:#888;margin:5px 0;">
                    <span style="color:#81b64c;">${m.opening || 'Standard'}</span> • ${moveCount} • ${m.date}
                </div>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <span style="font-size:11px;background:#26272b;color:#ccc;padding:2px 6px;border-radius:4px;">White Acc: <b>${m.w_acc || '--%'}</b></span>
                    <span style="font-size:11px;background:#26272b;color:#ccc;padding:2px 6px;border-radius:4px;">Black Acc: <b>${m.b_acc || '--%'}</b></span>
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="window.loadVaultMatch('${m.id}', '${m.fen}', ${isInProgress})" style="flex:1.2;background:${actionBtnColor};color:#fff;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">${actionBtnText}</button>
                    <button onclick="window.viewVaultMatchReport('${encodeURIComponent(m.pgn || '')}')" style="flex:1;background:#2b5278;color:#fff;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">📊 Report</button>
                    <button onclick="window.copySingleVaultPgn('${encodeURIComponent(m.pgn || '')}')" style="flex:1;background:#3a3b40;color:#ddd;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">📋 PGN</button>
                    <button onclick="window.deleteSingleMatch('${m.id}')" style="background:#da3633;color:#fff;border:none;padding:7px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>
                </div>
            </div>`;
            container.append(itemHtml);
        });
    });
};

window.viewVaultMatchReport = function(encodedPgn) {
    let rawPgn = decodeURIComponent(encodedPgn || "");
    if (!rawPgn) {
        alert("No PGN moves available for this game.");
        return;
    }
    if (window.openReportModalWithPgn) {
        window.openReportModalWithPgn(rawPgn);
    } else if (window.openReportModal) {
        window.openReportModal();
    } else {
        alert("Game Review / Report opened for this game.");
    }
};

window.copySingleVaultPgn = function(encodedPgn) {
    let rawPgn = decodeURIComponent(encodedPgn || "");
    if (!rawPgn) {
        alert("PGN text empty.");
        return;
    }
    navigator.clipboard.writeText(rawPgn).then(() => {
        alert("Match PGN copied to clipboard!");
    }).catch(() => {
        prompt("Copy Match PGN:", rawPgn);
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
        window.currentActiveMatchDbId = id;
        localStorage.setItem('chess_current_db_id', id);
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
        if (window.currentActiveMatchDbId == id) {
            window.currentActiveMatchDbId = null;
            localStorage.removeItem('chess_current_db_id');
        }
        window.refreshMatchVaultList();
    });
};

// Three-dot Dropdown: Clear All Game History confirmation
window.confirmDeleteAllMatches = function() {
    $('#vault-dropdown-menu').hide();
    let ans = confirm("⚠ DANGER: Are you sure you want to delete ALL game history?");
    if (!ans) return;

    $.post('/delete_all_matches', function(res) {
        window.currentActiveMatchDbId = null;
        localStorage.removeItem('chess_current_db_id');
        localStorage.removeItem('chess_active_match');
        alert("All game history cleared successfully.");
        window.refreshMatchVaultList();
    });
};

// ============================================================================
// SINGLE MATCH SAVER (DEVICE LOCAL TIME & PERSISTENT ID)
// ============================================================================
window.saveCurrentMatchToVault = function(resultTitle) {
    let pgn = window.buildBrandedPGN();
    let fen = game.fen();
    let localDate = getUserDeviceFormattedDate();

    let payload = {
        id: window.currentActiveMatchDbId || "",
        date: localDate,
        white: getWhiteDisplayName(),
        black: getBlackDisplayName(),
        result: resultTitle || "Saved Match",
        w_acc: getTextSafe('white-acc-text', '95%'),
        b_acc: getTextSafe('black-acc-text', '95%'),
        opening: getTextSafe('opening-bar', 'Standard Opening'),
        pgn: pgn,
        fen: fen
    };

    $.post('/save_match', payload, function(data) {
        if (data && data.id) {
            window.currentActiveMatchDbId = data.id;
            localStorage.setItem('chess_current_db_id', data.id);
        }
        if (resultTitle !== "In Progress") {
            localStorage.removeItem('chess_active_match');
        }
    });
};

window.manualSaveToVault = function() {
    window.saveCurrentMatchToVault("Saved Match");
    alert("Current match saved as a single complete PGN!");
    window.refreshMatchVaultList();
};
