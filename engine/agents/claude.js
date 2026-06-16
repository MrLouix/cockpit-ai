import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getAgent } from '../config/agents.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 50 * 1024 * 1024; // 50 MB

/**
 * Wrapper générique — lit la config, construit les argv, lance l'exécutable.
 * Gère les CLI qui prennent le prompt en tant qu'argument (claude) vs
 * ceux qui le prennent en trailing arg (hermes).
 */
export async function run(prompt, timeout) {
  const cfg = getAgent('claude');
  if (!cfg) {
    return { success: false, error: 'Claude CLI is not installed on this machine.' };
  }

  // Claude: claude -p --output-format {text|json} "prompt"
  // Le prompt est le trailing arg.
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : [];
  const args = [...cfg.args, ...outputArgs, prompt];
  const ms = timeout ?? cfg.timeout;

  try {
    const { stdout, stderr } = await execFileAsync(cfg.command, args, {
      timeout: ms,
      maxBuffer: MAX_BUFFER,
      killSignal: 'SIGTERM',
    });

    const rawOutput = stdout.trim();
    return parseResult(rawOutput, stderr.trim(), cfg.outputFmt);
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.killed) {
      return { success: false, error: `Agent timed out after ${ms}ms` };
    }
    return { success: false, error: err.message || String(err) };
  }
}

/** Parse the agent output based on the configured format. */
function parseResult(stdout, stderr, outputFmt) {
  if (outputFmt === 'json') {
    try {
      const parsed = JSON.parse(stdout);
      // Claude: {result:{text:"..."}}, {result:"..."}
      const text = parsed?.result?.text ?? parsed?.result ?? '';
      return { success: true, result: String(text).trim(), raw: parsed };
    } catch {
      // JSON parse failed — return raw with warning
      return { success: true, result: stdout, error: 'Failed to parse JSON output' };
    }
  }
  // text mode
  return {
    success: true,
    result: stdout,
    error: stderr || undefined,
  };
}
