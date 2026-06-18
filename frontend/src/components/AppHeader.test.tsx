import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import type { Session } from '../types';

vi.mock('../hooks/useDarkMode', () => ({ useDarkMode: () => ({ isDark: false, toggle: vi.fn() }) }));

const makeSessions = (overrides: Partial<Session>[] = []): Session[] =>
  overrides.map((o, i) => ({
    _id: `s${i}`,
    directory: `/projects/proj${i}`,
    titre: `Project ${i}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...o,
  }));

const defaultProps = {
  currentTitle: 'Tous les projets',
  sessions: [] as Session[],
  selectedDirectory: '',
  onSelectDirectory: vi.fn(),
  viewMode: 'cards' as const,
  onViewChange: vi.fn(),
  onNewSession: vi.fn(),
  onNewTask: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppHeader', () => {
  it('renders without crashing with minimal props', () => {
    render(<AppHeader {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('displays the currentTitle in the burger button', () => {
    render(<AppHeader {...defaultProps} currentTitle="My Project" />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders the cockpitAI brand text', () => {
    render(<AppHeader {...defaultProps} />);
    expect(screen.getByText('cockpit')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('calls onNewSession when "Nouveau projet" is clicked in the burger menu', () => {
    render(<AppHeader {...defaultProps} />);
    // Open burger menu
    fireEvent.click(screen.getByText('Tous les projets'));
    fireEvent.click(screen.getByText('Nouveau projet'));
    expect(defaultProps.onNewSession).toHaveBeenCalledTimes(1);
  });

  it('closes burger menu after clicking "Nouveau projet"', () => {
    render(<AppHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Tous les projets'));
    expect(screen.getByText('Nouveau projet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Nouveau projet'));
    expect(screen.queryByText('Nouveau projet')).not.toBeInTheDocument();
  });

  it('calls onNewTask when "Nouvelle tâche" button is clicked', () => {
    render(<AppHeader {...defaultProps} selectedDirectory="" />);
    // "Nouvelle tâche" button is only shown when no directory is selected
    const newTaskBtn = screen.getByRole('button', { name: /Nouvelle tâche/i });
    fireEvent.click(newTaskBtn);
    expect(defaultProps.onNewTask).toHaveBeenCalledTimes(1);
  });

  it('hides "Nouvelle tâche" button when a directory is selected', () => {
    render(<AppHeader {...defaultProps} selectedDirectory="/projects/foo" />);
    expect(screen.queryByRole('button', { name: /Nouvelle tâche/i })).not.toBeInTheDocument();
  });

  it('calls onViewChange("table") when Tableau button is clicked', () => {
    render(<AppHeader {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tableau' }));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('table');
  });

  it('calls onViewChange("cards") when Cartes button is clicked', () => {
    render(<AppHeader {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cartes' }));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('cards');
  });

  it('calls onViewChange("chat") when Chat button is clicked', () => {
    render(<AppHeader {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('chat');
  });

  it('lists sessions in the burger menu when opened', () => {
    const sessions = makeSessions([
      { titre: 'Alpha', directory: '/projects/alpha' },
      { titre: 'Beta', directory: '/projects/beta' },
    ]);
    render(<AppHeader {...defaultProps} sessions={sessions} />);
    fireEvent.click(screen.getByText('Tous les projets'));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onSelectDirectory with the session directory when a session is clicked', () => {
    const sessions = makeSessions([{ titre: 'Alpha', directory: '/projects/alpha' }]);
    render(<AppHeader {...defaultProps} sessions={sessions} />);
    fireEvent.click(screen.getByText('Tous les projets'));
    fireEvent.click(screen.getByText('Alpha'));
    expect(defaultProps.onSelectDirectory).toHaveBeenCalledWith('/projects/alpha');
  });

  it('calls onSelectDirectory("") when "Tous les projets" is clicked in the menu', () => {
    // Use a distinct currentTitle to avoid collision with the menu item text
    render(<AppHeader {...defaultProps} currentTitle="Mon Projet" selectedDirectory="/projects/foo" />);
    fireEvent.click(screen.getByText('Mon Projet'));
    fireEvent.click(screen.getByText('Tous les projets'));
    expect(defaultProps.onSelectDirectory).toHaveBeenCalledWith('');
  });

  it('shows the selectedDirectory badge when a directory is set', () => {
    render(<AppHeader {...defaultProps} selectedDirectory="/projects/foo" />);
    // Two badges exist (sm:hidden and hidden sm:inline-block), both render in jsdom
    const badges = screen.getAllByText('/projects/foo');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('does not show directory badges when selectedDirectory is empty', () => {
    render(<AppHeader {...defaultProps} selectedDirectory="" />);
    expect(screen.queryByText('/projects/foo')).not.toBeInTheDocument();
  });

  it('toggles the burger menu open and closed', () => {
    render(<AppHeader {...defaultProps} currentTitle="Mon Projet" />);
    // Initially closed
    expect(screen.queryByText('Nouveau projet')).not.toBeInTheDocument();
    // Open via burger trigger
    fireEvent.click(screen.getByText('Mon Projet'));
    expect(screen.getByText('Nouveau projet')).toBeInTheDocument();
    // Close by clicking trigger again
    fireEvent.click(screen.getByText('Mon Projet'));
    expect(screen.queryByText('Nouveau projet')).not.toBeInTheDocument();
  });
});
