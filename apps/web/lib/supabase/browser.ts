import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

type BrowserSupabaseClient = SupabaseClient<Database>;

let browserClient: BrowserSupabaseClient | null = null;

export function createClient(): BrowserSupabaseClient {
  if (typeof window !== "undefined") {
    browserClient ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
    return browserClient;
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
