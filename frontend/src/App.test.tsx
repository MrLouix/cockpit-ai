import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useTasks', () => ({
  useSessions: () => ({ data: [], isLoading: false, error: null }),
  useTasks: () => ({ data: [], isLoading: false, error: null }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useSkipTask: () => ({ mutate: vi.fn() }),
  useResumeTask: () => ({ mutate: vi.fn() }),
  useCreateSession: () => ({ mutate: vi.fn() }),
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  KEYS: { tasks: ['tasks'], sessions: ['sessions'] },
}));

vi.mock('./hooks/useDarkMode', () => ({ useDarkMode: () => ({ isDark: false }) }));

beforeEach(() => {
  localStorage.clear();
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });

  it('shows Tableau, Cartes, and Chat view toggle buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Tableau' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
  });

  it('switches to chat view when Chat button is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });

  it('switches back to table view after clicking Tableau', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Tableau' }));
    expect(screen.queryByTestId('chat-view')).not.toBeInTheDocument();
  });

  it('persists chat viewMode to localStorage', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(localStorage.getItem('cockpitai_viewmode')).toBe('chat');
  });

  it('restores chat viewMode from localStorage on mount', () => {
    localStorage.setItem('cockpitai_viewmode', 'chat');
    render(<App />);
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });
});
