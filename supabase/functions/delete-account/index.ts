// Deletes the calling user's own account (and, via the FK "on delete cascade" in
// schema.sql, their profile row and every logged session).
//
// This has to run server-side: deleting a user requires the service_role key,
// which must never ship inside the app. The app calls this via
// supabase.functions.invoke("delete-account"), which automatically attaches the
// caller's own access token — this function trusts THAT token to know who to
// delete, and never accepts a user id from the request body.
//
// Deploy (from the project root, once the Supabase CLI is installed and linked):
//   npx supabase login
//   npx supabase link --project-ref <your-project-ref>
//   npx supabase functions deploy delete-account

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    // Client bound to the caller's own token, only to find out who they are.
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401 });
    }

    // Admin client, only to perform the delete — never exposed to the caller.
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: delErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
