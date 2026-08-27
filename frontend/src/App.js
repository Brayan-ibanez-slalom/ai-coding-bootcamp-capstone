import React, { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

const winningStrategies = [
  'Keep creating threats while checking that every attacking piece is protected.',
  'Convert an advantage by improving your least active piece before starting a new attack.',
  'When ahead, trade pieces carefully and keep your king safe.',
  'Look for forcing sequences in order: checks, captures, then threats.',
  'Use open files and diagonals to bring your rooks and bishops into the game.',
  'Before capturing, ask whether the exchange improves your position or only wins a pawn.',
  'Keep developing pieces toward useful squares instead of moving the same piece repeatedly.',
  'When you have initiative, make threats that force your opponent to respond.',
  'Review the moment your advantage began and identify the decision that created it.',
  'Build on this result by explaining your plan before making your next move.',
];

const learningStrategies = [
  'Before moving, scan every opponent check, capture, and direct threat.',
  'Compare two candidate moves and predict your opponent\'s strongest reply.',
  'Develop your knights and bishops before moving the queen repeatedly.',
  'Castle early when the center is open and your king needs safety.',
  'Fight for the center with pieces and pawns while keeping them defended.',
  'After every opponent move, ask what changed and which piece is now under pressure.',
  'Count attackers and defenders before exchanging or capturing.',
  'Look one move deeper: do not stop calculating after finding your own idea.',
  'When unsure, improve your worst-placed piece instead of making a random pawn move.',
  'Review your biggest mistake first, then practice the position until the threat is familiar.',
];

function qualityColor(quality) {
  switch (quality) {
    case 'good': return '#22c55e';
    case 'inaccuracy': return '#eab308';
    case 'mistake': return '#f97316';
    case 'blunder': return '#ef4444';
    default: return '#94a3b8';
  }
}

function moveHighlight(quality, actor) {
  if (actor === 'ai') return 'rgba(59, 130, 246, 0.35)';
  return `${qualityColor(quality)}80`;
}

function ScoreBar({ label, value }) {
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <span className="score-value">{value > 0 ? `+${value}` : value} cp</span>
    </div>
  );
}

export function getGameResult(chess) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    return { type: 'win', winner, message: `${winner} wins by checkmate!` };
  }

  if (chess.isStalemate()) {
    return { type: 'draw', message: 'Draw by stalemate. Great defense from both sides!' };
  }

  if (chess.isThreefoldRepetition()) {
    return { type: 'draw', message: 'Draw by threefold repetition.' };
  }

  if (chess.isInsufficientMaterial()) {
    return { type: 'draw', message: 'Draw by insufficient material.' };
  }

  if (chess.isDraw()) {
    return { type: 'draw', message: 'The game is a draw.' };
  }

  return null;
}

export function getResultMessage(result, playerColor) {
  if (result.type !== 'win') return result.message;

  const playerName = playerColor === 'white' ? 'White' : 'Black';
  const playerWon = result.winner === playerName;
  return `${result.message} ${playerWon ? 'Congratulations!' : 'Keep practicing and review the key moments from this game.'}`;
}

export function selectStrategy(result, playerColor, randomValue = Math.random()) {
  const playerName = playerColor === 'white' ? 'White' : 'Black';
  const strategies = result.type === 'win' && result.winner === playerName
    ? winningStrategies
    : learningStrategies;
  return strategies[Math.floor(randomValue * strategies.length)];
}

function GameResult({ result, moveHistory, playerColor, strategyFocus }) {
  if (!result) return null;

  const humanMoves = moveHistory.filter(move => move.actor === 'human');
  const errors = humanMoves.filter(move => ['inaccuracy', 'mistake', 'blunder'].includes(move.quality));
  const goodMoves = humanMoves
    .filter(move => move.quality === 'good')
    .sort((first, second) => (second.scoreDiff || 0) - (first.scoreDiff || 0))
    .slice(0, 3);
  const allGoodMoves = humanMoves.filter(move => move.quality === 'good');
  const reviewMoves = errors
    .sort((first, second) => (first.scoreDiff || 0) - (second.scoreDiff || 0))
    .slice(0, 3);
  const resultMessage = getResultMessage(result, playerColor);

  return (
    <section className={`game-result ${result.type}`} role="status">
      <h2>{result.type === 'win' ? 'Game Complete' : 'Match Drawn'}</h2>
      <p>{resultMessage}</p>
      <div className="total-feedback">
        <h3>Total Feedback</h3>
        <p>You played {humanMoves.length} move{humanMoves.length === 1 ? '' : 's'}.</p>
        <p>{allGoodMoves.length} good, {errors.length} move{errors.length === 1 ? '' : 's'} to review.</p>
        {goodMoves.length > 0 && (
          <div className="review-list good-list">
            <strong>Top 3 good moves</strong>
            <p>{goodMoves.map(move => `${move.san} (${move.explanation})`).join(' ')}</p>
          </div>
        )}
        {reviewMoves.length > 0 && (
          <div className="review-list error-list">
            <strong>Top 3 moves to review</strong>
            {reviewMoves.map(move => (
              <p key={`${move.san}-${move.explanation}`}>
                <b>{move.san} - {move.quality}:</b> {move.explanation} {move.improvementAdvice}
              </p>
            ))}
          </div>
        )}
        <div className="improvement-summary">
          <strong>Strategy Focus</strong>
          <p>{strategyFocus}</p>
        </div>
      </div>
      <p className="result-prompt">Start a new game with Reset Game.</p>
    </section>
  );
}

