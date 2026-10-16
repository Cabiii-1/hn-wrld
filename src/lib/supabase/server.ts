import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "../backend/security";

export function backendConfigured() {
  return [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "APP_ORIGIN",
    "INVITE_TOKEN_PEPPER",
  ].every((k) => !!process.env[k]);
}
export function backendEnv() {
  const result = z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
      SUPABASE_SECRET_KEY: z.string().min(1),
      APP_ORIGIN: z.url().transform((v) => new URL(v).origin),
      INVITE_TOKEN_PEPPER: z.string().min(32),
      UPLOAD_PHOTO_MAX_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .max(5242880)
        .default(5242880),
      UPLOAD_AUDIO_MAX_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .max(15728640)
        .default(15728640),
      UPLOAD_AUDIO_MAX_SECONDS: z.coerce
        .number()
        .positive()
        .max(90)
        .default(90),
    })
    .safeParse(process.env);
  if (!result.success)
    throw new HttpError(503, "The contribution service is not configured yet.");
  return result.data;
}
const auth = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
// Isolated elevated client; callers must authorize before querying private data.
export function serviceClient() {
  const env = backendEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth });
}
export function userClient(token?: string) {
  const env = backendEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth,
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
}
