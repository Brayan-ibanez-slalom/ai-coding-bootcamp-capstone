import { render, screen } from '@testing-library/react';
import App from './App';

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
