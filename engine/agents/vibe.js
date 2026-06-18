import { exec } from 'child_process';
import { promisify } from 'util';
import { getAgent } from '../config/agents.js';

const execAsync = promisify(exec);

export const runVibe = async (prompt, options = {}) => {
  try {
    const { timeout = 300000 } = options;
    const agentConfig = getAgent('vibe');
    
    if (!agentConfig) {
      throw new Error('Vibe agent is not configured or installed');
    }
    
    const escaped = prompt.replace(/"/g, '\\"');
    const command = `${agentConfig.command} -p "${escaped}"`;

    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stderr && !stdout) {
      return { success: false, result: '', error: stderr };
    }

    return { success: true, result: stdout };
  } catch (err) {
    return {
      success: false,
      result: '',
      error: err.message || err.stdout || err.stderr || 'Unknown error',
    };
  }
};
