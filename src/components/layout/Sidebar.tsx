"use client";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
};

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "◆" },
  { key: "charts", label: "Charts", icon: "📈" },
  { key: "events", label: "Events", icon: "📰" },
  { key: "signals", label: "Signals", icon: "⚡", disabled: true },
];

export function Sidebar({
  collapsed,
  onToggle,
  activeView,
  onViewChange,
}: SidebarProps) {
  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[#2a2d3a] bg-[#0f1117] transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-[#2a2d3a] px-3">
        {collapsed ? (
          <span className="text-lg font-bold text-[#c9a44a]">C</span>
        ) : (
          <span className="text-sm font-bold text-white">
            Creare<span className="text-[#c9a44a]">Corp</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => !item.disabled && onViewChange(item.key)}
              disabled={item.disabled}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                collapsed ? "justify-center px-0" : ""
              } ${
                isActive
                  ? "bg-gradient-to-r from-[#c9a44a]/15 to-[#c9a44a]/5 text-[#c9a44a]"
                  : item.disabled
                    ? "cursor-not-allowed text-gray-700"
                    : "text-gray-500 hover:bg-[#1a1d28] hover:text-gray-300"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="text-xs font-medium">{item.label}</span>
                  {item.disabled && (
                    <span className="ml-auto rounded bg-[#252838] px-1.5 py-0.5 text-[9px] text-gray-600">
                      Soon
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center border-t border-[#2a2d3a] py-3 text-gray-600 transition-colors hover:text-gray-400"
      >
        <span className="text-sm">{collapsed ? "▷" : "◁"}</span>
        {!collapsed && (
          <span className="ml-2 text-xs text-gray-600">Collapse</span>
        )}
      </button>
    </aside>
  );
}
