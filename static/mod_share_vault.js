/* ============================================================================
   static/mod_share_vault.js (v410 - Fixed Engine Download Interceptor & Vault)
   ============================================================================ */

window.currentActiveMatchDbId = localStorage.getItem('chess_current_db_id') || null;
window.isSavingToCloud = false;
window.pendingCloudSave = null;

function getOrCreateDeviceId() {
    let devId = localStorage.getItem('chess_device_id');
    if (!devId) {
        devId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem('chess_device_id', devId);
    }
    return devId;
}

function getUserDeviceFormattedDate() {
    let now = new Date();
    let datePart = now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    let timePart = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${datePart} • ${timePart}`;
}

function showAndroidToast(message) {
    if (window.AndroidBridge && window.AndroidBridge.savePgnNative) return;

    let existing = document.getElementById('android-toast-pill');
    if (existing) existing.remove();

    let toast = document.createElement('div');
    toast.id = 'android-toast-pill';
    toast.style.cssText = `
        position: fixed !important; bottom: 34px !important; left: 50% !important;
        transform: translateX(-50%) translateY(20px) !important;
        background: #232429 !important; color: #ffffff !important;
        padding: 10px 20px !important; border-radius: 28px !important;
        border: 1px solid #3e404a !important; box-shadow: 0 10px 28px rgba(0,0,0,0.7) !important;
        font-size: 13px !important; font-family: sans-serif !important; font-weight: 500 !important;
        z-index: 99999999 !important; pointer-events: none !important; opacity: 0 !important;
        transition: opacity 0.22s ease-out, transform 0.22s ease-out !important;
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
    let dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    let resCode = "*";
    if (typeof game !== 'undefined' && game.in_checkmate && game.in_checkmate()) {
        resCode = (game.turn() === 'w') ? "0-1" : "1-0";
    } else if (typeof game !== 'undefined' && game.in_draw && game.in_draw()) {
        resCode = "1/2-1/2";
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

    let headers = [
        `[Event "Chess AI Pro Match"]`,
        `[Site "Chess AI Pro"]`,
        `[Date "${dateStr}"]`,
        `[White "${wName}"]`,
        `[Black "${bName}"]`,
        `[Result "${resCode}"]`
    ].join('\n');

    return `${headers}\n\n${movesText.trim()} ${resCode}`.trim();
};

window.saveSingleMatchPGN = function() {
    let pgnText = window.buildBrandedPGN ? window.buildBrandedPGN() : "";
    if (!pgnText || !pgnText.trim()) {
        showAndroidToast("⚠ No PGN moves to save!");
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

    $.post('/save_to_device_storage', { pgn: pgnText, filename: fileName }, function(res) {
        showAndroidToast(`💾 Saved to ChessAIPro folder (${fileName})`);
    }).fail(function() {
        showAndroidToast(`💾 Saved to Downloads folder (${fileName})`);
    });
};

window.exportAllMatchesMultiPGN = function() {
    let devId = getOrCreateDeviceId();
    $.get('/get_matches', { device_id: devId }, function(data) {
        let matches = (data && data.matches) ? data.matches : [];
        let pgnCollection = matches.map(m => m.pgn).filter(p => p && p.trim());
        let currentPgn = window.buildBrandedPGN ? window.buildBrandedPGN() : "";
        if (currentPgn) pgnCollection.push(currentPgn);

        let fullMasterPgn = pgnCollection.join('\n\n\n');
        let fileName = `Master_All_Matches_${Date.now()}.pgn`;

        if (window.AndroidBridge && window.AndroidBridge.savePgnNative) {
            window.AndroidBridge.savePgnNative(fullMasterPgn, fileName, true);
        } else {
            $.post('/save_to_device_storage', { pgn: fullMasterPgn, filename: fileName }, function() {
                showAndroidToast("📚 Master PGN saved!");
            });
        }
    });
};

// FIXED LISTENER: Removed button:contains("Download") so Engine install button works!
$(document).on('click', '#btn-download-pgn, #modal-download-pgn-btn, [id*="download-pgn"], button:contains("Download Current Match PGN")', function(e) {
    e.preventDefault();
    e.stopPropagation();
    window.saveSingleMatchPGN();
});

window.openShareModal = function() {
    let box = document.getElementById('branded-pgn-box');
    if (box) box.value = window.buildBrandedPGN();
    $('#share-modal').css('display', 'flex');
};

window.copyBrandedPGN = function() {
    let box = document.getElementById('branded-pgn-box');
    if (!box) return;
    box.select();
    navigator.clipboard.writeText(box.value).then(() => {
        showAndroidToast("📋 PGN copied");
    });
};

window.shareBrandedGameNative = function() {
    let pgn = window.buildBrandedPGN();
    if (navigator.share) {
        navigator.share({ title: 'Chess AI Pro Match PGN', text: pgn }).catch(() => {});
    } else {
        window.copyBrandedPGN();
    }
};

window.copyCurrentFEN = function() {
    let fen = (typeof game !== 'undefined') ? game.fen() : "";
    navigator.clipboard.writeText(fen).then(() => {
        showAndroidToast("📋 FEN copied");
    });
};

window.openMatchVaultModal = function() {
    window.refreshMatchVaultList();
    $('#vault-modal').css('display', 'flex');
};

window.refreshMatchVaultList = function() {
    let container = $('#vault-matches-list');
    if (!container.length) return;
    container.html('<div style="text-align:center;padding:20px;color:#aaa;">Loading Games...</div>');

    let devId = getOrCreateDeviceId();
    $.get('/get_matches', { device_id: devId }, function(data) {
        container.empty();
        let matches = data.matches || [];

        if (matches.length === 0) {
            container.html('<div style="text-align:center;padding:26px;color:#777;">No saved games in archive yet.<br><br>Play a game or tap "+ Save Current Game" to add one!</div>');
            return;
        }

        matches.forEach(m => {
            let card = `
            <div class="vault-card" style="background:#1e1e1e; border:1px solid #333; border-radius:8px; padding:10px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b style="color:#eee;">♔ ${m.white || 'White'} <span style="color:#777;font-size:11px;">vs</span> ♚ ${m.black || 'Black'}</b>
                    <span style="font-size:10px; background:#2a2b2e; color:#81b64c; padding:2px 7px; border-radius:4px;">${m.result || 'Finished'}</span>
                </div>
                <div style="font-size:10.5px; color:#888; margin:5px 0;">${m.date || ''} • ${m.opening || 'Standard'}</div>
                <div style="display:flex; gap:6px; margin-top:6px;">
                    <button onclick="window.loadVaultMatch('${m.id}', '${m.fen || ''}', false, '${m.white || ''}', '${m.black || ''}')" style="flex:1; background:#81b64c; color:#fff; border:none; padding:7px; border-radius:4px; font-weight:bold; cursor:pointer;">▶ Replay</button>
                    <button onclick="window.saveSingleMatchPGN()" style="flex:1; background:#3a3b40; color:#ddd; border:none; padding:7px; border-radius:4px; cursor:pointer; font-weight:bold;">💾 Save PGN</button>
                    <button onclick="window.deleteSingleMatch('${m.id}')" style="background:#da3633; color:#fff; border:none; padding:7px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">✕</button>
                </div>
            </div>`;
            container.append(card);
        });
    });
};

window.deleteSingleMatch = function(id) {
    $.post('/delete_match', { id: id }, function() {
        window.refreshMatchVaultList();
        showAndroidToast("Match deleted");
    });
};

window.saveCurrentMatchToVault = function(resultTitle) {
    let pgn = window.buildBrandedPGN ? window.buildBrandedPGN() : "";
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
        pgn: pgn,
        fen: fen
    };

    if (window.isSavingToCloud) return;
    window.isSavingToCloud = true;

    $.post('/save_match', payload, function(data) {
        window.isSavingToCloud = false;
        if (data && data.id) {
            window.currentActiveMatchDbId = data.id;
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
