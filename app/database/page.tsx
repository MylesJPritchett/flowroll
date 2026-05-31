import { auth } from "@/auth";
import DatabaseView from "../components/DatabaseView";

export default async function DatabasePage() {
  const session = await auth();
  const userId = session?.user?.email ?? "";

  return (
    <div className="flex h-full flex-1 flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h1 className="text-lg font-bold text-zinc-50">Database</h1>
        <a href="/" className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors">
          Back to Graph
        </a>
      </header>
      <div className="flex-1 overflow-y-auto">
        <DatabaseView mode="database" userId={userId} />
      </div>
    </div>
  );
}
