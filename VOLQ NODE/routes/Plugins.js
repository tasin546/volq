const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const https = require('https');
const http = require('http');

const VOLUMES_DIR = path.join(__dirname, '../volumes');

function safePath(base, target) {
    const fullPath = path.resolve(base, target);
    if (!fullPath.startsWith(path.resolve(base))) throw new Error('Path traversal detected');
    return fullPath;
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fsSync.createWriteStream(destPath);
        const request = protocol.get(url, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                fsSync.unlink(destPath, () => {});
                return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                file.close();
                fsSync.unlink(destPath, () => {});
                return reject(new Error(`Download failed with status ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        });
        request.on('error', err => { file.close(); fsSync.unlink(destPath, () => {}); reject(err); });
        file.on('error', err => { reject(err); });
    });
}

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const pluginsPath = path.join(VOLUMES_DIR, id, 'plugins');
    try {
        await fs.mkdir(pluginsPath, { recursive: true });
        const files = await fs.readdir(pluginsPath);
        const plugins = await Promise.all(
            files
                .filter(f => f.endsWith('.jar'))
                .map(async f => {
                    const stat = await fs.stat(path.join(pluginsPath, f)).catch(() => ({ size: 0 }));
                    return { name: f, filename: f, size: stat.size };
                })
        );
        res.json({ plugins });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/install', async (req, res) => {
    const { id } = req.params;
    const { url, filename } = req.body;
    if (!url || !filename) return res.status(400).json({ error: 'url and filename are required' });
    const pluginsPath = path.join(VOLUMES_DIR, id, 'plugins');
    try {
        await fs.mkdir(pluginsPath, { recursive: true });
        const destPath = safePath(pluginsPath, filename);
        await downloadFile(url, destPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id/:filename', async (req, res) => {
    const { id, filename } = req.params;
    const pluginsPath = path.join(VOLUMES_DIR, id, 'plugins');
    try {
        const filePath = safePath(pluginsPath, decodeURIComponent(filename));
        await fs.unlink(filePath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
