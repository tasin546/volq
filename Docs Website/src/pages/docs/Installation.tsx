export default function DocsInstallation() {
  return (
    <>
      <h1>Installing VOLQ Panel</h1>
      <p className="lead">
        The complete guide to installing the central VOLQ Panel on your server.
      </p>

      <h2>Requirements</h2>
      <p>Before you begin, ensure your server meets these minimum requirements:</p>
      <ul>
        <li><strong>OS:</strong> Ubuntu 22.04 / Debian 11 or newer recommended</li>
        <li><strong>Node.js:</strong> v18.x or newer</li>
        <li><strong>npm:</strong> v9.x or newer</li>
        <li><strong>Memory:</strong> At least 1GB RAM</li>
        <li><strong>Storage:</strong> 2GB free space</li>
      </ul>

      <h2>Step 1: Clone the repository</h2>
      <p>First, clone the VOLQ repository to your server:</p>
      <pre><code>{`git clone https://github.com/tasin546/volq-latest.git
cd "volq-latest/VOLQ PANEL"`}</code></pre>

      <h2>Step 2: Install Dependencies</h2>
      <p>Install the required Node.js packages:</p>
      <pre><code>{`npm install`}</code></pre>

      <h2>Step 3: Build CSS</h2>
      <p>Generate the production Tailwind CSS file:</p>
      <pre><code>{`npm run build:css`}</code></pre>

      <h2>Step 4: Configuration</h2>
      <p>Edit the <code>config.json</code> file to set up your domain and ports. On the first run, the panel will automatically generate secure random keys for your sessions.</p>
      <pre><code>{`{
  "port": 3000,
  "domain": "panel.yourdomain.com",
  "mode": "production",
  "version": "1.0.0",
  "session_secret": "Random",
  "databaseURL": "sqlite://volq.db",
  "databaseTable": "volq"
}`}</code></pre>

      <h2>Step 5: Initialization</h2>
      <p>Seed the database and create your first administrator account:</p>
      <pre><code>{`npm run seed
npm run createUser`}</code></pre>

      <h2>Step 6: Start the Panel</h2>
      <p>We recommend using PM2 to keep the panel running in the background:</p>
      <pre><code>{`npm install -g pm2
pm2 start index.js --name volq-panel`}</code></pre>
    </>
  );
}
