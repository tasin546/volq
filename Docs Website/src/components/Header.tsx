import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-16 border-b border-[#27272a] bg-[#111114]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button className="lg:hidden text-zinc-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            V
          </div>
          <span className="font-bold text-lg tracking-tight text-white hidden sm:block">VOLQ</span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-6">
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link to="/docs" className="text-white">Documentation</Link>
          <a href="https://github.com/tasin546/volq-latest" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <a href="https://discord.gg" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Discord</a>
        </div>
      </div>
    </header>
  );
}
