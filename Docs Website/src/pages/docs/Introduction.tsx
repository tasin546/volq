export default function DocsIntroduction() {
  return (
    <>
      <h1>Introduction to VOLQ</h1>
      <p className="lead">
        VOLQ is a modern, blazing-fast game server management panel built specifically for server hosts and communities that want full control without the bloat.
      </p>

      <h2>Why VOLQ?</h2>
      <p>
        Traditional panels are often bloated, slow, and hard to customize. VOLQ was built from the ground up using modern web technologies (Node.js, Express, React, and Tailwind CSS) to provide a smooth, app-like experience.
      </p>
      
      <ul>
        <li><strong>Modern Stack:</strong> No legacy PHP codebases. Fully asynchronous Node.js backend.</li>
        <li><strong>Real-time Everything:</strong> Live stats, live console, and instant actions powered by WebSockets.</li>
        <li><strong>True Isolation:</strong> Every server runs in its own Docker container with strict resource limits.</li>
        <li><strong>Developer Friendly:</strong> REST API, simple plugin system, and highly configurable.</li>
      </ul>

      <h2>Architecture</h2>
      <p>
        VOLQ consists of two main components:
      </p>
      
      <h3>1. VOLQ Panel</h3>
      <p>
        The frontend dashboard and central database. This is where users log in, manage their servers, and administrators configure the network. You only need one Panel installation.
      </p>

      <h3>2. VOLQ Node (volqd)</h3>
      <p>
        The daemon that runs on the actual machines hosting the game servers. It communicates securely with the Panel, manages Docker containers, streams stats, and handles file operations and FTP. You install one Node on every physical machine you want to host servers on.
      </p>
    </>
  );
}
