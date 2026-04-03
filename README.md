# VOLQ Panel

VOLQ is a game server management panel built with Node.js.

## Structure

- **VOLQ PANEL** — The web panel for managing game servers
- **VOLQ NODE** — The daemon (volqd) that runs on each node and manages Docker containers

## Requirements

- Node.js 18+
- Docker
- MySQL (for VOLQ NODE database features)

## VOLQ PANEL Setup

```bash
cd "VOLQ PANEL"
npm install
npm run seed
npm run createUser
npm start
```

## VOLQ NODE Setup

```bash
cd "VOLQ NODE"
npm install
npm start
```

## License

MIT
