import { fireEvent, render, screen } from '@testing-library/react';
import App, { getGameResult, getResultMessage } from './App';
import { Chess } from 'chess.js';

test('renders app title', () => {
  render(<App />);
  expect(screen.getByText(/Chess Move Tutor/i)).toBeInTheDocument();
});

test('renders reset game button', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
  expect(await screen.findByRole('button', { name: /reset game/i })).toBeInTheDocument();
});

test('renders initial feedback panel prompt', () => {
  render(<App />);
  expect(screen.getByText(/start a game to play and receive feedback/i)).toBeInTheDocument();
});

test('requires the player to start before playing', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /reset game/i })).not.toBeInTheDocument();
});

test('renders player color and difficulty controls', () => {
  render(<App />);
  expect(screen.getByRole('combobox', { name: /your color/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /advanced/i })).toBeInTheDocument();
});

test('congratulates the winner and supports the player after a loss', () => {
  const whiteWin = new Chess();
  ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'].forEach(move => whiteWin.move(move));
  const blackWin = new Chess();
  ['f3', 'e5', 'g4', 'Qh4#'].forEach(move => blackWin.move(move));

  expect(getResultMessage(getGameResult(whiteWin), 'white')).toMatch(/Congratulations/);
  expect(getResultMessage(getGameResult(blackWin), 'white')).toMatch(/Keep practicing/);
  expect(getResultMessage(getGameResult(blackWin), 'white')).not.toMatch(/Congratulations/);
});

test('reports a neutral message for a draw', () => {
  const draw = new Chess('8/8/8/8/8/8/4k3/4K3 w - - 0 1');
  const result = getGameResult(draw);

  expect(result.type).toBe('draw');
  expect(getResultMessage(result, 'white')).toMatch(/Draw by insufficient material/);
  expect(getResultMessage(result, 'white')).not.toMatch(/Congratulations/);
});
