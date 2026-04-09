import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // Test connection — "table not found" means Supabase IS reachable
  const { error } = await supabase.from("_test_ping").select("*").limit(1);
  const connected =
    !error ||
    error.message?.includes("could not find") ||
    error.code === "PGRST116" ||
    error.code === "42P01";

  return (
    <main className="min-h-screen bg-[#0f1117] text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Creare Corp</h1>
        <p className="text-gray-400">Commodity Signal Intelligence</p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <span
            className={`w-3 h-3 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-500">
            Supabase: {connected ? "Connected" : "Failed"}
          </span>
        </div>
        {error && !connected && (
          <p className="text-xs text-red-400 mt-2">{error.message}</p>
        )}
      </div>
    </main>
  );
}
