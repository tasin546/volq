import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function DocsLayout() {
  return (
    <div className="min-h-screen bg-[#111114] text-[#f4f4f5] flex flex-col font-sans">
      <Header />
      <div className="flex flex-1 max-w-[1400px] w-full mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 px-6 md:px-12 py-10 pb-24 lg:pb-10">
          <div className="prose prose-invert max-w-3xl prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-[#27272a] prose-a:text-blue-400 hover:prose-a:text-blue-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
