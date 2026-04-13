import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

type SupabaseCookieStore = {
  get(name: string): { value: string } | undefined;
  set(options: { name: string; value: string } & CookieOptions): void;
};

export function createClient() {
  const cookieStore = cookies() as unknown as SupabaseCookieStore;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Cookie writes are ignored when called from Server Components.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // Cookie writes are ignored when called from Server Components.
        }
      },
    },
  });
}
