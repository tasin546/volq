
/**
volqd - VOLQ Panel Daemon
 */
process.env.dockerSocket = process.platform === "win32" ? "//./pipe/docker_engine" : "/var/run/docker.sock";
const express = require('express');
const Docker = require('dockerode');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');
const CatLoggr = require('cat-loggr');
const WebSocket = require('ws');
const http = require('http');
const fs = require('node:fs');
const path = require('path');
const chalk = require('chalk')
const ascii = fs.readFileSync('./handlers/ascii.txt', 'utf8');
const { exec } = require('child_process');
const { init, createVolumesFolder } = require('./handlers/init.js');
const { seed } = require('./handlers/seed.js');
const { start, createNewVolume } = require('./routes/InstanceFTP.js')
const { createDatabaseAndUser } = require('./routes/InstanceDB.js');
const config = require('./config.json');

const docker = new Docker({ socketPath: process.env.dockerSocket });

/**
 * Initializes a WebSocket server tied to the HTTP server. This WebSocket server handles real-time
 * interactions such as authentication, container statistics reporting, logs streaming, and container
 * control commands (start, stop, restart). The WebSocket server checks for authentication on connection
 * and message reception, parsing messages as JSON and handling them according to their specified event type.
 */
const app = express();
const server = http.createServer(app);

const log = new CatLoggr();

/**
 * Sets up Express application middleware for JSON body parsing and basic authentication using predefined
 * user keys from the configuration. Initializes routes for managing Docker instances, deployments, and
 * power controls. These routes are grouped under the '/instances' path.
 */
console.log(chalk.gray(ascii) + chalk.white(`version v${config.version}\n`));
init();
seed();

app.use(bodyParser.json());
app.use(basicAuth({
    users: { 'Volq': config.key },
    challenge: true
}));

const instanceRouter = require('./routes/Instance.js');
const deploymentRouter = require('./routes/Deploy.js');
const filesystemRouter = require('./routes/Volume.js');
const archiveRouter = require('./routes/ArchiveVolume.js');
const powerRouter = require('./routes/PowerActions.js');
const pluginRouter = require('./routes/Plugins.js');


const os = require('os');
const checkDiskSpace = require('check-disk-space').default;

