# VOLQ Panel

> Game server management panel built with Node.js, Express, and Docker.

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

VOLQ Panel is a modern, self-hosted game server management panel. It communicates with one or more **VOLQ Node** daemon instances to provision, manage, and monitor Docker-based game servers in real time.

---

## Features

- **Instance Management** — Create, delete, redeploy, and reinstall game server instances
- **Real-time Console** — WebSocket-powered terminal with full command input
- **Live Stats** — CPU, RAM, and disk usage streamed live on the instances overview
- **File Manager** — Browse, upload, download, edit, rename, zip/unzip files inside containers
- **Plugin Manager** — Search and install Minecraft plugins directly from Modrinth
- **Databases** — Provision and manage MySQL databases per instance
- **FTP Access** — Built-in FTP credentials for each instance
- **Networking** — Manage port allocations per instance
- **Startup Config** — Edit startup variables and Docker image per instance
- **User Management** — Per-instance user access control
- **Modpack Installer** — Install modpacks directly
- **Automations** — Schedule automated tasks per instance
- **Admin Panel**
  - Node management and health monitoring
  - User administration
  - Docker image management
  - API key generation
  - Audit logs
  - Analytics dashboard
  - Panel plugins/extensions
  - Appearance, SMTP, and theme settings
- **Multi-language** — Built-in translation support (EN, DE, FR, ES, AR, ZH, JA)
- **2FA** — Two-factor authentication via TOTP
- **Rate limiting** — Built-in POST request rate limiting
- **Panel plugins** — Extensible via drop-in plugin modules

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Docker | ≥ 24.x (on VOLQ Node host) |
| VOLQ Node | v1.0.0 |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/tasin546/volq-latest.git
cd volq-latest/VOLQ\ PANEL
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build Tailwind CSS

```bash
npm run build:css
```

### 4. Configure

Edit `config.json` — on first run the panel auto-generates secrets marked `"Random"`:

```json
{
  "port": 3000,
  "domain": "localhost",
  "mode": "production",
  "version": "1.0.0",
  "session_secret": "Random",
  "databaseURL": "sqlite://volq.db",
  "databaseTable": "volq"
}
```

### 5. Seed the database (first run only)

```bash
npm run seed
```

### 6. Create an admin user (first run only)

```bash
npm run createUser
```

### 7. Start the panel

```bash
npm start
# or with pm2:
pm2 start index.js --name volq-panel
```

The panel will be available at `http://your-server:3000`.

---

## Directory Structure

```
VOLQ PANEL/
├── exec/           CLI tools (seed, createUser)
├── handlers/       Core handlers (db, auth, init, email, translation)
├── lang/           Translation files (en, de, fr, es, ar, zh, ja)
├── plugins/        Drop-in panel extension modules
├── public/         Static assets (CSS, JS, images)
├── routes/         Express route modules
│   ├── Admin/      Admin-only routes
│   ├── Instance/   Per-instance routes (console, files, plugins, etc.)
│   └── Remote/     Remote image listing
├── storage/        Theme and persistent storage
├── utils/          Utility helpers
└── views/          EJS templates
    ├── admin/      Admin panel views
    ├── components/ Shared layout components
    ├── instance/   Instance-level views
    └── errors/     Error pages
```

---

## Environment Notes

- The panel stores data in **SQLite** by default. MySQL is supported via `databaseURL: "mysql://user:pass@host/db"`.
- Sessions are persisted in `sessions.db` (SQLite).
- The panel expects at least one **VOLQ Node** to be registered via the admin panel before instances can be created.

---

## License

MIT © VOLQ Engineering
