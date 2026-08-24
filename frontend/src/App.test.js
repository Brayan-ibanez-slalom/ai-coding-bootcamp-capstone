import { render, screen } from '@testing-library/react';
import App, { getGameResult, getResultMessage } from './App';
import { Chess } from 'chess.js';

test('renders app title', () => {
  render(<App />);
  expect(screen.getByText(/Chess Move Tutor/i)).toBeInTheDocument();
});

test('renders reset game button', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /reset game/i })).toBeInTheDocument();
});

test('renders initial feedback panel prompt', () => {
  render(<App />);
  expect(screen.getByText(/make a move to see feedback/i)).toBeInTheDocument();
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
