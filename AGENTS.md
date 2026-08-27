# Chess Move Tutor Agent Instructions

## Project Context

Chess Move Tutor is a two-process Node.js application:

- `frontend/`: React 19 UI using `react-chessboard` and `chess.js`.
- `backend/`: Express API using `chess.js`, `dotenv`, and AWS Bedrock Converse.
- `guidelines/`: UI, testing, and agent handoff documentation.

The browser owns the visible board state. The backend owns move evaluation and AI move generation. Never expose AWS credentials to the browser.

## Runtime and Commands

- Use Node 22 LTS, declared in `.nvmrc`.
- Install dependencies independently with `npm install` in `backend/` and `frontend/`.
- Start the API with `cd backend && npm start`.
- Start the UI with `cd frontend && npm start`.
- Run frontend checks with `cd frontend && CI=true npm test -- --watchAll=false && npm run build`.
- Validate backend syntax with `cd backend && node --check index.js`.
- Run a live application smoke test after user-facing changes.

The project intentionally does not track `package-lock.json`; do not re-add those files unless the project policy changes. Local dependency folders, builds, `.env`, and `.project-memory/` are not source artifacts.

## Behavioral Contracts

- `react-chessboard` v5 receives all board configuration through its `options` prop.
- `onPieceDrop` receives `{ sourceSquare, targetSquare, piece }` and must return a synchronous boolean.
- Store the board position as a FEN string so React receives an explicit controlled-position update.
- Validate all human and AI moves with `chess.js` before applying them.
- Keep the selected player color at the bottom of the board.
- Do not allow a human move when it is the AI side's turn.
- On Bedrock failure or invalid model output, play a validated legal fallback move when one exists and identify it clearly in the UI.
- Stop play after checkmate, stalemate, repetition, insufficient material, or another draw condition.
- Congratulate the player only when the selected player wins. Use a supportive learning message after a loss.
- `Coach Explanation` and improvement advice are for human moves only. AI output belongs under `AI Advice`.

## Bedrock Rules

- Keep Bedrock calls in `backend/index.js` or a backend-only module.
- Use `BEDROCK_MODEL_ID` with default `amazon.nova-pro-v1:0`.
- Load local values from ignored `backend/.env`; use `backend/.env.example` as the shareable template.
- Never print, commit, or paste a real token. Replace exposed or expired tokens immediately.
- Validate model output as strict JSON and validate the proposed move against legal moves from the supplied FEN.
- Return generic client errors; do not expose AWS exception details.

## Change Workflow

Before editing, identify the local owner of the behavior and one focused validation. After the first substantive edit, run that validation before expanding scope. Keep changes small and preserve existing UI and API contracts unless the request explicitly changes them.

Before pushing:

1. Run frontend tests and production build.
2. Run backend syntax validation.
3. Start both services and exercise a legal move in the browser.
4. Test player color changes, AI turns, fallback behavior, and terminal result messaging when relevant.
5. Run `git diff --check` and review `git status`.

See `guidelines/LLM_AGENT_HANDOFF.md` for the full reproduction specification and test scenarios.
