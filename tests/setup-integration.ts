/**
 * Integration test setup.
 *
 * Points the Supabase client at the local instance (supabase start)
 * and stubs out NextAuth so server actions think a user is logged in.
 *
 * Usage: import this file's `setup` / `cleanup` in your tests, or
 * simply import individual helpers you need.
 */
import { vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// --- Local Supabase credentials (from `supabase status`) ---
// These are the well-known defaults for every local Supabase project.

const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const TEST_USER = "integration-test@flowroll.test";

// Set env vars so `createSupabaseServer()` connects to local instance
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_KEY;

// Stub NextAuth — all server actions call `auth()` to get the user session
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: TEST_USER },
  }),
}));

// --- Direct Supabase client for test assertions / cleanup ---

export function getTestClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Delete all rows created by the test user across user-scoped tables.
 * Call this in afterEach / afterAll to keep tests isolated.
 */
export async function cleanupTestUser(supabase?: SupabaseClient) {
  const db = supabase ?? getTestClient();

  // Order matters: edges reference nodes, nodes reference graphs
  await db.from("graph_edges").delete().eq("user_id", TEST_USER);
  await db.from("graph_nodes").delete().eq("user_id", TEST_USER);
  await db.from("graphs").delete().eq("user_id", TEST_USER);

  // Taxonomy items created by test user (not official)
  await db.from("states").delete().eq("created_by", TEST_USER);
  await db.from("position_conditions").delete().in(
    "position_id",
    (await db.from("positions").select("id").eq("created_by", TEST_USER)).data?.map((r) => r.id) ?? [],
  );
  await db.from("position_requirements").delete().in(
    "position_id",
    (await db.from("positions").select("id").eq("created_by", TEST_USER)).data?.map((r) => r.id) ?? [],
  );
  await db.from("actions").delete().eq("created_by", TEST_USER);
  // Options before groups (FK)
  await db.from("condition_options").delete().eq("created_by", TEST_USER);
  await db.from("condition_groups").delete().eq("created_by", TEST_USER);
  await db.from("positions").delete().eq("created_by", TEST_USER);
}
