import { AGENT_COMMANDS, AGENT_OPTIONS } from '../config/agents.js';

const EXPECTED_AGENTS = ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'];

describe('AGENT_COMMANDS', () => {
  it('has exactly 5 keys', () => {
    expect(Object.keys(AGENT_COMMANDS)).toHaveLength(5);
  });

  it('contains all expected agent names', () => {
    for (const name of EXPECTED_AGENTS) {
      expect(AGENT_COMMANDS).toHaveProperty(name);
    }
  });

  it('maps claude → "claude"', () => {
    expect(AGENT_COMMANDS.claude).toBe('claude');
  });

  it('maps vibe → "vibe"', () => {
    expect(AGENT_COMMANDS.vibe).toBe('vibe');
  });

  it('maps antigravity → "ag"', () => {
    expect(AGENT_COMMANDS.antigravity).toBe('ag');
  });

  it('maps hermes → "hermes"', () => {
    expect(AGENT_COMMANDS.hermes).toBe('hermes');
  });

  it('maps opencode → "opencode"', () => {
    expect(AGENT_COMMANDS.opencode).toBe('opencode');
  });
});

describe('AGENT_OPTIONS', () => {
  it('has an entry for each agent', () => {
    for (const name of EXPECTED_AGENTS) {
      expect(AGENT_OPTIONS).toHaveProperty(name);
    }
  });

  it('has a timeout of 300000 for each agent', () => {
    for (const name of EXPECTED_AGENTS) {
      expect(AGENT_OPTIONS[name].timeout).toBe(300000);
    }
  });
});
