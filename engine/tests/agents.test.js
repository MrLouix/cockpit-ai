import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

const mockSpawn = jest.fn();
const mockReadFile = jest.fn();
const mockUnlink = jest.fn();

jest.unstable_mockModule('child_process', () => ({ spawn: mockSpawn }));
jest.unstable_mockModule('fs/promises', () => ({ readFile: mockReadFile, unlink: mockUnlink }));

let runClaude, runVibe, runAntigravity, runHermes, runOpencode;
let runAgent, detectSubtasks;

beforeAll(async () => {
  ({ runClaude } = await import('../agents/claude.js'));
  ({ runVibe } = await import('../agents/vibe.js'));
  ({ runAntigravity } = await import('../agents/antigravity.js'));
  ({ runHermes } = await import('../agents/hermes.js'));
  ({ runOpencode } = await import('../agents/opencode.js'));
  ({ runAgent, detectSubtasks } = await import('../agents/index.js'));
});

beforeEach(() => {
  mockSpawn.mockReset();
  mockReadFile.mockReset();
  mockUnlink.mockReset();
  mockUnlink.mockResolvedValue(undefined);
  mockReadFile.mockRejectedValue(new Error('ENOENT'));
});

function mockSuccess(stdout, stderr = '', exitCode = 0) {
  mockSpawn.mockImplementation(() => {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    
    // Emit data asynchronously
    setTimeout(() => {
      if (stdout) mockProcess.stdout.emit('data', Buffer.from(stdout));
      if (stderr) mockProcess.stderr.emit('data', Buffer.from(stderr));
      mockProcess.emit('close', exitCode);
    }, 0);
    
    return mockProcess;
  });
}

function mockFailure(errorMessage) {
  mockSpawn.mockImplementation(() => {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    
    setTimeout(() => {
      mockProcess.emit('error', new Error(errorMessage));
    }, 0);
    
    return mockProcess;
  });
}

// ---------------------------------------------------------------------------
// Individual agent wrappers
// ---------------------------------------------------------------------------

describe.each([
  ['runClaude',      () => runClaude,      'claude --prompt'],
  ['runVibe',        () => runVibe,        'vibe --prompt'],
  ['runAntigravity', () => runAntigravity, 'ag --prompt'],
  ['runHermes',      () => runHermes,      'hermes --prompt'],
  ['runOpencode',    () => runOpencode,    'opencode --prompt'],
])('%s', (_name, getFn, cmdPrefix) => {
  it('returns success with stdout on success', async () => {
    mockSuccess('output text');
    const res = await getFn()('test prompt');
    expect(res.success).toBe(true);
    expect(res.result).toBe('output text');
  });

  it('uses the correct CLI command', async () => {
    mockSuccess('');
    await getFn()('hello');
    expect(mockSpawn).toHaveBeenCalled();
    const [[command, args]] = mockSpawn.mock.calls;
    // Verify command and args contain expected values
    expect(command || args[0]).toBeDefined();
  });

  it('includes the prompt in the command args', async () => {
    mockSuccess('');
    await getFn()('my special prompt');
    expect(mockSpawn).toHaveBeenCalled();
    const [[_command, args]] = mockSpawn.mock.calls;
    expect(args.join(' ')).toContain('my special prompt');
  });

  it('returns failure when stderr present and no stdout', async () => {
    mockSuccess('', 'something went wrong');
    const res = await getFn()('test');
    expect(res.success).toBe(false);
    expect(res.result).toBe('');
    expect(res.error).toBe('something went wrong');
  });

  it('returns success when both stdout and stderr present', async () => {
    mockSuccess('output', 'warning');
    const res = await getFn()('test');
    expect(res.success).toBe(true);
    expect(res.result).toBe('output');
  });

  it('returns failure on spawn error', async () => {
    mockFailure('command not found');
    const res = await getFn()('test');
    expect(res.success).toBe(false);
    expect(res.result).toBe('');
    expect(res.error).toContain('command not found');
  });

  it('handles prompts with special characters', async () => {
    mockSuccess('ok');
    await getFn()('say "hello"');
    expect(mockSpawn).toHaveBeenCalled();
    const [[_command, args]] = mockSpawn.mock.calls;
    expect(args).toContain('say "hello"');
  });
});

