/* ============================================================================
   static/mod_share_vault.js (v430 - Full PGN Move History Replay & Clean Vault)
   - Fixed Move History: Fully parses PGN into gameHistory for step-by-step replay (< > |< >|)
   - Complete Resume: Resumes match with all past moves intact
   - Specific Card PGN Saver: Saves the exact match's PGN from vault card
   - Offline Safe: Falls back to localStorage cache if network is unavailable
   - Native In-App Custom Confirm Dialog (Android WebView compatible)
   - Zero Click Hijacking on Engine Downloads
   ============================================================================ */

// Active database ID is restored after the device helpers below initialize.
window.isSavingToCloud = false;
window.pendingCloudSave = null;
window.vaultMatchesById = {};

// A device ID is an installation/profile identifier, not an authentication token.
let archiveRuntimeDeviceId = null;
function getOrCreateDeviceId() {
    if (archiveRuntimeDeviceId) return archiveRuntimeDeviceId;
    let id = null;
    try { id = localStorage.getItem('chess_device_id'); } catch (e) {}
    if (!id || !/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            let bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            id = 'dev_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        } else {
            id = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
        }
        try { localStorage.setItem('chess_device_id', id); } catch (e) {
            // Storage-disabled browsers get a unique page-lifetime ID, never a shared fallback.
            console.warn('Archive device identity cannot persist while browser storage is disabled.');
        }
    }
    archiveRuntimeDeviceId = id;
    return id;
}

function filterVaultMatchesForDevice(matches, deviceId = getOrCreateDeviceId()) {
    return Array.isArray(matches) ? matches.filter(m => m && typeof m === 'object' && m.device_id === deviceId) : [];
}

function writeDeviceVaultCache(matches) {
    let own = filterVaultMatchesForDevice(matches);
    try { localStorage.setItem('chess_vault_offline_matches', JSON.stringify(own)); } catch (e) {}
    return own;
}

function readDeviceVaultCache() {
    let raw, rows;
    try {
        raw = localStorage.getItem('chess_vault_offline_matches');
        rows = JSON.parse(raw || '[]');
    } catch (e) {
        try {
            if (raw) localStorage.setItem('chess_vault_corrupt_quarantine_v1', raw);
            writeDeviceVaultCache([]);
        } catch (ignored) {}
        return [];
    }
    let own = filterVaultMatchesForDevice(rows);
    let unowned = Array.isArray(rows) ? rows.filter(m => !m || m.device_id !== getOrCreateDeviceId()) : [rows];
    if (unowned.length) {
        // Never guess ownership of a cache previously populated by an unfiltered server.
        // Keep ambiguous data in a non-rendered quarantine instead of destroying history.
        try {
            let backup = JSON.parse(localStorage.getItem('chess_vault_legacy_quarantine_v1') || '[]');
            if (!Array.isArray(backup)) backup = [backup];
            let seen = new Set(backup.map(m => JSON.stringify(m)));
            unowned.forEach(m => { let sig = JSON.stringify(m); if (!seen.has(sig)) { backup.push(m); seen.add(sig); } });
            localStorage.setItem('chess_vault_legacy_quarantine_v1', JSON.stringify(backup));
        } catch (e) {}
        writeDeviceVaultCache(own);
    }
    return own;
}

// A successful list refresh must not discard this device's unsent offline games.
function cacheDeviceVaultResponse(matches) {
    let remote = filterVaultMatchesForDevice(matches);
    let pending = readDeviceVaultCache().filter(m => m._vault_pending_sync || String(m.id || '').startsWith('offline_'));
    let ids = new Set(pending.map(m => String(m.id)));
    let pgns = new Set(pending.map(m => (m.pgn || '').trim()).filter(pgn => pgn.length > 10));
    return writeDeviceVaultCache(pending.concat(remote.filter(m => !ids.has(String(m.id)) && !pgns.has((m.pgn || '').trim()))));
}

