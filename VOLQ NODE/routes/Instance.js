/**
 * @fileoverview Provides robust routes for managing Docker container instances within the Air Daemon.
 * This module allows for comprehensive Docker container management including listing, inspection,
 * deletion, and disk usage monitoring. Utilizes Dockerode with proper error handling and async/await.
 */

const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const docker = new Docker({ socketPath: process.env.dockerSocket || '/var/run/docker.sock' });
const execPromise = util.promisify(exec);

/**
 * GET /
 * Retrieves a list of all Docker containers on the host with comprehensive error handling.
 */
router.get('/', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    res.json(containers);
  } catch (err) {
    console.error('Error listing containers:', err);
    res.status(500).json({ 
      message: 'Failed to list containers',
      error: err.message 
    });
  }
});

/**
 * GET /:id
 * Fetches detailed information about a specific Docker container with proper validation.
 */
router.get('/:id', async (req, res) => {
  if (!req.params.id) {
    return res.status(400).json({ error: 'Container ID is required' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const data = await container.inspect();
    res.json(data);
  } catch (err) {
    console.error(`Error inspecting container ${req.params.id}:`, err);
    res.status(404).json({ 
      message: 'Container not found',
      error: err.message 
    });
  }
});

/**
 * GET /:id/ports
 * Lists all ports for a specific Docker container with proper error handling.
 */
router.get('/:id/ports', async (req, res) => {
  if (!req.params.id) {
    return res.status(400).json({ message: 'Container ID is required' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const data = await container.inspect();
    const ports = data.NetworkSettings.Ports || {};
    const portList = Object.entries(ports).map(([port, config]) => ({
      port,
      hostIp: config?.[0]?.HostIp || null,
      hostPort: config?.[0]?.HostPort || null
    }));
    res.json(portList);
  } catch (err) {
    console.error(`Error getting ports for container ${req.params.id}:`, err);
    res.status(404).json({ 
      message: 'Container not found',
      error: err.message 
    });
  }
});

/**
 * DELETE /:id
 * Deletes a specific Docker container and its associated volumes.
 */
router.delete('/:id', async (req, res) => {
  if (!req.params.id) {
    return res.status(400).json({ message: 'Container ID is required' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const { Name } = await container.inspect();
    const nameWithoutSlash = Name.startsWith('/') ? Name.slice(1) : Name;

    // Remove container first
    await container.remove({ force: true });
    
    // Then clean up volumes
    const volumeDir = path.join(__dirname, '../volumes', nameWithoutSlash);
    try {
      await fs.rm(volumeDir, { recursive: true, force: true });
      console.log(`Successfully deleted volume directory: ${volumeDir}`);
    } catch (fsErr) {
      console.warn(`Warning: Could not delete volume directory ${volumeDir}:`, fsErr.message);
    }

    res.json({ 
      success: true,
      message: `Container ${req.params.id} and its volumes were deleted`
    });
  } catch (err) {
    console.error(`Error deleting container ${req.params.id}:`, err);
    res.status(500).json({ 
      message: 'Failed to delete container',
      error: err.message 
    });
  }
});

/**
 * POST /purge/all
 * Purges all Docker containers and their associated volumes with comprehensive cleanup.
 */
router.post('/purge/all', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const deletionResults = [];

    for (const containerInfo of containers) {
      try {
        const container = docker.getContainer(containerInfo.Id);
        const { Name } = await container.inspect();
        const nameWithoutSlash = Name.startsWith('/') ? Name.slice(1) : Name;
        
        await container.remove({ force: true });
        deletionResults.push({
          id: containerInfo.Id,
          name: nameWithoutSlash,
          containerDeleted: true
        });

        const volumeDir = path.join(__dirname, '../volumes', nameWithoutSlash);
        try {
          await fs.rm(volumeDir, { recursive: true, force: true });
          deletionResults[deletionResults.length - 1].volumesDeleted = true;
          console.log(`Deleted volume directory: ${volumeDir}`);
        } catch (volErr) {
          deletionResults[deletionResults.length - 1].volumesDeleted = false;
          deletionResults[deletionResults.length - 1].volumesError = volErr.message;
          console.warn(`Could not delete volume directory ${volumeDir}:`, volErr.message);
        }
      } catch (err) {
        deletionResults.push({
          id: containerInfo.Id,
          error: err.message,
          success: false
        });
        console.error(`Error deleting container ${containerInfo.Id}:`, err.message);
      }
    }

    // Clean up any remaining volume directories
    const volumesBaseDir = path.join(__dirname, '../volumes');
    try {
      const volumeFolders = await fs.readdir(volumesBaseDir, { withFileTypes: true });
      for (const dirent of volumeFolders) {
        if (dirent.isDirectory()) {
          const dirPath = path.join(volumesBaseDir, dirent.name);
          try {
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`Deleted remaining volume directory: ${dirPath}`);
          } catch (dirErr) {
            console.warn(`Could not delete directory ${dirPath}:`, dirErr.message);
          }
        }
      }
    } catch (baseDirErr) {
      console.warn('Could not clean up volumes base directory:', baseDirErr.message);
    }

    res.json({ 
      success: true,
      message: 'Purge operation completed',
      results: deletionResults
    });
  } catch (err) {
    console.error('Error during purge:', err);
    res.status(500).json({ 
      message: 'Failed to complete purge operation',
      error: err.message 
    });
  }
});

/**
 * GET /:id/disk/usage
 * Gets disk usage information for a container's volumes with proper validation.
 */
router.get('/:id/disk/usage', async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: 'Container ID is required' });
  }

  const dirPath = path.join(__dirname, '../volumes', id);
  
  try {
    await fs.access(dirPath);
    
    try {
      const { stdout } = await execPromise(`du -sh "${dirPath}"`);
      const size = stdout.split('\t')[0];
      res.json({ 
        id, 
        totalSpace: size,
        path: dirPath
      });
    } catch (execErr) {
      console.error(`Error getting disk usage for ${dirPath}:`, execErr);
      res.status(500).json({ 
        error: 'Failed to calculate disk usage',
        details: execErr.message 
      });
    }
  } catch (fsErr) {
    res.status(404).json({ 
      error: 'Volume directory not found',
      path: dirPath 
    });
  }
});

module.exports = router;