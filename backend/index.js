require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Chess } = require('chess.js');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

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

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const difficultyInstructions = {
  beginner: 'Play a human-friendly move. Prefer simple plans and allow occasional obvious inaccuracies.',
  intermediate: 'Play a solid club-level move. Use basic tactics, but do not search for forcing perfection.',
  advanced: 'Play a strong competitive move. Use tactical and positional reasoning, but stay within this selected level.',
};

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(cleaned);
}

async function requestAiMove(fen, difficulty, retry = false) {
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
    `Choose exactly one move from this legal UCI list: ${legalMoves.join(', ')}`,
    'Return only valid JSON with this exact shape: {"move":"e7e5","advice":"one short helpful sentence"}.',
    'The move must be copied exactly from the legal UCI list. Do not return a move for the other color.',
    retry ? 'Your previous answer was invalid. Re-check the side to move and select only from the legal list.' : '',
  ].join('\n');

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-pro-v1:0',
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 160, temperature: difficulty === 'beginner' ? 0.8 : 0.3 },
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
    if (!retry) return requestAiMove(fen, difficulty, true);
    throw error;
  }
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
  const { fen, difficulty = 'beginner' } = req.body;
  if (!fen || !difficultyInstructions[difficulty]) {
    return res.status(400).json({ error: 'fen and a valid difficulty are required' });
  }

  try {
    const result = await requestAiMove(fen, difficulty);
    res.json(result);
  } catch (error) {
    console.error('AI move unavailable:', error.message);
    try {
      const fallbackGame = new Chess(fen);
      const fallbackMoves = fallbackGame.moves();
      const fallbackMove = fallbackMoves[0];
      if (!fallbackMove) throw new Error('No legal fallback move available');

      res.json({
        moveSAN: fallbackMove,
        advice: 'The AI was temporarily unavailable, so a legal fallback move was played.',
        aiFallback: true,
      });
    } catch {
      res.status(503).json({ error: 'AI opponent unavailable. Check the Bedrock configuration.' });
    }
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
