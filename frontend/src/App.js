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

function ScoreBar({ label, value }) {
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <span className="score-value">{value > 0 ? `+${value}` : value} cp</span>
    </div>
  );
}

function FeedbackPanel({ feedback, loading }) {
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

  const { moveSAN, moveQuality, scoreBefore, scoreAfter, scoreDiff, bestMove, explanation } = feedback;

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
      </section>
    </div>
  );
}

export default function App() {
  const [game, setGame] = useState(new Chess());
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState({});

  const onDrop = useCallback(
    async (sourceSquare, targetSquare) => {
      const gameCopy = new Chess(game.fen());
      const fenBefore = gameCopy.fen();

      let move;
      try {
        move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      } catch {
        return false;
      }
      if (!move) return false;

      const fenAfter = gameCopy.fen();
      setGame(gameCopy);
      setLastMoveSquares({
        [sourceSquare]: { background: 'rgba(234,179,8,0.35)' },
        [targetSquare]: { background: 'rgba(234,179,8,0.35)' },
      });

      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`${BACKEND_URL}/api/evaluate-move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fenBefore, fenAfter, moveSAN: move.san }),
        });
        const data = await res.json();
        setFeedback({ ...data, moveSAN: move.san });
      } catch (err) {
        setFeedback({ error: 'Could not reach the backend.' });
      } finally {
        setLoading(false);
      }

      return true;
    },
    [game]
  );

  const resetGame = useCallback(() => {
    setGame(new Chess());
    setFeedback(null);
    setLastMoveSquares({});
    setLoading(false);
  }, []);

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-logo">♟</span>
        <h1 className="app-title">Chess Move Tutor</h1>
      </header>

      <main className="app-main">
        <div className="board-column">
          <div className="board-wrapper">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              boardWidth={480}
              customSquareStyles={lastMoveSquares}
              customDarkSquareStyle={{ backgroundColor: '#4b5563' }}
              customLightSquareStyle={{ backgroundColor: '#f4f4f5' }}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />
          </div>
          <button className="reset-btn" onClick={resetGame}>
            Reset Game
          </button>
        </div>

        <div className="panel-column">
          <FeedbackPanel feedback={feedback} loading={loading} />
        </div>
      </main>
    </div>
  );
}
