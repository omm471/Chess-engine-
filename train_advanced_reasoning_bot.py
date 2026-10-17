import os
import chess
import chess.pgn
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models

TARGET_PLAYER = "Motylev"
PGN_FOLDER = '/storage/emulated/0/Download/Motylev'

# Board representation: 8x8x14 (12 pieces + turn plane + attack/legal indicator)
def board_to_feature_planes(board):
    planes = np.zeros((8, 8, 14), dtype=np.float32)
    piece_mapping = {
        chess.PAWN: 0, chess.KNIGHT: 1, chess.BISHOP: 2,
        chess.ROOK: 3, chess.QUEEN: 4, chess.KING: 5
    }
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            r, c = divmod(square, 8)
            ptype = piece_mapping[piece.piece_type]
            if not piece.color:
                ptype += 6
            planes[r, c, ptype] = 1.0
            
    # Turn plane (who has the turn)
    if board.turn == chess.WHITE:
        planes[:, :, 12] = 1.0
    
    # Check status plane (tactical danger reasoning)
    if board.is_check():
        planes[:, :, 13] = 1.0

    return planes

def move_to_index(move):
    # 64 from-squares * 64 to-squares = 4096 possible move pairs
    return move.from_square * 64 + move.to_square

X_data = []
y_policy = [] # Move policy
y_value = []  # Outcome value (-1.0 to 1.0)

if os.path.isdir(PGN_FOLDER):
    files = [os.path.join(PGN_FOLDER, f) for f in os.listdir(PGN_FOLDER) if f.endswith('.pgn')]
else:
    files = [PGN_FOLDER]

print(f"Reading games and extracting tactical features for {TARGET_PLAYER}...")

game_count = 0
for filepath in files:
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            
            white_name = game.headers.get("White", "")
            black_name = game.headers.get("Black", "")
            result = game.headers.get("Result", "*")

            is_white = TARGET_PLAYER.lower() in white_name.lower()
            is_black = TARGET_PLAYER.lower() in black_name.lower()

            if not is_white and not is_black:
                continue

            # Assign game evaluation outcome
            if result == "1-0":
                motylev_score = 1.0 if is_white else -1.0
            elif result == "0-1":
                motylev_score = -1.0 if is_white else 1.0
            elif result == "1/2-1/2":
                motylev_score = 0.0
            else:
                motylev_score = 0.0

            game_count += 1
            board = game.board()

            for move in game.mainline_moves():
                turn_is_motylev = (board.turn == chess.WHITE and is_white) or (board.turn == chess.BLACK and is_black)

                if turn_is_motylev:
                    X_data.append(board_to_feature_planes(board))
                    y_policy.append(move_to_index(move))
                    y_value.append(motylev_score)

                board.push(move)

print(f"Loaded {game_count} GM games. Extracted {len(X_data)} reasoning move states!")

X_data = np.array(X_data, dtype=np.float32)
y_policy = np.array(y_policy, dtype=np.int32)
y_value = np.array(y_value, dtype=np.float32)

# --- Dual-Head Architecture (AlphaZero style) ---
inputs = layers.Input(shape=(8, 8, 14))

# Convolutional Backbone (Patterns + spatial relationships)
x = layers.Conv2D(128, (3, 3), padding='same', activation='relu')(inputs)
x = layers.BatchNormalization()(x)
x = layers.Conv2D(128, (3, 3), padding='same', activation='relu')(x)
x = layers.BatchNormalization()(x)
x = layers.Conv2D(64, (3, 3), padding='same', activation='relu')(x)
x = layers.Flatten()(x)

# Head 1: Policy Head (From-Square + To-Square move reasoning)
p = layers.Dense(512, activation='relu')(x)
p = layers.Dropout(0.3)(p)
policy_out = layers.Dense(4096, activation='softmax', name='policy_output')(p)

# Head 2: Value Head (Position quality evaluation: -1 to +1)
v = layers.Dense(128, activation='relu')(x)
value_out = layers.Dense(1, activation='tanh', name='value_output')(v)

model = models.Model(inputs=inputs, outputs=[policy_out, value_out])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss={
        'policy_output': 'sparse_categorical_crossentropy',
        'value_output': 'mean_squared_error'
    },
    loss_weights={
        'policy_output': 1.0,
        'value_output': 0.5
    },
    metrics={'policy_output': 'accuracy'}
)

print("Starting deep 10-epoch training on policy + evaluation...")
model.fit(
    X_data,
    {'policy_output': y_policy, 'value_output': y_value},
    epochs=10,
    batch_size=64
)

model.save('my_chess_bot.keras')
print("Model trained and saved successfully with full tactics & evaluation as my_chess_bot.keras!")
