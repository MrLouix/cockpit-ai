import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { getAgent } from '../config/agents.js';

/**
 * Wrapper Claude — lance `claude -p` avec le prompt en argument.
 * Utilise spawn avec stdin redirigé vers /dev/null pour éviter l'attente de 3s.
 */
export async function run(prompt, timeout, cwd = process.cwd()) {
  const cfg = getAgent('claude');
  if (!cfg) {
    return { success: false, error: 'Claude CLI is not installed on this machine.' };
  }

  // Claude: claude -p --output-format {text|json} "prompt"
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : [];
  const args = [...cfg.args, ...outputArgs, prompt];
  const ms = timeout ?? cfg.timeout;

  return new Promise((resolve) => {
    // Open /dev/null for stdin to prevent "no stdin data received" warning
    const nullFd = fs.openSync('/dev/null', 'r');
    
    const child = spawn(cfg.command, args, {
      stdio: [nullFd, 'pipe', 'pipe'],
      timeout: ms,
      killSignal: 'SIGTERM',
      cwd,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      fs.closeSync(nullFd);
      const rawOutput = stdout.trim();
      const stderrTrimmed = stderr.trim();
      
      // Always try to parse stdout first - Claude sends errors on stdout as JSON
      if (cfg.outputFmt === 'json' && rawOutput) {
        try {
          const parsed = JSON.parse(rawOutput);
          // Claude returns error info in JSON: {is_error: true, result: "error message", api_error_status: 429}
          if (parsed.is_error === true) {
            const errorMsg = parsed.result || parsed.error || 'Unknown error';
            const apiStatus = parsed.api_error_status ? ` (API status: ${parsed.api_error_status})` : '';
            resolve({ success: false, error: errorMsg + apiStatus, raw: parsed });
          } else if (code === 0) {
            // Normal successful response
            const text = parsed?.result?.text ?? parsed?.result ?? '';
            resolve({ success: true, result: String(text).trim(), raw: parsed });
          } else {
            // Non-zero exit code with JSON output
            resolve({ success: false, error: rawOutput, raw: parsed });
          }
        } catch {
          // Not valid JSON, fall through to text handling
          if (code === 0) {
            resolve({ success: true, result: rawOutput, error: stderrTrimmed || undefined });
          } else {
            resolve({ success: false, error: stderrTrimmed || rawOutput || `Process exited with code ${code}` });
          }
        }
      } else {
        // Text mode
        if (code === 0) {
          resolve({ success: true, result: rawOutput, error: stderrTrimmed || undefined });
        } else {
          resolve({ success: false, error: stderrTrimmed || rawOutput || `Process exited with code ${code}` });
        }
      }
    });

    child.on('error', (err) => {
      fs.closeSync(nullFd);
      resolve({ success: false, error: err.message || String(err) });
    });

    child.on('timeout', () => {
      child.kill('SIGTERM');
      fs.closeSync(nullFd);
      resolve({ success: false, error: `Agent timed out after ${ms}ms` });
    });
  });
}

