import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AppHeader } from '../AppHeader';
import type { Session } from '../../types';

vi.mock('../LogoPunchline', () => ({ LogoPunchline: () => <span>Logo</span> }));
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => <button>Theme</button> }));

const makeSession = (id: string, directory: string, titre: string): Session => ({
  _id: id,
  directory,
  titre,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const sessions: Session[] = [
  makeSession('s1', '/projects/alpha', 'Alpha Chat 1'),
  makeSession('s2', '/projects/alpha', 'Alpha Chat 2'),
  makeSession('s3', '/projects/beta', 'Beta Chat 1'),
];

const defaultProps = {
  currentTitle: 'Tous les chats',
  sessions,
  selectedSessionId: '',
  selectedDirectory: '',
  onSelectSession: vi.fn(),
  onNewProject: vi.fn(),
  onNewChat: vi.fn(),
  viewMode: 'cards' as const,
  onViewChange: vi.fn(),
  onNewTask: vi.fn(),
};

afterEach(() => vi.clearAllMocks());

describe('AppHeader — dropdown toggle', () => {
  it('opens dropdown on burger button click', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Mon titre" />);
    // Project names not visible before dropdown opens
    expect(screen.queryByText('Alpha Chat 1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mon titre/ }));
    expect(screen.getByText('Alpha Chat 1')).toBeInTheDocument();
  });

  it('shows "Tous les chats" option in dropdown', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Mon chat" />);
    await user.click(screen.getByRole('button', { name: /Mon chat/ }));
    expect(screen.getByText('Tous les chats')).toBeInTheDocument();
  });
});

describe('AppHeader — "Tous les chats" highlighted state', () => {
  it('highlights "Tous les chats" when selectedSessionId is empty', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} selectedSessionId="" currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    const tousBtn = screen.getByRole('button', { name: 'Tous les chats' });
    expect(tousBtn.className).toContain('bg-indigo-50');
  });

  it('does not highlight "Tous les chats" when a session is selected', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} selectedSessionId="s1" currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    const tousBtn = screen.getByRole('button', { name: 'Tous les chats' });
    expect(tousBtn.className).not.toContain('bg-indigo-50');
  });
});

describe('AppHeader — hierarchical project/chat grouping', () => {
  it('shows project folder headers', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('shows chat entries under their project', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    expect(screen.getByText('Alpha Chat 1')).toBeInTheDocument();
    expect(screen.getByText('Alpha Chat 2')).toBeInTheDocument();
    expect(screen.getByText('Beta Chat 1')).toBeInTheDocument();
  });

  it('shows "Nouveau chat" button for each project', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    const newChatBtns = screen.getAllByText('Nouveau chat');
    expect(newChatBtns).toHaveLength(2); // one per project
  });
});

describe('AppHeader — "Nouveau chat" button', () => {
  it('calls onNewChat with the correct directory', async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    render(<AppHeader {...defaultProps} onNewChat={onNewChat} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    const newChatBtns = screen.getAllByText('Nouveau chat');
    // First "Nouveau chat" belongs to the first directory (/projects/alpha)
    await user.click(newChatBtns[0]);
    expect(onNewChat).toHaveBeenCalledWith('/projects/alpha');
  });

  it('closes dropdown after clicking "Nouveau chat"', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    await user.click(screen.getAllByText('Nouveau chat')[0]);
    expect(screen.queryByText('Alpha Chat 1')).not.toBeInTheDocument();
  });
});

describe('AppHeader — "Nouveau projet" button', () => {
  it('calls onNewProject', async () => {
    const user = userEvent.setup();
    const onNewProject = vi.fn();
    render(<AppHeader {...defaultProps} onNewProject={onNewProject} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    await user.click(screen.getByText('Nouveau projet'));
    expect(onNewProject).toHaveBeenCalled();
  });

  it('closes dropdown after clicking "Nouveau projet"', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    await user.click(screen.getByText('Nouveau projet'));
    expect(screen.queryByText('Alpha Chat 1')).not.toBeInTheDocument();
  });
});

describe('AppHeader — session selection', () => {
  it('calls onSelectSession with session id when a chat is clicked', async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn();
    render(<AppHeader {...defaultProps} onSelectSession={onSelectSession} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    await user.click(screen.getByText('Alpha Chat 1'));
    expect(onSelectSession).toHaveBeenCalledWith('s1');
  });

  it('closes dropdown after clicking a chat', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    await user.click(screen.getByText('Alpha Chat 1'));
    expect(screen.queryByText('Alpha Chat 2')).not.toBeInTheDocument();
  });

  it('calls onSelectSession with empty string when "Tous les chats" is clicked', async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn();
    render(<AppHeader {...defaultProps} onSelectSession={onSelectSession} selectedSessionId="s1" currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    await user.click(screen.getByRole('button', { name: 'Tous les chats' }));
    expect(onSelectSession).toHaveBeenCalledWith('');
  });

  it('highlights the active session', async () => {
    const user = userEvent.setup();
    render(<AppHeader {...defaultProps} selectedSessionId="s2" currentTitle="Test" />);
    await user.click(screen.getByRole('button', { name: /Test/ }));
    const chatBtn = screen.getByText('Alpha Chat 2').closest('button')!;
    expect(chatBtn.className).toContain('bg-indigo-50');
  });
});

describe('AppHeader — "Nouvelle tâche" button', () => {
  it('shows "Nouvelle tâche" button when selectedSessionId is empty', () => {
    render(<AppHeader {...defaultProps} selectedSessionId="" />);
    expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument();
  });

  it('hides "Nouvelle tâche" button when a session is selected', () => {
    render(<AppHeader {...defaultProps} selectedSessionId="s1" />);
    expect(screen.queryByText('Nouvelle tâche')).not.toBeInTheDocument();
  });
});
