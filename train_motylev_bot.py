import os
import chess.pgn
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models

# Target player name jiska clone banana hai
TARGET_PLAYER = "Motylev"
PGN_FOLDER = '/storage/emulated/0/Download/Motylev'

def board_to_matrix(board):
    matrix = np.zeros((8, 8, 12), dtype=np.float32)
    piece_mapping = {
        chess.PAWN: 0, chess.KNIGHT: 1, chess.BISHOP: 2,
        chess.ROOK: 3, chess.QUEEN: 4, chess.KING: 5
    }
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            row, col = divmod(square, 8)
            piece_type = piece_mapping[piece.piece_type]
            if not piece.color:
                piece_type += 6
            matrix[row, col, piece_type] = 1.0
    return matrix

X_data = []
y_data = []

if os.path.isdir(PGN_FOLDER):
    files = [os.path.join(PGN_FOLDER, f) for f in os.listdir(PGN_FOLDER) if f.endswith('.pgn')]
else:
    files = [PGN_FOLDER]

print(f"Scanning PGN files and filtering strictly for player: {TARGET_PLAYER}...")

game_count = 0
filtered_moves_count = 0

for filepath in files:
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            
            game_count += 1
            white_player = game.headers.get("White", "")
            black_player = game.headers.get("Black", "")
            
            # Check karein ki target player is game mein kahan hai
            is_white_target = TARGET_PLAYER.lower() in white_player.lower()
            is_black_target = TARGET_PLAYER.lower() in black_player.lower()
            
            if not is_white_target and not is_black_target:
                continue # Agar Motylev is game mein nahi hai toh skip kar do
            
            board = game.board()
            for move in game.mainline_moves():
                # Decide karein ki yeh move target player ka hai ya nahi
                is_white_turn = (board.turn == chess.WHITE)
                
                if (is_white_turn and is_white_target) or (not is_white_turn and is_black_target):
                    X_data.append(board_to_matrix(board))
                    y_data.append(move.to_square)
                    filtered_moves_count += 1
                
                board.push(move)

print(f"Processed {game_count} games. Extracted {filtered_moves_count} exact moves played by {TARGET_PLAYER}!")

if len(X_data) == 0:
    print("Error: Koi bhi move match nahi hua! PGN headers mein player ka naam check karein.")
else:
    X_data = np.array(X_data, dtype=np.float32)
    y_data = np.array(y_data, dtype=np.int32)

    # Advanced Convolutional Neural Network (CNN) for Chess pattern recognition
    model = models.Sequential([
        layers.Input(shape=(8, 8, 12)),
        layers.Conv2D(64, (3, 3), padding='same', activation='relu'),
        layers.Conv2D(64, (3, 3), padding='same', activation='relu'),
        layers.Flatten(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(64, activation='softmax') # 64 squares target prediction
    ])

    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

    print("Training the Grandmaster clone model (this may take some time depending on dataset size)...")
    # Zyada epochs aur achhe learning ke liye 10 epochs tak train karein
    model.fit(X_data, y_data, epochs=10, batch_size=32)

    model.save('my_chess_bot.keras')
    print("Success! Motylev-exclusive Grandmaster bot trained and saved as my_chess_bot.keras!")
