export function Footer() {
  return (
    <footer className="border-t border-[#2a2d3a] bg-[#0f1117] px-5 py-4">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500">
            Creare<span className="text-[#c9a44a]">Corp</span>
          </span>
          <span className="text-xs text-gray-700">
            Commodity Signal Intelligence
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>LME Metals</span>
          <span className="text-gray-700">·</span>
          <span>USD/mt</span>
          <span className="text-gray-700">·</span>
          <span>Powered by Claude AI</span>
        </div>
      </div>
    </footer>
  );
}
