// ---------------------------------------------------------------------------
// Simple name → CLI command mapping (used by the spec-compliant agent wrappers)
// ---------------------------------------------------------------------------
export const AGENT_COMMANDS = {
  claude: 'claude',
  vibe: 'vibe',
  antigravity: 'ag',
  hermes: 'hermes',
  opencode: 'opencode',
};

const DEFAULT_TIMEOUT = 300000; // 5 minutes

export const AGENT_OPTIONS = {
  claude: { timeout: DEFAULT_TIMEOUT },
  vibe: { timeout: DEFAULT_TIMEOUT },
  antigravity: { timeout: DEFAULT_TIMEOUT },
  hermes: { timeout: DEFAULT_TIMEOUT },
  opencode: { timeout: DEFAULT_TIMEOUT },
};

// ---------------------------------------------------------------------------

/**
 * AI Agent CLI configurations — built from actual `--help` output.
 *
 * Installed agents (verified on this machine):
 *   • hermes      → /home/ai_agent/.local/bin/hermes   (-z for non-interactive)
 *   • vibe        → /home/ai_agent/.local/bin/vibe      (-p for programmatic mode)
 *   • claude      → /usr/bin/claude                    (-p for print mode)
 *   • opencode    → /home/ai_agent/.opencode/bin/opencode (run for non-interactive)
 *   • antigravity → /home/ai_agent/.local/bin/agy       (--print for non-interactive)
 *
 * Each agent entry defines:
 *   command   – CLI binary (resolved via PATH)
 *   args      – prefix args pushed BEFORE the prompt
 *               (the prompt is appended as the last argument)
 *   timeout   – max wall-seconds before the child process is killed
 *   outputFmt – 'text' | 'json' — how the wrapper should parse stdout
 *               The wrapper (agents/<name>.js) is responsible for parsing.
 *   installed – whether the binary exists on this machine
 */

// ---------------------------------------------------------------------------
// Agent registry
// ---------------------------------------------------------------------------
const agents = {
  // ── Hermes Agent ──────────────────────────────────────────────────────────
  // Non-interactive via  -z "prompt"
  // No JSON output flag — response is plain text on stdout.
  // Source: hermes --help
  hermes: {
    command: '/home/ai_agent/.local/bin/hermes',
    args: ['-z'],               // hermes -z "your prompt here"
    timeout: 300_000,            // 5 min
    outputFmt: 'text',
    installed: true,
  },

  // ── Mistral Vibe ──────────────────────────────────────────────────────────
  // Programmatic mode via  -p "prompt" --output {text|json|streaming}
  // JSON output: [{role:"system",...}, {role:"assistant", content:"..."}]
  // Source: vibe --help
  vibe: {
    command: '/home/ai_agent/.local/bin/vibe',
    args: ['-p'],                  // vibe -p "prompt" --output json
    jsonArgs: ['--output', 'json'], // replaces --output text when outputFmt='json'
    timeout: 300_000,
    outputFmt: 'text',
    installed: true,
  },

  // ── Claude Code ───────────────────────────────────────────────────────────
  // Print mode via  -p --output-format {text|json|stream-json} "prompt"
  // JSON output: {result:{text:"..."}} with metadata
  // Source: claude --help
  claude: {
    command: 'claude',
    args: ['-p'],                  // claude -p --output-format json "prompt"
    jsonArgs: ['--output-format', 'json'],
    timeout: 300_000,
    outputFmt: 'json',
    installed: true,
  },

  // ── Antigravity ────────────────────────────────────────────────────────
  // Non-interactive via --print or -p flag
  // Output is plain text on stdout (no JSON flag available)
  // Source: agy --help
  antigravity: {
    command: '/home/ai_agent/.local/bin/agy',
    args: ['--print'],
    timeout: 300_000,
    outputFmt: 'text',
    installed: true,
  },

  // ── OpenCode ─────────────────────────────────────────────────────────────
  // Non-interactive via `opencode run --format json "prompt"`
  // JSON output: raw JSON events
  // Source: opencode run --help
  opencode: {
    command: 'opencode',
    args: ['run'],                 // opencode run --format json "prompt"
    jsonArgs: ['--format', 'json'],
    timeout: 300_000,
    outputFmt: 'text',
    installed: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get config for a given agent name. Returns null if not found or not installed. */
function getAgent(agentName) {
  const cfg = agents[agentName];
  if (!cfg) return null;
  if (!cfg.installed) {
    console.warn(`⚠ Agent "${agentName}" is not installed on this machine.`);
    return null;
  }
  return cfg;
}

/** List all installed agents. */
function listInstalled() {
  return Object.entries(agents)
    .filter(([, cfg]) => cfg.installed)
    .map(([name]) => name);
}

/** 
 * Build the full argv array for spawning the agent with a given prompt.
 * @param {string} agentName - The agent name (e.g., 'claude', 'opencode')
 * @param {string} prompt - The prompt to send to the agent
 * @param {boolean} useJson - Whether to use JSON output format (if available)
 * @returns {string[]} - Array of command-line arguments
 */
function buildArgs(agentName, prompt, useJson = false) {
  const cfg = getAgent(agentName);
  if (!cfg) throw new Error(`Unknown or uninstalled agent: ${agentName}`);
  
  const finalArgs = [...cfg.args];
  
  // Add JSON args if requested and available (before the prompt)
  if (useJson && cfg.jsonArgs) {
    finalArgs.push(...cfg.jsonArgs);
  }
  
  // Append prompt as last argument
  finalArgs.push(prompt);
  
  return finalArgs;
}

export { agents, getAgent, listInstalled, buildArgs };
