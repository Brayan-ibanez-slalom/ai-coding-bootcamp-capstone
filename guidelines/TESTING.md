# Testing Guidelines

Testing is part of the push workflow. Every change should be checked at the narrowest useful level, then the complete app should be started and exercised when behavior or UI has changed.

## Current Test Surface

- Frontend tests use Jest through Create React App and React Testing Library.
- The existing frontend tests verify the title, reset button, and initial feedback prompt.
- The backend currently has no real automated test suite. Its `npm test` script is a placeholder that exits with an error, so it must not be reported as a passing backend test.

## Before Every Push

Run the applicable commands from the repository root:

```bash
cd frontend
npm test -- --watchAll=false
npm run build
```

For backend changes, start the API in a separate terminal:

```bash
cd backend
npm start
```

For frontend changes, start the client in another terminal:

```bash
cd frontend
npm start
```

Then open `http://localhost:3000` and perform the manual smoke test below. Stop local servers after verification if they are no longer needed.

## Manual Application Smoke Test

This check confirms that the app is actually running, not merely compiling:

1. The page loads at `http://localhost:3000` without a blank screen or uncaught startup error.
2. The title, chessboard, feedback panel, and reset button are visible.
3. Drag a legal opening move such as `e2` to `e4`.
4. The board updates immediately and the source/destination squares are highlighted.
5. The feedback panel enters a loading state and then displays move quality, scores, best move, and an explanation.
6. Drag an illegal move and confirm the board and feedback do not advance.
7. Click **Reset Game** and confirm the initial board and empty feedback prompt return.
8. Resize the browser to a narrow viewport and verify that content remains readable, contained, and free of horizontal overflow.
9. Use keyboard navigation for every newly added control and confirm a visible focus indicator.

If the frontend cannot reach the API, verify that the backend is listening on port `4000` and that `REACT_APP_BACKEND_URL` matches the configured port.

## Backend API Smoke Test

With the backend running, verify the endpoint directly:

```bash
curl -i -X POST http://localhost:4000/api/evaluate-move \
  -H 'Content-Type: application/json' \
  -d '{
    "fenBefore": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "fenAfter": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    "moveSAN": "e4"
  }'
```

Expected behavior:

- HTTP `200` for a complete request.
- A JSON body containing `scoreBefore`, `scoreAfter`, `scoreDiff`, `moveQuality`, `bestMove`, and `explanation`.
- HTTP `400` when any required field is missing.

The endpoint should also be checked for malformed FEN once server-side validation is implemented. At present, malformed FEN handling is a known gap.

## Test Selection

- **Copy or styling only:** run the frontend tests and inspect the changed UI in a browser.
- **React behavior:** run frontend tests, build, and the manual smoke test.
- **Backend evaluator or API:** run the frontend tests, backend API smoke test, and the manual move workflow.
- **Dependency or configuration change:** run frontend tests, production build, backend startup, and the manual smoke test.
- **Cross-cutting change:** run all checks in this document and review the full diff.

## Test Quality Rules

- Test user-visible behavior rather than private implementation details.
- Keep tests deterministic and independent of network access when unit testing React components.
- Mock the API for frontend tests that exercise loading, success, and failure states.
- Add boundary tests for all move-quality thresholds: `-20`, `-21`, `-60`, `-61`, `-150`, and `-151` centipawns.
- Add API tests for missing fields, valid FEN, malformed FEN, and unexpected server errors.
- Include at least one regression test for every bug fixed.
- Do not claim that a check passed if it was skipped or if a script is only a placeholder.

## Required Future Automation

Before relying on CI as the only pre-push gate, add a real backend test command and automate the smoke checks. A good next step is to:

1. Extract the evaluator and classification functions into testable modules.
2. Use a test runner such as Jest or Node's built-in test runner for API contract tests.
3. Use a browser automation tool for the startup and move workflow smoke test.
4. Add a single root command that runs frontend tests, the frontend build, backend tests, and the browser smoke test in a clean environment.
5. Run that command in continuous integration and document it here as the canonical pre-push check.

Until then, the manual application smoke test is mandatory for user-facing changes.
