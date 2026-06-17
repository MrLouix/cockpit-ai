import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { getAgent } from '../config/agents.js';

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

  return new Promise((resolve) => {
    // Open /dev/null for stdin to prevent "no stdin data received" warning
    const nullFd = fs.openSync('/dev/null', 'r');
    
    const child = spawn(cfg.command, args, {
      stdio: [nullFd, 'pipe', 'pipe'],
      timeout: ms,
      killSignal: 'SIGTERM',
      env: {
        ...process.env,
        VIBE_ENABLE_CONNECTORS: 'false',
        HOME: process.env.HOME || '/home/ai_agent',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      fs.closeSync(nullFd);
      const rawOutput = stdout.trim();
      const stderrTrimmed = stderr.trim();

      if (code !== 0) {
        resolve({ success: false, error: stderrTrimmed || `Agent exited with code ${code}` });
        return;
      }

      resolve(parseResult(rawOutput, stderrTrimmed, cfg.outputFmt));
    });

    child.on('error', (err) => {
      fs.closeSync(nullFd);
      if (err.code === 'ETIMEDOUT' || err.killed) {
        resolve({ success: false, error: `Agent timed out after ${ms}ms` });
        return;
      }
      resolve({ success: false, error: err.message || String(err) });
    });
  });
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
