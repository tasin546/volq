const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const mime = require('mime-types');
const { pipeline } = require('stream/promises');

// Constants for better maintainability
const ARCHIVES_DIR = path.join(__dirname, '../archives');
const VOLUMES_DIR = path.join(__dirname, '../volumes');
const MAX_ARCHIVE_SIZE = 1024 * 1024 * 1024 * 5; // 5GB max archive size

/**
 * Ensures the target path is within the specified base directory, preventing directory traversal attacks.
 * @param {string} base - The base directory path.
 * @param {string} target - The target directory or file path.
 * @returns {string} The absolute path that is confirmed to be within the base directory.
 * @throws {Error} If the resolved path attempts to escape the base directory.
 */
function safePath(base, target) {
    const resolvedBase = path.resolve(base);
    const fullPath = path.resolve(resolvedBase, target);
    
    if (!fullPath.startsWith(resolvedBase + path.sep) && fullPath !== resolvedBase) {
        throw new Error('Attempting to access outside of the allowed directory');
    }
    return fullPath;
}

/**
 * Formats file size into a human-readable string.
 * @param {number} bytes - The file size in bytes.
 * @returns {string} Formatted file size with appropriate unit.
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, exponent);
    
    return `${size.toFixed(2)} ${units[exponent]}`;
}

/**
 * Validates archive name to prevent path traversal and invalid characters
 * @param {string} name - Archive name to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidArchiveName(name) {
    return /^[a-zA-Z0-9_\-\.]+$/.test(name) && !name.includes('..');
}

/**
 * GET /:id/archives
 * Lists all archives for the specified volume, including their timestamp, size, and name.
 */
router.get('/:id/archives', async (req, res) => {
    const { id } = req.params;
    
    if (!id || !isValidArchiveName(id)) {
        return res.status(400).json({ message: 'Invalid volume ID' });
    }

    try {
        const archivePath = safePath(ARCHIVES_DIR, id);
        
        await fsPromises.access(archivePath, fs.constants.F_OK);
        const files = await fsPromises.readdir(archivePath, { withFileTypes: true });

        const detailedFiles = await Promise.all(
            files
                .filter(file => file.isFile())
                .map(async (file) => {
                    const filePath = path.join(archivePath, file.name);
                    const stats = await fsPromises.stat(filePath);

                    return {
                        name: file.name,
                        size: stats.size,
                        formattedSize: formatFileSize(stats.size),
                        lastUpdated: stats.mtime.toISOString(),
                    };
                })
        );

        // Sort by last updated (newest first)
        detailedFiles.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

        res.json({ archives: detailedFiles });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.json({ archives: [] });
        } else if (err.message.includes('outside of the allowed directory')) {
            res.status(403).json({ message: 'Access denied' });
        } else {
            console.error('Error listing archives:', err);
            res.status(500).json({ message: 'Failed to list archives' });
        }
    }
});

/**
 * POST /:id/archives/:volumeId/create
 * Creates an archive of the specified volume and stores it in the archives directory.
 */
router.post('/:id/archives/:volumeId/create', async (req, res) => {
    const { id, volumeId } = req.params;
    
    
    if (!volumeId || !isValidArchiveName(volumeId)) {
        return res.status(400).json({ message: 'Invalid volume ID' });
    }

    try {
        const volumePath = safePath(VOLUMES_DIR, volumeId);
        const archivePath = safePath(ARCHIVES_DIR, id);
        
        await fsPromises.mkdir(archivePath, { recursive: true });
        
        // Check if volume exists
        await fsPromises.access(volumePath, fs.constants.F_OK);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = `${id}-${timestamp}.zip`;
        const archiveFullPath = path.join(archivePath, archiveName);

        const output = fs.createWriteStream(archiveFullPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
            statConcurrency: 4 // Number of concurrent stat calls
        });

        // Set up event handlers
        let archiveError = null;
        archive.on('error', (err) => {
            archiveError = err;
            output.destroy();
        });

        output.on('error', (err) => {
            if (!archiveError) archiveError = err;
        });

        // Track archive size to prevent excessively large archives
        let totalBytes = 0;
        archive.on('data', (data) => {
            totalBytes += data.length;
            if (totalBytes > MAX_ARCHIVE_SIZE) {
                archiveError = new Error('Archive size exceeds maximum limit');
                archive.abort();
            }
        });

        // Finalize the archive
        archive.pipe(output);
        archive.directory(volumePath, false);
        await archive.finalize();

        if (archiveError) {
            // Clean up the partial archive if there was an error
            try {
                await fsPromises.unlink(archiveFullPath);
            } catch (cleanupErr) {
                console.error('Failed to clean up partial archive:', cleanupErr);
            }
            throw archiveError;
        }

        res.json({ 
            message: 'Archive created successfully', 
            archiveName,
            size: totalBytes,
            formattedSize: formatFileSize(totalBytes)
        });
    } catch (err) {
        console.error('Error creating archive:', err);
        if (err.message.includes('outside of the allowed directory')) {
            res.status(403).json({ message: 'Access denied' });
        } else if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Volume not found' });
        } else if (err.message.includes('Archive size exceeds maximum limit')) {
            res.status(413).json({ message: 'Archive size exceeds maximum limit' });
        } else {
            res.status(500).json({ message: 'Failed to create archive' });
        }
    }
});

