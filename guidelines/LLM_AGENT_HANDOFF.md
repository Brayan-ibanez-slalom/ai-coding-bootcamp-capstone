# LLM Agent Handoff Specification

This document is a reproduction contract for an LLM coding agent. A new agent should be able to rebuild the project behavior from this document, the repository structure, and the existing source files without guessing about the product intent.

## Product Goal

Build Chess Move Tutor, a browser chess-learning experience where a human chooses a side, plays against an AI opponent, receives human-move coaching, and gets a final match review.

The experience should be direct and usable on first load:

1. The player chooses White or Black.
2. The player selects a maximum difficulty: Beginner, Intermediate, or Advanced.
3. The chosen player color stays at the bottom of the board.
4. The player clicks `Start Game` after selecting settings.
5. If the player chooses Black, the AI makes the first White move.
6. The human can drag legal pieces only on the human turn.
7. The AI responds after each human move.
8. The match ends visibly on checkmate or draw.

## Exact Stack

| Area | Technology | Version/policy |
| --- | --- | --- |
| Runtime | Node.js | 22 LTS recommended; `.nvmrc` contains `22` |
| UI | React | `19.2.8` |
| Build/test | Create React App | `react-scripts 5.0.1` |
| Board | `react-chessboard` | `5.12.1`; uses `options` prop |
| Rules | `chess.js` | `1.4.0` |
| API | Express | `5.2.1` |
| CORS | `cors` | `2.8.6` |
| Environment | `dotenv` | `17.4.2` |
| AI client | `@aws-sdk/client-bedrock-runtime` | `3.1000.0` |
| AI model | AWS Bedrock | Default `amazon.nova-pro-v1:0` |

Direct dependency versions are exact. The repository policy currently ignores `backend/package-lock.json` and `frontend/package-lock.json`; local installs use `npm install`, not `npm ci`.

## Required Repository Shape

```text
.
├── .nvmrc
├── .gitignore
├── AGENTS.md
├── README.md
├── backend/
│   ├── .env.example
│   ├── .gitignore
│   ├── index.js
│   ├── package.json
│   └── package-lock.json       # local only, ignored by Git
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.js
│       ├── App.css
│       └── App.test.js
└── guidelines/
    ├── README.md
    ├── TESTING.md
    ├── UI_DESIGN.md
    └── LLM_AGENT_HANDOFF.md
```

`.project-memory/` and `backend/.env` are local-only and ignored. `backend/.env.example` is shareable and must not contain real credentials.

## Backend Contract

### `POST /api/evaluate-move`

Request:

```json
{
  "fenBefore": "valid FEN before the human move",
  "fenAfter": "valid FEN after the human move",
  "moveSAN": "e4"
}
```

Response fields:

```json
{
  "scoreBefore": 0,
  "scoreAfter": 0,
  "scoreDiff": 0,
  "moveQuality": "good",
  "bestMove": "e4",
  "explanation": "...",
  "improvementAdvice": "..."
}
```

The current score is a lightweight heuristic in centipawns. It combines material values with center control, minor-piece development, legal mobility, castling rights, opening discipline, checks, captures, and immediate tactical danger. The score difference is transformed to the moving side's perspective. Strict quality thresholds are `good >= 5`, `inaccuracy >= -20`, `mistake >= -90`, otherwise `blunder`. It is not a substitute for a full chess engine.

Human feedback must never be blank. Use deterministic fallback explanations/advice when an LLM is unavailable.

### `POST /api/ai-move`

Request:

```json
{
  "fen": "current valid FEN",
  "difficulty": "beginner"
}
```

Allowed difficulties: `beginner`, `intermediate`, `advanced`.

The backend sends the side to move, FEN, recent SAN move history, difficulty ceiling, and complete legal UCI move list to Bedrock. Advanced mode requests at least five-ply calculation, comparison of at least five candidates, tactical refutations, and no intentionally passive inaccuracies. It uses low temperature and a larger response budget than Beginner. It expects strict JSON:

```json
{
  "move": "e7e5",
  "advice": "one short sentence"
}
```

The proposed move is validated with `chess.js` before returning SAN to the frontend. Retry one invalid/empty response. If Bedrock still fails, return a strategically prioritized legal `chess.js` move with `aiFallback: true` and explicit fallback advice. The fallback scores checkmate, checks, captures, promotions, castling, central moves, active development, and the resulting one-ply position. Return HTTP 503 only when no legal fallback exists.

