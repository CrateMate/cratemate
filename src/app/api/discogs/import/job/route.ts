import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DISCOGS_API, discogsRequest } from "@/lib/discogs";
import { createImportJob, runImportJobPage } from "@/lib/discogs/import-job";

export async function POST(_request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tokenData } = await supabase
    .from("discogs_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return NextResponse.json({ error: "Discogs not connected" }, { status: 400 });

  const { access_token, access_token_secret } = tokenData;
  let { discogs_username } = tokenData;

  if (!discogs_username) {
    const identityRes = await discogsRequest("GET", `${DISCOGS_API}/oauth/identity`, {
      tokenKey: access_token,
      tokenSecret: access_token_secret,
    });
    if (!identityRes.ok) {
      return NextResponse.json({ error: "Discogs connection is stale. Re-link Discogs." }, { status: 400 });
    }
    const identity = await identityRes.json();
    discogs_username = identity?.username || null;
    if (!discogs_username) {
      return NextResponse.json({ error: "Could not determine Discogs username. Re-link Discogs." }, { status: 400 });
    }
    await supabase.from("discogs_tokens").update({ discogs_username }).eq("user_id", userId);
  }

  // Resolve the user's actual Media/Sleeve condition field IDs
  let mediaFieldId = 1;
  let sleeveFieldId = 2;
  try {
    const fieldsRes = await discogsRequest(
      "GET",
      `${DISCOGS_API}/users/${encodeURIComponent(discogs_username)}/collection/fields`,
      { tokenKey: access_token, tokenSecret: access_token_secret }
    );
    if (fieldsRes.ok) {
      const fieldsData = await fieldsRes.json();
      for (const f of Array.isArray(fieldsData?.fields) ? fieldsData.fields : []) {
        const name = (f.name || "").toLowerCase();
        if (name.includes("media")) mediaFieldId = Number(f.id) || mediaFieldId;
        else if (name.includes("sleeve") || name.includes("cover")) sleeveFieldId = Number(f.id) || sleeveFieldId;
      }
    }
  } catch { /* fall back to defaults */ }

  try {
    const job = await createImportJob({ userId, discogsUsername: discogs_username, mediaFieldId, sleeveFieldId });

    // Run the first page synchronously so the client gets real data immediately.
    const updated = await runImportJobPage(job.id, userId);
    return NextResponse.json(updated, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