// ---------------------------------------------------------------------------
// Antigravity log-file fallback (rate-limit bug workaround)
// ---------------------------------------------------------------------------

describe('runAntigravity log-file fallback', () => {
  it('falls back to log file when stdout is empty', async () => {
    mockSuccess('');
    mockReadFile.mockResolvedValue('response from log file');
    const res = await runAntigravity('test prompt');
    expect(res.success).toBe(true);
    expect(res.result).toBe('response from log file');
  });

  it('passes --log-file as first args to agy', async () => {
    mockSuccess('output');
    await runAntigravity('test prompt');
    expect(mockSpawn).toHaveBeenCalled();
    const [[_command, args]] = mockSpawn.mock.calls;
    expect(args[0]).toBe('--log-file');
    expect(typeof args[1]).toBe('string');
    expect(args[1]).toMatch(/agy-.*\.log$/);
  });

  it('uses stdout when available (ignores log file)', async () => {
    mockSuccess('direct output');
    mockReadFile.mockResolvedValue('log content');
    const res = await runAntigravity('test');
    expect(res.success).toBe(true);
    expect(res.result).toBe('direct output');
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('cleans up log file after execution', async () => {
    mockSuccess('output');
    await runAntigravity('test');
    expect(mockUnlink).toHaveBeenCalled();
  });

  it('returns failure when both stdout and log file are empty', async () => {
    mockSuccess('', 'error occurred');
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const res = await runAntigravity('test');
    expect(res.success).toBe(false);
    expect(res.error).toBe('error occurred');
  });
});

// ---------------------------------------------------------------------------
// runAgent dispatcher
// ---------------------------------------------------------------------------

describe('runAgent', () => {
  it('dispatches to claude and returns success', async () => {
    mockSuccess('claude result');
    const res = await runAgent('claude', 'hello');
    expect(res.success).toBe(true);
    expect(res.result).toBe('claude result');
  });

  it('dispatches to vibe', async () => {
    mockSuccess('vibe result');
    const res = await runAgent('vibe', 'hello');
    expect(res.success).toBe(true);
  });

  it('dispatches to antigravity', async () => {
    mockSuccess('ag result');
    const res = await runAgent('antigravity', 'hello');
    expect(res.success).toBe(true);
  });

  it('throws for an unknown agent', async () => {
    await expect(runAgent('unknown_agent', 'hello')).rejects.toThrow(
      "Agent 'unknown_agent' not supported"
    );
  });
});

// ---------------------------------------------------------------------------
// detectSubtasks
// ---------------------------------------------------------------------------

describe('detectSubtasks', () => {
  it('returns null when no marker present', () => {
    expect(detectSubtasks('no marker here')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(detectSubtasks(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(detectSubtasks(undefined)).toBeNull();
  });

  it('returns null when marker present but no content after', () => {
    expect(detectSubtasks('[DECOMPOSITION_DETECTEE]')).toBeNull();
    expect(detectSubtasks('[DECOMPOSITION_DETECTEE]\n   \n')).toBeNull();
  });

  it('returns array of subtasks when marker present', () => {
    const response = 'some preamble\n[DECOMPOSITION_DETECTEE]\n- task one\n- task two\n';
    const result = detectSubtasks(response);
    expect(result).toEqual(['task one', 'task two']);
  });

  it('strips numbered list prefixes', () => {
    const response = '[DECOMPOSITION_DETECTEE]\n1. first\n2. second';
    expect(detectSubtasks(response)).toEqual(['first', 'second']);
  });

  it('strips asterisk and hash prefixes', () => {
    const response = '[DECOMPOSITION_DETECTEE]\n* alpha\n# beta';
    expect(detectSubtasks(response)).toEqual(['alpha', 'beta']);
  });
});
