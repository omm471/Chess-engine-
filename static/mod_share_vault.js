/* ============================================================================
   static/mod_share_vault.js (v118 - Android Bottom Toast & Storage Saver)
   - Android Native Bottom Toast: Clean floating pill at the bottom (No Popups!)
   - Direct Phone Storage Saver: Saves PGN to /storage/emulated/0/ChessAIPro/
   - In-Flight Request Lock: Prevents duplicate rows when moves happen rapidly
   - Native In-App Custom Confirm Dialog (Android WebView compatible)
   - Exact client-local time formatting with dynamic Resume/Replay switching
   ============================================================================ */

window.currentActiveMatchDbId = localStorage.getItem('chess_current_db_id') || null;
window.isSavingToCloud = false;
window.pendingCloudSave = null;

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

// ============================================================================
// NATIVE ANDROID BOTTOM TOAST (NO CENTER POPUPS!)
// ============================================================================
function showAndroidToast(message) {
    let existing = document.getElementById('android-toast-pill');
    if (existing) existing.remove();

    let toast = document.createElement('div');
    toast.id = 'android-toast-pill';
    toast.style.cssText = `
        position: fixed !important;
        bottom: 34px !important;
        left: 50% !important;
        transform: translateX(-50%) translateY(20px) !important;
        background: #232429 !important;
        color: #ffffff !important;
        padding: 10px 20px !important;
        border-radius: 28px !important;
        border: 1px solid #3e404a !important;
        box-shadow: 0 10px 28px rgba(0,0,0,0.7) !important;
        font-size: 13px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-weight: 500 !important;
        z-index: 99999999 !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transition: opacity 0.22s ease-out, transform 0.22s ease-out !important;
        max-width: 86vw !important;
        text-align: center !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 20);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(16px)';
        setTimeout(() => toast.remove(), 260);
    }, 2600);
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

// ============================================================================
// DIRECT DEVICE STORAGE PGN SAVER
// ============================================================================
window.saveSingleMatchPGN = function() {
    let pgnText = window.buildBrandedPGN ? window.buildBrandedPGN() : (game ? game.pgn() : "");
    if (!pgnText || !pgnText.trim()) {
        showAndroidToast("⚠ No PGN moves recorded to save!");
        return;
    }

    let cleanWhite = getWhiteDisplayName().replace(/[^a-zA-Z0-9]/g, '_');
    let cleanBlack = getBlackDisplayName().replace(/[^a-zA-Z0-9]/g, '_');
    let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + "_" + Date.now().toString().slice(-4);
    let fileName = `Match_${cleanWhite}_vs_${cleanBlack}_${timeStamp}.pgn`;

    // 1. Python server ke zariye phone ke internal folder me direct save karein
    $.post('/save_to_device_storage', { pgn: pgnText, filename: fileName }, function(res) {
        if (res && res.status === 'success') {
            showAndroidToast(`💾 Saved to ChessAIPro folder (${fileName})`);
        } else {
            triggerBrowserFileDownload(pgnText, fileName);
            showAndroidToast(`💾 Saved to Downloads folder (${fileName})`);
        }
    }).fail(function() {
        triggerBrowserFileDownload(pgnText, fileName);
        showAndroidToast(`💾 Saved to Downloads folder (${fileName})`);
    });
};

window.downloadCurrentPGN = window.saveSingleMatchPGN;
window.downloadCurrentMatchPGN = window.saveSingleMatchPGN;
window.downloadMatchPGN = window.saveSingleMatchPGN;
window.downloadPGN = window.saveSingleMatchPGN;
window.saveMatchPGN = window.saveSingleMatchPGN;

function triggerBrowserFileDownload(text, filename) {
    try {
        let blob = new Blob([text], { type: 'application/x-chess-pgn;charset=utf-8' });
        let link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 500);
    } catch (e) {
        let link = document.createElement('a');
        link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 500);
    }
}

// Delegated listener ensuring any "Download Current Match PGN" button executes
$(document).on('click', '#btn-download-pgn, #modal-download-pgn-btn, [id*="download-pgn"], button:contains("Download Current Match PGN"), button:contains("Download")', function(e) {
    e.preventDefault();
    e.stopPropagation();
    window.saveSingleMatchPGN();
});

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
        showAndroidToast("📋 PGN copied to clipboard");
    }).catch(() => {
        document.execCommand('copy');
        showAndroidToast("📋 PGN copied to clipboard");
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
        showAndroidToast("📋 FEN copied to clipboard");
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
// ANDROID-SAFE IN-APP CONFIRMATION DIALOG (FOR DELETING HISTORY ONLY)
// ============================================================================
function showInAppConfirmDialog(title, message, onConfirm) {
    let existing = document.getElementById('vault-custom-confirm-modal');
    if (existing) existing.remove();

    let overlay = document.createElement('div');
    overlay.id = 'vault-custom-confirm-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999999;display:flex;align-items:center;justify-content:center;padding:18px;';
    overlay.innerHTML = `
        <div style="background:#1b1c20;border:1px solid #da3633;border-radius:12px;padding:22px;max-width:320px;width:100%;text-align:center;box-shadow:0 12px 36px rgba(0,0,0,0.9);">
            <div style="font-size:16px;font-weight:bold;color:#ff6b6b;margin-bottom:8px;">${title}</div>
            <div style="font-size:13px;color:#ccc;margin-bottom:20px;line-height:1.5;">${message}</div>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="v-confirm-cancel" style="flex:1;background:#33343a;color:#eee;border:none;padding:10px;border-radius:6px;font-weight:bold;cursor:pointer;">Cancel</button>
                <button id="v-confirm-ok" style="flex:1;background:#da3633;color:#fff;border:none;padding:10px;border-radius:6px;font-weight:bold;cursor:pointer;">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#v-confirm-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#v-confirm-ok').onclick = () => {
        overlay.remove();
        onConfirm();
    };
}

