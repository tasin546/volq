/**
 * @fileoverview Handles container power management actions via Docker. This module provides
 * a robust interface to manage Docker containers with proper error handling, input validation,
 * and additional features like operation timeouts and container existence checks.
 */

const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const { promisify } = require('util');
const timeout = promisify(setTimeout);

// Configure Docker connection with error handling for socket path
const dockerSocketPath = process.env.dockerSocket || '/var/run/docker.sock';
const docker = new Docker({ socketPath: dockerSocketPath });

// Operation timeout (5 seconds)
const OPERATION_TIMEOUT = 5000;

/**
 * Checks if a container exists
 * @param {Docker.Container} container - The container object to check
 * @returns {Promise<boolean>} - True if container exists, false otherwise
 */
async function containerExists(container) {
    try {
        await container.inspect();
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * POST /:id/:power
 * Manages the power state of a Docker container with robust error handling and validation.
 * 
 * Supported actions: start, stop, restart, pause, unpause, kill
 * 
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @returns {Response} JSON response with operation result or error
 */
router.post('/:id/:power', async (req, res) => {
    const { id, power } = req.params;
    
    // Validate container ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ 
            error: 'Invalid container ID',
            details: 'Container ID must be a non-empty string'
        });
    }

    const container = docker.getContainer(id);
    
    try {
        // Check if container exists first
        if (!await containerExists(container)) {
            return res.status(404).json({ 
                error: 'Container not found',
                details: `Container with ID ${id} does not exist`
            });
        }

        // Validate and execute the power action with timeout
        switch (power) {
            case 'start':
                await Promise.race([
                    container.start(),
                    timeout(OPERATION_TIMEOUT, 'Operation timed out')
                ]);
                break;
                
            case 'stop':
                await Promise.race([
                    container.stop(),
                    timeout(OPERATION_TIMEOUT, 'Operation timed out')
                ]);
                break;
                
            case 'restart':
                await Promise.race([
                    container.restart({ t: 10 }), // 10 second timeout for graceful shutdown
                    timeout(OPERATION_TIMEOUT, 'Operation timed out')
                ]);
                break;
                
            case 'pause':
                await Promise.race([
                    container.pause(),
                    timeout(OPERATION_TIMEOUT, 'Operation timed out')
                ]);
                break;
                
            case 'unpause':
                await Promise.race([
                    container.unpause(),
                    timeout(OPERATION_TIMEOUT, 'Operation timed out')
                ]);
                break;
                
            case 'kill':
                await Promise.race([
                    container.kill(),
                    timeout(OPERATION_TIMEOUT, 'Operation timed out')
                ]);
                break;
                
            default:
                return res.status(400).json({ 
                    error: 'Invalid action',
                    details: `Supported actions are: start, stop, restart, pause, unpause, kill`,
                    received: power
                });
        }

        res.status(200).json({ 
            success: true,
            message: `Container ${power} operation completed successfully`,
            containerId: id
        });
        
    } catch (err) {
        // Handle specific error cases
        if (err.message === 'Operation timed out') {
            return res.status(504).json({ 
                error: 'Operation timeout',
                details: `The ${power} operation timed out after ${OPERATION_TIMEOUT/1000} seconds`,
                containerId: id
            });
        }
        
        // Handle Docker-specific errors
        if (err.statusCode === 304) {
            return res.status(400).json({
                error: 'Container already in desired state',
                details: `Container is already ${power}ed`,
                containerId: id
            });
        }
        
        // Generic error handling
        res.status(500).json({ 
            error: 'Operation failed',
            details: err.message,
            containerId: id
        });
    }
});

module.exports = router;