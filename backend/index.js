require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Chess } = require('chess.js');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const app = express();
app.use(cors());
app.use(express.json());

function evaluatePosition(fen) {
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const chess = new Chess(fen);
  let score = 0;
  const centerSquares = new Set(['d4', 'e4', 'd5', 'e5']);
  const homeSquares = new Set(['b1', 'c1', 'f1', 'g1', 'b8', 'c8', 'f8', 'g8']);
  const pieceActivity = {
    p: [0, 4, 8, 14, 20, 28, 38, 0],
    n: [-20, -8, 4, 12, 16, 18, 10, -10],
    b: [-12, -4, 6, 12, 16, 18, 12, -4],
    r: [0, 4, 8, 12, 16, 20, 24, 28],
    q: [-4, 0, 4, 8, 12, 16, 12, 8],
    k: [-8, -4, 0, 4, 8, 4, -4, -8],
  };
  const pawnFiles = { w: Array(8).fill(0), b: Array(8).fill(0) };

  chess.board().forEach(row => {
    row.forEach((sq, rankIndex) => {
      if (!sq) return;
      const val = pieceValues[sq.type] || 0;
      const sign = sq.color === 'w' ? 1 : -1;
      score += sign * val;
      if (sq.type === 'p') pawnFiles[sq.color][sq.square.charCodeAt(0) - 97] += 1;
      const relativeRank = sq.color === 'w' ? 7 - rankIndex : rankIndex;
      score += sign * (pieceActivity[sq.type]?.[relativeRank] || 0);
    });
  });

  chess.board().forEach((row, rankIndex) => {
    row.forEach((sq, fileIndex) => {
      if (!sq) return;
      const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
      const sign = sq.color === 'w' ? 1 : -1;
      if (centerSquares.has(square)) score += sign * 18;
      if (sq.type === 'n' || sq.type === 'b') {
        if (!homeSquares.has(square)) score += sign * 12;
      }
    });
  });

  const fenParts = fen.split(' ');
  const mobilityFen = fenParts.map((part, index) => index === 3 ? '-' : part);
  const whiteTurn = new Chess(mobilityFen.map((part, index) => index === 1 ? 'w' : part).join(' '));
  const blackTurn = new Chess(mobilityFen.map((part, index) => index === 1 ? 'b' : part).join(' '));
  score += (whiteTurn.moves().length - blackTurn.moves().length) * 2;

  // Reward coordinated pawn structures and punish doubled or isolated pawns.
  ['w', 'b'].forEach(color => {
    const sign = color === 'w' ? 1 : -1;
    pawnFiles[color].forEach((count, fileIndex) => {
      if (count > 1) score -= sign * (count - 1) * 12;
      if (count > 0 && pawnFiles[color][fileIndex - 1] === 0 && pawnFiles[color][fileIndex + 1] === 0) {
        score -= sign * 10;
      }
      if (count > 0 && count === 1 && pawnFiles[color].slice(0, fileIndex).every(value => value === 0)
        && pawnFiles[color].slice(fileIndex + 1).every(value => value === 0)) {
        score += sign * 8;
      }
    });
  });

  // Reward active pieces and penalize pieces that can be captured immediately.
  ['w', 'b'].forEach(color => {
    const sign = color === 'w' ? 1 : -1;
    chess.board().forEach(row => row.forEach(sq => {
      if (!sq || sq.color !== color || sq.type === 'k') return;
      const legalMoves = chess.moves({ square: sq.square, verbose: true });
      score += sign * Math.min(legalMoves.length, 8) * 2;
      if (legalMoves.some(move => move.captured)) score += sign * 8;
    }));
  });

  const whiteKing = chess.board().flat().find(sq => sq?.type === 'k' && sq.color === 'w');
  const blackKing = chess.board().flat().find(sq => sq?.type === 'k' && sq.color === 'b');
  if (whiteKing && blackKing) {
    score += (whiteKing.square[0] === 'g' || whiteKing.square[0] === 'c') ? 35 : 0;
    score -= (blackKing.square[0] === 'g' || blackKing.square[0] === 'c') ? 35 : 0;
  }
  if (!fen.split(' ')[2].includes('K') && !fen.split(' ')[2].includes('Q')) score += 25;
  if (!fen.split(' ')[2].includes('k') && !fen.split(' ')[2].includes('q')) score -= 25;

  return score;
}

function moveQuality(diff) {
  if (diff >= 5) return 'good';
  if (diff >= -20) return 'inaccuracy';
  if (diff >= -90) return 'mistake';
  return 'blunder';
}

