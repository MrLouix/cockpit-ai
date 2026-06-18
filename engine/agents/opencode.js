import { spawn } from 'child_process';
import { getAgent, buildArgs } from '../config/agents.js';

export const runOpencode = async (prompt, options = {}) => {
  try {
    const { timeout = 300000, workingDirectory } = options;
    const agentConfig = getAgent('opencode');
    
    if (!agentConfig) {
      throw new Error('Opencode agent is not configured or installed');
    }
    
    const args = buildArgs('opencode', prompt);
    const command = agentConfig.command;
    const commandArgs = args;

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

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (timedOut) {
          resolve({ success: false, result: '', error: 'Timeout exceeded' });
          return;
        }

        if (code !== 0 || (stderr && !stdout)) {
          resolve({ success: false, result: '', error: stderr });
          return;
        }

        resolve({ success: true, result: stdout });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
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