// ============================================================================
// THREE-DOT (⋮) MENU INJECTION
// ============================================================================
function setupVaultThreeDotMenu() {
    if ($('#vault-threedot-wrap').length) return;

    let refreshBtn = $('#vault-modal button:contains("↻"), .vault-refresh-btn');
    if (!refreshBtn.length) {
        refreshBtn = $('#vault-modal').find('button').filter(function() {
            return $(this).text().trim() === '↻';
        });
    }

    let targetContainer = null;
    if (refreshBtn.length) {
        targetContainer = refreshBtn.parent();
    } else {
        let saveBtn = $('button:contains("Save Current Game")');
        if (saveBtn.length) targetContainer = saveBtn.parent();
    }

    if (targetContainer && targetContainer.length) {
        let menuHtml = `
        <div id="vault-threedot-wrap" style="position:relative; display:inline-block; margin-left:6px; vertical-align:middle;">
            <button id="vault-threedot-btn" onclick="window.toggleVaultDropdown(event)" style="background:#2a2b2e; color:#eee; border:1px solid #444; border-radius:6px; width:40px; height:40px; font-size:20px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">
                ⋮
            </button>
            <div id="vault-dropdown-menu" style="display:none; position:absolute; right:0; top:46px; background:#1c1d21; border:1px solid #da3633; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.9); z-index:999999; min-width:220px; overflow:hidden;">
                <div onclick="window.triggerDeleteAllHistoryAction()" style="color:#ff6b6b; padding:12px 16px; font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#2d1517'" onmouseout="this.style.background='transparent'">
                    🗑 Delete All Game History
                </div>
            </div>
        </div>`;
        targetContainer.append(menuHtml);

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

window.triggerDeleteAllHistoryAction = function() {
    $('#vault-dropdown-menu').hide();
    showInAppConfirmDialog(
        "Delete All Games?",
        "Are you sure you want to permanently clear your entire cloud game history?",
        function() {
            $.post('/delete_all_matches', function(res) {
                window.currentActiveMatchDbId = null;
                localStorage.removeItem('chess_current_db_id');
                localStorage.removeItem('chess_active_match');
                window.refreshMatchVaultList();
                showAndroidToast("🗑 All game history deleted");
            });
        }
    );
};

// ============================================================================
// ARCHIVE MATCH LIST RENDERER WITH DYNAMIC RESUME / REPLAY
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
            let resultLower = (m.result || "").toString().toLowerCase();
            let isInProgress = resultLower.includes("in progress") || resultLower.includes("progress");
            let actionBtnText = isInProgress ? "▶ Resume" : "▶ Replay";
            let actionBtnColor = isInProgress ? "#2ea043" : "#81b64c";

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
    if (!rawPgn) return;
    if (window.openReportModalWithPgn) {
        window.openReportModalWithPgn(rawPgn);
    } else if (window.openReportModal) {
        window.openReportModal();
    }
};

window.copySingleVaultPgn = function(encodedPgn) {
    let rawPgn = decodeURIComponent(encodedPgn || "");
    if (!rawPgn) return;
    navigator.clipboard.writeText(rawPgn).then(() => {
        showAndroidToast("📋 PGN copied to clipboard");
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
    showInAppConfirmDialog(
        "Delete Match?",
        "Are you sure you want to delete this match record?",
        function() {
            $.post('/delete_match', { id: id }, function() {
                if (window.currentActiveMatchDbId == id) {
                    window.currentActiveMatchDbId = null;
                    localStorage.removeItem('chess_current_db_id');
                }
                window.refreshMatchVaultList();
                showAndroidToast("Match deleted");
            });
        }
    );
};

// ============================================================================
// SINGLE MATCH SAVER WITH IN-FLIGHT QUEUE (ZERO DUPLICATE ROW GUARANTEE)
// ============================================================================
window.saveCurrentMatchToVault = function(resultTitle) {
    let pgn = window.buildBrandedPGN ? window.buildBrandedPGN() : game.pgn();
    let fen = game.fen();
    let localDate = getUserDeviceFormattedDate();

    let payload = {
        id: window.currentActiveMatchDbId || "",
        date: localDate,
        white: getWhiteDisplayName(),
        black: getBlackDisplayName(),
        result: resultTitle || "In Progress",
        w_acc: getTextSafe('white-acc-text', '95%'),
        b_acc: getTextSafe('black-acc-text', '95%'),
        opening: getTextSafe('opening-bar', 'Standard Opening'),
        pgn: pgn,
        fen: fen
    };

    if (window.isSavingToCloud) {
        window.pendingCloudSave = payload;
        return;
    }

    window.isSavingToCloud = true;

    $.post('/save_match', payload, function(data) {
        window.isSavingToCloud = false;
        if (data && data.id) {
            window.currentActiveMatchDbId = data.id;
            localStorage.setItem('chess_current_db_id', data.id);
        }
        if (resultTitle && !resultTitle.toLowerCase().includes("in progress")) {
            localStorage.removeItem('chess_active_match');
            window.currentActiveMatchDbId = null;
            localStorage.removeItem('chess_current_db_id');
        }

        if (window.pendingCloudSave) {
            let next = window.pendingCloudSave;
            window.pendingCloudSave = null;
            next.id = window.currentActiveMatchDbId || "";
            window.saveCurrentMatchToVault(next.result);
        }
    }).fail(function() {
        window.isSavingToCloud = false;
    });
};

window.manualSaveToVault = function() {
    window.saveCurrentMatchToVault("Saved Match");
    showAndroidToast("💾 Match saved to Vault");
    window.refreshMatchVaultList();
};
