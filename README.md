# Chess Move Tutor

A local web-based Chess Move Tutor with a clean, dark-themed UI. Make moves on the board and receive instant feedback from the coach panel.

## Tech Stack

| Layer    | Technology                                |
|----------|-------------------------------------------|
| Frontend | React, react-chessboard, chess.js         |
| Backend  | Node.js, Express, chess.js                |

---

## Project Structure

```
ai-coding-bootcamp-capstone/
├── backend/          # Express API server
│   ├── index.js
│   └── package.json
└── frontend/         # React app
    ├── src/
    │   ├── App.js    # Board + Feedback panel
    │   └── App.css   # Dark theme styles
    └── package.json
```

---

## Running Locally

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### 1. Start the Backend

```bash
cd backend
npm install
npm start
# Server listens on http://localhost:4000
```

### 2. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm start
# App opens at http://localhost:3000
```

---

## How It Works

1. Drag and drop a piece on the board to make a move.
2. The frontend sends `fenBefore`, `fenAfter`, and `moveSAN` to `POST /api/evaluate-move`.
3. The backend evaluates the position (stubbed material-count heuristic) and returns:
   - `scoreBefore`, `scoreAfter`, `scoreDiff` (centipawns)
   - `moveQuality`: `good` | `inaccuracy` | `mistake` | `blunder`
   - `bestMove` (stubbed — echoes the played move)
   - `explanation` — a coaching sentence
4. The feedback panel displays the evaluation with color-coded quality badges.

### Move Quality Thresholds

| Quality     | Score diff (cp) | Color  |
|-------------|----------------|--------|
| good        | ≥ −20          | green  |
| inaccuracy  | ≥ −60          | yellow |
| mistake     | ≥ −150         | orange |
| blunder     | < −150         | red    |

---

## UI Theme

| Token              | Value     |
|--------------------|-----------|
| Background         | `#0f172a` |
| Surface / panels   | `#111827` |
| Primary accent     | `#3b82f6` |
| Secondary accent   | `#f97316` |
| Board light sq.    | `#f4f4f5` |
| Board dark sq.     | `#4b5563` |
| Good move          | `#22c55e` |
| Inaccuracy         | `#eab308` |
| Mistake            | `#f97316` |
| Blunder            | `#ef4444` |
