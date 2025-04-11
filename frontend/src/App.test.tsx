import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders without crashing and displays expected content', () => {
    render(<App />);
    // Adjust the text below to match something visible in your App component
    expect(screen.getByText(/calendar/i)).toBeInTheDocument();
  });
});
