import { motion } from 'framer-motion';
import { ArrowRight, Terminal, Shield, Zap, Server, Code, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: <Terminal className="w-6 h-6 text-blue-500" />,
    title: "Docker Power",
    description: "Manage game servers in fully isolated Docker containers with real-time stats."
  },
  {
    icon: <Zap className="w-6 h-6 text-blue-500" />,
    title: "Real-time Console",
    description: "Bidirectional WebSocket exec session for live console I/O and interaction."
  },
  {
    icon: <Shield className="w-6 h-6 text-blue-500" />,
    title: "Secure & Built-in",
    description: "Built-in FTP daemon per volume with auto-generated credentials."
  },
  {
    icon: <Server className="w-6 h-6 text-blue-500" />,
    title: "Resource Management",
    description: "Allocate and limit CPU, RAM, and Disk space for every single instance."
  },
  {
    icon: <Code className="w-6 h-6 text-blue-500" />,
    title: "Plugin System",
    description: "Search, download and manage plugins for your instances automatically."
  },
  {
    icon: <Settings className="w-6 h-6 text-blue-500" />,
    title: "Deep Configuration",
    description: "Tweak every aspect of the panel and node to perfectly fit your ecosystem."
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#111114] text-[#f4f4f5] overflow-x-hidden font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-[#111114]/80 backdrop-blur-md border-b border-[#27272a] z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(37,99,235,0.5)]">
              V
            </div>
            <span className="font-bold text-xl tracking-tight">VOLQ</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <Link to="/docs" className="hover:text-white transition-colors">Documentation</Link>
            <a href="https://github.com/tasin546/volq-latest" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/docs" 
              className="bg-[#27272a] hover:bg-[#3f3f46] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Read Docs
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              The modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">game server</span> management panel.
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Self-hosted, beautiful, and blazing fast. Built on Node.js and Docker to give you the ultimate control over your infrastructure.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/docs/installation" 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)]"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a 
                href="https://github.com/tasin546/volq-latest" 
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#27272a] hover:bg-[#3f3f46] text-white px-8 py-3.5 rounded-xl font-medium transition-all border border-[#3f3f46]"
              >
                View on GitHub
              </a>
            </div>
          </motion.div>

          {/* Terminal Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-20 mx-auto max-w-3xl bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl"
          >
            <div className="h-10 bg-[#18181b] border-b border-[#27272a] flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-zinc-500 font-mono">volq@node ~</span>
            </div>
            <div className="p-6 text-left font-mono text-sm">
              <div className="flex gap-2 text-zinc-400 mb-2">
                <span className="text-green-400">❯</span>
                <span>npm install -g volq-cli</span>
              </div>
              <div className="text-zinc-500 mb-4">Installing VOLQ globally...</div>
              <div className="flex gap-2 text-zinc-400 mb-2">
                <span className="text-green-400">❯</span>
                <span>volq init</span>
              </div>
              <div className="text-blue-400 mb-1">Initializing VOLQ Node...</div>
              <div className="text-zinc-300">✓ Generated daemon configuration</div>
              <div className="text-zinc-300">✓ Connected to Docker engine</div>
              <div className="text-green-400 mt-2">Daemon started on port 3002. Ready to accept connections.</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-[#09090b] border-t border-[#27272a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Built for scale and performance</h2>
            <p className="text-zinc-400">Everything you need to run your game servers smoothly.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-[#111114] border border-[#27272a] p-6 rounded-2xl hover:border-blue-500/50 transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-zinc-100">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs">
              V
            </div>
            <span className="font-bold tracking-tight">VOLQ Panel</span>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} VOLQ Engineering. MIT Licensed.
          </p>
        </div>
      </footer>
    </div>
  );
}
