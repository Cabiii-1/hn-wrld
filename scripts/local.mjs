import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);
function command(executable, args) {
  return spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
}
function fail(message) {
  console.error(message);
  process.exit(1);
}
function status() {
  const result = command(process.execPath, [cli, "status", "--output", "json"]);
  if (result.status !== 0)
    fail(
      "Local Supabase is not running. Start Docker Desktop, then run npm run db:setup.",
    );
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("Supabase status was not valid JSON. No credentials were printed.");
  }
}
if (process.argv[2] === "status") {
  const local = status();
  console.log(
    `API: ${local.API_URL}\nStudio: ${local.STUDIO_URL}\nCredentials stay in ignored .env.local.`,
  );
} else {
  const docker = command("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (docker.error || docker.status !== 0)
    fail(
      "Docker Desktop is required and must be running. Install/start Docker, then run npm run db:setup again. No environment file was written.",
    );
  console.log(
    "Starting local Supabase. The first start downloads Docker images; this may take a few minutes.",
  );
  const started = command(process.execPath, [cli, "start"]);
  // Suppress CLI status output because it contains keys. Report only safe URLs.
  if (started.status !== 0)
    fail(
      "Supabase did not start. Check Docker Desktop and port availability; no environment file was written.",
    );
  const migrated = command(process.execPath, [
    cli,
    "migration",
    "up",
    "--local",
  ]);
  if (migrated.status !== 0)
    fail(
      "Local migrations did not finish. Inspect with npx supabase migration up --local. Existing data and environment files were preserved.",
    );
  const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (existsSync(envPath)) {
    console.log(
      "Existing .env.local preserved. Run npm run db:status for local service URLs.",
    );
    process.exit(0);
  }
  const local = status();
  if (!local.API_URL || !local.ANON_KEY || !local.SERVICE_ROLE_KEY)
    fail(
      "Local Supabase credentials are incomplete. No environment file was written.",
    );
  writeFileSync(
    envPath,
    [
      "# Local development only. Git ignores this file.",
      `SUPABASE_URL=${local.API_URL}`,
      `SUPABASE_PUBLISHABLE_KEY=${local.ANON_KEY}`,
      `SUPABASE_SECRET_KEY=${local.SERVICE_ROLE_KEY}`,
      "APP_ORIGIN=http://localhost:3000",
      `INVITE_TOKEN_PEPPER=${randomBytes(32).toString("base64url")}`,
      `CRON_SECRET=${randomBytes(32).toString("base64url")}`,
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    `Local Supabase is ready. Studio: ${local.STUDIO_URL}\nCredentials were written only to ignored .env.local.\nCreate a test admin in local Studio, add its UUID to admin_members, then restart npm run dev.`,
  );
}
