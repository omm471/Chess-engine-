/* ============================================================================
   static/mod_share_vault.js (v100 - Step 3)
   Restored Full Branded PGN Format with Headers + Archive Save
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

    // Reconstruct clean SAN move text from gameHistory so it works even in review mode
    let movesText = "";
    for (let i = 1; i < gameHistory.length; i++) {
        let rec = gameHistory[i];
        if (!rec || !rec.moveObj) continue;
        if (i % 2 === 1) {
            movesText += `${Math.ceil(i / 2)}. ${rec.moveObj.san} `;
        } else {
            movesText += `${rec.moveObj.san} `;
        }
    }
    if (!movesText.trim()) movesText = game.pgn() || "";

    let headers = [
        `[Event "Chess AI Pro Match"]`,
        `[Site "Chess AI Pro • Local Engine Server"]`,
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

window.downloadShareableKundliCard = function() {
    openShareModal();
};

window.openMatchVaultModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    if (window.refreshMatchVaultList) window.refreshMatchVaultList();
    safeDisplay('vault-modal', 'flex');
};

window.manualSaveToVault = function() {
    window.saveCurrentMatchToVault("Saved Match");
    if (window.refreshMatchVaultList) window.refreshMatchVaultList();
    alert("Current game saved to Archive!");
};

window.saveCurrentMatchToVault = function(resultTitle) {
    if (currentMatchSaved && resultTitle !== "Saved Match") return;
    currentMatchSaved = true;
    if (window.updateAccuracySummary) window.updateAccuracySummary();
    let whiteName = getWhiteDisplayName();
    let blackName = getBlackDisplayName();
    let wAcc = getTextSafe('white-acc-text', '95%');
    let bAcc = getTextSafe('black-acc-text', '95%');
    let opening = getTextSafe('opening-bar', 'Standard Opening');
    let pgn = window.buildBrandedPGN();
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
