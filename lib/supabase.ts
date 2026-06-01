import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

export function createSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}
