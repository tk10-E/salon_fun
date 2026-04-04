type PublicSupabaseEnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

const publicSupabaseEnv: Record<PublicSupabaseEnvName, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

function requireEnv(
  names: readonly [PublicSupabaseEnvName, ...PublicSupabaseEnvName[]],
) {
  for (const name of names) {
    const value = publicSupabaseEnv[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}.`);
}

const supabaseUrl = requireEnv(["NEXT_PUBLIC_SUPABASE_URL"]);
const supabaseAnonKey = requireEnv([
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]);

export { supabaseAnonKey, supabaseUrl };
