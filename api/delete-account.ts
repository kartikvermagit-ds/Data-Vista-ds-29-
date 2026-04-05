import { createClient } from "@supabase/supabase-js";

type DeleteRequest = {
  accessToken?: string;
};

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: "Server auth configuration is missing." });
    return;
  }

  let body: DeleteRequest = {};

  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}) as DeleteRequest;
  } catch {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  const accessToken = body.accessToken?.trim();

  if (!accessToken) {
    res.status(400).json({ error: "Missing access token." });
    return;
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(accessToken);

  if (userError || !user) {
    res.status(401).json({ error: "Invalid session." });
    return;
  }

  const { error: stateDeleteError } = await adminClient.from("teacher_states").delete().eq("owner_id", user.id);

  if (stateDeleteError) {
    res.status(500).json({ error: stateDeleteError.message });
    return;
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    res.status(500).json({ error: deleteError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
