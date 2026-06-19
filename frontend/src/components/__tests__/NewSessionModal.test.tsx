import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NewSessionModal } from '../NewSessionModal';

vi.mock('../DirectoryPicker', () => ({
  DirectoryPicker: ({ onClose }: { onSelect: (p: string) => void; onClose: () => void }) => (
    <div data-testid="directory-picker">
      <button onClick={onClose}>Close picker</button>
    </div>
  ),
}));

describe('NewSessionModal — new project mode (no defaultDirectory)', () => {
  it('renders "Nouveau Projet" title', () => {
    render(<NewSessionModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Nouveau Projet')).toBeInTheDocument();
    expect(screen.getByText('Créez un espace pour vos agents IA')).toBeInTheDocument();
  });

  it('shows the directory input and Parcourir button', () => {
    render(<NewSessionModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Parcourir les répertoires')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('/home/ai_agent/projects/my-app')).toBeInTheDocument();
  });

  it('shows "Nom du projet" label for the name input', () => {
    render(<NewSessionModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Nom du projet')).toBeInTheDocument();
  });

  it('submit button is disabled until both titre and directory are filled', async () => {
    const user = userEvent.setup();
    render(<NewSessionModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    const submitBtn = screen.getByRole('button', { name: 'Créer le projet' });

    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText('e.g. Refonte API v2'), 'Mon projet');
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText('/home/ai_agent/projects/my-app'), '/some/path');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onSubmit with correct data on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NewSessionModal onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('e.g. Refonte API v2'), 'Mon projet');
    await user.type(screen.getByPlaceholderText('/home/ai_agent/projects/my-app'), '/some/path');
    await user.click(screen.getByRole('button', { name: 'Créer le projet' }));

    expect(onSubmit).toHaveBeenCalledWith({ titre: 'Mon projet', directory: '/some/path' });
  });

  it('shows new project info text', () => {
    render(<NewSessionModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Un projet est lié à un répertoire de code/)).toBeInTheDocument();
  });
});

describe('NewSessionModal — new chat mode (defaultDirectory provided)', () => {
  const DIR = '/home/ai_agent/projects/my-app';

  it('renders "Nouveau Chat" title', () => {
    render(<NewSessionModal defaultDirectory={DIR} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Nouveau Chat')).toBeInTheDocument();
    expect(screen.getByText('Ajoutez un nouveau chat dans ce projet')).toBeInTheDocument();
  });

  it('hides the directory input', () => {
    render(<NewSessionModal defaultDirectory={DIR} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByPlaceholderText('/home/ai_agent/projects/my-app')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Parcourir les répertoires')).not.toBeInTheDocument();
  });

  it('shows "Nom du chat" label for the name input', () => {
    render(<NewSessionModal defaultDirectory={DIR} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Nom du chat')).toBeInTheDocument();
  });

  it('submit button is disabled until titre is filled (directory pre-filled)', async () => {
    const user = userEvent.setup();
    render(<NewSessionModal defaultDirectory={DIR} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const submitBtn = screen.getByRole('button', { name: 'Créer le chat' });

    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText('e.g. Refonte API v2'), 'Mon chat');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onSubmit with pre-filled directory and correct titre', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NewSessionModal defaultDirectory={DIR} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('e.g. Refonte API v2'), 'Mon chat');
    await user.click(screen.getByRole('button', { name: 'Créer le chat' }));

    expect(onSubmit).toHaveBeenCalledWith({ titre: 'Mon chat', directory: DIR });
  });

  it('shows new chat info text', () => {
    render(<NewSessionModal defaultDirectory={DIR} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Un nouveau chat sera créé dans le projet existant/)).toBeInTheDocument();
  });
});

describe('NewSessionModal — shared behaviour', () => {
  it('calls onClose when Annuler is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewSessionModal onClose={onClose} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the X button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewSessionModal onClose={onClose} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<NewSessionModal onClose={onClose} onSubmit={vi.fn()} />);
    // Click the outermost backdrop div
    await user.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });
});
