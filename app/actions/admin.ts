"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";

export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("admins")
    .select("email")
    .eq("email", session.user.email)
    .single();
  return !!data;
}
