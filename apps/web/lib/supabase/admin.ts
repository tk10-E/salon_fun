import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "@/lib/env";
import { getSupabaseServiceRoleKey } from "@/lib/serverEnv";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
