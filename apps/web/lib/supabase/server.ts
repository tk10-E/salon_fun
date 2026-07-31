import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

type SupabaseCookieStore = {
  getAll(): Array<{ name: string; value: string }>;
  set(options: { name: string; value: string } & CookieOptions): void;
};

export function createClient() {
  const cookieStore = cookies() as unknown as SupabaseCookieStore;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string } & CookieOptions>,
      ) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie);
          }
        } catch {
          // Cookie writes are ignored when called from Server Components.
        }
      },
    },
  });
}