/**
 * GET /:id/archives/download/:archiveName
 * Allows downloading of the specified archive file with improved performance and reliability.
 */
router.get('/:id/archives/download/:archiveName', async (req, res) => {
    const { id, archiveName } = req.params;
    
    if (!id || !isValidArchiveName(id)) {
        return res.status(400).json({ message: 'Invalid archive ID' });
    }
    
    if (!archiveName || !isValidArchiveName(archiveName)) {
        return res.status(400).json({ message: 'Invalid archive name' });
    }

    try {
        const archivePath = safePath(ARCHIVES_DIR, path.join(id, archiveName));
        
        // Check if file exists and get stats
        const stats = await fsPromises.stat(archivePath);
        if (!stats.isFile()) {
            return res.status(404).json({ message: 'Archive not found' });
        }

        // Set headers
        const mimeType = mime.lookup(archivePath) || 'application/octet-stream';
        const filename = encodeURIComponent(archiveName); // Properly encode filename for headers

        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-store'); // Prevent caching of sensitive files

        // Use proper streaming with error handling
        const fileStream = fs.createReadStream(archivePath, {
            highWaterMark: 64 * 1024 // 64KB chunks for better performance
        });

        // Handle client disconnects
        req.on('close', () => {
            fileStream.destroy();
        });

        // Use pipeline for proper error handling and cleanup
        await pipeline(fileStream, res);
    } catch (err) {
        console.error('Error downloading archive:', err);
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Archive not found' });
        } else if (err.message.includes('outside of the allowed directory')) {
            res.status(403).json({ message: 'Access denied' });
        } else if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
            // Client disconnected, no need to respond
        } else {
            res.status(500).json({ message: 'Failed to download archive' });
        }
    }
});

/**
 * POST /:id/archives/delete/:archiveName
 * Deletes the specified archive.
 */
router.post('/:id/archives/delete/:archiveName', async (req, res) => {
    const { id, archiveName } = req.params;
    
    if (!id || !isValidArchiveName(id)) {
        return res.status(400).json({ message: 'Invalid archive ID' });
    }
    
    if (!archiveName || !isValidArchiveName(archiveName)) {
        return res.status(400).json({ message: 'Invalid archive name' });
    }

    try {
        const archivePath = safePath(ARCHIVES_DIR, path.join(id, archiveName));
        
        // Verify it's a file before deleting
        const stats = await fsPromises.stat(archivePath);
        if (!stats.isFile()) {
            return res.status(404).json({ message: 'Archive not found' });
        }

        await fsPromises.unlink(archivePath);
        res.json({ message: 'Archive deleted successfully' });
    } catch (err) {
        console.error('Error deleting archive:', err);
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Archive not found' });
        } else if (err.message.includes('outside of the allowed directory')) {
            res.status(403).json({ message: 'Access denied' });
        } else {
            res.status(500).json({ message: 'Failed to delete archive' });
        }
    }
});

/**
 * POST /:id/archives/rollback/:volumeId/:archiveName
 * Rolls back the specified volume to the state of the given archive.
 */
router.post('/:id/archives/rollback/:volumeId/:archiveName', async (req, res) => {
    const { id, archiveName, volumeId } = req.params;
    
    if (!id || !isValidArchiveName(id)) {
        return res.status(400).json({ message: 'Invalid archive ID' });
    }
    
    if (!volumeId || !isValidArchiveName(volumeId)) {
        return res.status(400).json({ message: 'Invalid volume ID' });
    }
    
    if (!archiveName || !isValidArchiveName(archiveName)) {
        return res.status(400).json({ message: 'Invalid archive name' });
    }

    try {
        const volumePath = safePath(VOLUMES_DIR, volumeId);
        const archivePath = safePath(ARCHIVES_DIR, path.join(id, archiveName));
        
        // Verify archive exists
        await fsPromises.access(archivePath, fs.constants.F_OK);

        // Clear the volume directory
        try {
            const files = await fsPromises.readdir(volumePath);
            await Promise.all(files.map(file => 
                fsPromises.rm(path.join(volumePath, file), { recursive: true, force: true })
            ));
        } catch (clearErr) {
            if (clearErr.code !== 'ENOENT') throw clearErr;
            // If volume directory doesn't exist, create it
            await fsPromises.mkdir(volumePath, { recursive: true });
        }

        // Extract the archive
        const zipStream = fs.createReadStream(archivePath);
        const extractStream = unzipper.Extract({ path: volumePath });

        await new Promise((resolve, reject) => {
            extractStream.on('close', resolve);
            extractStream.on('error', reject);
            zipStream.pipe(extractStream);
        });

        res.json({ message: 'Volume rolled back successfully' });
    } catch (err) {
        console.error('Error rolling back volume:', err);
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Archive or volume not found' });
        } else if (err.message.includes('outside of the allowed directory')) {
            res.status(403).json({ message: 'Access denied' });
        } else {
            res.status(500).json({ message: 'Failed to roll back volume' });
        }
    }
});

module.exports = router;