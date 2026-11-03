body { font-family: -apple-system, sans-serif; background: #161512; color: #bababa; margin: 0; padding: 10px; text-align: center; }
h1 { color: #81b64c; margin: 5px 0; font-size: 20px; }
.main-container { display: flex; flex-direction: column; align-items: center; max-width: 450px; margin: 0 auto; }
.board-area { display: flex; justify-content: center; align-items: stretch; margin: 6px 0; }

.chess-board { width: 320px; height: 320px; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); border: 2px solid #262421; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); user-select: none; position: relative; touch-action: none; }
.square { position: relative; display: flex; justify-content: center; align-items: center; width: 40px; height: 40px; font-size: 32px; cursor: pointer; }
.square.light { background-color: #ebecd0; }
.square.dark { background-color: #739552; }
.square.selected { background-color: #f5f682 !important; }
.square.highlight-check { background-color: #eb2828 !important; }

/* LAST MOVE HIGHLIGHT (CHESS.COM STYLE) */
.square.last-move { background-color: rgba(245, 246, 130, 0.7) !important; }

/* SLOW & SMOOTH PIECE TRANSITION */
.piece { width: 100%; height: 100%; background-size: cover; z-index: 2; position: absolute; cursor: grab; transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1); }
.piece:active { cursor: grabbing; }

.legal-dot { width: 14px; height: 14px; background: rgba(0, 0, 0, 0.25); border-radius: 50%; position: absolute; z-index: 3; pointer-events: none; }
.legal-capture { width: 36px; height: 36px; border: 4px solid rgba(0, 0, 0, 0.25); border-radius: 50%; position: absolute; box-sizing: border-box; z-index: 3; pointer-events: none; }

.badge-loser { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; background: #eb2828; border-radius: 50%; color: #000; font-size: 11px; display: flex; justify-content: center; align-items: center; z-index: 10; border: 1px solid #fff; }
.badge-winner { position: absolute; bottom: 2px; right: 2px; width: 18px; height: 18px; background: #81b64c; border-radius: 50%; color: #fff; font-size: 11px; display: flex; justify-content: center; align-items: center; z-index: 10; border: 1px solid #fff; }

.eval-bar-container { width: 14px; height: 320px; background: #262421; margin-right: 6px; border-radius: 4px; border: 1px solid #363431; overflow: hidden; position: relative; font-weight: 900; }
.eval-fill { width: 100%; height: 50%; background: #fff; position: absolute; bottom: 0; transition: height 0.5s ease; z-index: 1; }
.eval-text-white { position: absolute; bottom: 2px; left: 0; right: 0; width: 100%; color: #000; z-index: 2; text-align: center; font-size: 8px; letter-spacing: -0.5px; }
.eval-text-black { position: absolute; top: 2px; left: 0; right: 0; width: 100%; color: #fff; z-index: 2; text-align: center; font-size: 8px; letter-spacing: -0.5px; }

.top-bar { width: 340px; margin-bottom: 5px; }
select { background: #262421; color: #81b64c; border: 1px solid #81b64c; padding: 5px; border-radius: 4px; font-weight: bold; width: 100%; }
.timer-bar { display: flex; justify-content: space-between; align-items: center; width: 340px; background: #262421; color: #fff; padding: 5px 10px; border-radius: 4px; margin-bottom: 4px; box-sizing: border-box; }
.player-info { display: flex; flex-direction: column; align-items: flex-start; font-size: 14px; font-weight: bold; }
.timer-box { background: #121212; padding: 4px 8px; border-radius: 3px; border: 1px solid #363431; font-size: 15px; font-weight: bold; }
.captured-pieces { font-size: 16px; color: #999; display: flex; align-items: center; height: 18px; margin-top: 2px; }
.score-plus { font-size: 12px; font-weight: bold; color: #81b64c; margin-left: 5px; }
#status { font-size: 13px; margin: 5px 0; font-weight: bold; color: #e4e4e4; background: #262421; padding: 6px; border-radius: 4px; width: 340px; box-sizing: border-box; }
#pgn-box { width: 340px; height: 50px; background: #262421; color: #888; border: 1px solid #363431; border-radius: 4px; padding: 5px; font-size: 12px; margin-bottom: 6px; box-sizing: border-box; resize: none; }
.controls { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; width: 340px; }
button { background: #81b64c; color: white; border: none; padding: 7px 10px; font-size: 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
button:hover { background: #71a342; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { position: relative; background: #262421; padding: 25px; border-radius: 10px; width: 280px; text-align: center; border: 2px solid #363431; box-shadow: 0 10px 40px rgba(0,0,0,0.9); }
.close-btn { position: absolute; top: 10px; right: 10px; color: #888; font-size: 16px; font-weight: bold; cursor: pointer; background: #161512; border: 1px solid #363431; padding: 3px 8px; border-radius: 4px; }
.close-btn:hover { color: #fff; background: #b33430; border-color: #b33430; }
.modal-content h2 { margin-top: 5px; color: #fff; font-size: 22px; }
.vs-container { display: flex; justify-content: space-between; align-items: center; margin: 20px 0; background: #161512; padding: 15px; border-radius: 8px; border: 1px solid #363431; }
.player { display: flex; flex-direction: column; align-items: center; color: #e4e4e4; font-weight: bold; font-size: 14px; width: 40%; }
.player-icon { font-size: 32px; margin-bottom: 5px; }
.vs-text { color: #81b64c; font-weight: 900; font-size: 18px; }
#modal-subtitle { color: #aaa; font-size: 14px; margin-bottom: 20px; }
#modal-btn { width: 100%; padding: 12px; font-size: 16px; border-radius: 6px; }
