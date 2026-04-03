import { NavLink } from 'react-router-dom';

const navItems = [
  {
    title: "Getting Started",
    links: [
      { name: "Introduction", path: "/docs" },
      { name: "Installation", path: "/docs/installation" },
      { name: "Configuration", path: "/docs/configuration" },
    ]
  },
  {
    title: "VOLQ Panel",
    links: [
      { name: "Users & Roles", path: "/docs/panel/users" },
      { name: "Nodes & Locations", path: "/docs/panel/nodes" },
      { name: "Docker Images", path: "/docs/panel/images" },
    ]
  },
  {
    title: "VOLQ Node",
    links: [
      { name: "Setup Daemon", path: "/docs/node/setup" },
      { name: "Ports & Allocation", path: "/docs/node/ports" },
      { name: "Troubleshooting", path: "/docs/node/troubleshooting" },
    ]
  }
];

export default function Sidebar() {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[#27272a] h-[calc(100vh-4rem)] overflow-y-auto bg-[#111114] sticky top-16 hidden lg:block">
      <div className="p-6 space-y-8">
        {navItems.map((section, i) => (
          <div key={i}>
            <h4 className="font-semibold text-white mb-3 text-sm">{section.title}</h4>
            <div className="flex flex-col space-y-1 border-l border-[#27272a] ml-2">
              {section.links.map((link, j) => (
                <NavLink
                  key={j}
                  to={link.path}
                  end={link.path === "/docs"}
                  className={({ isActive }) => `
                    flex items-center text-sm py-1.5 pl-4 -ml-[1px] border-l transition-colors
                    ${isActive 
                      ? 'text-blue-400 border-blue-500 font-medium' 
                      : 'text-zinc-400 border-transparent hover:text-white hover:border-zinc-500'
                    }
                  `}
                >
                  {link.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
