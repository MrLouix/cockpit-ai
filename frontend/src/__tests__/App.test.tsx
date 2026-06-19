import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeAll, afterEach } from 'vitest';
import type { Session, Task, TaskStatus } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeSession = (id: string, directory: string, createdAt = '2024-01-01T00:00:00Z'): Session => ({
  _id: id,
  directory,
  titre: `Session ${id}`,
  createdAt,
  updatedAt: '2024-01-01T00:00:00Z',
});

const makeTask = (id: string, sessionIdStr: string, status: TaskStatus): Task & { sessionIdStr: string } => ({
  _id: id,
  sessionId: sessionIdStr,
  sessionIdStr,
  prompt: `Task ${id}`,
  status,
  agent: 'hermes',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
} as any);

const alphaSession1 = makeSession('s1', '/projects/alpha', '2024-01-01T00:00:00Z');
const alphaSession2 = makeSession('s2', '/projects/alpha', '2024-01-02T00:00:00Z');
const betaSession = makeSession('s3', '/projects/beta');

const allSessions = [alphaSession1, alphaSession2, betaSession];

const allTasks = [
  makeTask('t1', 's1', 'pending'),
  makeTask('t2', 's1', 'success'),
  makeTask('t3', 's2', 'running'),
  makeTask('t4', 's3', 'failed'),
];

// ── Mocks ─────────────────────────────────────────────────────────────────────
let mockCreateSessionMutate = vi.fn();

vi.mock('../hooks/useTasks', () => ({
  useSessions: () => ({ data: allSessions, isLoading: false, error: null }),
  useTasks: () => ({ data: allTasks, isLoading: false, error: null }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useSkipTask: () => ({ mutate: vi.fn() }),
  useResumeTask: () => ({ mutate: vi.fn() }),
  useCreateSession: () => ({ mutate: mockCreateSessionMutate }),
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  KEYS: { sessions: ['sessions'], tasks: ['tasks'] },
}));

vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false }),
}));

vi.mock('../components/AppHeader', () => ({
  AppHeader: ({ onSelectSession, onNewProject, onNewChat, selectedSessionId }: any) => (
    <div data-testid="app-header">
      <span data-testid="header-session-id">{selectedSessionId}</span>
      <button onClick={() => onSelectSession('s1')} data-testid="select-s1">S1</button>
      <button onClick={() => onSelectSession('s2')} data-testid="select-s2">S2</button>
      <button onClick={() => onSelectSession('s3')} data-testid="select-s3">S3</button>
      <button onClick={() => onSelectSession('')} data-testid="deselect">Deselect</button>
      <button onClick={() => onNewProject()} data-testid="new-project">New Project</button>
      <button onClick={() => onNewChat('/projects/alpha')} data-testid="new-chat-alpha">New Chat Alpha</button>
    </div>
  ),
}));

vi.mock('../components/QuickInputBar', () => ({
  QuickInputBar: () => <div data-testid="quick-input-bar">QuickInputBar</div>,
}));

vi.mock('../components/NewSessionModal', () => ({
  NewSessionModal: ({ defaultDirectory, onClose, onSubmit }: any) => (
    <div data-testid="new-session-modal">
      <span data-testid="modal-default-directory">{defaultDirectory === '' ? '__empty__' : (defaultDirectory || '__undefined__')}</span>
      <button
        onClick={() => onSubmit({ titre: 'New Session', directory: defaultDirectory || '/new/dir' })}
        data-testid="modal-submit"
      >
        Submit
      </button>
      <button onClick={onClose} data-testid="modal-close">Close</button>
    </div>
  ),
}));

vi.mock('../components/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('../components/ChatView', () => ({
  ChatView: ({ tasks }: any) => (
    <div data-testid="chat-view">{tasks.map((t: any) => <div key={t._id} data-testid={`task-${t._id}`} />)}</div>
  ),
}));

vi.mock('../components/TaskTable', () => ({
  TaskTable: ({ tasks }: any) => (
    <div data-testid="task-table">{tasks.map((t: any) => <div key={t._id} data-testid={`task-${t._id}`} />)}</div>
  ),
}));

vi.mock('../components/TaskCard', () => ({
  TaskCard: ({ task }: any) => <div data-testid={`task-${task._id}`} />,
}));

vi.mock('../components/TaskDetailModal', () => ({
  TaskDetailModal: () => <div data-testid="task-detail-modal" />,
}));

