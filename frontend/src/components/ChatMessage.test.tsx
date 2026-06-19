import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import type { Task, TaskStatus } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: 'task-1',
    sessionId: 's1',
    prompt: 'test prompt',
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

const defaultProps = {
  onSkip: vi.fn(),
  onResume: vi.fn(),
  onDelete: vi.fn(),
  onClick: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChatMessage', () => {
  it('renders the task prompt in the user bubble', () => {
    render(<ChatMessage task={makeTask({ prompt: 'Hello world' })} {...defaultProps} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders a StatusBadge with the correct status aria-label', () => {
    render(<ChatMessage task={makeTask({ status: 'pending' })} {...defaultProps} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Statut: En attente');
  });

  it('shows Skip button for status "pending"', () => {
    render(<ChatMessage task={makeTask({ status: 'pending' })} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Ignorer/i })).toBeInTheDocument();
  });

  it('does not show Skip button for status "success"', () => {
    render(<ChatMessage task={makeTask({ status: 'success' })} {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Ignorer/i })).not.toBeInTheDocument();
  });

  it('shows Resume button for status "skipped"', () => {
    render(<ChatMessage task={makeTask({ status: 'skipped' })} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Reprendre/i })).toBeInTheDocument();
  });

  it('does not show Resume button for status "pending"', () => {
    render(<ChatMessage task={makeTask({ status: 'pending' })} {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Reprendre/i })).not.toBeInTheDocument();
  });

  it('always shows Delete button', () => {
    render(<ChatMessage task={makeTask()} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Supprimer/i })).toBeInTheDocument();
  });

  it('calls onClick with the task when agent bubble is clicked', () => {
    const task = makeTask();
    render(<ChatMessage task={task} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Tâche: test prompt/i }));
    expect(defaultProps.onClick).toHaveBeenCalledWith(task);
  });

  it('calls onSkip with task._id when Skip is clicked', () => {
    const task = makeTask({ status: 'pending' });
    render(<ChatMessage task={task} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Ignorer/i }));
    expect(defaultProps.onSkip).toHaveBeenCalledWith('task-1');
  });

  it('calls onDelete with task._id after inline confirm (clicking Oui)', () => {
    const task = makeTask();
    render(<ChatMessage task={task} {...defaultProps} />);
    // First click shows the inline "Oui / Non" confirmation
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/i }));
    // Second click on "Oui" triggers the actual deletion
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la suppression/i }));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('task-1');
  });

  it('does not call onDelete when inline confirm is cancelled (clicking Non)', () => {
    const task = makeTask();
    render(<ChatMessage task={task} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(defaultProps.onDelete).not.toHaveBeenCalled();
  });

  it('shows result area when task.result is set', () => {
    render(<ChatMessage task={makeTask({ result: 'Agent output here' })} {...defaultProps} />);
    expect(screen.getByText('Agent output here')).toBeInTheDocument();
  });

  it('shows "Voir plus" button on result when result exceeds 300 chars', () => {
    const longResult = 'x'.repeat(301);
    render(<ChatMessage task={makeTask({ result: longResult })} {...defaultProps} />);
    expect(screen.getByText('Voir plus')).toBeInTheDocument();
  });

  it('does not show "Voir plus" button when result is 300 chars or fewer', () => {
    const shortResult = 'x'.repeat(300);
    render(<ChatMessage task={makeTask({ result: shortResult })} {...defaultProps} />);
    expect(screen.queryByText('Voir plus')).not.toBeInTheDocument();
  });

  it.each<TaskStatus>(['pending', 'running', 'success', 'failed', 'pause', 'skipped'])(
    'renders without crashing for status "%s"',
    (status) => {
      expect(() => {
        render(<ChatMessage task={makeTask({ status })} {...defaultProps} />);
      }).not.toThrow();
    }
  );
});
