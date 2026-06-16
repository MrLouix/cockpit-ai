/**
 * AI Agent CLI configurations — built from actual `--help` output.
 *
 * Installed agents (verified on this machine):
 *   • hermes  → /home/ai_agent/.local/bin/hermes  (-z for non-interactive)
 *   • vibe    → /home/ai_agent/.local/bin/vibe     (-p for programmatic mode)
 *   • claude  → /usr/bin/claude                     (-p for print mode)
 *
 * Not installed (commented out, ready to be enabled):
 *   • antigravity (ag)
 *   • opencode
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
    outputFmt: 'text',
    installed: true,
  },

  // ── Antigravity (NOT installed) ───────────────────────────────────────────
  // Needs investigation — no `ag` binary found on this machine.
  // Uncomment and adjust args once installed.
  // antigravity: {
  //   command: 'ag',
  //   args: ['-p'],
  //   timeout: 300_000,
  //   outputFmt: 'text',
  //   installed: false,
  // },

  // ── OpenCode (NOT installed) ──────────────────────────────────────────────
  // Uncomment and adjust args once installed.
  // opencode: {
  //   command: 'opencode',
  //   args: ['-p'],
  //   timeout: 300_000,
  //   outputFmt: 'text',
  //   installed: false,
  // },
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

/** Build the full argv array for spawning the agent with a given prompt. */
function buildArgs(agentName, prompt) {
  const cfg = getAgent(agentName);
  if (!cfg) throw new Error(`Unknown or uninstalled agent: ${agentName}`);
  return [...cfg.args, prompt];
}

export { agents, getAgent, listInstalled, buildArgs };