function getDeviceOwnedActiveMatchId() {
    let devId = getOrCreateDeviceId();
    try {
        let id = localStorage.getItem('chess_current_db_id');
        let owner = localStorage.getItem('chess_current_db_device_id');
        if (id && (owner === devId || readDeviceVaultCache().some(m => String(m.id) === String(id)))) {
            localStorage.setItem('chess_current_db_device_id', devId);
            return id;
        }
        // Do not attach a potentially leaked legacy DB ID to a newly saved game.
        localStorage.removeItem('chess_current_db_id');
        localStorage.removeItem('chess_current_db_device_id');
    } catch (e) {}
    return null;
}

getOrCreateDeviceId();
readDeviceVaultCache();

// Covers legacy archive callers in mod_extras.js too, without changing that file.
// Only same-origin archive endpoints are touched; engine/download requests are not.
$.ajaxPrefilter(function(options) {
    let url;
    try { url = new URL(options.url, window.location.href); } catch (e) { return; }
    if (url.origin !== window.location.origin || ![
        '/get_matches', '/save_match', '/delete_match', '/delete_all_matches', '/api/export_all_pgn'
    ].includes(url.pathname)) return;
    let deviceId = getOrCreateDeviceId();
    url.searchParams.delete('device_id');
    options.url = url.href;
    if (typeof FormData !== 'undefined' && options.data instanceof FormData) {
        options.data.set('device_id', deviceId);
    } else if (typeof options.data === 'object' && options.data !== null) {
        options.data.device_id = deviceId;
    } else {
        let fields = new URLSearchParams(options.data || '');
        fields.set('device_id', deviceId);
        options.data = fields.toString();
    }
});

window.currentActiveMatchDbId = getDeviceOwnedActiveMatchId();

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
    if (window.AndroidBridge && window.AndroidBridge.savePgnNative) return;

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
    let wName = (typeof getWhiteDisplayName === 'function') ? getWhiteDisplayName() : 'White';
    let bName = (typeof getBlackDisplayName === 'function') ? getBlackDisplayName() : 'Black';
    let wAcc = (typeof getTextSafe === 'function') ? getTextSafe('white-acc-text', '100%') : '100%';
    let bAcc = (typeof getTextSafe === 'function') ? getTextSafe('black-acc-text', '100%') : '100%';
    let opening = (typeof getTextSafe === 'function') ? getTextSafe('opening-bar', 'Standard Opening') : 'Standard Opening';
    let dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    let resCode = "*";
    if (typeof game !== 'undefined' && game.in_checkmate && game.in_checkmate()) {
        resCode = (game.turn() === 'w') ? "0-1" : "1-0";
    } else if (typeof game !== 'undefined' && game.in_draw && game.in_draw()) {
        resCode = "1/2-1/2";
    } else if (typeof matchEnded !== 'undefined' && matchEnded && typeof gameEndEffect !== 'undefined' && gameEndEffect) {
        if (gameEndEffect.winner === 'w') resCode = "1-0";
        else if (gameEndEffect.winner === 'b') resCode = "0-1";
        else if (gameEndEffect.winner === 'draw') resCode = "1/2-1/2";
    }

    let movesText = "";
    if (typeof gameHistory !== 'undefined' && Array.isArray(gameHistory)) {
        for (let i = 1; i < gameHistory.length; i++) {
            let rec = gameHistory[i];
            if (!rec || !rec.moveObj) continue;
            if (i % 2 === 1) movesText += `${Math.ceil(i / 2)}. ${rec.moveObj.san} `;
            else movesText += `${rec.moveObj.san} `;
        }
    }
    if (!movesText.trim() && typeof game !== 'undefined' && game.pgn) {
        movesText = game.pgn() || "";
    }

    let startFen = (typeof gameHistory !== 'undefined' && gameHistory[0]) ? gameHistory[0].fen : (typeof game !== 'undefined' ? game.fen() : "");
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
        `[FEN "${startFen}"]`
    ].join('\n');

    return `${headers}\n\n${movesText.trim()} ${resCode}`.trim();
};

