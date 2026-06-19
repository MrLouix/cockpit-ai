import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import type { Session } from './types';

const mockUseSessions = vi.fn();
const mockUseCreateTask = vi.fn();

vi.mock('./hooks/useTasks', () => ({
  useSessions: () => mockUseSessions(),
  useTasks: () => ({ data: [], isLoading: false, error: null }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useSkipTask: () => ({ mutate: vi.fn() }),
  useResumeTask: () => ({ mutate: vi.fn() }),
  useCreateSession: () => ({ mutate: vi.fn() }),
  useCreateTask: () => mockUseCreateTask(),
  KEYS: { tasks: ['tasks'], sessions: ['sessions'] },
}));

vi.mock('./hooks/useDarkMode', () => ({ useDarkMode: () => ({ isDark: false }) }));

const noSessions = { data: [] as Session[], isLoading: false, error: null };

const withSession = (directory: string, titre: string): ReturnType<typeof mockUseSessions> => ({
  data: [{ _id: 's1', directory, titre, createdAt: '', updatedAt: '' }],
  isLoading: false,
  error: null,
});

beforeEach(() => {
  localStorage.clear();
  mockUseSessions.mockReturnValue(noSessions);
  mockUseCreateTask.mockReturnValue({ mutate: vi.fn(), isPending: false });
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
    // Use exact name 'Chat' to avoid matching the burger button "Tous les chats"
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
  });

  it('switches to chat view when Chat button is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });

  it('switches back to table view after clicking Tableau', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tableau' }));
    expect(screen.queryByTestId('chat-view')).not.toBeInTheDocument();
  });

  it('persists chat viewMode to localStorage', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(localStorage.getItem('cockpitai_viewmode')).toBe('chat');
  });

  it('restores chat viewMode from localStorage on mount', () => {
    localStorage.setItem('cockpitai_viewmode', 'chat');
    render(<App />);
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });
});

describe('App — AppHeader wiring', () => {
  it('renders the cockpitAI brand from AppHeader', () => {
    render(<App />);
    expect(screen.getByText('cockpit')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders view toggle buttons via AppHeader', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Tableau' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartes' })).toBeInTheDocument();
  });

  it('shows "Nouvelle tâche" button from AppHeader when no session is selected', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Nouvelle tâche/i })).toBeInTheDocument();
  });

  it('lists available sessions in the AppHeader burger menu', () => {
    mockUseSessions.mockReturnValue(withSession('/projects/foo', 'Foo Project'));
    render(<App />);
    // Open the burger (default title is "Tous les chats")
    fireEvent.click(screen.getByRole('button', { name: 'Tous les chats' }));
    expect(screen.getByText('Foo Project')).toBeInTheDocument();
  });
});

describe('App — QuickInputBar wiring', () => {
  it('does not render QuickInputBar when no session is selected', () => {
    render(<App />);
    expect(screen.queryByPlaceholderText('Décrivez la tâche…')).not.toBeInTheDocument();
  });

  it('renders QuickInputBar after selecting a session', () => {
    mockUseSessions.mockReturnValue(withSession('/projects/foo', 'Foo Project'));
    render(<App />);
    // Open burger and select the session chat
    fireEvent.click(screen.getByRole('button', { name: 'Tous les chats' }));
    fireEvent.click(screen.getByText('Foo Project'));
    expect(screen.getByPlaceholderText('Décrivez la tâche…')).toBeInTheDocument();
  });

  it('hides QuickInputBar after navigating back to "Tous les chats"', () => {
    mockUseSessions.mockReturnValue(withSession('/projects/foo', 'Foo Project'));
    render(<App />);
    // Select a session
    fireEvent.click(screen.getByRole('button', { name: 'Tous les chats' }));
    fireEvent.click(screen.getByText('Foo Project'));
    expect(screen.getByPlaceholderText('Décrivez la tâche…')).toBeInTheDocument();
    // Open burger (title is now "Foo Project")
    fireEvent.click(screen.getByRole('button', { name: 'Foo Project' }));
    // Click "Tous les chats" in dropdown (burger now shows "Foo Project", not "Tous les chats",
    // so this uniquely selects the dropdown deselect option)
    fireEvent.click(screen.getByRole('button', { name: 'Tous les chats' }));
    expect(screen.queryByPlaceholderText('Décrivez la tâche…')).not.toBeInTheDocument();
  });

  it('QuickInputBar send button is disabled when prompt is empty', () => {
    mockUseSessions.mockReturnValue(withSession('/projects/foo', 'Foo Project'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Tous les chats' }));
    fireEvent.click(screen.getByText('Foo Project'));
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });
});
