import chess
import numpy as np
import tensorflow as tf

# Saved model load karein
model = tf.keras.models.load_model('my_chess_bot.keras')

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
    return np.expand_dims(matrix, axis=0)

board = chess.Board()
print("Game Started! Bot vs Random/ خود aap")

while not board.is_game_over():
    print("\nCurrent Board:")
    print(board)
    print("-" * 30)

    if board.turn == chess.WHITE:
        # Bot ki turn (Model prediction)
        board_tensor = board_to_matrix(board)
        prediction = model.predict(board_tensor, verbose=0)
        predicted_square = np.argmax(prediction)

        chosen_move = None
        for move in board.legal_moves:
            if move.to_square == predicted_square:
                chosen_move = move
                break

        if not chosen_move:
            chosen_move = list(board.legal_moves)[0]

        board.push(chosen_move)
        print(f"Bot played: {chosen_move}")
    else:
        # Opponent / Second player turn (Abhi ke liye legal moves me se random)
        legal_moves = list(board.legal_moves)
        # Aap chahein toh yahan input() daal kar khud bhi manually play kar sakte hain!
        chosen_move = legal_moves[0]
        board.push(chosen_move)
        print(f"Opponent played: {chosen_move}")

print("Game Over!", board.result())

