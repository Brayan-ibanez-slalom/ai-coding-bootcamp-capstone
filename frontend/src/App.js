import React, { useState, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

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

function GameResult({ result, moveHistory, playerColor }) {
  if (!result) return null;

  const humanMoves = moveHistory.filter(move => move.actor === 'human');
  const errors = humanMoves.filter(move => ['inaccuracy', 'mistake', 'blunder'].includes(move.quality));
  const goodMoves = humanMoves.filter(move => move.quality === 'good');
  const improvement = errors.some(move => move.quality === 'blunder')
    ? 'Focus on checking your opponent\'s immediate threats before every move.'
    : errors.some(move => move.quality === 'mistake')
      ? 'Compare candidate moves and look for checks, captures, and threats.'
      : 'Keep practicing your opening principles and review your candidate moves.';
  const resultMessage = getResultMessage(result, playerColor);

  return (
    <section className={`game-result ${result.type}`} role="status">
      <h2>{result.type === 'win' ? 'Game Complete' : 'Match Drawn'}</h2>
      <p>{resultMessage}</p>
      <div className="total-feedback">
        <h3>Total Feedback</h3>
        <p>You played {humanMoves.length} move{humanMoves.length === 1 ? '' : 's'}.</p>
        <p>{goodMoves.length} good, {errors.length} move{errors.length === 1 ? '' : 's'} to review.</p>
        {errors.length > 0 && (
          <p className="error-summary">Review: {errors.map(move => `${move.san} (${move.quality})`).join(', ')}</p>
        )}
        <p className="improvement-summary"><strong>Next focus:</strong> {improvement}</p>
      </div>
      <p className="result-prompt">Start a new game with Reset Game.</p>
    </section>
  );
}

function FeedbackPanel({ feedback, loading, gameResult, moveHistory, playerColor }) {
  if (gameResult) {
    return (
      <div className="feedback-panel">
        <GameResult result={gameResult} moveHistory={moveHistory} playerColor={playerColor} />
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
        <p className="muted">Make a move to see feedback.</p>
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
  const [playerColor, setPlayerColor] = useState('white');
  const [difficulty, setDifficulty] = useState('beginner');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [gameResult, setGameResult] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);

  const playAiTurn = useCallback(async (position, selectedDifficulty) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: position, difficulty: selectedDifficulty }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const aiGame = new Chess(position);
      const aiMove = aiGame.move(data.moveSAN);
      setGame(aiGame.fen());
      setGameResult(getGameResult(aiGame));
      setMoveHistory(history => [...history, { actor: 'ai', san: aiMove.san }]);
      setLastMoveSquares({
        [aiMove.from]: { background: moveHighlight('ai move', 'ai') },
        [aiMove.to]: { background: moveHighlight('ai move', 'ai') },
      });
      setFeedback({
        actor: 'ai',
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
  }, []);

  const handleColorChange = useCallback(event => {
    const selectedColor = event.target.value;
    const initialPosition = new Chess().fen();
    setPlayerColor(selectedColor);
    setGame(initialPosition);
    setFeedback(null);
    setLastMoveSquares({});
    setLoading(false);
    setGameResult(null);
    setMoveHistory([]);
    if (selectedColor === 'black') playAiTurn(initialPosition, difficulty);
  }, [difficulty, playAiTurn]);

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      if (!targetSquare) return false;

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
      setGameResult(moveResult);
      setLastMoveSquares({
        [sourceSquare]: { background: 'rgba(234,179,8,0.35)' },
        [targetSquare]: { background: 'rgba(234,179,8,0.35)' },
      });

      setLoading(true);
      setFeedback(null);
      fetch(`${BACKEND_URL}/api/evaluate-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fenBefore, fenAfter, moveSAN: move.san }),
      })
        .then(async (res) => {
          const data = await res.json();
          setMoveHistory(history => [...history, {
            actor: 'human',
            san: move.san,
            quality: data.moveQuality,
          }]);
          setLastMoveSquares({
            [sourceSquare]: { background: moveHighlight(data.moveQuality, 'human') },
            [targetSquare]: { background: moveHighlight(data.moveQuality, 'human') },
          });
          setFeedback({ ...data, moveSAN: move.san });
        })
        .catch(() => {
          setFeedback({ error: 'Could not reach the backend.' });
        })
        .finally(() => {
          setLoading(false);
          if (!moveResult && gameCopy.turn() !== playerColor[0]) {
            playAiTurn(gameCopy.fen(), difficulty);
          }
        });

      return true;
    },
    [difficulty, game, playAiTurn, playerColor]
  );

  const resetGame = useCallback(() => {
    const initialPosition = new Chess().fen();
    setGame(initialPosition);
    setFeedback(null);
    setLastMoveSquares({});
    setLoading(false);
    setGameResult(null);
    setMoveHistory([]);
    if (playerColor === 'black') playAiTurn(initialPosition, difficulty);
  }, [difficulty, playAiTurn, playerColor]);

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
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <div className="board-wrapper">
            <Chessboard
              options={{
                position: game,
                boardOrientation: playerColor,
                onPieceDrop: onDrop,
                boardWidth: 480,
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
          <button className="reset-btn" onClick={resetGame}>
            Reset Game
          </button>
        </div>

        <div className="panel-column">
          <FeedbackPanel
            feedback={feedback}
            loading={loading}
            gameResult={gameResult}
            moveHistory={moveHistory}
            playerColor={playerColor}
          />
        </div>
      </main>
    </div>
  );
}