function moveAdjustment(moveSAN, fenBefore) {
  const fullMove = Number(fenBefore.split(' ')[5]);
  let adjustment = 0;

  if (/^Q/.test(moveSAN) && fullMove <= 5) adjustment -= 70;
  if (/^[a-h][34]$/.test(moveSAN) && !/^[de]/.test(moveSAN) && fullMove <= 8) adjustment -= 25;
  if (/^O-O/.test(moveSAN)) adjustment += 35;
  if (/[+#]$/.test(moveSAN)) adjustment += 20;
  if (/x/.test(moveSAN)) adjustment += 10;

  return adjustment;
}

function tacticalAdjustment(moveSAN, fenBefore, fenAfter) {
  const before = new Chess(fenBefore);
  const after = new Chess(fenAfter);
  const lastMove = before.moves({ verbose: true }).find(move => move.san === moveSAN);
  if (!lastMove) return 0;
  const movedPiece = after.get(lastMove.to);
  if (!movedPiece) return 0;

  const opponentCaptures = after.moves({ verbose: true }).filter(move => (
    move.to === lastMove.to && move.captured
  ));
  if (opponentCaptures.length === 0) return 0;

  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const value = pieceValues[movedPiece.type] || 0;
  return -Math.min(450, Math.round(value * 0.65));
}

function minimaxPosition(chess, depth, aiColor, alpha = -Infinity, beta = Infinity) {
  if (chess.isCheckmate()) return chess.turn() === aiColor ? -100000 : 100000;
  if (chess.isDraw() || depth === 0) {
    const positionScore = evaluatePosition(chess.fen());
    return aiColor === 'w' ? positionScore : -positionScore;
  }

  const maximizing = chess.turn() === aiColor;
  const moves = chess.moves({ verbose: true });
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const nextPosition = new Chess(chess.fen());
    nextPosition.move(move);
    const score = minimaxPosition(nextPosition, depth - 1, aiColor, alpha, beta);
    bestScore = maximizing ? Math.max(bestScore, score) : Math.min(bestScore, score);
    if (maximizing) {
      alpha = Math.max(alpha, bestScore);
    } else {
      beta = Math.min(beta, bestScore);
    }
    if (beta <= alpha) break;
  }

  return bestScore;
}

function chooseFallbackMove(fen, difficulty) {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const aiColor = chess.turn();

  return moves
    .map(move => {
      const candidate = new Chess(fen);
      const applied = candidate.move(move);
      let score = 0;
      const positionScore = evaluatePosition(candidate.fen());
      score += aiColor === 'w' ? positionScore : -positionScore;
      if (candidate.isCheckmate()) score += 100000;
      if (applied.san.includes('+')) score += 5000;
      if (applied.captured) score += 1000 + (pieceValues[applied.captured] || 0);
      if (applied.promotion) score += 800;
      if (applied.san.startsWith('O-O')) score += difficulty === 'advanced' ? 250 : 100;
      if (['d4', 'e4', 'd5', 'e5'].includes(applied.to)) score += 80;
      if (['n', 'b'].includes(applied.piece) && !['b1', 'c1', 'f1', 'g1', 'b8', 'c8', 'f8', 'g8'].includes(applied.to)) score += 60;

      if (difficulty === 'advanced') {
        score = minimaxPosition(candidate, 3, aiColor) * 3 + score;
      }

      return { san: applied.san, score };
    })
    .sort((first, second) => second.score - first.score)[0]?.san;
}

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const difficultyInstructions = {
  beginner: 'Play one simple, human-friendly move. Prefer clear plans and basic development over sharp tactics.',
  intermediate: 'Compare at least three candidate moves and calculate the most forcing reply. Use basic tactics and choose a solid club-level move.',
  advanced: 'Play as a demanding tournament opponent, not a teaching opponent. Calculate forcing checks, captures, and threats at least seven plies deep on every move, including the middlegame and endgame. Compare at least eight candidate moves, search for tactical refutations and zwischenzugs, punish hanging pieces, improve the worst-placed piece, coordinate every piece, improve pawn structure, create passed pawns, and convert material advantages. A quiet move that wins material, improves a piece, controls an open file, or creates a durable positional advantage is preferred over a premature king attack. Do not relax after a good opening, drift into random moves, intentionally make inaccurate moves, or repeat a plan without calculating the opponent\'s best response.',
};

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(cleaned);
}

