import { jest } from '@jest/globals';

const mockExec = jest.fn();

jest.unstable_mockModule('child_process', () => ({ exec: mockExec }));

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

beforeEach(() => mockExec.mockReset());

function mockSuccess(stdout, stderr = '') {
  mockExec.mockImplementation((_cmd, _opts, cb) => cb(null, { stdout, stderr }));
}

function mockFailure(message) {
  mockExec.mockImplementation((_cmd, _opts, cb) => cb(new Error(message)));
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

  it('uses the correct CLI command prefix', async () => {
    mockSuccess('');
    await getFn()('hello');
    const [[cmd]] = mockExec.mock.calls;
    expect(cmd).toContain(cmdPrefix);
  });

  it('includes the prompt in the command', async () => {
    mockSuccess('');
    await getFn()('my special prompt');
    const [[cmd]] = mockExec.mock.calls;
    expect(cmd).toContain('my special prompt');
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

  it('returns failure on exec error', async () => {
    mockFailure('command not found');
    const res = await getFn()('test');
    expect(res.success).toBe(false);
    expect(res.result).toBe('');
    expect(res.error).toContain('command not found');
  });

  it('escapes double quotes in prompt', async () => {
    mockSuccess('ok');
    await getFn()('say "hello"');
    const [[cmd]] = mockExec.mock.calls;
    expect(cmd).toContain('\\"hello\\"');
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
