import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getAgent } from '../config/agents.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 50 * 1024 * 1024; // 50 MB

/**
 * Vibe CLI wrapper.
 * Correct arg order: vibe -p "prompt" --output {text|json}
 */
export async function run(prompt, timeout) {
  const cfg = getAgent('vibe');
  if (!cfg) {
    return { success: false, error: 'Vibe CLI is not installed on this machine.' };
  }

  // Correct order: vibe -p "prompt" --output json
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : ['--output', 'text'];
  const args = ['-p', prompt, ...outputArgs];
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
      const messages = JSON.parse(stdout);
      // Vibe JSON: [{role:"system",...}, {role:"assistant", content:"..."}]
      // Last assistant message is the result.
      const assistantMsgs = messages.filter(m => m.role === 'assistant');
      const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
      const text = lastAssistant?.content ?? '';
      return { success: true, result: String(text).trim(), raw: messages };
    } catch {
      return { success: true, result: stdout, error: 'Failed to parse JSON output' };
    }
  }
  return {
    success: true,
    result: stdout,
    error: stderr || undefined,
  };
}
