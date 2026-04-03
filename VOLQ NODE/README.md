# VOLQ Node (volqd)

> The daemon component of VOLQ Panel. Manages Docker containers, file systems, FTP, and real-time stats streaming.

```
____   ____________  .____    ________
\   \ /   /\_____  \ |    |   \_____  \
 \   Y   /  /   |   \|    |    /  / \  \
  \     /  /    |    \    |___/   \_/.  \
   \___/   \_______  /_______ \_____\ \_/
                   \/        \/      \__>
                 version v1.0.0
```

---

## Overview

VOLQ Node (`volqd`) is the backend daemon that runs on each machine hosting game servers. It receives instructions from VOLQ Panel over HTTP and WebSocket, manages Docker containers, handles the file system, streams real-time stats and console output, and provides FTP access to server volumes.

---

## Features

- **Docker management** — Create, start, stop, restart, and delete containers
- **Real-time console** — Bidirectional WebSocket exec session for live console I/O
- **Live stats streaming** — CPU, RAM, disk usage streamed via WebSocket every 2 seconds
- **File system API** — Browse, read, write, rename, delete, zip/unzip files inside volumes
- **Plugin management** — List, install (from URL), and delete `.jar` plugins in server volumes
- **FTP server** — Built-in FTP daemon per volume with auto-generated credentials
- **Database provisioning** — Create and manage MySQL databases per instance
- **Archive support** — Import/export volume archives

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Docker | ≥ 24.x |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/tasin546/volq-latest.git
cd volq-latest/VOLQ\ NODE
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure

```bash
node handlers/configure.js
```

Or edit `config.json` manually:

```json
{
  "remote": "http://your-panel-ip:3000",
  "key": "your-secret-key",
  "port": 3002,
  "version": "1.0.0",
  "ftp": {
    "ip": "your-public-ip",
    "port": 3003
  }
}
```

> The `key` must match the API key registered for this node in the VOLQ Panel admin interface.

### 4. Start the daemon

```bash
npm start
# or with pm2:
pm2 start index.js --name volq-node
```

---

## API Overview

All endpoints require HTTP Basic Auth (`Volq` / `<config.key>`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/stats` | Node resource stats (CPU, RAM, disk) |
| `POST` | `/instances/deploy` | Deploy a new container |
| `DELETE` | `/instances/delete/:id` | Delete a container and its volume |
| `POST` | `/instances/:id/start` | Start a container |
| `POST` | `/instances/:id/stop` | Stop a container |
| `POST` | `/instances/:id/restart` | Restart a container |
| `GET` | `/fs/:id/files` | List files in a volume |
| `GET` | `/fs/:id/files/read/:file` | Read file contents |
| `POST` | `/fs/:id/files/edit/:file` | Write file contents |
| `DELETE` | `/fs/:id/files/delete/:file` | Delete a file |
| `GET` | `/plugins/:id` | List installed plugins |
| `POST` | `/plugins/:id/install` | Download and install a plugin |
| `DELETE` | `/plugins/:id/:filename` | Delete a plugin |

### WebSocket

Connect to `ws://node:port/stats/<containerId>/<volumeId>` or `ws://node:port/exec/<containerId>`.  
Authenticate immediately after connect:

```json
{ "event": "auth", "args": ["your-secret-key"] }
```

---

## Directory Structure

```
VOLQ NODE/
├── handlers/       Core handlers (init, configure, seed, ascii)
├── routes/         Express route modules
│   ├── Instance.js     Container lifecycle
│   ├── Deploy.js       Container deployment
│   ├── PowerActions.js Start/stop/restart
│   ├── Volume.js       File system operations
│   ├── Plugins.js      Plugin management
│   ├── ArchiveVolume.js Archive import/export
│   ├── InstanceFTP.js  FTP server integration
│   └── InstanceDB.js   Database provisioning
├── volumes/        Persistent server data (per volume ID)
├── ftp/            FTP user config files
└── config.json     Node configuration
```

---

## License

MIT © VOLQ Engineering
