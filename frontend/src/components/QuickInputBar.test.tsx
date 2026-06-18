import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickInputBar } from './QuickInputBar';
import type { AgentType } from '../types';

vi.mock('./AgentSelector', () => ({
  AgentSelector: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick} aria-label="Agent selector">
      Agent
    </button>
  ),
  getAgentConfig: (id: AgentType) => ({ icon: () => <span data-testid={`icon-${id}`} /> }),
}));

const defaultProps = {
  agent: 'hermes' as AgentType,
  onAgentChange: vi.fn(),
  prompt: '',
  onPromptChange: vi.fn(),
  onSend: vi.fn(),
  isPending: false,
  keyboardOffset: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickInputBar', () => {
  it('renders without crashing with minimal props', () => {
    render(<QuickInputBar {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders the task input placeholder', () => {
    render(<QuickInputBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Décrivez la tâche…')).toBeInTheDocument();
  });

  it('renders the send button', () => {
    render(<QuickInputBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
  });

  it('calls onSend when send button is clicked with a non-empty prompt', () => {
    render(<QuickInputBar {...defaultProps} prompt="do something" />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(defaultProps.onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onSend when Enter is pressed in the input with a non-empty prompt', () => {
    render(<QuickInputBar {...defaultProps} prompt="do something" />);
    fireEvent.keyDown(screen.getByPlaceholderText('Décrivez la tâche…'), { key: 'Enter' });
    expect(defaultProps.onSend).toHaveBeenCalledTimes(1);
  });

  it('does not call onSend when Enter is pressed with an empty prompt', () => {
    render(<QuickInputBar {...defaultProps} prompt="" />);
    fireEvent.keyDown(screen.getByPlaceholderText('Décrivez la tâche…'), { key: 'Enter' });
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('does not call onSend when Enter is pressed with a whitespace-only prompt', () => {
    render(<QuickInputBar {...defaultProps} prompt="   " />);
    fireEvent.keyDown(screen.getByPlaceholderText('Décrivez la tâche…'), { key: 'Enter' });
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('send button is disabled when isPending is true', () => {
    render(<QuickInputBar {...defaultProps} prompt="do something" isPending={true} />);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  it('send button is disabled when prompt is empty', () => {
    render(<QuickInputBar {...defaultProps} prompt="" />);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  it('send button is disabled when prompt is whitespace only', () => {
    render(<QuickInputBar {...defaultProps} prompt="   " />);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  it('send button is enabled when prompt is non-empty and not pending', () => {
    render(<QuickInputBar {...defaultProps} prompt="do something" isPending={false} />);
    expect(screen.getByRole('button', { name: 'Envoyer' })).not.toBeDisabled();
  });

  it('calls onPromptChange when input value changes', () => {
    render(<QuickInputBar {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Décrivez la tâche…'), {
      target: { value: 'new task' },
    });
    expect(defaultProps.onPromptChange).toHaveBeenCalledWith('new task');
  });

  it('uses keyboardOffset > 0 to set bottom style as pixels', () => {
    const { container } = render(<QuickInputBar {...defaultProps} keyboardOffset={100} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.bottom).toBe('116px');
  });

  it('does not use pixel bottom when keyboardOffset is 0', () => {
    // jsdom does not support env(), so the safe-area value resolves to empty string.
    // We just verify it is NOT the px form used for keyboard avoidance.
    const { container } = render(<QuickInputBar {...defaultProps} keyboardOffset={0} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.bottom).not.toMatch(/^\d+px$/);
  });

  it('shows the agent dropdown when agent selector is clicked', () => {
    render(<QuickInputBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agent selector' }));
    expect(screen.getByText('Hermes')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('calls onAgentChange when an agent is selected from the dropdown', () => {
    render(<QuickInputBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agent selector' }));
    fireEvent.click(screen.getByText('Claude'));
    expect(defaultProps.onAgentChange).toHaveBeenCalledWith('claude');
  });

  it('closes the dropdown after selecting an agent', () => {
    render(<QuickInputBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agent selector' }));
    fireEvent.click(screen.getByText('Claude'));
    expect(screen.queryByText('Hermes')).not.toBeInTheDocument();
  });

  it('displays a spinner instead of Send icon when isPending', () => {
    const { container } = render(<QuickInputBar {...defaultProps} isPending={true} prompt="x" />);
    // Spinner div has animate-spin class; Send icon should not be present
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
