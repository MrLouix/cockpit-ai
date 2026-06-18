import { spawn } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getAgent, buildArgs } from '../config/agents.js';

export const runAntigravity = async (prompt, options = {}) => {
  try {
    const { timeout = 300000, workingDirectory } = options;
    const agentConfig = getAgent('antigravity');
    
    if (!agentConfig) {
      throw new Error('Antigravity agent is not configured or installed');
    }
    
    // Use --log-file to work around agy rate-limit bug (empty stdout)
    const logFile = join(tmpdir(), `agy-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
    const args = buildArgs('antigravity', prompt);
    const command = agentConfig.command;
    const commandArgs = ['--log-file', logFile, ...args];

    const spawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'], // stdin closed, stdout/stderr piped
      shell: false
    };
    
    if (workingDirectory) {
      spawnOptions.cwd = workingDirectory;
    }

    return new Promise((resolve) => {
      const child = spawn(command, commandArgs, spawnOptions);

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', async (code) => {
        clearTimeout(timeoutId);
        if (timedOut) {
          cleanup(logFile);
          resolve({ success: false, result: '', error: 'Timeout exceeded' });
          return;
        }

        // If stdout is empty, fall back to log file (rate-limit bug workaround)
        if (!stdout.trim()) {
          try {
            const logContent = await readFile(logFile, 'utf-8');
            if (logContent.trim()) {
              stdout = logContent;
            }
          } catch {
            // Log file may not exist if agy failed early
          }
        }

        cleanup(logFile);

        if (code !== 0 || (stderr && !stdout)) {
          resolve({ success: false, result: '', error: stderr });
          return;
        }

        resolve({ success: true, result: stdout });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        cleanup(logFile);
        resolve({
          success: false,
          result: '',
          error: err.message || 'Unknown error'
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      result: '',
      error: err.message || 'Unknown error',
    };
  }
};

/** Best-effort cleanup of the temporary log file. */
function cleanup(filePath) {
  unlink(filePath).catch(() => {});
}
