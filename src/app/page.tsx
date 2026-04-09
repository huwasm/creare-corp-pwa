import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0f1117] text-white">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">
          Creare<span className="text-[#c9a44a]">Corp</span>
        </h1>
        <p className="text-gray-400 text-lg">Commodity Signal Intelligence</p>
        <Link
          href="/charts"
          className="inline-block rounded-xl bg-[#c9a44a] px-8 py-3 text-sm font-semibold text-[#0f1117] transition-colors hover:bg-[#d4b45a]"
        >
          Open Dashboard →
        </Link>
      </div>
    </main>
  );
}
