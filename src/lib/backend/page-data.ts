import "server-only";
import { backendConfigured, backendEnv } from "../supabase/server";
import { handleBackend } from "./http";

type PageRead =
  | "admin/dashboard"
  | "contributor"
  | "recipient/session"
  | "recipient/scenes/sta_ana_house"
  | "recipient/ending/status";

// Reuse the API's authorization and projections inside the current server
// request, without a browser -> API round trip or a cross-user response cache.
export async function readPageData<T>(path: PageRead): Promise<{
  data: T | null;
  status: number;
  error: string;
}> {
  if (!backendConfigured())
    return {
      data: null,
      status: 503,
      error: "The service is not configured yet.",
    };
  try {
    const response = await handleBackend(
      new Request(`${backendEnv().APP_ORIGIN}/api/manage/${path}`),
      path.split("/"),
    );
    const value = await response.json();
    return response.ok
      ? { data: value as T, status: response.status, error: "" }
      : {
          data: null,
          status: response.status,
          error: value.error ?? "Please try again.",
        };
  } catch {
    return {
      data: null,
      status: 503,
      error: "This page couldn’t load. Please try again.",
    };
  }
}