function FeedbackPanel({ feedback, loading, gameResult, moveHistory, playerColor, strategyFocus }) {
  if (gameResult) {
    return (
      <div className="feedback-panel">
        <GameResult
          result={gameResult}
          moveHistory={moveHistory}
          playerColor={playerColor}
          strategyFocus={strategyFocus}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="feedback-panel">
        <h2 className="panel-title">Move Feedback</h2>
        <p className="muted">Evaluating…</p>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="feedback-panel">
        <h2 className="panel-title">Move Feedback</h2>
        <p className="muted">Start a game to play and receive feedback.</p>
      </div>
    );
  }

  if (feedback.error) {
    return (
      <div className="feedback-panel">
        <h2 className="panel-title">Move Feedback</h2>
        <p className="error-message">{feedback.error}</p>
      </div>
    );
  }

  const {
    moveSAN,
    moveQuality,
    scoreBefore,
    scoreAfter,
    scoreDiff,
    bestMove,
    explanation,
    improvementAdvice,
  } = feedback;

  if (feedback.actor === 'ai') {
    return (
      <div className="feedback-panel">
        <section className="panel-section">
          <h2 className="panel-title">AI Move</h2>
          <div className="move-info-row">
            <span className="move-san"><strong>Move:</strong> {moveSAN}</span>
            <span className="quality-badge ai-badge">opponent</span>
          </div>
          <div className="best-move-row">
            <span className="score-label">Level:</span>
            <span className="score-value">{feedback.difficulty}</span>
          </div>
        </section>
        <section className="panel-section">
          <h3 className="section-heading">AI Advice</h3>
          <p className="explanation">{explanation}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="feedback-panel">
      <section className="panel-section">
        <h2 className="panel-title">Move Feedback</h2>
        <div className="move-info-row">
          <span className="move-san">
            <strong>Move:</strong> {moveSAN}
          </span>
          <span
            className="quality-badge"
            style={{ backgroundColor: qualityColor(moveQuality) }}
          >
            {moveQuality}
          </span>
        </div>
        <div className="best-move-row">
          <span className="score-label">Best Move:</span>
          <span className="score-value">{bestMove}</span>
        </div>
      </section>

      <section className="panel-section">
        <h3 className="section-heading">Evaluation</h3>
        <ScoreBar label="Before" value={scoreBefore} />
        <ScoreBar label="After" value={scoreAfter} />
        <ScoreBar label="Δ Score" value={scoreDiff} />
      </section>

      <section className="panel-section">
        <h3 className="section-heading">Coach Explanation</h3>
        <p className="explanation">{explanation}</p>
        <h3 className="section-heading advice-heading">How to Improve</h3>
        <p className="explanation">{improvementAdvice}</p>
      </section>
    </div>
  );
}

export default function App() {
  const [game, setGame] = useState(new Chess().fen());
  const [boardWidth, setBoardWidth] = useState(() => Math.min(720, window.innerWidth - 64));
  const [playerColor, setPlayerColor] = useState('white');
  const [difficulty, setDifficulty] = useState('beginner');
  const [gameStarted, setGameStarted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [gameResult, setGameResult] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [strategyFocus, setStrategyFocus] = useState('Complete a game to receive a strategy focus.');

  useEffect(() => {
    const updateBoardWidth = () => setBoardWidth(Math.min(720, window.innerWidth - 64));
    window.addEventListener('resize', updateBoardWidth);
    return () => window.removeEventListener('resize', updateBoardWidth);
  }, []);

  const playAiTurn = useCallback(async (position, selectedDifficulty, history) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: position,
          difficulty: selectedDifficulty,
          moveHistory: history.map(move => move.san),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const aiGame = new Chess(position);
      const aiMove = aiGame.move(data.moveSAN);
      setGame(aiGame.fen());
      const aiResult = getGameResult(aiGame);
      setGameResult(aiResult);
      if (aiResult) setStrategyFocus(selectStrategy(aiResult, playerColor));
      setMoveHistory(history => [...history, { actor: 'ai', san: aiMove.san }]);
      setLastMoveSquares({
        [aiMove.from]: { background: moveHighlight('ai move', 'ai') },
        [aiMove.to]: { background: moveHighlight('ai move', 'ai') },
      });
      setFeedback({
        actor: 'ai',
        difficulty: selectedDifficulty,
        moveSAN: aiMove.san,
        moveQuality: 'ai move',
        scoreBefore: 0,
        scoreAfter: 0,
        scoreDiff: 0,
        bestMove: aiMove.san,
        explanation: data.advice,
      });
    } catch (error) {
      setFeedback({ error: error.message || 'AI opponent unavailable.' });
    } finally {
      setLoading(false);
    }
  }, [playerColor]);

  const handleColorChange = useCallback(event => {
    const selectedColor = event.target.value;
    setPlayerColor(selectedColor);
    if (!gameStarted) return;
    setGameStarted(false);
    setFeedback(null);
    setLastMoveSquares({});
    setGameResult(null);
    setMoveHistory([]);
    setStrategyFocus('Complete a game to receive a strategy focus.');
  }, [gameStarted]);

  const startGame = useCallback(() => {
    const initialPosition = new Chess().fen();
    setGame(initialPosition);
    setFeedback(null);
    setLastMoveSquares({});
    setGameResult(null);
    setMoveHistory([]);
    setStrategyFocus('Complete a game to receive a strategy focus.');
    setGameStarted(true);
    if (playerColor === 'black') playAiTurn(initialPosition, difficulty, []);
  }, [difficulty, playAiTurn, playerColor]);

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      if (!gameStarted || !targetSquare) return false;

      const gameCopy = new Chess(game);
      if (gameCopy.turn() !== playerColor[0]) return false;
      const fenBefore = gameCopy.fen();

      let move;
      try {
        move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      } catch {
        return false;
      }
      if (!move) return false;

      const fenAfter = gameCopy.fen();
      setGame(gameCopy.fen());
      const moveResult = getGameResult(gameCopy);
      setLastMoveSquares({
        [sourceSquare]: { background: 'rgba(234,179,8,0.35)' },
        [targetSquare]: { background: 'rgba(234,179,8,0.35)' },
      });

      setLoading(true);
      setFeedback(null);
      const moveId = `${Date.now()}-${sourceSquare}-${targetSquare}`;
      setMoveHistory(history => [...history, {
        id: moveId,
        actor: 'human',
        san: move.san,
        quality: null,
      }]);
      if (!moveResult && gameCopy.turn() !== playerColor[0]) {
        playAiTurn(gameCopy.fen(), difficulty, [...moveHistory, { actor: 'human', san: move.san }]);
      }
      fetch(`${BACKEND_URL}/api/evaluate-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fenBefore, fenAfter, moveSAN: move.san }),
      })
        .then(async (res) => {
          const data = await res.json();
          setMoveHistory(history => history.map(historyMove => (
            historyMove.id === moveId
              ? {
                ...historyMove,
                quality: data.moveQuality,
                explanation: data.explanation,
                improvementAdvice: data.improvementAdvice,
                scoreDiff: data.scoreDiff,
              }
              : historyMove
          )));
          setLastMoveSquares({
            [sourceSquare]: { background: moveHighlight(data.moveQuality, 'human') },
            [targetSquare]: { background: moveHighlight(data.moveQuality, 'human') },
          });
          setFeedback({ ...data, moveSAN: move.san });
          if (moveResult) {
            setGameResult(moveResult);
            setStrategyFocus(selectStrategy(moveResult, playerColor));
          }
        })
        .catch(() => {
          setFeedback({ error: 'Could not reach the backend.' });
          if (moveResult) {
            setGameResult(moveResult);
            setStrategyFocus(selectStrategy(moveResult, playerColor));
          }
        })
        .finally(() => {
          setLoading(false);
        });

      return true;
    },
    [difficulty, game, gameStarted, moveHistory, playAiTurn, playerColor]
  );

  const resetGame = useCallback(() => {
    const initialPosition = new Chess().fen();
    setGame(initialPosition);
    setFeedback(null);
    setLastMoveSquares({});
    setLoading(false);
    setGameResult(null);
    setMoveHistory([]);
    setStrategyFocus('Complete a game to receive a strategy focus.');
    setGameStarted(false);
  }, []);

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-logo">♟</span>
        <h1 className="app-title">Chess Move Tutor</h1>
      </header>

      <main className="app-main">
        <div className="board-column">
          <div className="game-controls" aria-label="Game settings">
            <label>
              Your color
              <select value={playerColor} onChange={handleColorChange}>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </label>
            <label>
              Maximum difficulty
              <select value={difficulty} onChange={event => setDifficulty(event.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced - Expert</option>
              </select>
            </label>
          </div>
          <div className="board-wrapper">
            <Chessboard
              options={{
                position: game,
                boardOrientation: playerColor,
                canDragPiece: ({ isSparePiece }) => gameStarted && !isSparePiece,
                onPieceDrop: onDrop,
                boardWidth,
                customSquareStyles: lastMoveSquares,
                darkSquareStyle: { backgroundColor: '#4b5563' },
                lightSquareStyle: { backgroundColor: '#f4f4f5' },
                boardStyle: {
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                },
              }}
            />
          </div>
          <button className="reset-btn" onClick={gameStarted ? resetGame : startGame}>
            {gameStarted ? 'Reset Game' : 'Start Game'}
          </button>
        </div>

        <div className="panel-column">
          <FeedbackPanel
            feedback={feedback}
            loading={loading}
            gameResult={gameResult}
            moveHistory={moveHistory}
            playerColor={playerColor}
            strategyFocus={strategyFocus}
          />
        </div>
      </main>
    </div>
  );
}
