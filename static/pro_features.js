/* ============================================================================
   PRO CHESS AI - MASTER PLUGIN (pro_features.js v47)
   Fixes Included:
   1. Real-Time Stockfish Engine Hint (Top-3 Multi-PV Cycling + Chess.com Arrow)
   2. Deep Report Smooth Mobile Scroll + Sticky Close Button + Phone Back Button
   3. Complete Match Vault (Game Archive) with Auto-Save, Full PGN & FEN Export
   ============================================================================ */
(function() {
    let heatmapEnabled = false;
    let voiceTtsEnabled = false;
    let voiceListening = false;
    let blindfoldEnabled = false;
    let focusModeEnabled = false;
    let drawModeEnabled = false;
    let showHintButton = false;
    let showEvalBar = true;
    let engineThinkTime = 0.5;
    let engineMaxDepth = 16;

    let activeDrawColor = "rgba(255, 170, 0, 0.82)";
    let customAnnotations = [];
    let drawUndoStack = [];
    let drawRedoStack = [];
    let drawStartSq = null;
    let isAnalysisBranchMode = false;

    // Hint Cycling State (Cycles through Top 3 Stockfish moves if tapped repeatedly)
    let lastHintFen = "";
    let lastHintLines = [];
    let hintCycleIndex = 0;

    // Prevent duplicate auto-saves of the same game
    let currentMatchSaved = false;

    let replayInterval = null;
    let replaySpeedMs = 1000;
    let activePersonality = "default";
    let activeOpeningDrill = null;
    let drillStepIndex = 0;

    // 1. DEEP OPENING BOOK WITH FULL VARIATIONS
    const deepOpeningsBook = [
        { moves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4", name: "Sicilian: Dragon, Yugoslav Attack (9.Bc4)" },
        { moves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6", name: "Sicilian Defense: Dragon Variation" },
        { moves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3", name: "Sicilian: Najdorf, English Attack" },
        { moves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6", name: "Sicilian Defense: Najdorf Variation" },
        { moves: "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5", name: "Sicilian Defense: Sveshnikov Variation" },
        { moves: "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4", name: "Sicilian Defense: Kan / Taimanov Variation" },
        { moves: "1. e4 c5 2. c3", name: "Sicilian Defense: Alapin Variation" },
        { moves: "1. e4 c5 2. Nc3", name: "Sicilian Defense: Closed Variation" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O", name: "Ruy Lopez: Closed, Chigorin Defense" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6", name: "Ruy Lopez: Exchange Variation" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6", name: "Ruy Lopez: Berlin Defense" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6", name: "Ruy Lopez: Morphy Defense, Main Line" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6", name: "Ruy Lopez: Morphy Defense" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5", name: "Ruy Lopez (Spanish Game)" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7", name: "Italian: Two Knights, Fried Liver Attack" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5", name: "Italian: Two Knights, Knight Attack" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6", name: "Italian Game: Two Knights Defense" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3", name: "Italian Game: Giuoco Pianissimo" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4", name: "Italian Game: Evans Gambit" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5", name: "Italian Game: Giuoco Piano" },
        { moves: "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4", name: "Scotch Game: Main Line" },
        { moves: "1. e4 e5 2. Nf3 d6 3. d4 exd4 4. Nxd4", name: "Philidor Defense: Exchange Variation" },
        { moves: "1. e4 e5 2. Nf3 d6 3. d4 Nf6", name: "Philidor Defense: Lion / Hanham Variation" },
        { moves: "1. e4 e5 2. Nf3 d6", name: "Philidor Defense" },
        { moves: "1. e4 e5 2. Nf3 Nf6", name: "Petrov's Defense (Russian Game)" },
        { moves: "1. e4 e5 2. Qh5", name: "King's Pawn: Wayward Queen Attack" },
        { moves: "1. e4 c6 2. d4 d5 3. e5 Bf5", name: "Caro-Kann: Advance Variation, Main Line" },
        { moves: "1. e4 c6 2. d4 d5 3. e5 c5", name: "Caro-Kann: Advance, Botvinnik-Carls" },
        { moves: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3", name: "Caro-Kann Defense: Exchange Variation" },
        { moves: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5", name: "Caro-Kann Defense: Classical Variation" },
        { moves: "1. e4 c6 2. d4 d5 3. f3", name: "Caro-Kann Defense: Fantasy Variation" },
        { moves: "1. e4 c6", name: "Caro-Kann Defense" },
        { moves: "1. e4 e6 2. d4 d5 3. Nc3 Bb4", name: "French Defense: Winawer Variation" },
        { moves: "1. e4 e6 2. d4 d5 3. e5 c5", name: "French Defense: Advance Variation" },
        { moves: "1. e4 e6 2. d4 d5 3. Nd2", name: "French Defense: Tarrasch Variation" },
        { moves: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7", name: "Queen's Gambit Declined: Orthodox Defense" },
        { moves: "1. d4 d5 2. c4 c6 3. Nf3 Nf6", name: "Slav Defense: Main Line" },
        { moves: "1. d4 d5 2. c4 dxc4", name: "Queen's Gambit Accepted" },
        { moves: "1. d4 d5 2. Bf4 Nf6 3. e3", name: "London System: Main Line" },
        { moves: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6", name: "King's Indian Defense: Classical Variation" },
        { moves: "1. d4 Nf6 2. c4 g6 3. Nc3 d5", name: "Grünfeld Defense" },
        { moves: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4", name: "Nimzo-Indian Defense" },
        { moves: "1. e4 e5 2. f4 exf4", name: "King's Gambit Accepted" },
        { moves: "1. e4 d5 2. exd5 Qxd5", name: "Scandinavian Defense: Mieses-Kotroc" },
        { moves: "1. c4 e5", name: "English Opening: Reversed Sicilian" },
        { moves: "1. c4", name: "English Opening" },
        { moves: "1. e4 e5", name: "King's Pawn Game (1.e4 e5)" },
        { moves: "1. e4", name: "King's Pawn Opening (1.e4)" },
        { moves: "1. d4", name: "Queen's Pawn Opening (1.d4)" }
    ];

    const botPersonalities = {
        "default": { name: "Standard Stockfish", contempt: 0, style: "Balanced universal calculation." },
        "tal": { name: "Mikhail Tal (Aggressive)", contempt: 80, style: "Sharp sacrifices & tactical attacks." },
        "karpov": { name: "Anatoly Karpov (Positional)", contempt: -20, style: "Solid boa-constrictor defense." },
        "carlsen": { name: "Magnus Carlsen (Universal)", contempt: 35, style: "Endgame precision & relentless pressure." },
        "hikaru": { name: "Hikaru Nakamura (Speed)", contempt: 50, style: "Fast tactical complications." }
    };

    const repertoireDrills = {
        "ruy_lopez": {
            name: "Ruy Lopez: Morphy Defense",
            color: "w",
            moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"],
            tips: "Control center, pin c6 Knight, castle early and prepare Re1."
        },
        "caro_kann": {
            name: "Caro-Kann Defense: Classical",
            color: "b",
            moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5", "Ng3", "Bg6"],
            tips: "Solid c6-d5 light-square structure with active Bf5."
        },
        "philidor": {
            name: "Philidor Defense: Solid Setup",
            color: "b",
            moves: ["e4", "e5", "Nf3", "d6", "d4", "Nd7", "Bc4", "c6", "O-O", "Be7"],
            tips: "Hold e5 strongpoint firmly with d6 and Nd7."
        },
        "italian": {
            name: "Italian Game: Giuoco Piano",
            color: "w",
            moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "d6", "O-O"],
            tips: "Target f7 and build a strong center with c3 and d3."
        }
    };

    const endgameDrills = {
        "lucena": {
            name: "Lucena Position (Winning Rook Endgame)",
            fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
            tip: "Build a bridge with Rc4! Bring your King out and promote the b7 pawn."
        },
        "philidor_end": {
            name: "Queen vs Rook Fortress Breakdown",
            fen: "6k1/5r2/6K1/8/8/8/8/6Q1 w - - 0 1",
            tip: "Force the Rook away from the King using double attacks and checks."
        },
        "kp_opposition": {
            name: "King & Pawn Opposition Mastery",
            fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1",
            tip: "Keep opposition with Kd6/Kf6 and escort the e-pawn to promotion!"
        },
        "two_bishops": {
            name: "Two Bishops Checkmate Drill",
            fen: "4k3/8/8/8/8/2B1B3/4K3/8 w - - 0 1",
            tip: "Use both Bishops side-by-side to push the Black King into a corner."
        }
    };

    // ========================================================================
    // 2. INJECT MOBILE SCROLL & STICKY CLOSE BUTTON FIX FOR MODALS
    // ========================================================================
    function injectScrollAndModalFixes() {
        $('#pro-modal-scroll-fix').remove();
        const css = `
            /* FIX FULLSCREEN TRAP: Allow smooth vertical scrolling in all modals */
            .modal-overlay {
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                align-items: flex-start !important;
                padding: 16px 8px !important;
                box-sizing: border-box !important;
            }
            .modal-content, .kundli-box, .setup-box {
                max-height: 85vh !important;
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                touch-action: pan-y !important;
                margin: auto !important;
                position: relative !important;
                box-sizing: border-box !important;
            }
            /* Sticky Top Close Bar inside Deep Report & Match Vault */
            .sticky-top-bar {
                position: sticky !important;
                top: -14px !important;
                background: #262421 !important;
                z-index: 99 !important;
                padding: 8px 4px !important;
                margin: -10px -6px 8px -6px !important;
                border-bottom: 1px solid #444 !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
            }
            .big-close-btn {
                background: #ca3431 !important;
                color: #fff !important;
                border: 1px solid #ff6b6b !important;
                padding: 5px 12px !important;
                border-radius: 5px !important;
                font-size: 12px !important;
                font-weight: bold !important;
                cursor: pointer !important;
            }
            /* Archive / Vault Cards */
            .vault-card {
                background: #181714;
                border: 1px solid #363431;
                border-left: 3px solid #81b64c;
                border-radius: 6px;
                padding: 8px;
                margin-bottom: 8px;
                text-align: left;
                font-size: 11px;
            }
            .vault-code-box {
                width: 100%;
                background: #11100e;
                color: #aaa;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 4px 6px;
                font-family: monospace;
                font-size: 10px;
                margin-top: 4px;
                box-sizing: border-box;
                white-space: nowrap;
                overflow-x: auto;
            }
            .vault-btn-row {
                display: flex;
                gap: 5px;
                margin-top: 6px;
                flex-wrap: wrap;
            }
            .vault-mini-btn {
                flex: 1;
                padding: 5px 6px;
                font-size: 10.5px;
                border-radius: 4px;
                font-weight: bold;
                cursor: pointer;
                border: none;
                color: #fff;
            }
        `;
        $('<style id="pro-modal-scroll-fix">').text(css).appendTo('head');

        // Upgrade Deep Report Modal Header to Sticky Header with clear Close Button
        let $kModal = $('#kundli-modal .modal-content');
        if ($kModal.length && $kModal.find('.sticky-top-bar').length === 0) {
            $kModal.find('.close-btn').remove();
            $kModal.find('h2').first().remove();
            $kModal.prepend(`
                <div class="sticky-top-bar">
                    <span style="color:#d580ff; font-size:15px; font-weight:bold;">📊 Deep Report & Analysis</span>
                    <button class="big-close-btn" onclick="closeModal('kundli-modal')">✕ Close</button>
                </div>
            `);
        }

        // Upgrade Match Vault Modal to Game Archive with Sticky Close + Manual Save Button
        let $vModal = $('#vault-modal .modal-content');
        if ($vModal.length) {
            $vModal.html(`
                <div class="sticky-top-bar">
                    <span style="color:#81b64c; font-size:15px; font-weight:bold;">💾 Game Archive (Vault)</span>
                    <button class="big-close-btn" onclick="closeModal('vault-modal')">✕ Close</button>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                    <button onclick="manualSaveToVault()" style="flex:1; background:#4b7399; padding:8px; font-size:11px; border-radius:5px;">💾 Save Current Game Now</button>
                </div>
                <div id="vault-list" style="margin-top: 6px;"></div>
                <button onclick="closeModal('vault-modal')" style="width:100%; margin-top:10px; background:#ca3431; padding:9px; font-weight:bold;">✕ Close Archive</button>
            `);
        }

        // Allow tapping outside dark overlay backdrop to close any open modal
        $('.modal-overlay').off('click.backdrop').on('click.backdrop', function(e) {
            if (e.target === this) {
                $(this).hide();
            }
        });

        // Support Android Hardware Back Button to close open modals instead of exiting page
        window.addEventListener('popstate', function() {
            $('.modal-overlay:visible').hide();
        });
    }

    // Push history state when opening heavy modals so Back button closes them cleanly
    function pushModalHistoryState() {
        try { window.history.pushState({ modalOpen: true }, ""); } catch(e) {}
    }

    // ========================================================================
    // 3. REAL STOCKFISH ENGINE HINT (MULTI-PV CYCLING + CHESS.COM ARROW)
    // ========================================================================
    function drawEngineHintArrowOnBoard(fromSq, toSq, color) {
        let svg = document.getElementById('arrow-overlay');
        if (!svg) return;
        let files = ['a','b','c','d','e','f','g','h'];
        let f1 = files.indexOf(fromSq[0]), r1 = parseInt(fromSq[1]);
        let f2 = files.indexOf(toSq[0]), r2 = parseInt(toSq[1]);

        if ((Math.abs(f2 - f1) === 1 && Math.abs(r2 - r1) === 2) || (Math.abs(f2 - f1) === 2 && Math.abs(r2 - r1) === 1)) {
            svg.innerHTML = buildKnightLArrowSvg(fromSq, toSq, color);
        } else {
            let p1 = sqToSvgCoords(fromSq), p2 = sqToSvgCoords(toSq);
            svg.innerHTML = buildStraightArrowSvg(p1, p2, color);
        }
    }

    window.requestHint = function() {
        // Always get the EXACT FEN currently displayed on the board (works in Live AND Review Mode!)
        let activeFen = (historyIndex >= 0 && historyIndex < gameHistory.length)
            ? gameHistory[historyIndex].fen
            : game.fen();

        let tempBoard = new Chess(activeFen);
        if (tempBoard.game_over()) {
            $('#status').text("Game is over on this position — no legal moves.");
            return;
        }

        // If user taps Hint again on the exact same board position, cycle through Top 3 Stockfish moves!
        if (activeFen === lastHintFen && lastHintLines.length > 1) {
            hintCycleIndex = (hintCycleIndex + 1) % lastHintLines.length;
            let chosen = lastHintLines[hintCycleIndex];
            let from = chosen.uci.substring(0, 2);
            let to = chosen.uci.substring(2, 4);
            let colors = ["rgba(74, 143, 240, 0.88)", "rgba(129, 182, 76, 0.88)", "rgba(255, 170, 0, 0.88)"];
            drawEngineHintArrowOnBoard(from, to, colors[hintCycleIndex % colors.length]);
            $('#status').text(`💡 Engine Choice #${hintCycleIndex + 1}: ${chosen.san} (${from} → ${to}) [${chosen.score}]`);
            safeHtml('coach-bubble', `🤖 <b>Stockfish Hint #${hintCycleIndex + 1}:</b> Play <b>${chosen.san}</b> (${from} → ${to}), Eval: <b>${chosen.score}</b>`);
            playSnd('notify');
            return;
        }

        $('#status').text("🧠 Stockfish analyzing position for Best Hint...");

        // Query Stockfish Multi-PV (Top 3 Engine Moves)
        $.post('/multipv', { fen: activeFen, _t: Date.now() }, function(data) {
            if (data && data.lines && data.lines.length > 0) {
                lastHintFen = activeFen;
                lastHintLines = data.lines;
                hintCycleIndex = 0;

                let best = data.lines[0];
                let from = best.uci.substring(0, 2);
                let to = best.uci.substring(2, 4);
                drawEngineHintArrowOnBoard(from, to, "rgba(74, 143, 240, 0.88)");

                let alts = data.lines.slice(1).map((l, idx) => `#${idx+2} ${l.san} (${l.score})`).join(', ');
                $('#status').text(`💡 Best Hint: ${best.san} (${from} → ${to}) [${best.score}] ${alts ? '| Tap Hint for ' + alts : ''}`);
                safeHtml('coach-bubble', `🤖 <b>Stockfish Hint:</b> Best move is <b>${best.san}</b> (${from} → ${to}) with score <b>${best.score}</b>.`);
                playSnd('notify');
            } else {
                // Fallback to /ai_move if multipv returns empty
                $.post('/ai_move', { fen: activeFen, level: 2500, think_time: Math.max(0.4, engineThinkTime), _t: Date.now() }, function(res) {
                    if (res && res.move && res.move.length >= 4) {
                        let from = res.move.substring(0, 2);
                        let to = res.move.substring(2, 4);
                        let mObj = tempBoard.move(res.move, { sloppy: true });
                        let san = mObj ? mObj.san : res.move;
                        lastHintFen = activeFen;
                        lastHintLines = [{ uci: res.move, san: san, score: "Best" }];
                        hintCycleIndex = 0;
                        drawEngineHintArrowOnBoard(from, to, "rgba(74, 143, 240, 0.88)");
                        $('#status').text(`💡 Best Move Hint: ${san} (${from} → ${to})`);
                        safeHtml('coach-bubble', `🤖 <b>Stockfish Hint:</b> Play <b>${san}</b> (${from} → ${to}).`);
                        playSnd('notify');
                    }
                });
            }
        });
    };

    // ========================================================================
    // 4. COMPLETE MATCH VAULT (GAME ARCHIVE) WITH PGN & FEN EXPORT
    // ========================================================================
    function buildFullPgnFromHistory() {
        let pgnStr = game.pgn();
        if (pgnStr && pgnStr.trim().length > 0) return pgnStr.trim();

        // Fallback: reconstruct PGN from gameHistory if game.pgn() is empty
        let movesText = [];
        for (let i = 1; i < gameHistory.length; i++) {
            let h = gameHistory[i];
            if (!h || !h.moveObj) continue;
            if (h.moveObj.color === 'w') {
                movesText.push(`${Math.ceil(i / 2)}. ${h.moveObj.san}`);
            } else {
                movesText.push(h.moveObj.san);
            }
        }
        return movesText.join(' ');
    }

    function saveCurrentMatchToVault(resultTitle, forceManual = false) {
        if (gameHistory.length <= 2) {
            if (forceManual) alert("Play at least 2 moves before saving to Game Archive!");
            return;
        }
        if (currentMatchSaved && !forceManual) return;
        currentMatchSaved = true;

        updateAccuracySummary();

        let pgnText = buildFullPgnFromHistory();
        let finalFen = (gameHistory[gameHistory.length - 1] && gameHistory[gameHistory.length - 1].fen)
            ? gameHistory[gameHistory.length - 1].fen
            : game.fen();

        let record = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            white: getWhiteDisplayName(),
            black: getBlackDisplayName(),
            result: resultTitle || getTextSafe('status', 'Played Match'),
            w_acc: getTextSafe('white-acc-text', '--%'),
            b_acc: getTextSafe('black-acc-text', '--%'),
            opening: getTextSafe('opening-bar', 'Standard').replace('📖 Opening: ', ''),
            pgn: pgnText,
            fen: finalFen
        };

        // 1. Save to LocalStorage Vault (Guaranteed instant persistence with FEN & PGN)
        let localMatches = JSON.parse(localStorage.getItem('pro_chess_vault') || "[]");
        // Avoid exact duplicate PGN back-to-back
        if (localMatches.length === 0 || localMatches[0].pgn !== record.pgn || forceManual) {
            localMatches.unshift(record);
            localStorage.setItem('pro_chess_vault', JSON.stringify(localMatches.slice(0, 50)));
        }

        // 2. Also Save to Python SQLite Backend
        $.post('/save_match', record);

        if (forceManual) {
            playSnd('notify');
            openMatchVaultModal();
        }
    }

    window.manualSaveToVault = function() {
        saveCurrentMatchToVault("Saved Game (" + (gameHistory.length - 1) + " moves)", true);
    };

    window.openMatchVaultModal = function() {
        pushModalHistoryState();
        safeDisplay('vault-modal', 'flex');

        let localMatches = JSON.parse(localStorage.getItem('pro_chess_vault') || "[]");
        $.get('/get_matches', function(data) {
            let dbMatches = (data && data.matches) ? data.matches : [];
            // Merge localMatches (which include FEN) with dbMatches without duplicates
            let combined = [...localMatches];
            dbMatches.forEach(dbm => {
                if (!combined.some(loc => loc.pgn === dbm.pgn && loc.pgn)) {
                    let gTmp = new Chess();
                    if (dbm.pgn) gTmp.load_pgn(dbm.pgn);
                    dbm.fen = gTmp.fen();
                    combined.push(dbm);
                }
            });
            renderVaultList(combined);
        }).fail(function() {
            renderVaultList(localMatches);
        });
    };

    function renderVaultList(matches) {
        if (!matches || matches.length === 0) {
            $('#vault-list').html('<div style="padding:14px; color:#999; font-size:12px;">Abhi tak koi game archive mein nahi hai. Ek game khelein ya upar "💾 Save Current Game Now" dabayein!</div>');
            return;
        }
        window._loadedVaultMatches = matches;
        let html = "";
        matches.forEach((m, idx) => {
            let safePgn = (m.pgn || "No moves").replace(/</g, '&lt;');
            let safeFen = (m.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").replace(/</g, '&lt;');
            html += `
                <div class="vault-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="color:#fff; font-size:12px;">♔ ${m.white} vs ♚ ${m.black}</b>
                        <span style="color:#f0c15c; font-size:10px; font-weight:bold;">${m.result}</span>
                    </div>
                    <div style="color:#81b64c; margin-top:2px;">Acc: W ${m.w_acc} | B ${m.b_acc} • <span style="color:#bbb;">${m.opening}</span></div>
                    <div style="color:#777; font-size:9.5px; margin-bottom:4px;">🕒 ${m.date}</div>
                    
                    <div style="color:#aaa; font-size:10px; font-weight:bold;">PGN:</div>
                    <div class="vault-code-box">${safePgn}</div>
                    
                    <div style="color:#aaa; font-size:10px; font-weight:bold; margin-top:3px;">FEN:</div>
                    <div class="vault-code-box">${safeFen}</div>

                    <div class="vault-btn-row">
                        <button class="vault-mini-btn" style="background:#4a8ff0;" onclick="loadMatchFromVault(${idx})">▶️ Load & Review</button>
                        <button class="vault-mini-btn" style="background:#364935; border:1px solid #81b64c;" onclick="copyArchiveText(${idx}, 'pgn')">📋 Copy PGN</button>
                        <button class="vault-mini-btn" style="background:#2b2926; border:1px solid #555;" onclick="copyArchiveText(${idx}, 'fen')">📋 Copy FEN</button>
                        <button class="vault-mini-btn" style="background:#4a2525; max-width:34px;" onclick="deleteVaultMatch(${idx})" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        });
        $('#vault-list').html(html);
    }

    window.copyArchiveText = function(idx, type) {
        let m = window._loadedVaultMatches[idx];
        if (!m) return;
        let text = (type === 'fen') ? (m.fen || "") : (m.pgn || "");
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => alert(type.toUpperCase() + " Copied!"));
        } else {
            let ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert(type.toUpperCase() + " Copied!");
        }
    };

    window.deleteVaultMatch = function(idx) {
        let localMatches = JSON.parse(localStorage.getItem('pro_chess_vault') || "[]");
        localMatches.splice(idx, 1);
        localStorage.setItem('pro_chess_vault', JSON.stringify(localMatches));
        openMatchVaultModal();
    };

    window.loadMatchFromVault = function(idx) {
        let m = window._loadedVaultMatches[idx];
        if (!m) return;
        closeModal('vault-modal');
        clearInterval(timerInterval);
        timerStarted = false;
        isAnalysisBranchMode = true;

        game.reset();
        if (m.pgn && m.pgn.trim().length > 0) {
            game.load_pgn(m.pgn);
        } else if (m.fen) {
            game.load(m.fen);
        }

        let verboseMoves = game.history({ verbose: true });
        let temp = new Chess();
        gameHistory = [{ fen: temp.fen(), move: null, moveObj: null, evalScore: 50, evalText: "0.0", cp: 0 }];
        verboseMoves.forEach(mv => {
            let prevFen = temp.fen();
            let bm = findInstantBestMove(prevFen);
            temp.move(mv);
            let ev = computeSmartEvalFromFen(temp.fen());
            gameHistory.push({
                fen: temp.fen(),
                move: { from: mv.from, to: mv.to },
                moveObj: mv,
                bestMoveUci: bm ? bm.uci : null,
                bestMoveSan: bm ? bm.san : null,
                isCastle: mv.flags.includes('k') || mv.flags.includes('q'),
                isCapture: mv.flags.includes('c') || mv.flags.includes('e'),
                isPromote: mv.flags.includes('p'),
                inCheck: temp.in_check(),
                isCheckmate: temp.in_checkmate(),
                evalScore: ev.score,
                evalText: ev.text,
                cp: ev.cp
            });
        });

        for (let i = 1; i < gameHistory.length; i++) {
            classifyMoveByEval(i);
        }

        historyIndex = gameHistory.length - 1;
        safeText(['bottom-player-name', 'white-name'], m.white || "White");
        safeText(['top-player-name', 'black-name'], m.black || "Black");
        renderBoard();
        drawAllEvalGraphs();
        $('#status').text(`📂 Loaded Archived Game: ${m.white} vs ${m.black}`);
    };

    // ========================================================================
    // 5. POSITIONAL + TACTICAL HANGING-PIECE EVALUATOR
    // ========================================================================
    function computeSquareControl(fen) {
        let files = ['a','b','c','d','e','f','g','h'];
        let control = {};
        files.forEach(f => { for (let r=1; r<=8; r++) control[f+r] = { w: 0, b: 0 }; });
        ['w', 'b'].forEach(color => {
            let tokens = fen.split(' ');
            tokens[1] = color; tokens[3] = '-';
            let g = new Chess();
            if (g.load(tokens.join(' '))) {
                g.moves({ verbose: true }).forEach(m => { if (control[m.to]) control[m.to][color]++; });
            }
        });
        return control;
    }

    function computeSmartEvalFromFen(fen) {
        let g = new Chess(fen);
        if (g.in_checkmate()) {
            return g.turn() === 'w' ? { cp: -1000, score: 1.0, text: "-M0" } : { cp: 1000, score: 99.0, text: "M0" };
        }
        if (g.in_draw()) return { cp: 0, score: 50.0, text: "0.0" };

        const vals = { p: 100, n: 315, b: 330, r: 500, q: 920, k: 0 };
        let board = g.board();
        let ctrl = computeSquareControl(fen);
        let files = ['a','b','c','d','e','f','g','h'];
        let cp = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let p = board[r][c];
                if (!p) continue;
                let sq = files[c] + (8 - r);
                let v = vals[p.type] || 0;

                if ((r >= 2 && r <= 5) && (c >= 2 && c <= 5)) v += 18;
                if ((p.type === 'n' || p.type === 'b') && ((p.color === 'w' && r === 7) || (p.color === 'b' && r === 0))) {
                    v -= 15;
                }

                if (p.type !== 'k' && ctrl[sq]) {
                    let atk = p.color === 'w' ? ctrl[sq].b : ctrl[sq].w;
                    let def = p.color === 'w' ? ctrl[sq].w : ctrl[sq].b;
                    if (atk > 0 && def === 0) {
                        v -= Math.round(vals[p.type] * 0.65);
                    } else if (atk > def) {
                        v -= Math.round(vals[p.type] * 0.30);
                    }
                }

                cp += (p.color === 'w' ? v : -v);
            }
        }

        let scorePct = Math.max(2.0, Math.min(98.0, 50.0 + (cp / 15.0)));
        let text = (cp >= 0 ? "+" : "") + (cp / 100.0).toFixed(1);
        return { cp: cp, score: Number(scorePct.toFixed(1)), text: text };
    }

    // ========================================================================
    // 6. HINT OPTION, EVAL BAR OPTION, FOCUS MODE & CHESS.COM DRAWING
    // ========================================================================
    function applyHintAndEvalUI() {
        $('#btn-board-hint').css('display', showHintButton ? 'block' : 'none');
        $('#menu-hint-opt-btn').text(`💡 Hint Option: ${showHintButton ? 'ON' : 'OFF'}`)
            .css('border-color', showHintButton ? '#81b64c' : '#383531');
        let hSel = safeEl('setting-hint-button');
        if (hSel) hSel.value = showHintButton ? 'on' : 'off';

        $('#eval-wrapper').css('display', showEvalBar ? 'block' : 'none');
        $('#menu-eval-opt-btn').text(`📊 Eval Bar: ${showEvalBar ? 'ON' : 'OFF'}`)
            .css('border-color', showEvalBar ? '#81b64c' : '#383531');
        let eSel = safeEl('setting-eval-bar');
        if (eSel) eSel.value = showEvalBar ? 'on' : 'off';

        if (showEvalBar) updateEvalBar(historyIndex);
    }

    window.toggleHintOption = function() {
        showHintButton = !showHintButton;
        localStorage.setItem('pro_chess_hint_opt', showHintButton ? 'on' : 'off');
        applyHintAndEvalUI();
        playSnd('notify');
    };

    window.toggleEvalOption = function() {
        showEvalBar = !showEvalBar;
        localStorage.setItem('pro_chess_eval_opt', showEvalBar ? 'on' : 'off');
        applyHintAndEvalUI();
        playSnd('notify');
    };

    window.syncHintAndEvalFromSettings = function() {
        let hSel = safeEl('setting-hint-button');
        let eSel = safeEl('setting-eval-bar');
        if (hSel) {
            showHintButton = (hSel.value === 'on');
            localStorage.setItem('pro_chess_hint_opt', showHintButton ? 'on' : 'off');
        }
        if (eSel) {
            showEvalBar = (eSel.value === 'on');
            localStorage.setItem('pro_chess_eval_opt', showEvalBar ? 'on' : 'off');
        }
        applyHintAndEvalUI();
    };

    window.openToolsMenuModal = function() {
        pushModalHistoryState();
        updateMenuLabels();
        updateCareerBannerUI();
        safeDisplay('tools-menu-modal', 'flex');
    };

    window.updateMenuLabels = function() {
        $('#menu-premove-btn').text(`⚡ Premove: ${premoveEnabled ? 'ON' : 'OFF'}`);
        $('#menu-blindfold-btn').text(`👁️ Blindfold: ${blindfoldEnabled ? 'ON' : 'OFF'}`);
        $('#menu-heatmap-btn').text(`🔥 X-Ray Map: ${heatmapEnabled ? 'ON' : 'OFF'}`);
        $('#menu-tts-btn').text(`🔊 Audio Coach: ${voiceTtsEnabled ? 'ON' : 'OFF'}`);
        applyHintAndEvalUI();
    };

    window.toggleFocusMode = function() {
        focusModeEnabled = !focusModeEnabled;
        document.body.classList.toggle('focus-mode', focusModeEnabled);
        let $fBtn =$('#btn-focus-mode');
        if (focusModeEnabled) {
            $fBtn.text('✕ Exit Focus').css({'background': '#b33430', 'border-color': '#eb2828', 'color': '#fff'});
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } else {
            $fBtn.text('⛶ Focus').css({'background': '', 'border-color': '', 'color': ''});
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
        applyHintAndEvalUI();
    };

    function cloneAnnotations(arr) {
        return JSON.parse(JSON.stringify(arr));
    }

    function pushDrawUndoState() {
        drawUndoStack.push(cloneAnnotations(customAnnotations));
        if (drawUndoStack.length > 50) drawUndoStack.shift();
        drawRedoStack = [];
    }

    window.undoDrawAnnotation = function() {
        if (drawUndoStack.length === 0) return;
        drawRedoStack.push(cloneAnnotations(customAnnotations));
        customAnnotations = drawUndoStack.pop();
        renderCustomAnnotations();
        playSnd('move');
    };

    window.redoDrawAnnotation = function() {
        if (drawRedoStack.length === 0) return;
        drawUndoStack.push(cloneAnnotations(customAnnotations));
        customAnnotations = drawRedoStack.pop();
        renderCustomAnnotations();
        playSnd('move');
    };

    window.clearCustomAnnotations = function() {
        if (customAnnotations.length > 0) {
            pushDrawUndoState();
            customAnnotations = [];
            renderCustomAnnotations();
            playSnd('notify');
        }
    };

    window.toggleDrawMode = function() {
        drawModeEnabled = !drawModeEnabled;
        let $btn =$('#btn-draw-mode');
        if (drawModeEnabled) {
            $btn.addClass('active-btn').css({'background':'#ffaa00', 'color':'#000', 'border-color':'#ffaa00'});
            $('#draw-palette-bar').css('display', 'flex');
            $('#status').text("✏️ Draw Mode: Drag for Arrows (L-shape for Knight), Tap for Square.");
        } else {
            $btn.removeClass('active-btn').css({'background':'', 'color':'', 'border-color':''});$('#draw-palette-bar').hide();
            $('#status').text(isAnalysisBranchMode ? "Analysis Free Play Mode" : "Live Game");
        }
    };

    window.setDrawColor = function(rgba, dotEl) {
        activeDrawColor = rgba;
        $('.color-dot').removeClass('active-dot');$(dotEl).addClass('active-dot');
    };

    function getSquareFromClientXY(clientX, clientY) {
        let found = null;
        $('.square').each(function() {
            let r = this.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
                found = $(this).attr('data-square');
            }
        });
        return found;
    }

    function buildStraightArrowSvg(p1, p2, color) {
        let dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
        if (len < 10) return "";
        let ux = dx / len, uy = dy / len, px = -uy, py = ux;
        let startX = p1.x + ux * 10, startY = p1.y + uy * 10;
        let neckX = p2.x - ux * 15, neckY = p2.y - uy * 15;
        let sw = 4.5, hw = 11.5;
        let pts = `${startX+px*sw},${startY+py*sw} ${neckX+px*sw},${neckY+py*sw} ${neckX+px*hw},${neckY+py*hw} ${p2.x},${p2.y} ${neckX-px*hw},${neckY-py*hw} ${neckX-px*sw},${neckY-py*sw} ${startX-px*sw},${startY-py*sw}`;
        return `<polygon points="${pts}" fill="${color}" style="pointer-events:none;" />`;
    }

    function buildKnightLArrowSvg(fromSq, toSq, color) {
        let files = ['a','b','c','d','e','f','g','h'];
        let f1 = files.indexOf(fromSq[0]), r1 = parseInt(fromSq[1]);
        let f2 = files.indexOf(toSq[0]), r2 = parseInt(toSq[1]);
        let cornerSq = (Math.abs(r2 - r1) === 2) ? (files[f1] + r2) : (files[f2] + r1);
        let p1 = sqToSvgCoords(fromSq), pc = sqToSvgCoords(cornerSq), p2 = sqToSvgCoords(toSq);
        let dx2 = p2.x - pc.x, dy2 = p2.y - pc.y, len2 = Math.hypot(dx2, dy2) || 1;
        let ux2 = dx2 / len2, uy2 = dy2 / len2, px2 = -uy2, py2 = ux2;
        let neckX = p2.x - ux2 * 15, neckY = p2.y - uy2 * 15, hw = 11.5;
        let headPts = `${neckX+px2*hw},${neckY+py2*hw} ${p2.x},${p2.y} ${neckX-px2*hw},${neckY-py2*hw}`;
        return `<polyline points="${p1.x},${p1.y} ${pc.x},${pc.y} ${neckX},${neckY}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;" /><polygon points="${headPts}" fill="${color}" style="pointer-events:none;" />`;
    }

    function renderCustomAnnotations() {
        let svg = document.getElementById('custom-draw-overlay');
        if (!svg) return;
        let files = ['a','b','c','d','e','f','g','h'];
        let html = "";
        customAnnotations.filter(a => a.type === 'sq').forEach(a => {
            let center = sqToSvgCoords(a.sq);
            html += `<rect x="${center.x - 20}" y="${center.y - 20}" width="40" height="40" fill="${a.color}" style="pointer-events:none;" />`;
        });
        customAnnotations.filter(a => a.type === 'arrow').forEach(a => {
            let f1 = files.indexOf(a.from[0]), r1 = parseInt(a.from[1]);
            let f2 = files.indexOf(a.to[0]), r2 = parseInt(a.to[1]);
            if ((Math.abs(f2-f1)===1 && Math.abs(r2-r1)===2) || (Math.abs(f2-f1)===2 && Math.abs(r2-r1)===1)) {
                html += buildKnightLArrowSvg(a.from, a.to, a.color);
            } else {
                let p1 = sqToSvgCoords(a.from), p2 = sqToSvgCoords(a.to);
                html += buildStraightArrowSvg(p1, p2, a.color);
            }
        });
        svg.innerHTML = html;
    }

    function toggleAnnotationItem(fromSq, toSq) {
        if (!fromSq || !toSq) return;
        pushDrawUndoState();
        if (fromSq === toSq) {
            let idx = customAnnotations.findIndex(a => a.type === 'sq' && a.sq === fromSq);
            if (idx >= 0) customAnnotations.splice(idx, 1);
            else customAnnotations.push({ type: 'sq', sq: fromSq, color: activeDrawColor.replace('0.82', '0.52') });
        } else {
            let idx = customAnnotations.findIndex(a => a.type === 'arrow' && a.from === fromSq && a.to === toSq);
            if (idx >= 0) customAnnotations.splice(idx, 1);
            else customAnnotations.push({ type: 'arrow', from: fromSq, to: toSq, color: activeDrawColor });
        }
        renderCustomAnnotations();
    }

    function bindChessComDrawingEvents() {
        const boardEl = document.getElementById('board');
        if (!boardEl || boardEl._drawBound) return;
        boardEl._drawBound = true;
        boardEl.addEventListener('contextmenu', e => e.preventDefault());
        boardEl.addEventListener('pointerdown', function(e) {
            let isRightClick = (e.button === 2);
            if (drawModeEnabled || isRightClick) {
                drawStartSq = getSquareFromClientXY(e.clientX, e.clientY);
                e.stopImmediatePropagation(); e.preventDefault();
            } else if (customAnnotations.length > 0) {
                clearCustomAnnotations();
            }
        }, true);
        window.addEventListener('pointerup', function(e) {
            if (!drawStartSq) return;
            let endSq = getSquareFromClientXY(e.clientX, e.clientY);
            if (endSq) toggleAnnotationItem(drawStartSq, endSq);
            drawStartSq = null;
            if (drawModeEnabled) { e.stopImmediatePropagation(); e.preventDefault(); }
        }, true);
    }

    // ========================================================================
    // 7. REPLAY, CAREER ELO, ENDGAME, BLINDFOLD, VOICE & HEATMAP
    // ========================================================================
    window.toggleMovieReplay = function() {
        let $btn =$('#btn-replay-toggle');
        if (replayInterval) {
            clearInterval(replayInterval);
            replayInterval = null;
            $btn.removeClass('playing-btn').text('▶️ Play');
            return;
        }
        if (gameHistory.length <= 1) return;
        if (historyIndex >= gameHistory.length - 1) {
            historyIndex = 0;
            renderBoard();
        }
        $btn.addClass('playing-btn').text('⏸️ Pause');
        replayInterval = setInterval(() => {
            if (historyIndex < gameHistory.length - 1) {
                goForward();
            } else {
                clearInterval(replayInterval);
                replayInterval = null;
                $btn.removeClass('playing-btn').text('▶️ Play');
            }
        }, replaySpeedMs);
    };

    window.cycleReplaySpeed = function() {
        const speeds = [{ label: "1x", ms: 1000 }, { label: "2x", ms: 500 }, { label: "4x", ms: 250 }, { label: "0.5x", ms: 1800 }];
        let cur = $('#btn-replay-speed').text();
        let idx = speeds.findIndex(s => s.label === cur);
        let next = speeds[(idx + 1) % speeds.length];
        replaySpeedMs = next.ms;
        $('#btn-replay-speed').text(next.label);
        if (replayInterval) { toggleMovieReplay(); toggleMovieReplay(); }
    };

    function getCareerStats() {
        let raw = localStorage.getItem('pro_chess_career');
        if (!raw) return { elo: 1200, w: 0, l: 0, d: 0 };
        try { return JSON.parse(raw); } catch(e) { return { elo: 1200, w: 0, l: 0, d: 0 }; }
    }

    function updateCareerRatingOnGameEnd() {
        if (gameMode !== 'pvb' || isAnalysisBranchMode || gameHistory.length <= 2) return;
        let stats = getCareerStats();
        let botElo = parseInt(currentBlackElo) || 1500;
        let expected = 1 / (1 + Math.pow(10, (botElo - stats.elo) / 400));
        let actual = 0.5;
        if (game.in_checkmate()) {
            let winnerColor = game.turn() === 'w' ? 'b' : 'w';
            actual = (winnerColor === playerColor) ? 1.0 : 0.0;
        } else if (!isInfiniteTime && (whiteTime <= 0 || blackTime <= 0)) {
            let timeoutColor = whiteTime <= 0 ? 'w' : 'b';
            actual = (timeoutColor !== playerColor) ? 1.0 : 0.0;
        }
        if (actual === 1.0) stats.w++;
        else if (actual === 0.0) stats.l++;
        else stats.d++;
        let delta = Math.round(32 * (actual - expected));
        stats.elo = Math.max(400, stats.elo + delta);
        localStorage.setItem('pro_chess_career', JSON.stringify(stats));
        updateCareerBannerUI();
    }

    function updateCareerBannerUI() {
        let s = getCareerStats();
        $('#career-elo-val').text(`${s.elo} ELO`);
        $('#career-wld-val').text(`W: ${s.w} | L: ${s.l} | D: ${s.d}`);
    }

    window.openEndgameModal = function() { safeDisplay('endgame-modal', 'flex'); };

    window.startEndgameDrill = function() {
        let key = $('#endgame-select').val();
        let drill = endgameDrills[key];
        if (!drill) return;
        closeModal('endgame-modal');
        isAnalysisBranchMode = false;
        currentMatchSaved = false;
        gameMode = 'pvb'; playerColor = 'w'; currentBoardOrientation = 'w'; currentBlackElo = "2500";
        isInfiniteTime = true; clearInterval(timerInterval); timerStarted = false;
        game.load(drill.fen); clearArrows(); clearCustomAnnotations();
        gameHistory = [{ fen: game.fen(), move: null, moveObj: null, evalScore: 50, evalText: "0.0", cp: 0 }];
        historyIndex = 0;
        safeText(['top-player-name', 'black-name'], "Endgame GM (2500)");
        safeText(['bottom-player-name', 'white-name'], "You (Endgame Drill)");
        safeText('opening-bar', `🎯 Endgame: ${drill.name}`);
        safeHtml('coach-bubble', `🤖 <b>Endgame Tip:</b> ${drill.tip}`);
        $('#status').text("🎯 Endgame Drill Started!");
        updateTimer(); updateMaterial(game.fen()); renderBoard();
    };

    window.toggleBlindfoldMode = function() {
        blindfoldEnabled = !blindfoldEnabled;
        document.body.classList.toggle('blindfold-mode', blindfoldEnabled);
        updateMenuLabels();
    };

    window.toggleVoiceCoachTTS = function() {
        voiceTtsEnabled = !voiceTtsEnabled;
        updateMenuLabels();
    };

    function speakCoachText(text) {
        if (!voiceTtsEnabled || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        let clean = text.replace(/<[^>]*>?/gm, '').replace(/[🤖🔥⚡★📖✓?!]/g, '');
        let utter = new SpeechSynthesisUtterance(clean);
        utter.lang = 'hi-IN';
        utter.rate = 1.05;
        window.speechSynthesis.speak(utter);
    }

    window.toggleVoiceRecognition = function() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) { alert("Use Chrome for Voice Move."); return; }
        if (voiceListening) return;
        const rec = new SpeechRec();
        rec.lang = 'en-US';
        voiceListening = true;
        $('#status').text("🎙️ Speak move now (e.g. 'e4', 'Knight f3', 'castle')...");
        rec.onresult = function(event) {
            let spoken = event.results[0][0].transcript.toLowerCase().trim();
            let s = spoken.replace(/knight|night/g, 'N').replace(/bishop/g, 'B').replace(/rook/g, 'R').replace(/queen/g, 'Q').replace(/king/g, 'K').replace(/takes|captures|x/g, 'x').replace(/to|\s+/g, '');
            let legals = game.moves({ verbose: true });
            let matched = legals.find(m => m.san.toLowerCase() === s.toLowerCase() || (m.from + m.to) === s.toLowerCase() || m.to === s.toLowerCase());
            if (spoken.includes("castle")) matched = legals.find(m => m.san.includes("O-O"));
            if (matched) executeHumanMove(matched.from, matched.to);
            else { playSnd('illegal'); $('#status').text(`🎙️ Heard "${spoken}" — Not a legal move.`); }
        };
        rec.onend = function() { voiceListening = false; };
        rec.start();
    };

    window.toggleSquareHeatmap = function() {
        heatmapEnabled = !heatmapEnabled;
        updateMenuLabels();
        renderBoard();
    };

    function renderHeatmapOverlay() {
        if (!heatmapEnabled) return;
        let fen = (historyIndex >= 0 && historyIndex < gameHistory.length) ? gameHistory[historyIndex].fen : game.fen();
        let ctrl = computeSquareControl(fen);
        let temp = new Chess(fen);
        $('.square').each(function() {
            let sq = $(this).attr('data-square');
            if (!sq || !ctrl[sq]) return;
            let diff = ctrl[sq].w - ctrl[sq].b;
            if (diff > 0) $(this).append(`<div class="heat-overlay" style="background: rgba(46, 204, 113, ${Math.min(0.45, diff * 0.14)});"></div>`);
            else if (diff < 0) $(this).append(`<div class="heat-overlay" style="background: rgba(231, 76, 60, ${Math.min(0.45, Math.abs(diff) * 0.14)});"></div>`);
            let p = temp.get(sq);
            if (p && p.type !== 'k') {
                let atk = p.color === 'w' ? ctrl[sq].b : ctrl[sq].w;
                let def = p.color === 'w' ? ctrl[sq].w : ctrl[sq].b;
                if (atk > 0 && def === 0) $(this).append(`<div class="hanging-warn">!</div>`);
            }
        });
    }

    window.openOpeningTrainerModal = function() { safeDisplay('trainer-modal', 'flex'); };

    window.startOpeningDrill = function() {
        let key = document.getElementById('trainer-opening-select').value;
        activeOpeningDrill = repertoireDrills[key];
        drillStepIndex = 0;
        closeModal('trainer-modal');
        isAnalysisBranchMode = false;
        currentMatchSaved = false;
        gameMode = 'pvb'; playerColor = activeOpeningDrill.color; currentBoardOrientation = playerColor;
        isInfiniteTime = true; clearInterval(timerInterval); timerStarted = false;
        game.reset();
        gameHistory = [{ fen: game.fen(), move: null, moveObj: null, evalScore: 50, evalText: "0.0" }];
        historyIndex = 0;
        safeText('opening-bar', `📚 Drill: ${activeOpeningDrill.name}`);
        safeHtml('coach-bubble', `🤖 <b>Plan:</b> ${activeOpeningDrill.tips}`);
        updateTimer(); renderBoard();
    };

    window.downloadShareableKundliCard = function() {
        let canvas = document.createElement('canvas');
        canvas.width = 600; canvas.height = 360;
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = "#161512"; ctx.fillRect(0, 0, 600, 360);
        ctx.strokeStyle = "#81b64c"; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 580, 340);
        ctx.fillStyle = "#81b64c"; ctx.font = "bold 22px sans-serif";
        ctx.fillText("♔ PRO CHESS AI — DEEP REPORT CARD", 30, 48);
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif";
        ctx.fillText(`White: ${getWhiteDisplayName()} (${getTextSafe('white-acc-text', '--%')})`, 30, 90);
        ctx.fillText(`Black: ${getBlackDisplayName()} (${getTextSafe('black-acc-text', '--%')})`, 30, 120);
        let srcGraph = document.getElementById('main-eval-graph');
        if (srcGraph) ctx.drawImage(srcGraph, 30, 150, 540, 140);
        let link = document.createElement('a');
        link.download = `Deep_Report_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // ========================================================================
    // 8. MASTER HOOKS & OVERRIDES
    // ========================================================================
    $(document).ready(function() {
        injectScrollAndModalFixes();

        showHintButton = (localStorage.getItem('pro_chess_hint_opt') === 'on');
        let savedEvalPref = localStorage.getItem('pro_chess_eval_opt');
        showEvalBar = (savedEvalPref === null) ? true : (savedEvalPref === 'on');

        $('#setup-modal').hide();
        bindChessComDrawingEvents();
        updateCareerBannerUI();
        updateMenuLabels();
        renderBoard();

        window.computeInstantEvalFromFen = computeSmartEvalFromFen;

        // Push history state when opening Deep Report so Back button & Scroll work smoothly
        const _origOpenDeepReport = window.openDeepReport;
        window.openDeepReport = function() {
            pushModalHistoryState();
            injectScrollAndModalFixes();
            if (_origOpenDeepReport) _origOpenDeepReport.apply(this, arguments);
            let box = document.querySelector('#kundli-modal .modal-content');
            if (box) box.scrollTop = 0;
        };

        // Deep Opening Variations with Longest-Match Priority
        window.updateOpeningExplorer = function() {
            let pgn = buildFullPgnFromHistory();
            let matched = "Starting Position";
            let maxLen = 0;
            if (pgn && pgn.trim().length > 0) {
                matched = "Custom / Middle Game Variation";
                for (let op of deepOpeningsBook) {
                    if (pgn.startsWith(op.moves) && op.moves.length > maxLen) {
                        matched = op.name;
                        maxLen = op.moves.length;
                    }
                }
            }
            safeText('opening-bar', `📖 Opening: ${matched}`);
        };

        // Strict Realistic Estimated ELO Calculation in Deep Report
        const _origRenderKundli = window.renderKundliStats;
        window.renderKundliStats = function() {
            if (_origRenderKundli) _origRenderKundli.apply(this, arguments);

            let wCplSum = 0, wCount = 0, wBlunders = 0, wMistakes = 0, wInacc = 0;
            let bCplSum = 0, bCount = 0, bBlunders = 0, bMistakes = 0, bInacc = 0;

            for (let i = 1; i < gameHistory.length; i++) {
                let h = gameHistory[i];
                if (!h || !h.moveObj) continue;
                let cpl = h.cpl || 0;
                let lbl = h.classification ? h.classification.label : "";
                if (h.moveObj.color === 'w') {
                    wCplSum += cpl; wCount++;
                    if (lbl === "Blunder") wBlunders++;
                    else if (lbl === "Mistake") wMistakes++;
                    else if (lbl === "Inaccuracy") wInacc++;
                } else {
                    bCplSum += cpl; bCount++;
                    if (lbl === "Blunder") bBlunders++;
                    else if (lbl === "Mistake") bMistakes++;
                    else if (lbl === "Inaccuracy") bInacc++;
                }
            }

            if (wCount > 0) {
                let wAcpl = wCplSum / wCount;
                let wElo = Math.round(2750 * Math.exp(-0.028 * wAcpl) - (wBlunders * 130) - (wMistakes * 55) - (wInacc * 20));
                wElo = Math.max(250, Math.min(2900, wElo));
                safeText('k-w-elo', wElo + " ELO");
            }
            if (bCount > 0) {
                let bAcpl = bCplSum / bCount;
                let bElo = Math.round(2750 * Math.exp(-0.028 * bAcpl) - (bBlunders * 130) - (bMistakes * 55) - (bInacc * 20));
                bElo = Math.max(250, Math.min(2900, bElo));
                safeText('k-b-elo', bElo + " ELO");
            }
        };

        // Enable Free Moves in Analysis Mode
        function activateAnalysisBranchIfReviewing() {
            if (gameMode === 'bvb') return;
            if (historyIndex < gameHistory.length - 1 || game.game_over()) {
                isAnalysisBranchMode = true;
                gameHistory = gameHistory.slice(0, historyIndex + 1);
                game.load(gameHistory[historyIndex].fen);
                gameMode = 'pvp';
                autoFlipPvP = false;
                clearInterval(timerInterval);
                timerStarted = false;
            }
        }

        document.getElementById('board').addEventListener('pointerdown', function(e) {
            if (drawModeEnabled || e.button === 2) return;
            if (historyIndex < gameHistory.length - 1 || game.game_over()) {
                activateAnalysisBranchIfReviewing();
            }
        }, true);

        const _origExecHuman = window.executeHumanMove;
        window.executeHumanMove = function(fromSq, toSq) {
            clearArrows();
            lastHintFen = "";
            if (activeOpeningDrill && game.turn() === playerColor && drillStepIndex < activeOpeningDrill.moves.length) {
                let expectedSan = activeOpeningDrill.moves[drillStepIndex];
                let temp = new Chess(game.fen());
                let testMove = temp.move({ from: fromSq, to: toSq, promotion: 'q' });
                if (!testMove || testMove.san !== expectedSan) {
                    playSnd('illegal');
                    $('#status').text(`❌ In ${activeOpeningDrill.name}, book move is ${expectedSan}!`);
                    return false;
                }
                drillStepIndex++;
            }
            let res = _origExecHuman.apply(this, arguments);
            if (res && isAnalysisBranchMode) {
                $('#status').text(`🔍 Analysis Free Play: Move ${historyIndex} (${gameHistory[historyIndex].moveObj.san})`);
            }
            return res;
        };

        const _origApplySetup = window.applySetupAndStart;
        window.applySetupAndStart = function() {
            // Auto-archive previous game if at least 2 moves were played before starting New Game!
            if (gameHistory.length > 2 && !currentMatchSaved && !isAnalysisBranchMode) {
                saveCurrentMatchToVault("Archived Match");
            }
            currentMatchSaved = false;
            isAnalysisBranchMode = false;
            activeOpeningDrill = null;
            lastHintFen = "";

            let stEl = safeEl('setup-think-time');
            if (stEl) {
                engineThinkTime = parseFloat(stEl.value) || 0.5;
                let setEl = safeEl('engine-think-time');
                if (setEl) { setEl.value = engineThinkTime; safeText('think-time-val', engineThinkTime + 's'); }
            }
            let dpEl = safeEl('setup-engine-depth');
            if (dpEl) engineMaxDepth = parseInt(dpEl.value) || 16;

            activePersonality = $('#setup-personality').val() || "default";
            let p = botPersonalities[activePersonality];
            if (p) {
                let hash = $('#engine-hash').val() || 256;
                let threads = $('#engine-threads').val() || 2;
                $.post('/update_engine', { hash: hash, threads: threads, contempt: p.contempt });
            }
            _origApplySetup.apply(this, arguments);
        };

        const _origSaveSettings = window.saveSettings;
        window.saveSettings = function() {
            let tEl = safeEl('engine-think-time');
            if (tEl) {
                engineThinkTime = parseFloat(tEl.value) || 0.5;
                let stEl = safeEl('setup-think-time');
                if (stEl) { stEl.value = engineThinkTime; safeText('setup-think-val', engineThinkTime + 's'); }
            }
            syncHintAndEvalFromSettings();
            if (_origSaveSettings) _origSaveSettings.apply(this, arguments);
        };

        $.ajaxPrefilter(function(options) {
            if (options.url === '/ai_move' && typeof options.data === 'string') {
                if (!options.data.includes('think_time=')) {
                    options.data += '&think_time=' + encodeURIComponent(engineThinkTime);
                }
                if (!options.data.includes('depth=')) {
                    options.data += '&depth=' + encodeURIComponent(engineMaxDepth);
                }
            }
        });

        const _origCoach = window.updateCoachCommentary;
        window.updateCoachCommentary = function(record, idx) {
            if (_origCoach) _origCoach.apply(this, arguments);
            if (voiceTtsEnabled && historyIndex === gameHistory.length - 1) {
                speakCoachText($('#coach-bubble').text());
            }
        };

        const _origRenderBoard = window.renderBoard;
        window.renderBoard = function() {
            _origRenderBoard.apply(this, arguments);
            renderHeatmapOverlay();
            renderCustomAnnotations();
        };

        const _origFlip = window.flipBoardUI;
        window.flipBoardUI = function() {
            _origFlip.apply(this, arguments);
            renderCustomAnnotations();
        };

        // Hook ALL Game Endings (Checkmate, Draw, Timeout, Resign) to Auto-Save into Match Vault!
        const _origGameOver = window.handleGameOver;
        window.handleGameOver = function() {
            _origGameOver.apply(this, arguments);
            updateCareerRatingOnGameEnd();
            setTimeout(() => saveCurrentMatchToVault(getTextSafe('status', 'Match Over')), 300);
        };

        const _origShowGameOver = window.showGameOverModal;
        window.showGameOverModal = function(title, subtitle, btnText) {
            if (_origShowGameOver) _origShowGameOver.apply(this, arguments);
            setTimeout(() => saveCurrentMatchToVault(`${title}: ${subtitle}`), 300);
        };
    });
})();