async function requestAiMove(fen, difficulty, moveHistory = [], retry = false) {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true }).map(move => (
    `${move.from}${move.to}${move.promotion || ''}`
  ));
  const prompt = [
    'You are the chess opponent in a learning app.',
    `The maximum difficulty selected by the player is ${difficulty}. ${difficultyInstructions[difficulty]}`,
    'Adapt to the player over time when move history is provided, but never exceed the selected maximum.',
    `It is ${chess.turn() === 'w' ? 'White' : 'Black'} to move.`,
    `Current position in FEN: ${fen}`,
    `Complete recent move history: ${moveHistory.slice(-24).join(' ') || 'No moves yet.'}`,
    `Choose exactly one move from this legal UCI list: ${legalMoves.join(', ')}`,
    'Return only valid JSON with this exact shape: {"move":"e7e5","advice":"one short helpful sentence"}.',
    difficulty === 'advanced'
      ? 'Before answering, silently calculate a principal variation for each serious candidate, including the opponent\'s strongest defensive reply and your best continuation. Recalculate from the current board every turn; never play a move merely because it worked in the opening. Inspect all enemy pieces, loose material, pawn breaks, open files, weak squares, and endgame transitions. Prefer forcing lines, tactical accuracy, piece coordination, king safety, and concrete gains over a familiar opening move or an attack on the king alone.'
      : '',
    'The move must be copied exactly from the legal UCI list. Do not return a move for the other color.',
    retry ? 'Your previous answer was invalid. Re-check the side to move and select only from the legal list.' : '',
  ].join('\n');

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-pro-v1:0',
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: {
      maxTokens: difficulty === 'advanced' ? 450 : 160,
      temperature: difficulty === 'beginner' ? 0.8 : difficulty === 'intermediate' ? 0.2 : 0,
      topP: difficulty === 'advanced' ? 0.7 : undefined,
    },
  });
  try {
    const response = await bedrock.send(command);
    const text = response.output?.message?.content?.map(part => part.text || '').join('').trim();
    if (!text) throw new Error('Bedrock returned an empty response');

    const result = extractJson(text);
    const move = chess.move({
      from: result.move?.slice(0, 2),
      to: result.move?.slice(2, 4),
      promotion: result.move?.[4],
    });
    if (!move) throw new Error('Bedrock returned an illegal move');

    return { moveSAN: move.san, advice: result.advice || 'The AI played a move within your selected difficulty.' };
  } catch (error) {
    if (!retry) return requestAiMove(fen, difficulty, moveHistory, true);
    throw error;
  }
}

app.post('/api/evaluate-move', (req, res) => {
  const { fenBefore, fenAfter, moveSAN } = req.body;
  if (!fenBefore || !fenAfter || !moveSAN) {
    return res.status(400).json({ error: 'fenBefore, fenAfter, and moveSAN are required' });
  }

  const scoreBefore = evaluatePosition(fenBefore);
  const scoreAfter = evaluatePosition(fenAfter);
  // Flip sign based on whose turn it was (fenBefore side)
  const sideMultiplier = fenBefore.split(' ')[1] === 'w' ? 1 : -1;
  // Transform both scores to moving-side perspective before differencing
  const scoreDiff = sideMultiplier * scoreAfter - sideMultiplier * scoreBefore
    + moveAdjustment(moveSAN, fenBefore)
    + tacticalAdjustment(moveSAN, fenBefore, fenAfter);
  const quality = moveQuality(scoreDiff);

  // Stub best move: just report the played move as "best"
  const bestMove = moveSAN;

  const explanations = {
    good: `${moveSAN} improves your position by preserving material and supporting development, activity, or a concrete threat.`,
    inaccuracy: `${moveSAN} is playable, but it gives up some activity or coordination. Compare it with a forcing move before committing.`,
    mistake: `${moveSAN} weakens your position. It gives your opponent a useful target or allows them to gain time, space, or initiative.`,
    blunder: `${moveSAN} is a serious error. Recheck all opponent checks, captures, and threats before making this kind of move.`,
  };

  const improvementAdvice = {
    good: 'Keep looking for forcing moves: checks, captures, and threats before choosing your next move.',
    inaccuracy: 'Before moving, compare two candidate moves and check what your opponent can capture next.',
    mistake: 'Pause and scan your opponent\'s checks, captures, and threats before committing to a move.',
    blunder: 'Slow down and verify every attacked piece, undefended square, and immediate opponent threat.',
  };

  res.json({
    scoreBefore,
    scoreAfter,
    scoreDiff,
    moveQuality: quality,
    bestMove,
    explanation: explanations[quality],
    improvementAdvice: improvementAdvice[quality],
  });
});

app.post('/api/ai-move', async (req, res) => {
  const { fen, difficulty = 'beginner', moveHistory = [] } = req.body;
  if (!fen || !difficultyInstructions[difficulty]) {
    return res.status(400).json({ error: 'fen and a valid difficulty are required' });
  }

  try {
    const result = await requestAiMove(fen, difficulty, moveHistory);
    res.json(result);
  } catch (error) {
    console.error('AI move unavailable:', error.message);
    try {
      const fallbackMove = chooseFallbackMove(fen, difficulty);
      if (!fallbackMove) throw new Error('No legal fallback move available');
      const authenticationFailed = error.message.toLowerCase().includes('authentication')
        || error.message.toLowerCase().includes('api key');

      res.json({
        moveSAN: fallbackMove,
        advice: authenticationFailed
          ? 'The Bedrock key is invalid or expired, so a legal fallback move was played. Update backend/.env and restart the backend.'
          : 'The AI was temporarily unavailable, so a legal fallback move was played.',
        aiFallback: true,
        fallbackReason: authenticationFailed ? 'authentication' : 'service',
      });
    } catch {
      res.status(503).json({ error: 'AI opponent unavailable. Check the Bedrock configuration.' });
    }
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