// ============================================================================
// 1. DIRECT DEVICE STORAGE SINGLE PGN SAVER
// ============================================================================
window.saveSingleMatchPGN = function() {
    let pgnText = window.buildBrandedPGN ? window.buildBrandedPGN() : (typeof game !== 'undefined' ? game.pgn() : "");
    if (!pgnText || !pgnText.trim()) {
        showAndroidToast("⚠ No PGN moves recorded to save!");
        return;
    }

    let w = ((typeof getWhiteDisplayName === 'function') ? getWhiteDisplayName() : 'White').replace(/[^a-zA-Z0-9]/g, '_');
    let b = ((typeof getBlackDisplayName === 'function') ? getBlackDisplayName() : 'Black').replace(/[^a-zA-Z0-9]/g, '_');
    let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + "_" + Date.now().toString().slice(-4);
    let fileName = `Match_${w}_vs_${b}_${timeStamp}.pgn`;

    if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
        window.AndroidBridge.savePgnNative(pgnText, fileName, false);
        return;
    }
    if (window.Android && window.Android.savePgnNative) {
        window.Android.savePgnNative(pgnText, fileName, false);
        return;
    }

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

window.saveVaultMatchPGN = function(id) {
    let match = (window.vaultMatchesById && window.vaultMatchesById[id]) ? window.vaultMatchesById[id] : null;
    let pgnText = (match && match.pgn) ? match.pgn : "";
    if (!pgnText) {
        window.saveSingleMatchPGN();
        return;
    }

    let w = (match.white || 'White').replace(/[^a-zA-Z0-9]/g, '_');
    let b = (match.black || 'Black').replace(/[^a-zA-Z0-9]/g, '_');
    let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + "_" + Date.now().toString().slice(-4);
    let fileName = `Match_${w}_vs_${b}_${timeStamp}.pgn`;

    if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
        window.AndroidBridge.savePgnNative(pgnText, fileName, false);
        return;
    }
    if (window.Android && window.Android.savePgnNative) {
        window.Android.savePgnNative(pgnText, fileName, false);
        return;
    }

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