vi.mock('../components/NewTaskModal', () => ({
  NewTaskModal: () => <div data-testid="new-task-modal" />,
}));

vi.mock('../components/LogoPunchline', () => ({
  LogoPunchline: () => null,
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => null,
}));

// ── Test setup ────────────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 0; });
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockCreateSessionMutate = vi.fn();
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
});

// Dynamic import so mocks are already in place when App loads
async function renderApp() {
  const { default: App } = await import('../App');
  return render(<App />);
}

// ══ Pure logic tests (step 3) ══════════════════════════════════════════════════

// ── Mirrors App.tsx selectedDirectory derivation ──────────────────────────────
function deriveSelectedDirectory(sessions: Session[], selectedSessionId: string): string {
  if (!selectedSessionId) return '';
  return sessions.find(s => s._id === selectedSessionId)?.directory ?? '';
}

type FilterMode = '' | 'completed' | 'pending';
const COMPLETED_STATUSES = new Set(['success', 'failed']);
const PENDING_STATUSES = new Set(['pending', 'running', 'pause', 'skipped']);
function matchesFilter(status: string, filter: FilterMode): boolean {
  if (!filter) return true;
  if (filter === 'completed') return COMPLETED_STATUSES.has(status);
  if (filter === 'pending') return PENDING_STATUSES.has(status);
  return true;
}

function filterTasks(
  tasks: (Task & { sessionIdStr: string })[],
  selectedSessionId: string,
  selectedFilter: FilterMode,
): (Task & { sessionIdStr: string })[] {
  return tasks.filter(t => {
    if (selectedSessionId && t.sessionIdStr !== selectedSessionId) return false;
    if (!matchesFilter(t.status, selectedFilter)) return false;
    return true;
  });
}

const pureSessionFixtures: Session[] = [
  makeSession('s1', '/projects/alpha'),
  makeSession('s2', '/projects/beta'),
];
const pureTaskFixtures = [
  makeTask('t1', 's1', 'pending'),
  makeTask('t2', 's1', 'success'),
  makeTask('t3', 's2', 'running'),
  makeTask('t4', 's2', 'failed'),
];

describe('deriveSelectedDirectory', () => {
  it('returns empty string when selectedSessionId is empty', () => {
    expect(deriveSelectedDirectory(pureSessionFixtures, '')).toBe('');
  });

  it('returns the directory of the matching session', () => {
    expect(deriveSelectedDirectory(pureSessionFixtures, 's1')).toBe('/projects/alpha');
    expect(deriveSelectedDirectory(pureSessionFixtures, 's2')).toBe('/projects/beta');
  });

  it('returns empty string when selectedSessionId does not match any session', () => {
    expect(deriveSelectedDirectory(pureSessionFixtures, 'unknown')).toBe('');
  });
});

describe('filterTasks — selectedSessionId', () => {
  it('returns all tasks when selectedSessionId is empty', () => {
    expect(filterTasks(pureTaskFixtures, '', '')).toHaveLength(4);
  });

  it('filters to only tasks matching selectedSessionId', () => {
    const result = filterTasks(pureTaskFixtures, 's1', '');
    expect(result).toHaveLength(2);
    expect(result.every(t => t.sessionIdStr === 's1')).toBe(true);
  });

  it('returns tasks for the other session when that session is selected', () => {
    const result = filterTasks(pureTaskFixtures, 's2', '');
    expect(result).toHaveLength(2);
    expect(result.every(t => t.sessionIdStr === 's2')).toBe(true);
  });

  it('returns empty array when selectedSessionId matches no tasks', () => {
    expect(filterTasks(pureTaskFixtures, 'nonexistent', '')).toHaveLength(0);
  });
});

describe('filterTasks — status filter combined', () => {
  it('applies status filter on top of session filter', () => {
    const result = filterTasks(pureTaskFixtures, 's1', 'completed');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('t2');
  });

  it('applies pending filter across all sessions', () => {
    const result = filterTasks(pureTaskFixtures, '', 'pending');
    expect(result.map(t => t._id).sort()).toEqual(['t1', 't3']);
  });

  it('applies completed filter across all sessions', () => {
    const result = filterTasks(pureTaskFixtures, '', 'completed');
    expect(result.map(t => t._id).sort()).toEqual(['t2', 't4']);
  });
});

