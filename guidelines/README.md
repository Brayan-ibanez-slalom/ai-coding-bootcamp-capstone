# Project Guidelines

This folder contains the working standards for Chess Move Tutor. The guidelines describe the visual language for the React client and the checks required before changes are pushed.

## Documents

- [UI design guidelines](UI_DESIGN.md): color, typography, spacing, shapes, borders, states, responsive behavior, accessibility, and chess-specific interaction patterns.
- [Testing guidelines](TESTING.md): local test commands, manual smoke checks, API checks, and the pre-push quality gate.
- [LLM agent handoff](LLM_AGENT_HANDOFF.md): the exact project architecture, contracts, behavior, security rules, and validation scenarios for another coding agent.

## Definition of Done

A change is ready to push when:

1. The relevant frontend tests pass.
2. The frontend production build completes successfully when UI or build configuration changed.
3. The backend starts successfully and its evaluation endpoint responds correctly when backend code changed.
4. The application is opened in a browser and the primary move workflow is verified when user-facing behavior changed.
5. The UI remains consistent with [UI_DESIGN.md](UI_DESIGN.md), including responsive and keyboard/focus behavior where applicable.
6. The final git diff contains only intentional changes.
