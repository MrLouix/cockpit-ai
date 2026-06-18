import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatView } from './ChatView';
import type { Task } from '../types';

let idCounter = 0;

function makeTask(overrides: Partial<Task> = {}): Task {
  idCounter++;
  return {
    _id: `task-${idCounter}`,
    sessionId: 's1',
    prompt: `prompt-${idCounter}`,
    agent: 'claude',
    executedByAgent: false,
    status: 'pending',
    result: undefined,
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const defaultProps = {
  onSkip: vi.fn(),
  onResume: vi.fn(),
  onDelete: vi.fn(),
  onClick: vi.fn(),
};

beforeEach(() => {
  idCounter = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatView', () => {
  it('renders all task prompts', () => {
    const tasks = [
      makeTask({ prompt: 'first task' }),
      makeTask({ prompt: 'second task' }),
    ];
    render(<ChatView tasks={tasks} {...defaultProps} />);
    expect(screen.getByText('first task')).toBeInTheDocument();
    expect(screen.getByText('second task')).toBeInTheDocument();
  });

  it('shows "Aujourd\'hui" separator for tasks created today', () => {
    render(<ChatView tasks={[makeTask()]} {...defaultProps} />);
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
  });

  it('shows "Hier" separator for tasks created yesterday', () => {
    const task = makeTask({ createdAt: daysAgo(1) });
    render(<ChatView tasks={[task]} {...defaultProps} />);
    expect(screen.getByText('Hier')).toBeInTheDocument();
  });

  it('shows DD/MM/YYYY separator for tasks older than yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    const task = makeTask({ createdAt: d.toISOString() });
    render(<ChatView tasks={[task]} {...defaultProps} />);

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    expect(screen.getByText(`${dd}/${mm}/${yyyy}`)).toBeInTheDocument();
  });

  it('shows empty state when tasks array is empty', () => {
    render(<ChatView tasks={[]} {...defaultProps} />);
    expect(screen.getByText('Aucune tâche pour le moment')).toBeInTheDocument();
  });

  it('shows 6 skeleton divs (3 pairs) when isLoading is true', () => {
    const { container } = render(<ChatView tasks={[]} isLoading={true} {...defaultProps} />);
    const pulsingDivs = container.querySelectorAll('.animate-pulse');
    expect(pulsingDivs).toHaveLength(6);
  });

  it('does not show empty state when isLoading is true', () => {
    render(<ChatView tasks={[]} isLoading={true} {...defaultProps} />);
    expect(screen.queryByText('Aucune tâche pour le moment')).not.toBeInTheDocument();
  });

  it('creates separate date groups for tasks on different days', () => {
    const tasks = [
      makeTask({ createdAt: daysAgo(2) }),
      makeTask({ createdAt: daysAgo(0) }),
    ];
    const { container } = render(<ChatView tasks={tasks} {...defaultProps} />);
    // Each group gets a DateSeparator; find all separator labels
    const separators = container.querySelectorAll('[class*="border-t"]');
    // Each separator has 2 horizontal lines; so 2 groups → 4 border-t elements
    expect(separators.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
  });

  it('renders tasks in ascending createdAt order within a day', () => {
    const earlier = new Date();
    earlier.setHours(8, 0, 0, 0);
    const later = new Date();
    later.setHours(20, 0, 0, 0);

    const tasks = [
      makeTask({ prompt: 'late task', createdAt: later.toISOString() }),
      makeTask({ prompt: 'early task', createdAt: earlier.toISOString() }),
    ];
    const { container } = render(<ChatView tasks={tasks} {...defaultProps} />);

    const allText = container.textContent ?? '';
    expect(allText.indexOf('early task')).toBeLessThan(allText.indexOf('late task'));
  });

  it('calls scrollIntoView when tasks.length changes', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(<ChatView tasks={[]} {...defaultProps} />);
    const callsBefore = scrollIntoViewMock.mock.calls.length;

    rerender(<ChatView tasks={[makeTask()]} {...defaultProps} />);

    expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('renders tasks grouped under their correct date separator', () => {
    const todayTask = makeTask({ prompt: 'today prompt' });
    const oldTask = makeTask({ prompt: 'old prompt', createdAt: daysAgo(10) });

    render(<ChatView tasks={[todayTask, oldTask]} {...defaultProps} />);

    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText('today prompt')).toBeInTheDocument();
    expect(screen.getByText('old prompt')).toBeInTheDocument();
  });

  it('does not show task prompts when isLoading is true', () => {
    const tasks = [makeTask({ prompt: 'should not appear' })];
    render(<ChatView tasks={tasks} isLoading={true} {...defaultProps} />);
    expect(screen.queryByText('should not appear')).not.toBeInTheDocument();
  });

  it('renders the chat-view container', () => {
    render(<ChatView tasks={[]} {...defaultProps} />);
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });
});