describe('matchesFilter', () => {
  it('returns true for any status when filter is empty', () => {
    expect(matchesFilter('success', '')).toBe(true);
    expect(matchesFilter('pending', '')).toBe(true);
  });

  it('matches completed statuses', () => {
    expect(matchesFilter('success', 'completed')).toBe(true);
    expect(matchesFilter('failed', 'completed')).toBe(true);
    expect(matchesFilter('pending', 'completed')).toBe(false);
  });

  it('matches pending statuses', () => {
    expect(matchesFilter('pending', 'pending')).toBe(true);
    expect(matchesFilter('running', 'pending')).toBe(true);
    expect(matchesFilter('success', 'pending')).toBe(false);
  });
});

// ── Swipe logic (pure) ────────────────────────────────────────────────────────
function computeSwipeTarget(
  projectChats: Session[],
  selectedSessionId: string,
  swipeLeft: boolean,
): string | null {
  const idx = projectChats.findIndex(s => s._id === selectedSessionId);
  if (idx === -1 || projectChats.length < 2) return null;
  return swipeLeft
    ? projectChats[(idx + 1) % projectChats.length]._id
    : projectChats[(idx - 1 + projectChats.length) % projectChats.length]._id;
}

describe('swipe navigation logic', () => {
  const chats = [
    makeSession('s1', '/projects/alpha', '2024-01-01T00:00:00Z'),
    makeSession('s2', '/projects/alpha', '2024-01-02T00:00:00Z'),
    makeSession('s3', '/projects/alpha', '2024-01-03T00:00:00Z'),
  ];

  it('swipe left advances to next chat', () => {
    expect(computeSwipeTarget(chats, 's1', true)).toBe('s2');
    expect(computeSwipeTarget(chats, 's2', true)).toBe('s3');
  });

  it('swipe left wraps from last to first', () => {
    expect(computeSwipeTarget(chats, 's3', true)).toBe('s1');
  });

  it('swipe right goes to previous chat', () => {
    expect(computeSwipeTarget(chats, 's3', false)).toBe('s2');
    expect(computeSwipeTarget(chats, 's2', false)).toBe('s1');
  });

  it('swipe right wraps from first to last', () => {
    expect(computeSwipeTarget(chats, 's1', false)).toBe('s3');
  });

  it('returns null when only one chat in project', () => {
    const single = [makeSession('s1', '/projects/alpha')];
    expect(computeSwipeTarget(single, 's1', true)).toBeNull();
  });

  it('returns null when selectedSessionId not found', () => {
    expect(computeSwipeTarget(chats, 'unknown', true)).toBeNull();
  });
});

// ══ Component integration tests (step 4) ══════════════════════════════════════

describe('QuickInputBar visibility', () => {
  it('is hidden when no session is selected', async () => {
    await renderApp();
    expect(screen.queryByTestId('quick-input-bar')).not.toBeInTheDocument();
  });

  it('appears when a session is selected', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('select-s1'));
    expect(screen.getByTestId('quick-input-bar')).toBeInTheDocument();
  });

  it('disappears when session is deselected', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('select-s1'));
    await user.click(screen.getByTestId('deselect'));
    expect(screen.queryByTestId('quick-input-bar')).not.toBeInTheDocument();
  });
});

describe('scroll on session selection', () => {
  it('triggers requestAnimationFrame when switching to a new session', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('select-s1'));
    expect(rafSpy).toHaveBeenCalled();
  });

  it('does not trigger scroll when deselecting (going to empty)', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByTestId('select-s1'));
    const countAfterSelect = rafSpy.mock.calls.length;
    expect(countAfterSelect).toBeGreaterThan(0);

    // Deselect — selectedSessionId becomes '' so scrollToBottom is NOT called
    await user.click(screen.getByTestId('deselect'));
    expect(rafSpy.mock.calls.length).toBe(countAfterSelect);
  });
});

describe('NewSessionModal — defaultDirectory', () => {
  it('opens with empty defaultDirectory when "Nouveau projet" is clicked', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('new-project'));
    expect(screen.getByTestId('new-session-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-default-directory').textContent).toBe('__empty__');
  });

  it('opens with directory pre-filled when "Nouveau chat" is clicked', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('new-chat-alpha'));
    expect(screen.getByTestId('new-session-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-default-directory').textContent).toBe('/projects/alpha');
  });

  it('closes after submit', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('new-project'));
    await user.click(screen.getByTestId('modal-submit'));
    expect(screen.queryByTestId('new-session-modal')).not.toBeInTheDocument();
  });
});

