// Privileged user-management actions (list all users, create, delete).
// Runs with the service_role key, which must never be shipped to a static
// page. Every request is re-checked against ADMIN_EMAIL here, independent of
// anything the client claims, since the caller is an untrusted browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_EMAIL = "steve.baird@royalmint.com";
const PROJECT_KEYS = ["roadmap-db", "schedule-a-db-v2", "implementation-forum", "intake"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, "")
    .slice(0, 16);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header" }, 401);

  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);
  if ((callerData.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "Not authorized" }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // no/invalid body — treated as {}
  }
  const action = body.action;

  try {
    if (action === "list") {
      const users: any[] = [];
      let page = 1;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 200) break;
        page++;
      }

      const { data: accessRows, error: accessError } = await admin
        .from("project_access")
        .select("user_id, project_key, role");
      if (accessError) throw accessError;

      const accessByUser: Record<string, Record<string, string>> = {};
      (accessRows || []).forEach((row: any) => {
        (accessByUser[row.user_id] ||= {})[row.project_key] = row.role;
      });

      const result = users
        .map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          access: accessByUser[u.id] || {},
        }))
        .sort((a, b) => (a.email || "").localeCompare(b.email || ""));

      return json({ users: result, projectKeys: PROJECT_KEYS });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json({ error: "Email required" }, 400);

      const chosenPassword = String(body.password || "");
      if (chosenPassword && chosenPassword.length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }
      const password = chosenPassword || randomPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;

      return json({ user: { id: data.user!.id, email: data.user!.email }, password });
    }

    if (action === "reset-password") {
      const userId = String(body.userId || "");
      if (!userId) return json({ error: "userId required" }, 400);

      const password = randomPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;

      return json({ password });
    }

    if (action === "delete") {
      const userId = String(body.userId || "");
      if (!userId) return json({ error: "userId required" }, 400);
      if (userId === callerData.user.id) {
        return json({ error: "You cannot delete your own account" }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : (err && typeof err === "object" && "message" in err)
        ? String((err as { message: unknown }).message)
        : String(err);
    return json({ error: message }, 500);
  }
});