## Frontend State Model

`App` should own:

- `game`: current FEN string.
- `playerColor`: `white` or `black`.
- `difficulty`: selected maximum difficulty.
- `feedback`: current human coaching or AI advice.
- `loading`: active evaluation/AI request.
- `lastMoveSquares`: semantic latest-move highlights.
- `gameResult`: win or draw result.
- `moveHistory`: entries with actor (`human` or `ai`), SAN, and human quality.

Use the `react-chessboard 5.12.1` API exactly:

```jsx
<Chessboard
  options={{
    position: game,
    boardOrientation: playerColor,
    onPieceDrop: onDrop,
  }}
/>
```

`onPieceDrop` receives one object and returns a synchronous boolean. Apply a legal move to React state immediately, then perform evaluation asynchronously.

## Feedback Rules

- Human move: show `Move Feedback`, quality, evaluation, `Coach Explanation`, and `How to Improve`.
- AI move: show `AI Move` and `AI Advice`; do not label AI advice as human coaching.
- AI moves use blue square highlights.
- Human quality highlights use green/yellow/orange/red.
- A failed AI request should not stop the match if a legal fallback exists.
- At terminal state, show `Game Complete` for checkmate or `Match Drawn` for draws.
- If the selected player won, append `Congratulations!`.
- If the selected player lost, use a supportive review message without congratulations.
- Include `Total Feedback`: human move count, good count, moves to review, reviewed SAN moves, and next practice focus.

## Terminal State Rules

After every applied human or AI move, evaluate:

- `isCheckmate()` and winner from the side that just moved.
- `isStalemate()`.
- `isThreefoldRepetition()`.
- `isInsufficientMaterial()`.
- `isDraw()`.

Do not request another AI move after a terminal result. Keep the final board position visible and leave Reset Game available.

For reliable threefold-repetition detection, preserve move history in the `Chess` instance or track position repetition keys. Reconstructing only from FEN loses prior repetition history.

## Secure Configuration

Use `backend/.env.example` as the template:

```env
AWS_REGION=us-east-2
AWS_BEARER_TOKEN_BEDROCK=replace-with-a-new-bedrock-token
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
PORT=4000
```

Never commit `backend/.env`, expose credentials through React, use `REACT_APP_*` for secrets, print token values, or paste a real token into an agent prompt. Replace a token immediately if exposed, revoked, expired, suspected compromised, or due for scheduled rotation. Restart the backend after changing it.

## UI Rules

Use `guidelines/UI_DESIGN.md` as the visual authority. Preserve:

- Deep neutral background with high-contrast text.
- Blue primary action and AI highlight.
- Semantic quality colors paired with text labels.
- Modest radii and restrained borders/shadows.
- Stable board dimensions.
- Responsive controls and visible focus states.
- No overlapping or clipped text.

## Reproduction and Validation

From the repository root:

```bash
cd backend
npm install
npm start
```

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3000`.

Automated checks:

```bash
cd frontend
CI=true npm test -- --watchAll=false
npm run build
cd ../backend
node --check index.js
```

Manual checks:

1. Choose White, move `e2` to `e4`, and confirm the piece remains on `e4`.
2. Choose settings, click `Start Game`, and confirm the board becomes interactive.
3. Choose Black, click `Start Game`, and confirm Black is at the bottom and AI makes the opening move.
4. Play at least three human/AI turns.
5. Confirm AI advice is separate from human coaching.
6. Trigger or simulate a Bedrock failure and confirm a legal fallback continues the match.
7. Verify Scholar's Mate reports a White win and congratulates the White player.
8. Verify Fool's Mate reports a Black win and does not congratulate a White player.
9. Verify a draw reports a neutral draw message.
10. Confirm final feedback totals and error highlights are visible.
11. Run `git diff --check` before committing.

## Agent Completion Criteria

An LLM agent has reproduced the project correctly when the repository starts with the commands above, legal moves persist, the selected side stays at the bottom, the AI can continue beyond three turns, feedback is actor-specific, terminal messages identify wins/losses/draws correctly, secrets remain server-side, and all automated checks pass.