describe('session creation success callback', () => {
  it('sets selectedSessionId to the new session _id on success', async () => {
    const user = userEvent.setup();

    let capturedOnSuccess: ((result: any) => void) | undefined;
    mockCreateSessionMutate = vi.fn((_data, options) => {
      capturedOnSuccess = options?.onSuccess;
    });

    await renderApp();
    await user.click(screen.getByTestId('new-project'));
    await user.click(screen.getByTestId('modal-submit'));

    expect(capturedOnSuccess).toBeDefined();
    expect(screen.getByTestId('header-session-id').textContent).toBe('');

    act(() => {
      capturedOnSuccess!({ session: { _id: 'new-session-42' } });
    });

    expect(screen.getByTestId('header-session-id').textContent).toBe('new-session-42');
  });

  it('does not change selectedSessionId if result has no session._id', async () => {
    const user = userEvent.setup();

    let capturedOnSuccess: ((result: any) => void) | undefined;
    mockCreateSessionMutate = vi.fn((_data, options) => {
      capturedOnSuccess = options?.onSuccess;
    });

    await renderApp();
    await user.click(screen.getByTestId('new-project'));
    await user.click(screen.getByTestId('modal-submit'));

    act(() => {
      capturedOnSuccess!({});
    });

    expect(screen.getByTestId('header-session-id').textContent).toBe('');
  });
});

describe('swipe navigation — component', () => {
  function setMobile() {
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true, configurable: true });
    act(() => { fireEvent(window, new Event('resize')); });
  }

  it('swipe left on main advances to next chat in same project', async () => {
    const user = userEvent.setup();
    await renderApp();
    setMobile();

    await user.click(screen.getByTestId('select-s1')); // s1 in /projects/alpha
    expect(screen.getByTestId('header-session-id').textContent).toBe('s1');

    const main = document.querySelector('main')!;
    fireEvent.touchStart(main, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 150, clientY: 205 }] }); // dx=-150 (left), dy=5

    // Should advance from s1 → s2 (next in alpha, sorted by createdAt)
    expect(screen.getByTestId('header-session-id').textContent).toBe('s2');
  });

  it('swipe right on main goes to previous chat in same project', async () => {
    const user = userEvent.setup();
    await renderApp();
    setMobile();

    await user.click(screen.getByTestId('select-s2')); // s2 in /projects/alpha
    const main = document.querySelector('main')!;
    fireEvent.touchStart(main, { touches: [{ clientX: 150, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 300, clientY: 205 }] }); // dx=+150 (right)

    // Should go back from s2 → s1
    expect(screen.getByTestId('header-session-id').textContent).toBe('s1');
  });

  it('swipe is a no-op when no session is selected', async () => {
    await renderApp();
    setMobile();

    const main = document.querySelector('main')!;
    fireEvent.touchStart(main, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 150, clientY: 205 }] });

    expect(screen.getByTestId('header-session-id').textContent).toBe('');
  });

  it('swipe is a no-op when only one chat in the project', async () => {
    const user = userEvent.setup();
    await renderApp();
    setMobile();

    await user.click(screen.getByTestId('select-s3')); // s3 is alone in /projects/beta
    const main = document.querySelector('main')!;
    fireEvent.touchStart(main, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 150, clientY: 205 }] });

    expect(screen.getByTestId('header-session-id').textContent).toBe('s3'); // unchanged
  });

  it('swipe is a no-op when dx is below threshold (< 60px)', async () => {
    const user = userEvent.setup();
    await renderApp();
    setMobile();

    await user.click(screen.getByTestId('select-s1'));
    const main = document.querySelector('main')!;
    fireEvent.touchStart(main, { touches: [{ clientX: 200, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 160, clientY: 205 }] }); // dx=-40 below threshold

    expect(screen.getByTestId('header-session-id').textContent).toBe('s1'); // unchanged
  });

  it('swipe is a no-op when vertical movement dominates', async () => {
    const user = userEvent.setup();
    await renderApp();
    setMobile();

    await user.click(screen.getByTestId('select-s1'));
    const main = document.querySelector('main')!;
    fireEvent.touchStart(main, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 150, clientY: 500 }] }); // dy=300 > dx=150

    expect(screen.getByTestId('header-session-id').textContent).toBe('s1'); // unchanged
  });
});
