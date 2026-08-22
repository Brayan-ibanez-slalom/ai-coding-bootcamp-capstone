const express = require('express');
const cors = require('cors');
const { Chess } = require('chess.js');

const app = express();
app.use(cors());
app.use(express.json());

function stubEvaluate(fen) {
  // Stub: count material for a rough score (centipawns)
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const chess = new Chess(fen);
  let score = 0;
  chess.board().forEach(row => {
    row.forEach(sq => {
      if (!sq) return;
      const val = pieceValues[sq.type] || 0;
      score += sq.color === 'w' ? val : -val;
    });
  });
  return score;
}

function moveQuality(diff) {
  if (diff >= -20) return 'good';
  if (diff >= -60) return 'inaccuracy';
  if (diff >= -150) return 'mistake';
  return 'blunder';
}

app.post('/api/evaluate-move', (req, res) => {
  const { fenBefore, fenAfter, moveSAN } = req.body;
  if (!fenBefore || !fenAfter || !moveSAN) {
    return res.status(400).json({ error: 'fenBefore, fenAfter, and moveSAN are required' });
  }

  const scoreBefore = stubEvaluate(fenBefore);
  const scoreAfter = stubEvaluate(fenAfter);
  // Flip sign based on whose turn it was (fenBefore side)
  const sideMultiplier = fenBefore.split(' ')[1] === 'w' ? 1 : -1;
  // Transform both scores to moving-side perspective before differencing
  const scoreDiff = sideMultiplier * scoreAfter - sideMultiplier * scoreBefore;
  const quality = moveQuality(scoreDiff);

  // Stub best move: just report the played move as "best"
  const bestMove = moveSAN;

  const explanations = {
    good: `${moveSAN} is a solid move that maintains or improves your position.`,
    inaccuracy: `${moveSAN} is slightly inaccurate. There may be a better option available.`,
    mistake: `${moveSAN} is a mistake. Your opponent can take advantage of this.`,
    blunder: `${moveSAN} is a blunder! This significantly weakens your position.`,
  };

  res.json({
    scoreBefore,
    scoreAfter,
    scoreDiff,
    moveQuality: quality,
    bestMove,
    explanation: explanations[quality],
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