// ============================================================================
// 2. MASTER MULTI-PGN EXPORTER (ALL GAMES IN 1 FILE)
// ============================================================================
window.exportAllMatchesMultiPGN = function() {
    let devId = getOrCreateDeviceId();
    $.get('/get_matches', { device_id: devId }, function(data) {
        let matches = filterVaultMatchesForDevice(data && data.matches, devId);
        let pgnCollection = [];

        if (matches.length > 0) {
            matches.forEach((m, idx) => {
                let mPgn = (m && m.pgn) ? m.pgn.trim() : "";
                if (mPgn) {
                    if (!mPgn.includes("[Event ")) {
                        mPgn = `[Event "Match ${idx + 1}"]\n[Site "Chess AI Pro Archive"]\n[White "${m.white || 'Player'}"]\n[Black "${m.black || 'Stockfish'}"]\n[Result "${m.result || '*'}"]\n\n${mPgn}`;
                    }
                    if (!pgnCollection.includes(mPgn)) {
                        pgnCollection.push(mPgn);
                    }
                }
            });
        }

        let currentPgn = window.buildBrandedPGN ? window.buildBrandedPGN() : "";
        if (currentPgn && currentPgn.trim() && !pgnCollection.includes(currentPgn.trim())) {
            pgnCollection.push(currentPgn.trim());
        }

        let fullMasterPgn = pgnCollection.join('\n\n\n');
        if (!fullMasterPgn.trim()) {
            fullMasterPgn = currentPgn || "[Event \"Casual Match\"]\n\n1. e4 *";
        }

        let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let fileName = `Master_All_Matches_${timeStamp}.pgn`;

        if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
            window.AndroidBridge.savePgnNative(fullMasterPgn, fileName, true);
            return;
        }
        if (window.Android && window.Android.savePgnNative) {
            window.Android.savePgnNative(fullMasterPgn, fileName, true);
            return;
        }

        $.post('/save_to_device_storage', { pgn: fullMasterPgn, filename: fileName }, function(res) {
            if (res && res.status === 'success') {
                showAndroidToast(`📚 Master PGN saved (${pgnCollection.length} matches)`);
            } else {
                triggerBrowserFileDownload(fullMasterPgn, fileName);
                showAndroidToast(`📚 Master PGN saved (${pgnCollection.length} matches)`);
            }
        }).fail(function() {
            triggerBrowserFileDownload(fullMasterPgn, fileName);
            showAndroidToast(`📚 Master PGN saved (${pgnCollection.length} matches)`);
        });
    }).fail(function() {
        let cur = window.buildBrandedPGN ? window.buildBrandedPGN() : "";
        let timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let fileName = `Master_All_Matches_${timeStamp}.pgn`;
        if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
            window.AndroidBridge.savePgnNative(cur, fileName, true);
        } else {
            triggerBrowserFileDownload(cur, fileName);
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

// ============================================================================
// SPECIFIC PGN DOWNLOAD LISTENER (NEVER HIJACKS ENGINE DOWNLOADS)
// ============================================================================
$(document).on('click', '#btn-download-pgn, #modal-download-pgn-btn, [id*="download-pgn"], button:contains("Download Current Match PGN"), button:contains("💾 Download Current Match PGN")', function(e) {
    e.preventDefault();
    e.stopPropagation();
    window.saveSingleMatchPGN();
});

window.openShareModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    if (window.updateAccuracySummary) window.updateAccuracySummary();
    let box = (typeof safeEl === 'function') ? safeEl('branded-pgn-box') : document.getElementById('branded-pgn-box');
    if (box) box.value = window.buildBrandedPGN();
    if (typeof safeDisplay === 'function') safeDisplay('share-modal', 'flex');
    else $('#share-modal').css('display', 'flex');
};

window.copyBrandedPGN = function() {
    let box = (typeof safeEl === 'function') ? safeEl('branded-pgn-box') : document.getElementById('branded-pgn-box');
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
    let fen = (typeof historyIndex !== 'undefined' && historyIndex >= 0 && typeof gameHistory !== 'undefined' && gameHistory[historyIndex]) ? gameHistory[historyIndex].fen : (typeof game !== 'undefined' ? game.fen() : "");
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
    if (typeof safeDisplay === 'function') safeDisplay('vault-modal', 'flex');
    else $('#vault-modal').css('display', 'flex');
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
    let devId = getOrCreateDeviceId();
    showInAppConfirmDialog(
        "Delete All Games?",
        "Are you sure you want to permanently clear your entire game history on this device?",
        function() {
            $.post('/delete_all_matches', { device_id: devId }, function() {
                window.currentActiveMatchDbId = null;
                localStorage.removeItem('chess_current_db_id');
                localStorage.removeItem('chess_current_db_device_id');
                localStorage.removeItem('chess_active_match');
                localStorage.removeItem('chess_vault_offline_matches');
                localStorage.removeItem('saved_games_list');
                window.refreshMatchVaultList();
                showAndroidToast("🗑 Game history deleted for this device");
            });
        }
    );
};

// ============================================================================
// ARCHIVE MATCH LIST RENDERER (WITH FULL PGN REPLAY SUPPORT)
// ============================================================================
function renderVaultCards(matches, container) {
    matches = filterVaultMatchesForDevice(matches);
    container.empty();
    window.vaultMatchesById = {};

    if (!matches || matches.length === 0) {
        container.html('<div style="text-align:center;padding:34px;color:#777;">No saved games in your archive yet.</div>');
        return;
    }

    let finishedSignatures = new Set();
    matches.forEach(m => {
        if (m && m.id) window.vaultMatchesById[m.id] = m;
        let res = (m.result || "").toString().toLowerCase();
        if (!res.includes("progress")) {
            finishedSignatures.add(`${m.white}_${m.black}`);
        }
    });

    let cleanList = matches.filter(m => {
        let res = (m.result || "").toString().toLowerCase();
        let sig = `${m.white}_${m.black}`;
        return !(res.includes("progress") && finishedSignatures.has(sig));
    });

    cleanList.forEach(m => {
        let resultLower = (m.result || "").toString().toLowerCase();
        let isInProgress = resultLower.includes("in progress") || resultLower.includes("progress");
        let actionBtnText = isInProgress ? "▶ Resume" : "▶ Replay";
        let actionBtnColor = isInProgress ? "#2ea043" : "#81b64c";

        let moveCount = "1 move";
        if (m.pgn) {
            let moveTokens = m.pgn.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').trim().split(/\s+/).filter(Boolean);
            let turns = moveTokens.filter(t => !t.includes('.') && !t.includes('-') && t !== '*');
            if (turns.length > 0) moveCount = `${Math.ceil(turns.length / 2)} moves`;
        } else if (m.fen) {
            let parts = m.fen.split(' ');
            if (parts.length >= 6) {
                let fullMoves = parseInt(parts[5]);
                if (!isNaN(fullMoves) && fullMoves > 0) moveCount = `${fullMoves} moves`;
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
                <button onclick="window.loadVaultMatch('${m.id}', '${m.fen || ''}', ${isInProgress}, '${m.white || ''}', '${m.black || ''}')" style="flex:1.2;background:${actionBtnColor};color:#fff;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">${actionBtnText}</button>
                <button onclick="window.viewVaultMatchReport('${encodeURIComponent(m.pgn || '')}')" style="flex:1;background:#2b5278;color:#fff;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">📊 Report</button>
                <button onclick="window.saveVaultMatchPGN('${m.id}')" style="flex:1;background:#3a3b40;color:#ddd;border:none;padding:7px;border-radius:4px;font-weight:bold;cursor:pointer;">💾 PGN</button>
                <button onclick="window.deleteSingleMatch('${m.id}')" style="background:#da3633;color:#fff;border:none;padding:7px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>
            </div>
        </div>`;
        container.append(itemHtml);
    });
}

window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) container = $('#vault-list');
    if (!container.length) {
        container = $('#vault-modal .modal-body, .vault-modal-content, .archive-container');
    }
    if (!container.length) return;

    container.html('<div style="text-align:center;padding:24px;color:#aaa;">Loading Games Archive...</div>');

    let devId = getOrCreateDeviceId();
    $.get('/get_matches', { device_id: devId }, function(data) {
        let matches = cacheDeviceVaultResponse(data && data.matches);
        try {
            writeDeviceVaultCache(matches);
        } catch(e) {}
        renderVaultCards(matches, container);
    }).fail(function() {
        let localMatches = [];
        try {
            localMatches = readDeviceVaultCache();
        } catch(e) {}
        renderVaultCards(localMatches, container);
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

// ============================================================================
// LOAD MATCH WITH FULL MOVE HISTORY (REPLAY & RESUME 100% FIXED)
// ============================================================================
window.loadVaultMatch = function(id, fen, isResume, whiteName, blackName) {
    let match = (window.vaultMatchesById && window.vaultMatchesById[id]) ? window.vaultMatchesById[id] : null;
    if (!match) {
        try {
            let local = readDeviceVaultCache();
            match = local.find(m => String(m.id) === String(id));
        } catch(e) {}
    }

    if (typeof closeModal === 'function') closeModal('vault-modal');
    else $('#vault-modal').hide();

    let pgnData = (match && match.pgn) ? match.pgn : "";
    let finalFen = (match && match.fen) ? match.fen : (fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    let white = (match && match.white) ? match.white : (whiteName || "White");
    let black = (match && match.black) ? match.black : (blackName || "Black");

    if (typeof stopAllActiveMatchProcesses === 'function') stopAllActiveMatchProcesses();
    window.activeGameEndStatus = null;
    if (typeof window.clearKingEndEffects === 'function') window.clearKingEndEffects();

    let tempGame = new Chess();
    let pgnLoaded = false;
    if (pgnData && pgnData.trim().length > 0) {
        try {
            pgnLoaded = tempGame.load_pgn(pgnData);
        } catch(e) {
            pgnLoaded = false;
        }
        if (!pgnLoaded || tempGame.history().length === 0) {
            try {
                let movesOnly = pgnData.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').replace(/\d+\.+/g, '').replace(/(1-0|0-1|1\/2-1\/2|\*)/g, '').trim();
                let tokens = movesOnly.split(/\s+/).filter(Boolean);
                let fallbackG = new Chess();
                tokens.forEach(tok => fallbackG.move(tok, { sloppy: true }));
                if (fallbackG.history().length > 0) {
                    tempGame = fallbackG;
                    pgnLoaded = true;
                }
            } catch(e) {}
        }
    }

    if (pgnLoaded && tempGame.history().length > 0) {
        let moves = tempGame.history({ verbose: true });
        let replayG = new Chess();
        let newHistory = [{
            fen: replayG.fen(),
            move: null,
            moveObj: null,
            soundType: 'move',
            evalScore: 50.0,
            evalText: "0.0",
            cp: 0,
            bestMoveUci: "",
            bestMoveSan: ""
        }];

        moves.forEach(function(mv) {
            let res = replayG.move(mv);
            if (!res) return;
            let sType = (typeof detectMoveSoundType === 'function') ? detectMoveSoundType(replayG, res) : (res.captured ? 'capture' : (res.san && res.san.includes('+') ? 'check' : 'move'));
            newHistory.push({
                fen: replayG.fen(),
                move: { from: res.from, to: res.to },
                moveObj: res,
                soundType: sType,
                evalScore: 50.0,
                evalText: "0.0",
                cp: 0,
                bestMoveUci: "",
                bestMoveSan: ""
            });
        });

        game = replayG;
        gameHistory = newHistory;
        historyIndex = isResume ? (newHistory.length - 1) : 0;
    } else {
        game.load(finalFen);
        gameHistory = [{
            fen: game.fen(),
            move: null,
            moveObj: null,
            soundType: 'move',
            evalScore: 50.0,
            evalText: "0.0",
            cp: 0,
            bestMoveUci: "",
            bestMoveSan: ""
        }];
        historyIndex = 0;
    }

    window.activeWhiteDisplayName = white;
    window.activeBlackDisplayName = black;
    if (typeof safeText === 'function') {
        safeText('bottom-player-name', white);
        safeText('bottom-player-label', 'White');
        safeText('top-player-name', black);
        safeText('top-player-label', 'Black');
    }

    selectedSquare = null;
    currentLegalMoves = [];
    premoveQueue = [];

    if (isResume) {
        window.currentActiveMatchDbId = id;
        localStorage.setItem('chess_current_db_id', id);
        localStorage.setItem('chess_current_db_device_id', getOrCreateDeviceId());
        if (typeof matchEnded !== 'undefined') matchEnded = false;
        if (typeof isAnalysisBranchMode !== 'undefined') isAnalysisBranchMode = false;

        let bStr = (black || '').toLowerCase();
        if (bStr.includes('stockfish') || bStr.includes('bot') || bStr.includes('ai') || bStr.includes('gm')) {
            if (typeof gameMode !== 'undefined') gameMode = 'pvb';
            if (typeof playerColor !== 'undefined') playerColor = 'w';
        } else {
            if (typeof gameMode !== 'undefined') gameMode = 'pvp';
        }

        if (typeof renderBoard === 'function') renderBoard();
        if (typeof updateEvalBar === 'function') updateEvalBar(historyIndex);
        if (typeof updateMaterial === 'function') updateMaterial(game.fen());
        if (typeof updateStatus === 'function') updateStatus();
        if (typeof startTimer === 'function') startTimer();
        $('#status').text("Resumed match from archive.");

        if (typeof gameMode !== 'undefined' && gameMode === 'pvb' && typeof game !== 'undefined' && game.turn() === 'b') {
            if (typeof makeAiMove === 'function') setTimeout(makeAiMove, 300);
        }
    } else {
        if (typeof matchEnded !== 'undefined') matchEnded = true;
        if (typeof isAnalysisBranchMode !== 'undefined') isAnalysisBranchMode = true;
        if (typeof stopAllActiveMatchProcesses === 'function') stopAllActiveMatchProcesses();
        
        if (typeof renderBoard === 'function') renderBoard();
        if (typeof updateEvalBar === 'function') updateEvalBar(historyIndex);
        if (typeof updateMaterial === 'function') updateMaterial(gameHistory[historyIndex].fen);
        if (typeof showAnalysisStatus === 'function') showAnalysisStatus();
        if (typeof drawAllEvalGraphs === 'function') drawAllEvalGraphs();

        $('#status').text(`Replay: ${white} vs ${black} (Use > or >| to view moves)`);
    }
};

window.deleteSingleMatch = function(id) {
    showInAppConfirmDialog(
        "Delete Match?",
        "Are you sure you want to delete this match record?",
        function() {
            let devId = getOrCreateDeviceId();
            $.post('/delete_match', { id: id, device_id: devId }, function() {
                if (window.currentActiveMatchDbId == id) {
                    window.currentActiveMatchDbId = null;
                    localStorage.removeItem('chess_current_db_id');
                    localStorage.removeItem('chess_current_db_device_id');
                }
                try {
                    let local = readDeviceVaultCache();
                    local = local.filter(m => String(m.id) !== String(id));
                    writeDeviceVaultCache(local);
                } catch(e) {}
                window.refreshMatchVaultList();
                showAndroidToast("Match deleted");
            }).fail(function() {
                try {
                    let local = readDeviceVaultCache();
                    local = local.filter(m => String(m.id) !== String(id));
                    writeDeviceVaultCache(local);
                } catch(e) {}
                window.refreshMatchVaultList();
                showAndroidToast("Removed from offline cache; server deletion was not confirmed.");
            });
        }
    );
};

// ============================================================================
// SINGLE MATCH SAVER WITH DEVICE ISOLATION & IN-FLIGHT QUEUE
// ============================================================================
window.saveCurrentMatchToVault = function(resultTitle, onComplete) {
    let pgn = window.buildBrandedPGN ? window.buildBrandedPGN() : (typeof game !== 'undefined' ? game.pgn() : "");
    let fen = (typeof game !== 'undefined') ? game.fen() : "";
    let localDate = getUserDeviceFormattedDate();
    let devId = getOrCreateDeviceId();

    let payload = {
        id: window.currentActiveMatchDbId || "",
        device_id: devId,
        date: localDate,
        white: (typeof getWhiteDisplayName === 'function') ? getWhiteDisplayName() : 'White',
        black: (typeof getBlackDisplayName === 'function') ? getBlackDisplayName() : 'Black',
        result: resultTitle || "In Progress",
        w_acc: (typeof getTextSafe === 'function') ? getTextSafe('white-acc-text', '95%') : '95%',
        b_acc: (typeof getTextSafe === 'function') ? getTextSafe('black-acc-text', '95%') : '95%',
        opening: (typeof getTextSafe === 'function') ? getTextSafe('opening-bar', 'Standard Opening') : 'Standard Opening',
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
        writeDeviceVaultCache(readDeviceVaultCache().filter(m => !m._vault_pending_sync ||
            !((payload.id && String(m.id) === String(payload.id)) ||
              (data && data.id && String(m.id) === String(data.id)) ||
              (payload.pgn && m.pgn === payload.pgn))));
        if (data && data.id) {
            window.currentActiveMatchDbId = data.id;
            localStorage.setItem('chess_current_db_id', data.id);
            localStorage.setItem('chess_current_db_device_id', devId);
        }
        if (resultTitle && !resultTitle.toLowerCase().includes("in progress")) {
            localStorage.removeItem('chess_active_match');
            window.currentActiveMatchDbId = null;
            localStorage.removeItem('chess_current_db_id');
            localStorage.removeItem('chess_current_db_device_id');
        }

        if (typeof onComplete === 'function') onComplete(data);

        if (window.pendingCloudSave) {
            let next = window.pendingCloudSave;
            window.pendingCloudSave = null;
            next.id = window.currentActiveMatchDbId || "";
            window.saveCurrentMatchToVault(next.result);
        }
    }).fail(function() {
        window.isSavingToCloud = false;
        try {
            let offlineList = readDeviceVaultCache();
            payload.id = payload.id || ("offline_" + Date.now());
            payload._vault_pending_sync = true;
            let existingIdx = offlineList.findIndex(x => x.id === payload.id);
            if (existingIdx >= 0) offlineList[existingIdx] = payload;
            else offlineList.unshift(payload);
            writeDeviceVaultCache(offlineList);
        } catch(e) {}
        if (typeof onComplete === 'function') onComplete(null);
    });
};

window.manualSaveToVault = function() {
    window.saveCurrentMatchToVault("Saved Match", function() {
        showAndroidToast("💾 Match saved to Vault");
        window.refreshMatchVaultList();
    });
};