// Stats endpoint - must match exactly what your panel expects
app.get('/stats', async (req, res) => {
  try {
    // 1. Get memory stats
    const memoryTotal = os.totalmem();
    const memoryFree = os.freemem();
    const memoryUsed = memoryTotal - memoryFree;
    const memoryPercent = (memoryUsed / memoryTotal) * 100;

    // 2. Get disk stats
    const disk = await checkDiskSpace('/');
    const diskUsed = disk.size - disk.free;
    const diskPercent = (diskUsed / disk.size) * 100;

    // 3. Get CPU stats
    const cpuCores = os.cpus().length;
    const cpuUsage = await getCpuUsage();

    // 4. Get container stats
    const containers = await docker.listContainers({ all: true });
    const runningContainers = containers.filter(c => c.State === 'running');

    // 5. Format uptime
    const uptime = formatUptime(process.uptime());

    // Response structure MUST match exactly what your panel expects
    res.json({
      memory: {
        total: memoryTotal,
        used: memoryUsed,
        free: memoryFree,
        percent: parseFloat(memoryPercent.toFixed(2))
      },
      disk: {
        total: disk.size,
        used: diskUsed,
        free: disk.free,
        percent: parseFloat(diskPercent.toFixed(2))
      },
      cpu: {
        usage: parseFloat(cpuUsage.toFixed(2)),
        cores: cpuCores
      },
      uptime: uptime,
      status: 'Online',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Stats endpoint failed:', error);
    res.status(500).json({
      status: 'Offline',
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// CPU usage measurement
async function getCpuUsage() {
  return new Promise((resolve) => {
    const startMeasure = cpuAverage();
    setTimeout(() => {
      const endMeasure = cpuAverage(startMeasure);
      const idleDiff = endMeasure.idle - startMeasure.idle;
      const totalDiff = endMeasure.total - startMeasure.total;
      const percentage = (100 - (100 * idleDiff / totalDiff));
      resolve(percentage);
    }, 1000);
  });
}

function cpuAverage(previous) {
  const cpus = os.cpus();
  let idle = 0, total = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });

  return previous ? { idle: idle - previous.idle, total: total - previous.total } : { idle, total };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

// use routes
app.use('/instances', instanceRouter);
app.use('/instances', deploymentRouter);
app.use('/instances', powerRouter);

// archive
app.use('/archive', archiveRouter);

// fs
app.use('/fs', filesystemRouter);

// plugins
app.use('/plugins', pluginRouter);

// FTP
start();
app.get('/ftp/info/:id', (req, res) => {
    const filePath = './ftp/user-' + req.params.id + '.json';
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            res.status(500).json({ error: 'Error reading file' });
            return;
        }
        res.json(JSON.parse(data));
    });
});

app.post('/database/create/:name', async (req, res) => {
    try {
        const dbName = req.params.name;
        const credentials = await createDatabaseAndUser(dbName);
        res.status(200).json({
            message: `Database ${dbName} created successfully`,
            credentials
        });
    } catch (error) {
        console.error('Error creating database:', error);
        res.status(500).json({ error: 'Failed to create database' });
    }
});


/**
 * Initializes a WebSocket server tied to the HTTP server. This WebSocket server handles real-time
 * interactions such as authentication, container statistics reporting, logs streaming, and container
 * control commands (start, stop, restart). The WebSocket server checks for authentication on connection
 * and message reception, parsing messages as JSON and handling them according to their specified event type.
 * 
 * @param {http.Server} server - The HTTP server to bind the WebSocket server to.
 */
function initializeWebSocketServer(server) {
    const wss = new WebSocket.Server({ server }); // use express-ws so you can have multiple ws's, api routes & that on 1 server.

    wss.on('connection', (ws, req) => {
        let isAuthenticated = false;

        ws.on('message', async (message) => {
            log.debug('got ' + message);
            let msg = {};
            try {
                msg = JSON.parse(message);
            } catch (error) {
                ws.send('Invalid JSON');
                return;
            }

            if (msg.event === 'auth' && msg.args) {
                authenticateWebSocket(ws, req, msg.args[0], (authenticated, containerId, volumeId) => {
                    if (authenticated) {
                        isAuthenticated = true;
                        handleWebSocketConnection(ws, req, containerId, volumeId);
                    } else {
                        ws.send('Authentication failed');
                        ws.close(1008, "Authentication failed");
                    }
                });
            } else if (isAuthenticated) {
                const urlParts = req.url.split('/');
                const containerId = urlParts[2];

                if (!containerId) {
                    ws.close(1008, "Container ID not specified");
                    return;
                }

                const container = docker.getContainer(containerId);

                switch (msg.event) {
                    case 'cmd':
                        // Do absolutely fucking nothing. Not handling it here.
                        break;
                    case 'power:start':
                        performPowerAction(ws, container, 'start');
                        break;
                    case 'power:stop':
                        performPowerAction(ws, container, 'stop');
                        break;
                    case 'power:restart':
                        performPowerAction(ws, container, 'restart');
                        break;
                    default:
                        ws.send('Unsupported event');
                        break;
                }
            } else {
                ws.send('Unauthorized access');
                ws.close(1008, "Unauthorized access");
            }
        });

        function authenticateWebSocket(ws, req, password, callback) {
            if (password === config.key) {
                log.info('successful authentication on ws');
                ws.send(`\r\n\u001b[33m[volqd] \x1b[0mconnected!\r\n`);
                const urlParts = req.url.split('/');
                const containerId = urlParts[2];
                const volumeId = urlParts[3] || 0;

                if (!containerId) {
                    ws.close(1008, "Container ID not specified");
                    callback(false, null);
                    return;
                }

                callback(true, containerId, volumeId);
            } else {
                log.warn('authentication failure on websocket!');
                callback(false, null);
            }
        }

        function handleWebSocketConnection(ws, req, containerId, volumeId) {
            const container = docker.getContainer(containerId);
            const volume = volumeId || 0;

            container.inspect(async (err, data) => {
                if (err) {
                    ws.send('Container not found');
                    return;
                }

                if (req.url.startsWith('/exec/')) {
                    setupExecSession(ws, container);
                } else if (req.url.startsWith('/stats/')) {
                    setupStatsStreaming(ws, container, volume);
                } else {
                    ws.close(1002, "URL must start with /exec/ or /stats/");
                }
            });
        }

        async function setupExecSession(ws, container) {
            const logStream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                tail: 50
            });

            logStream.on('data', chunk => {
                ws.send(chunk.toString());
            });

            ws.on('message', (msg) => {
                if (isAuthenticated) {
                    const command = JSON.parse(msg).command;
                    
                    if (command) {
                        executeCommand(ws, container, command);
                    }
                }
            });

            ws.on('close', () => {
                logStream.destroy();
                log.info('WebSocket client disconnected');
            });
        }

        async function setupStatsStreaming(ws, container, volumeId) {
            const fetchStats = async () => {
                try {
                    const stats = await new Promise((resolve, reject) => {
                        container.stats({ stream: false }, (err, stats) => {
                            if (err) {
                                reject(new Error('Failed to fetch stats'));
                            } else {
                                resolve(stats);
                            }
                        });
                    });
        
                    // Calculate volume size
                    const volumeSize = await getVolumeSize(volumeId);
        
                    // Add volume size to stats object
                    stats.volumeSize = volumeSize;
        
                    ws.send(JSON.stringify(stats));
                } catch (error) {
                    ws.send(JSON.stringify({ error: error.message }));
                }
            };
        
            await fetchStats();
        
            const statsInterval = setInterval(fetchStats, 2000);
        
            ws.on('close', () => {
                clearInterval(statsInterval);
                log.info('WebSocket client disconnected');
            });
        }

        async function executeCommand(ws, container, command) {
            try {
                const stream = await container.attach({
                    stream: true,
                    stdin: true,
                    stdout: false,
                    stderr: false,
                    hijack: true
                });
                stream.write(command + '\n');
                stream.end();
            } catch (err) {
                log.error('Failed to send command:', err.message);
                ws.send(`\r\n\u001b[31m[volqd] \x1b[0mFailed to send command: ${err.message}\r\n`);
            }
        }

        async function performPowerAction(ws, container, action) {
            const actionMap = {
                'start': container.start.bind(container),
                'stop': container.kill.bind(container),
                'restart': container.restart.bind(container),
            };
        
            if (!actionMap[action]) {
                ws.send(`\r\n\u001b[33m[volqd] \x1b[0mInvalid action: ${action}\r\n`);
                return;
            }
        
            ws.send(`\r\n\u001b[33m[volqd] \x1b[0mWorking on ${action}...\r\n`);
        
            try {
                await actionMap[action]();
            } catch (err) {
                console.error(`Error performing ${action} action:`, err);
                ws.send(`\r\n\u001b[33m[volqd] \x1b[0mAction failed: ${err.message}\r\n`);
            }
        }

        async function getVolumeSize(volumeId) {
            const volumePath = path.join('./volumes', volumeId);
            try {
                const totalSize = await calculateDirectorySize(volumePath);
                return formatBytes(totalSize);
            } catch (err) {
                return 'Unknown';
            }
        }

        function calculateDirectorySize(directoryPath, currentDepth) {
            if (currentDepth >= 500) {
                log.warn(`Maximum depth reached at ${directoryPath}`);
                return 0;
            }
        
            let totalSize = 0;
            const files = fs.readdirSync(directoryPath);
            for (const file of files) {
                const filePath = path.join(directoryPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    totalSize += calculateDirectorySize(filePath, currentDepth + 1);
                } else {
                    totalSize += stats.size;
                }
            }
            return totalSize;
        }

        // fixed in 0.2.2 sam
        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    });
}

// Start the websocket server
initializeWebSocketServer(server);

/**
 * Default HTTP GET route that provides basic daemon status information including Docker connectivity
 * and system info. It performs a health check on Docker to ensure it's running and accessible, returning
 * the daemon's status and any pertinent Docker system information in the response.
 */
app.get('/', async (req, res) => {
    try {
        const dockerInfo = await docker.info();  // Fetches information about the docker
        const isDockerRunning = await docker.ping();  // Checks if the docker is up (which it probably is or this will err)

        // Prepare the response object with Docker status
        const response = {
            versionFamily: 1,
            versionRelease: 'volqd ' + config.version,
            online: true,
            remote: config.remote,
            mysql: {
              host: config.mysql.host,
              user: config.mysql.user,
              password: config.mysql.password
            },
            docker: {
              status: isDockerRunning ? 'running' : 'not running',
              systemInfo: dockerInfo
            }
          };

        res.json(response); // the point of this? just use the ws - yeah conn to the ws on nodes page and send that json over ws
    } catch (error) {
        console.error('Error fetching Docker status:', error);
        res.status(500).json({ error: 'Docker is not running - volqd will not function properly.' });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something has... gone wrong!');
});

/**
 * Starts the HTTP server with WebSocket support after a short delay, listening on the configured port.
 * Logs a startup message indicating successful listening. This delayed start allows for any necessary
 * initializations to complete before accepting incoming connections.
 */
const port = config.port;
setTimeout(function (){
  server.listen(port, () => {
    log.info('volqd is listening on port ' + port);
  });
}, 2000);
