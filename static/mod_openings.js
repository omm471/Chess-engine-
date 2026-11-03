/* ============================================================================
   static/mod_openings.js (v105 - Complete Standard ECO Encyclopedia)
   - Fixed: Accurate Token-by-Token Prefix Matching (Matches Chessis / Lichess)
   - Fixed: No more false future variation predictions (e.g. Wing Gambit on move 2)
   - Fixed: 1. d4 e6 accurately identified as A40 Horwitz Defense
   - Video Auto-Play Demo Mode & Visual Arrow AI Coach fully integrated
   ============================================================================ */

var FULL_OPENINGS_DB = [
    // --- 1-MOVE & 2-MOVE BASE OPENINGS (ESSENTIAL FOR ACCURATE EARLY DETECTION) ---
    ["A00", "Uncommon Opening (Grob Attack)", "g4"],
    ["A00", "Polish Opening (Sokolsky)", "b4"],
    ["A00", "Amar Opening", "Nh3"],
    ["A00", "Clemenz Opening", "h3"],
    ["A00", "Mieses Opening", "d3"],
    ["A00", "Saragossa Opening", "c3"],
    ["A00", "Van 't Kruijs Opening", "e3"],
    ["A00", "Ware Opening", "a4"],
    ["A00", "Anderssen's Opening", "a3"],
    ["A01", "Nimzowitsch-Larsen Attack", "b3"],
    ["A02", "Bird's Opening", "f4"],
    ["A04", "Réti Opening", "Nf3"],
    ["A10", "English Opening", "c4"],
    ["A40", "Queen's Pawn Game", "d4"],
    ["A40", "Horwitz Defense", "d4 e6"],
    ["A40", "English Defense", "d4 e6 c4 b6"],
    ["A40", "Keres Defense", "d4 e6 c4 Bb4+"],
    ["A41", "Queen's Pawn Game: Modern Defense", "d4 d6"],
    ["A42", "Modern Defense: Averbakh System", "d4 g6 c4 Bg7 Nc3 d6 e4"],
    ["A43", "Old Benoni Defense", "d4 c5"],
    ["A45", "Trompowsky Attack", "d4 Nf6 Bg5"],
    ["A46", "Torre Attack", "d4 Nf6 Nf3 e6 Bg5"],
    ["A80", "Dutch Defense", "d4 f5"],
    ["B00", "King's Pawn Game", "e4"],
    ["B00", "Nimzowitsch Defense", "e4 Nc6"],
    ["B01", "Scandinavian Defense", "e4 d5"],
    ["B02", "Alekhine's Defense", "e4 Nf6"],
    ["B06", "Modern Defense", "e4 g6"],
    ["B07", "Pirc Defense", "e4 d6 d4 Nf6 Nc3"],
    ["B10", "Caro-Kann Defense", "e4 c6"],
    ["B20", "Sicilian Defense", "e4 c5"],
    ["C00", "French Defense", "e4 e6"],
    ["C20", "King's Pawn Game: Open Game", "e4 e5"],
    ["D00", "Queen's Pawn Game: Closed", "d4 d5"],
    ["D06", "Queen's Gambit", "d4 d5 c4"],

    // --- FRENCH DEFENSE (C00 - C19) ---
    ["C00", "French Defense: Knight Variation", "e4 e6 Nf3 d5"],
    ["C00", "French Defense: Wing Gambit", "e4 e6 Nf3 d5 e5 c5 b4"],
    ["C00", "French Defense: Steinitz Attack", "e4 e6 e5"],
    ["C00", "French Defense: King's Indian Attack", "e4 e6 d3 d5 Nd2"],
    ["C01", "French Defense: Exchange Variation", "e4 e6 d4 d5 exd5 exd5"],
    ["C02", "French Defense: Advance Variation", "e4 e6 d4 d5 e5"],
    ["C02", "French Defense: Advance, Paulsen Attack", "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4"],
    ["C03", "French Defense: Tarrasch Variation", "e4 e6 d4 d5 Nd2"],
    ["C05", "French Defense: Tarrasch, Closed Variation", "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6"],
    ["C07", "French Defense: Tarrasch, Open Variation", "e4 e6 d4 d5 Nd2 c5 exd5 exd5 Ngf3 Nc6"],
    ["C10", "French Defense: Rubinstein Variation", "e4 e6 d4 d5 Nc3 dxe4 Nxe4"],
    ["C11", "French Defense: Classical Variation", "e4 e6 d4 d5 Nc3 Nf6"],
    ["C11", "French Defense: Steinitz Variation", "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3"],
    ["C12", "French Defense: McCutcheon Variation", "e4 e6 d4 d5 Nc3 Nf6 Bg5 Bb4"],
    ["C14", "French Defense: Classical, Burn Variation", "e4 e6 d4 d5 Nc3 Nf6 Bg5 dxe4 Nxe4 Be7 Bxf6"],
    ["C15", "French Defense: Winawer Variation", "e4 e6 d4 d5 Nc3 Bb4"],
    ["C18", "French Defense: Winawer, Advance Variation", "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4"],

    // --- RUY LOPEZ / SPANISH (C60 - C99) ---
    ["C60", "Ruy Lopez: General", "e4 e5 Nf3 Nc6 Bb5"],
    ["C61", "Ruy Lopez: Bird's Defense", "e4 e5 Nf3 Nc6 Bb5 Nd4"],
    ["C62", "Ruy Lopez: Old Steinitz Defense", "e4 e5 Nf3 Nc6 Bb5 d6"],
    ["C63", "Ruy Lopez: Schliemann Defense", "e4 e5 Nf3 Nc6 Bb5 f5"],
    ["C64", "Ruy Lopez: Classical Defense (Cordel)", "e4 e5 Nf3 Nc6 Bb5 Bc5"],
    ["C65", "Ruy Lopez: Berlin Defense", "e4 e5 Nf3 Nc6 Bb5 Nf6"],
    ["C67", "Ruy Lopez: Berlin Defense, Open", "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8"],
    ["C68", "Ruy Lopez: Exchange Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6"],
    ["C70", "Ruy Lopez: Morphy Defense", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4"],
    ["C77", "Ruy Lopez: Morphy, Anderssen Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 d3"],
    ["C78", "Ruy Lopez: Archangel Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bb7"],
    ["C80", "Ruy Lopez: Open Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4"],
    ["C84", "Ruy Lopez: Closed Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O"],
    ["C88", "Ruy Lopez: Marshall Attack", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6"],
    ["C92", "Ruy Lopez: Closed, Zaitsev Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Bb7 d4 Re8"],
    ["C97", "Ruy Lopez: Closed, Chigorin Defense", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7"],
    ["C99", "Ruy Lopez: Closed, Breyer Defense", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7"],

    // --- ITALIAN GAME & OPEN GAMES (C40 - C59) ---
    ["C50", "Italian Game: General", "e4 e5 Nf3 Nc6 Bc4"],
    ["C50", "Italian Game: Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6"],
    ["C50", "Italian Game: Giuoco Pianissimo", "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 c3 d6 O-O O-O"],
    ["C51", "Italian Game: Evans Gambit", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4"],
    ["C52", "Italian Game: Evans Gambit Accepted", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O"],
    ["C53", "Italian Game: Classical Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5"],
    ["C55", "Italian Game: Two Knights Defense", "e4 e5 Nf3 Nc6 Bc4 Nf6"],
    ["C56", "Italian Game: Two Knights, Modern Line", "e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 O-O Nxe4 Re1 d5 Bxd5 Qxd5 Nc3"],
    ["C57", "Italian Game: Fried Liver Attack", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3"],
    ["C57", "Italian Game: Two Knights, Traxler Counterattack", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5 Bxf7+ Ke7"],
    ["C45", "Scotch Game: General", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4"],
    ["C45", "Scotch Game: Classical Variation", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7"],
    ["C45", "Scotch Game: Mieses Variation", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4"],
    ["C44", "Scotch Gambit", "e4 e5 Nf3 Nc6 d4 exd4 Bc4"],
    ["C44", "Ponziani Opening", "e4 e5 Nf3 Nc6 c3"],
    ["C42", "Petrov's Defense: Classical", "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3"],
    ["C42", "Petrov's Defense: Stafford Gambit", "e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5 Be2 h5"],
    ["C43", "Petrov's Defense: Steinitz Attack", "e4 e5 Nf3 Nf6 d4 Nxe4 Bd3 d5 Nxe5"],
    ["C41", "Philidor Defense: General", "e4 e5 Nf3 d6"],
    ["C41", "Philidor Defense: Hanham Variation", "e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O"],
    ["C47", "Four Knights Game: Scotch Variation", "e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4"],
    ["C48", "Four Knights Game: Spanish Variation", "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5"],
    ["C30", "King's Gambit", "e4 e5 f4"],
    ["C33", "King's Gambit Accepted", "e4 e5 f4 exf4 Bc4"],
    ["C34", "King's Gambit Accepted: Traditional", "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5"],
    ["C31", "King's Gambit Declined: Falkbeer Countergambit", "e4 e5 f4 d5 exd5 e4 d3 Nf6"],
    ["C25", "Vienna Game: General", "e4 e5 Nc3"],
    ["C29", "Vienna Gambit", "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Qf3"],
    ["C21", "Danish Gambit", "e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2"],
    ["C23", "Bishop's Opening", "e4 e5 Bc4"],

    // --- SICILIAN DEFENSE (B20 - B99) ---
    ["B20", "Sicilian Defense: Bowdler Attack", "e4 c5 Bc4"],
    ["B21", "Sicilian Defense: Smith-Morra Gambit", "e4 c5 d4 cxd4 c3 dxc3 Nxc3"],
    ["B22", "Sicilian Defense: Alapin Variation", "e4 c5 c3"],
    ["B22", "Sicilian Defense: Alapin, Main Line", "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4"],
    ["B23", "Sicilian Defense: Closed", "e4 c5 Nc3"],
    ["B23", "Sicilian Defense: Grand Prix Attack", "e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7 Bb5 Nd4 O-O"],
    ["B27", "Sicilian Defense: Hyperaccelerated Dragon", "e4 c5 Nf3 g6"],
    ["B30", "Sicilian Defense: Old Sicilian", "e4 c5 Nf3 Nc6"],
    ["B30", "Sicilian Defense: Rossolimo Variation", "e4 c5 Nf3 Nc6 Bb5"],
    ["B33", "Sicilian Defense: Sveshnikov Variation", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5"],
    ["B34", "Sicilian Defense: Accelerated Dragon", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O"],
    ["B40", "Sicilian Defense: French Variation", "e4 c5 Nf3 e6"],
    ["B41", "Sicilian Defense: Kan Variation", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6"],
    ["B44", "Sicilian Defense: Taimanov Variation", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6"],
    ["B50", "Sicilian Defense: Modern Variations", "e4 c5 Nf3 d6"],
    ["B51", "Sicilian Defense: Moscow Variation", "e4 c5 Nf3 d6 Bb5+"],
    ["B54", "Sicilian Defense: Classical Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6"],
    ["B70", "Sicilian Defense: Dragon Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6"],
    ["B76", "Sicilian Defense: Dragon, Yugoslav Attack", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O"],
    ["B80", "Sicilian Defense: Scheveningen Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6"],
    ["B90", "Sicilian Defense: Najdorf Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"],
    ["B90", "Sicilian Defense: Najdorf, English Attack", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O"],
    ["B95", "Sicilian Defense: Najdorf, Classical 6.Bg5", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O"],

    // --- CARO-KANN DEFENSE (B10 - B19) ---
    ["B12", "Caro-Kann Defense: Advance Variation", "e4 c6 d4 d5 e5"],
    ["B12", "Caro-Kann Defense: Advance, Short Variation", "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nc6"],
    ["B13", "Caro-Kann Defense: Exchange Variation", "e4 c6 d4 d5 exd5 cxd5"],
    ["B13", "Caro-Kann Defense: Panov-Botvinnik Attack", "e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Bb4"],
    ["B15", "Caro-Kann Defense: Gurgenidze System", "e4 c6 d4 d5 Nc3 g6"],
    ["B17", "Caro-Kann Defense: Steinitz Variation", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7"],
    ["B18", "Caro-Kann Defense: Classical Variation", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7"],
    ["B19", "Caro-Kann Defense: Classical, Spassky Line", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3"],

    // --- SCANDINAVIAN, ALEKHINE, PIRC (B01 - B09) ---
    ["B01", "Scandinavian Defense: Main Line (3...Qa5)", "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6"],
    ["B01", "Scandinavian Defense: Gubinsky-Melts Defense", "e4 d5 exd5 Qxd5 Nc3 Qd6"],
    ["B01", "Scandinavian Defense: Modern Variation", "e4 d5 exd5 Nf6"],
    ["B01", "Scandinavian Defense: Portuguese Gambit", "e4 d5 exd5 Nf6 d4 Bg4"],
    ["B04", "Alekhine's Defense: Modern Variation", "e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7"],
    ["B07", "Pirc Defense: Austrian Attack", "e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O Bd3 Na6"],
    ["B08", "Pirc Defense: Classical Variation", "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O"],

    // --- QUEEN'S GAMBIT & SLAV (D06 - D69) ---
    ["D06", "Queen's Gambit Declined: General", "d4 d5 c4 e6"],
    ["D10", "Slav Defense: General", "d4 d5 c4 c6"],
    ["D10", "Slav Defense: Exchange Variation", "d4 d5 c4 c6 cxd5 cxd5"],
    ["D11", "Slav Defense: Modern Line", "d4 d5 c4 c6 Nf3 Nf6 e3 Bf5"],
    ["D15", "Slav Defense: Three Knights Variation", "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5"],
    ["D20", "Queen's Gambit Accepted: Central Line", "d4 d5 c4 dxc4 e4"],
    ["D20", "Queen's Gambit Accepted: Classical", "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6"],
    ["D31", "Queen's Gambit Declined: Semi-Slav", "d4 d5 c4 e6 Nc3 c6"],
    ["D35", "Queen's Gambit Declined: Exchange Variation", "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3"],
    ["D37", "Queen's Gambit Declined: Classical Line", "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4 O-O e3 Nbd7"],
    ["D38", "Queen's Gambit Declined: Ragozin Defense", "d4 d5 c4 e6 Nc3 Nf6 Nf3 Bb4"],
    ["D43", "Semi-Slav Defense: General", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6"],
    ["D45", "Semi-Slav Defense: Meran Variation", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5"],
    ["D47", "Semi-Slav Defense: Botvinnik Variation", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 dxc4 e4 b5 e5 h6 Bh4 g5 Nxg5 hxg5 Bxg5 Nbd7"],

    // --- LONDON SYSTEM & 1.d4 SYSTEMS (D00 - D05) ---
    ["D00", "Jobava London System", "d4 d5 Nc3 Nf6 Bf4"],
    ["D00", "Jobava London: Main Line", "d4 Nf6 Nc3 d5 Bf4 c5 e3 Nc6 Nb5 Qa5+ c3"],
    ["D02", "London System: General", "d4 d5 Nf3 Nf6 Bf4"],
    ["D02", "London System: Main Line", "d4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 Bf5 Ngf3 e6"],
    ["D05", "Colle System", "d4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3"],
    ["D01", "Richter-Veresov Attack", "d4 d5 Nc3 Nf6 Bg5"],

    // --- CATALAN OPENING (E00 - E09) ---
    ["E00", "Catalan Opening: General", "d4 Nf6 c4 e6 g3"],
    ["E01", "Catalan Opening: Closed", "d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O"],
    ["E04", "Catalan Opening: Open Defense", "d4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 a6 O-O Nc6"],
    ["E06", "Catalan Opening: Closed, Main Line", "d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O c6 Qc2 Nbd7"],
    ["E08", "Catalan Opening: Closed, Zagoryansky Variation", "d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O Nbd7 Qc2 c6 b3 b6"],

    // --- NIMZO-INDIAN, BOGO & QUEEN'S INDIAN (E10 - E59) ---
    ["E20", "Nimzo-Indian Defense: General", "d4 Nf6 c4 e6 Nc3 Bb4"],
    ["E21", "Nimzo-Indian Defense: Three Knights", "d4 Nf6 c4 e6 Nc3 Bb4 Nf3"],
    ["E32", "Nimzo-Indian Defense: Classical (Capablanca)", "d4 Nf6 c4 e6 Nc3 Bb4 Qc2"],
    ["E40", "Nimzo-Indian Defense: Rubinstein System", "d4 Nf6 c4 e6 Nc3 Bb4 e3"],
    ["E11", "Bogo-Indian Defense", "d4 Nf6 c4 e6 Nf3 Bb4+"],
    ["E12", "Queen's Indian Defense", "d4 Nf6 c4 e6 Nf3 b6"],
    ["E15", "Queen's Indian Defense: Fianchetto", "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2"],

    // --- KING'S INDIAN & GRÜNFELD (E60 - E99, D70 - D99) ---
    ["E60", "King's Indian Defense: General", "d4 Nf6 c4 g6"],
    ["E61", "King's Indian Defense: Classical Setup", "d4 Nf6 c4 g6 Nc3 Bg7"],
    ["E70", "King's Indian Defense: Normal System", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6"],
    ["E80", "King's Indian Defense: Sämisch Variation", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5"],
    ["E91", "King's Indian Defense: Classical Line", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2"],
    ["E97", "King's Indian Defense: Mar del Plata", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7"],
    ["D70", "Grünfeld Defense: General", "d4 Nf6 c4 g6 Nc3 d5"],
    ["D85", "Grünfeld Defense: Exchange Variation", "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Bc4 c5 Ne2"],
    ["D90", "Grünfeld Defense: Russian System", "d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3 dxc4 Qxc4 O-O e4"],

    // --- BENONI, BENKO, DUTCH & FLANK OPENINGS ---
    ["A57", "Benko Gambit", "d4 Nf6 c4 c5 d5 b5"],
    ["A57", "Benko Gambit Accepted", "d4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6 e4"],
    ["A60", "Modern Benoni Defense", "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7"],
    ["A52", "Budapest Gambit", "d4 Nf6 c4 e5 dxe5 Ng4"],
    ["A80", "Dutch Defense: General", "d4 f5"],
    ["A80", "Dutch Defense: Leningrad Variation", "d4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3"],
    ["A87", "Dutch Defense: Stonewall Variation", "d4 f5 g3 Nf6 Bg2 e6 Nf3 d5 O-O Bd6 c4 c6"],
    ["A20", "English Opening: King's English", "c4 e5"],
    ["A21", "English Opening: Reversed Sicilian", "c4 e5 Nc3"],
    ["A22", "English Opening: Two Knights", "c4 e5 Nc3 Nf6"],
    ["A28", "English Opening: Four Knights", "c4 e5 Nc3 Nf6 Nf3 Nc6"],
    ["A30", "English Opening: Symmetrical", "c4 c5"],
    ["A09", "Réti Opening: Advance Variation", "Nf3 d5 c4 d4 b4 f6 e3 e5 c5 a5 Bc4"],
    ["A05", "King's Indian Attack", "Nf3 d5 g3 Nf6 Bg2 c6 O-O Bf5 d3 e6 Nbd2 h6"],
    ["A02", "Bird's Opening: From's Gambit", "f4 e5 fxe5 d6 exd6 Bxd6 Nf3 g5 d4 g4"]
];

var activeOpeningItem = null;
var openingPracticeState = {
    active: false,
    mode: 'none', // 'watch' | 'practice'
    eco: '',
    name: '',
    sanMoves: [],
    stepIdx: 0,
    userColor: 'w',
    demoTimer: null
};

// Clean move strings by removing check +, mate #, annotations ?, ! and castling normalization
function normalizeSan(s) {
    if (!s) return "";
    return s.replace(/[+#?!]/g, '').replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O').trim();
}

// ============================================================================
// ACCURATE TOKEN-BY-TOKEN PREFIX MATCHING (NO FUTURE GUESSING)
// ============================================================================
function getBestOpeningMatch(sanArray) {
    if (!sanArray || sanArray.length === 0) return null;
    let normPlayed = sanArray.map(normalizeSan);

    let bestMatch = null;
    let maxMatchLen = 0;

    for (let i = 0; i < FULL_OPENINGS_DB.length; i++) {
        let op = FULL_OPENINGS_DB[i];
        let opRawMoves = op[2].trim().split(/\s+/).filter(Boolean);
        let opNormMoves = opRawMoves.map(normalizeSan);

        // Strict Rule: An opening CANNOT have more moves than what has actually been played!
        if (opNormMoves.length > normPlayed.length) {
            continue;
        }

        // Check if every move of the opening strictly matches the played move sequence
        let isMatch = true;
        for (let k = 0; k < opNormMoves.length; k++) {
            if (opNormMoves[k] !== normPlayed[k]) {
                isMatch = false;
                break;
            }
        }

        // If it matches, pick the deepest/most specific variation played so far
        if (isMatch) {
            if (opNormMoves.length > maxMatchLen) {
                bestMatch = op;
                maxMatchLen = opNormMoves.length;
            }
        }
    }
    return bestMatch;
}

function mergeFullEcoBookFromServer() {
    $.get('/eco_book', function(data) {
        if (data && data.openings && data.openings.length > 0) {
            let existingKeys = new Set(FULL_OPENINGS_DB.map(x => x[0] + "|" + x[1]));
            data.openings.forEach(item => {
                if (item && item.length >= 3 && item[2] && item[2].trim().length > 0) {
                    let key = item[0] + "|" + item[1];
                    if (!existingKeys.has(key)) {
                        existingKeys.add(key);
                        FULL_OPENINGS_DB.push([item[0], item[1], item[2].trim()]);
                    }
                }
            });
            if ($('#trainer-modal').is(':visible')) {
                filterOpeningTrainerList();
            }
            if (typeof updateOpeningExplorer === 'function') {
                updateOpeningExplorer();
            }
        }
    });
}

window.updateOpeningExplorer = function() {
    let sanSeq = [];
    if (typeof gameHistory !== 'undefined' && typeof historyIndex !== 'undefined') {
        for (let i = 1; i <= historyIndex && i < gameHistory.length; i++) {
            if (gameHistory[i] && gameHistory[i].moveObj) {
                sanSeq.push(gameHistory[i].moveObj.san);
            }
        }
    } else if (typeof game !== 'undefined' && game.history) {
        sanSeq = game.history();
    }

    if (sanSeq.length === 0) {
        safeText('opening-bar', 'A00: Starting Position');
        return;
    }

    let bestMatch = getBestOpeningMatch(sanSeq);
    if (bestMatch) {
        safeText('opening-bar', `${bestMatch[0]}: ${bestMatch[1]}`);
    }

    // If user is in interactive Opening Practice Mode, validate move & trigger Coach arrow
    if (openingPracticeState.active && openingPracticeState.mode === 'practice') {
        setTimeout(checkOpeningPracticeProgress, 120);
    }
};

window.openOpeningTrainerModal = function() {
    try { window.history.pushState({ modalOpen: true }, ""); } catch (e) {}
    filterOpeningTrainerList();
    safeDisplay('trainer-modal', 'flex');
};

window.filterOpeningTrainerList = function() {
    let q = ((safeEl('trainer-search-input') || {}).value || '').toLowerCase().trim();
    let sel = $('#trainer-opening-select');
    if (!sel.length) return;
    sel.empty();

    let matches = [];
    for (let i = 0; i < FULL_OPENINGS_DB.length; i++) {
        let op = FULL_OPENINGS_DB[i];
        let label = `${op[0]} • ${op[1]} (${op[2]})`;
        if (!q || label.toLowerCase().includes(q)) {
            matches.push({ idx: i, eco: op[0], name: op[1], moves: op[2] });
            if (matches.length >= 300) break;
        }
    }

    matches.forEach((m, i) => {
        sel.append(`<option value="${m.idx}" ${i === 0 ? 'selected' : ''}>[${m.eco}] ${m.name} — ${m.moves}</option>`);
    });
    updateOpeningPreviewText();
};

window.updateOpeningPreviewText = function() {
    let idx = parseInt($('#trainer-opening-select').val() || '0');
    let op = FULL_OPENINGS_DB[idx] || FULL_OPENINGS_DB[0];
    if (!op) return;
    activeOpeningItem = op;
    safeHtml('trainer-opening-preview', `<b>${op[0]}: ${op[1]}</b><br><span style="color:#81b64c; font-family:monospace;">${op[2]}</span>`);
};

function stopOpeningDemoTimer() {
    if (openingPracticeState.demoTimer) {
        clearInterval(openingPracticeState.demoTimer);
        openingPracticeState.demoTimer = null;
    }
    safeText('btn-replay-toggle', 'Play');
}

// 1. WATCH OPENING VIDEO DEMO (Plays move-by-move automatically with arrows & sound)
window.watchOpeningVideoDemo = function(fromModal = true) {
    let idx = parseInt($('#trainer-opening-select').val() || '0');
    let op = fromModal ? (FULL_OPENINGS_DB[idx] || FULL_OPENINGS_DB[0]) : (activeOpeningItem || FULL_OPENINGS_DB[0]);
    if (!op) return;
    activeOpeningItem = op;
    if (fromModal) closeModal('trainer-modal');

    stopAllActiveMatchProcesses();
    stopOpeningDemoTimer();

    let tokens = op[2].trim().split(/\s+/).filter(Boolean);
    openingPracticeState = {
        active: true,
        mode: 'watch',
        eco: op[0],
        name: op[1],
        sanMoves: tokens,
        stepIdx: 0,
        userColor: 'w',
        demoTimer: null
    };

    isAnalysisBranchMode = true;
    matchEnded = false;
    gameEndEffect = null;
    currentBoardOrientation = 'w';
    game.reset();
    clearArrows();
    if (window.clearCustomAnnotations) window.clearCustomAnnotations();

    gameHistory = [{
        fen: game.fen(), move: null, moveObj: null, soundType: 'move',
        evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
    }];
    historyIndex = 0;

    safeText('opening-bar', `${op[0]}: ${op[1]}`);
    safeText('bottom-player-label', 'White'); safeText('bottom-player-name', 'Opening Demo');
    safeText('top-player-label', 'Black'); safeText('top-player-name', op[1]);
    syncEloBadgeVisibility();
    updateMaterial(game.fen());
    renderBoard();
    playSnd('start');

    $('#status').text(`Watching Opening: ${op[1]} (0/${tokens.length})`);
    safeText('btn-replay-toggle', 'Stop');

    openingPracticeState.demoTimer = setInterval(() => {
        if (openingPracticeState.stepIdx >= openingPracticeState.sanMoves.length) {
            stopOpeningDemoTimer();
            $('#status').text(`Opening Demo Complete: ${op[1]} — Tap 'Menu -> Opening Explorer' or continue playing!`);
            drawCoachBestContinuationArrow();
            return;
        }
        let san = openingPracticeState.sanMoves[openingPracticeState.stepIdx];
        let mvObj = game.move(san, { sloppy: true });
        if (!mvObj) {
            stopOpeningDemoTimer();
            return;
        }
        openingPracticeState.stepIdx++;
        let sType = detectMoveSoundType(game, mvObj);
        gameHistory.push({
            fen: game.fen(),
            move: { from: mvObj.from, to: mvObj.to },
            moveObj: mvObj,
            soundType: sType,
            evalScore: 50.0,
            evalText: "0.0",
            cp: 0,
            bestMoveUci: "",
            bestMoveSan: ""
        });
        historyIndex = gameHistory.length - 1;
        playSoundForHistoryRec(gameHistory[historyIndex]);
        updateMaterial(game.fen());
        renderBoard();
        if (window.drawMoveArrow) window.drawMoveArrow(mvObj.from, mvObj.to, 'rgba(129, 182, 76, 0.85)');
        $('#status').text(`${op[0]} ${op[1]} • Move ${openingPracticeState.stepIdx}/${openingPracticeState.sanMoves.length}: ${mvObj.san}`);
    }, 850);
};

// 2. PRACTICE OPENING WITH VISUAL AI COACH (Draws Arrow Hints & Plays Book Replies)
window.startOpeningDrill = function() {
    let idx = parseInt($('#trainer-opening-select').val() || '0');
    let op = FULL_OPENINGS_DB[idx] || FULL_OPENINGS_DB[0];
    if (!op) return;
    activeOpeningItem = op;
    let side = ($('#trainer-side-select').val() || 'w');
    closeModal('trainer-modal');

    stopAllActiveMatchProcesses();
    stopOpeningDemoTimer();

    let tokens = op[2].trim().split(/\s+/).filter(Boolean);
    openingPracticeState = {
        active: true,
        mode: 'practice',
        eco: op[0],
        name: op[1],
        sanMoves: tokens,
        stepIdx: 0,
        userColor: side,
        demoTimer: null
    };

    isAnalysisBranchMode = true;
    matchEnded = false;
    gameEndEffect = null;
    playerColor = side;
    currentBoardOrientation = side;
    game.reset();
    clearArrows();
    if (window.clearCustomAnnotations) window.clearCustomAnnotations();

    gameHistory = [{
        fen: game.fen(), move: null, moveObj: null, soundType: 'move',
        evalScore: 50.0, evalText: "0.0", cp: 0, bestMoveUci: "", bestMoveSan: ""
    }];
    historyIndex = 0;

    safeText('opening-bar', `${op[0]}: ${op[1]} (Coach Practice)`);
    if (side === 'w') {
        safeText('bottom-player-label', 'White'); safeText('bottom-player-name', 'You (Practicing)');
        safeText('top-player-label', 'Black'); safeText('top-player-name', 'AI Opening Coach');
    } else {
        safeText('bottom-player-label', 'Black'); safeText('bottom-player-name', 'You (Practicing)');
        safeText('top-player-label', 'White'); safeText('top-player-name', 'AI Opening Coach');
    }
    syncEloBadgeVisibility();
    updateMaterial(game.fen());
    renderBoard();
    playSnd('start');

    promptNextOpeningCoachStep();
};

function findMoveObjectBySan(fenStr, sanStr) {
    let temp = new Chess(fenStr);
    let m = temp.move(sanStr, { sloppy: true });
    return m;
}

function promptNextOpeningCoachStep() {
    if (!openingPracticeState.active || openingPracticeState.mode !== 'practice') return;

    if (openingPracticeState.stepIdx >= openingPracticeState.sanMoves.length) {
        $('#status').text(`Opening Book Completed! Coach Arrow shows best engine continuation.`);
        drawCoachBestContinuationArrow();
        return;
    }

    let expectedSan = openingPracticeState.sanMoves[openingPracticeState.stepIdx];
    let turnColor = game.turn();

    if (turnColor !== openingPracticeState.userColor) {
        $('#status').text(`Coach playing book move: ${expectedSan}...`);
        setTimeout(() => {
            if (!openingPracticeState.active || openingPracticeState.mode !== 'practice') return;
            let mvObj = game.move(expectedSan, { sloppy: true });
            if (!mvObj) return;
            openingPracticeState.stepIdx++;
            let sType = detectMoveSoundType(game, mvObj);
            gameHistory.push({
                fen: game.fen(),
                move: { from: mvObj.from, to: mvObj.to },
                moveObj: mvObj,
                soundType: sType,
                evalScore: 50.0,
                evalText: "0.0",
                cp: 0,
                bestMoveUci: "",
                bestMoveSan: ""
            });
            historyIndex = gameHistory.length - 1;
            playSoundForHistoryRec(gameHistory[historyIndex]);
            updateMaterial(game.fen());
            renderBoard();
            promptNextOpeningCoachStep();
        }, 420);
        return;
    }

    let targetMove = findMoveObjectBySan(game.fen(), expectedSan);
    if (targetMove) {
        if (window.drawMoveArrow) {
            window.drawMoveArrow(targetMove.from, targetMove.to, 'rgba(129, 182, 76, 0.88)');
        }
        $('#status').text(`Coach Hint: Play ${targetMove.san} (${targetMove.from} → ${targetMove.to}) [${openingPracticeState.stepIdx + 1}/${openingPracticeState.sanMoves.length}]`);
    }
}

function checkOpeningPracticeProgress() {
    if (!openingPracticeState.active || openingPracticeState.mode !== 'practice') return;
    let playedMovesCount = gameHistory.length - 1;
    if (playedMovesCount <= openingPracticeState.stepIdx) return;

    let lastRec = gameHistory[gameHistory.length - 1];
    if (!lastRec || !lastRec.moveObj) return;

    if (openingPracticeState.stepIdx < openingPracticeState.sanMoves.length) {
        let expectedSan = openingPracticeState.sanMoves[openingPracticeState.stepIdx];
        if (normalizeSan(lastRec.moveObj.san) === normalizeSan(expectedSan)) {
            openingPracticeState.stepIdx++;
            promptNextOpeningCoachStep();
        } else {
            playSnd('illegal');
            game.undo();
            gameHistory.pop();
            historyIndex = gameHistory.length - 1;
            renderBoard();
            let targetMove = findMoveObjectBySan(game.fen(), expectedSan);
            if (targetMove && window.drawMoveArrow) {
                window.drawMoveArrow(targetMove.from, targetMove.to, 'rgba(230, 57, 70, 0.88)');
            }
            $('#status').text(`Book Move is ${expectedSan} (${targetMove ? targetMove.from + ' → ' + targetMove.to : ''}) — Try again!`);
        }
    } else {
        if (game.turn() !== openingPracticeState.userColor && !game.game_over()) {
            $.post('/ai_move', { fen: game.fen(), level: '2000', think_time: 0.35, depth: 14 }, function(data) {
                if (!data || !data.move) return;
                let mvObj = parseAndApplyUciMove(data.move);
                if (!mvObj) return;
                let sType = detectMoveSoundType(game, mvObj);
                gameHistory.push({
                    fen: game.fen(), move: { from: mvObj.from, to: mvObj.to }, moveObj: mvObj, soundType: sType,
                    evalScore: 50.0, evalText: "0.0", cp: 0
                });
                historyIndex = gameHistory.length - 1;
                playSoundForHistoryRec(gameHistory[historyIndex]);
                updateMaterial(game.fen());
                renderBoard();
                drawCoachBestContinuationArrow();
            });
        } else {
            drawCoachBestContinuationArrow();
        }
    }
}

function drawCoachBestContinuationArrow() {
    if (game.game_over()) return;
    $.post('/eval', { fen: game.fen(), depth: 15, time: 0.25 }, function(data) {
        if (data && data.best_uci && data.best_uci.length >= 4) {
            let f = data.best_uci.substring(0, 2), t = data.best_uci.substring(2, 4);
            if (window.drawMoveArrow) window.drawMoveArrow(f, t, 'rgba(129, 182, 76, 0.88)');
            $('#status').text(`Coach Best Move: ${data.best_san || data.best_uci} (${data.text || '0.0'})`);
        }
    });
}

$(document).ready(function() {
    setTimeout(mergeFullEcoBookFromServer, 600);
});
