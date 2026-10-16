import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Reserved for authenticated server workflows in M2. Never imported by the game.
export function createSupabaseServerClient() {
  const env = z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    })
    .parse(process.env);
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
