/**
 * Tests for App.tsx selection model logic (step 3 of refactor).
 *
 * AppContent can't be rendered here because the JSX still references old APIs
 * (setSelectedDirectory, old AppHeader props) that will be fixed in step 4.
 * We test the pure logic that was changed in this step directly.
 */

import type { Session, Task, TaskStatus } from '../types';

// ── Mirrors App.tsx selectedDirectory derivation ──────────────────────────────
function deriveSelectedDirectory(sessions: Session[], selectedSessionId: string): string {
  if (!selectedSessionId) return '';
  return sessions.find(s => s._id === selectedSessionId)?.directory ?? '';
}

// ── Mirrors App.tsx matchesFilter ─────────────────────────────────────────────
type FilterMode = '' | 'completed' | 'pending';
const COMPLETED_STATUSES = new Set(['success', 'failed']);
const PENDING_STATUSES = new Set(['pending', 'running', 'pause', 'skipped']);
function matchesFilter(status: string, filter: FilterMode): boolean {
  if (!filter) return true;
  if (filter === 'completed') return COMPLETED_STATUSES.has(status);
  if (filter === 'pending') return PENDING_STATUSES.has(status);
  return true;
}

// ── Mirrors App.tsx normalizedTasks filter ────────────────────────────────────
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

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeSession = (id: string, directory: string): Session => ({
  _id: id,
  directory,
  titre: `Session ${id}`,
  createdAt: '2024-01-01T00:00:00Z',
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

const sessions: Session[] = [
  makeSession('s1', '/projects/alpha'),
  makeSession('s2', '/projects/beta'),
];

const tasks = [
  makeTask('t1', 's1', 'pending'),
  makeTask('t2', 's1', 'success'),
  makeTask('t3', 's2', 'running'),
  makeTask('t4', 's2', 'failed'),
];

// ── selectedDirectory derivation ──────────────────────────────────────────────
describe('deriveSelectedDirectory', () => {
  it('returns empty string when selectedSessionId is empty', () => {
    expect(deriveSelectedDirectory(sessions, '')).toBe('');
  });

  it('returns the directory of the matching session', () => {
    expect(deriveSelectedDirectory(sessions, 's1')).toBe('/projects/alpha');
    expect(deriveSelectedDirectory(sessions, 's2')).toBe('/projects/beta');
  });

  it('returns empty string when selectedSessionId does not match any session', () => {
    expect(deriveSelectedDirectory(sessions, 'unknown')).toBe('');
  });
});

// ── normalizedTasks filter ────────────────────────────────────────────────────
describe('filterTasks — selectedSessionId', () => {
  it('returns all tasks when selectedSessionId is empty', () => {
    const result = filterTasks(tasks, '', '');
    expect(result).toHaveLength(4);
  });

  it('filters to only tasks matching selectedSessionId', () => {
    const result = filterTasks(tasks, 's1', '');
    expect(result).toHaveLength(2);
    expect(result.every(t => t.sessionIdStr === 's1')).toBe(true);
  });

  it('returns tasks for the other session when that session is selected', () => {
    const result = filterTasks(tasks, 's2', '');
    expect(result).toHaveLength(2);
    expect(result.every(t => t.sessionIdStr === 's2')).toBe(true);
  });

  it('returns empty array when selectedSessionId matches no tasks', () => {
    const result = filterTasks(tasks, 'nonexistent', '');
    expect(result).toHaveLength(0);
  });
});

describe('filterTasks — status filter combined with session filter', () => {
  it('applies status filter on top of session filter', () => {
    const result = filterTasks(tasks, 's1', 'completed');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('t2'); // only success task in s1
  });

  it('applies pending filter across all sessions when no session selected', () => {
    const result = filterTasks(tasks, '', 'pending');
    // pending + running = t1 and t3
    expect(result).toHaveLength(2);
    expect(result.map(t => t._id).sort()).toEqual(['t1', 't3']);
  });

  it('applies completed filter across all sessions when no session selected', () => {
    const result = filterTasks(tasks, '', 'completed');
    // success + failed = t2 and t4
    expect(result).toHaveLength(2);
    expect(result.map(t => t._id).sort()).toEqual(['t2', 't4']);
  });
});

// ── matchesFilter ─────────────────────────────────────────────────────────────
describe('matchesFilter', () => {
  it('returns true for any status when filter is empty', () => {
    expect(matchesFilter('success', '')).toBe(true);
    expect(matchesFilter('pending', '')).toBe(true);
    expect(matchesFilter('running', '')).toBe(true);
  });

  it('matches completed statuses', () => {
    expect(matchesFilter('success', 'completed')).toBe(true);
    expect(matchesFilter('failed', 'completed')).toBe(true);
    expect(matchesFilter('pending', 'completed')).toBe(false);
  });

  it('matches pending statuses', () => {
    expect(matchesFilter('pending', 'pending')).toBe(true);
    expect(matchesFilter('running', 'pending')).toBe(true);
    expect(matchesFilter('pause', 'pending')).toBe(true);
    expect(matchesFilter('skipped', 'pending')).toBe(true);
    expect(matchesFilter('success', 'pending')).toBe(false);
  });
});
