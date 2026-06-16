import { Router } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const router = Router();

// GET /api/files/ls?path=/home/ai_agent/projects
// Returns: { path, parent, directories: [...], files: [...] }
router.get('/ls', async (req, res, next) => {
  try {
    const raw = req.query.path;
    const targetPath = typeof raw === 'string' && raw.length > 0
      ? path.resolve(raw)
      : path.resolve('/home/ai_agent');

    // Safety: restrict to /home/ai_agent subtree
    if (!targetPath.startsWith('/home/ai_agent')) {
      return res.status(403).json({ error: 'Path outside home directory' });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const directories = [];
    const files = [];

    for (const entry of entries) {
      const info = { name: entry.name, fullPath: path.join(targetPath, entry.name) };
      if (entry.isDirectory()) {
        // Skip hidden dirs and node_modules to keep it clean
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        directories.push(info);
      } else {
        // Skip hidden files
        if (entry.name.startsWith('.')) continue;
        files.push(info);
      }
    }

    // Sort: directories first, then files, alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      path: targetPath,
      parent: path.dirname(targetPath),
      directories,
      files,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    if (err.code === 'EACCES') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next(err);
  }
});

export default router;
