import os
import chess.pgn
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models

# 1. Path to your folder containing PGN files
PGN_FOLDER = '/storage/emulated/0/Download/Motylev'

def board_to_matrix(board):
    """Converts a chess board into a numerical grid matrix for the neural network."""
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
            if not piece.color:  # Black pieces
                piece_type += 6
            matrix[row, col, piece_type] = 1.0
    return matrix

# 2. Extracting training data from PGNs
X_data = []
y_data = []

if os.path.isdir(PGN_FOLDER):
    files = [os.path.join(PGN_FOLDER, f) for f in os.listdir(PGN_FOLDER) if f.endswith('.pgn')]
else:
    files = [PGN_FOLDER]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            board = game.board()
            for move in game.mainline_moves():
                X_data.append(board_to_matrix(board))
                y_data.append(move.to_square) 
                board.push(move)

X_data = np.array(X_data)
y_data = np.array(y_data)

# 3. Build Neural Network Model
model = models.Sequential([
    layers.Input(shape=(8, 8, 12)),
    layers.Flatten(),
    layers.Dense(128, activation='relu'),
    layers.Dense(64, activation='softmax') # Predicting target square (0-63)
])

model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

# 4. Train the model using your data
model.fit(X_data, y_data, epochs=5, batch_size=32)

# 5. Save the trained model weights
model.save('my_chess_bot.keras')
print("Model trained and saved successfully as my_chess_bot.keras!")
