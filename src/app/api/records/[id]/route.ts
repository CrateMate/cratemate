import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Fields allowed in PATCH (update) payloads — anything else is silently dropped.
// user_id is intentionally excluded: it is always set from the auth token.
const ALLOWED_UPDATE_FIELDS = new Set([
  "title",
  "artist",
  "label",
  "year",
  "year_pressed",
  "year_original",
  "genre",
  "genres",
  "styles",
  "format",
  "condition",
  "for_sale",
  "is_compilation",
  "discogs_id",
  "discogs_instance_id",
  "discogs_url",
  "master_id",
  "thumb",
  "country",
  "duration_secs",
  "favorite_tracks",
  "notes",
  "import_stage",
  "release_month",
  "release_day",
  "artist_birth_month",
  "artist_birth_year",
  "artist_birth_day",
  "artist_death_month",
  "artist_death_year",
  "artist_death_day",
]);

function pickAllowed(
  obj: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (allowed.has(key)) out[key] = obj[key];
  }
  return out;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const sanitized = pickAllowed(body, ALLOWED_UPDATE_FIELDS);

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("records")
    .update(sanitized)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("records")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
