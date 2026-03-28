import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function normalizeMood(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mood } = await request.json();
  if (!mood?.trim()) return NextResponse.json({ error: "No mood provided" }, { status: 400 });

  const key = normalizeMood(mood);

  // Check cache first
  const { data: cached } = await supabase
    .from("mood_profile_cache")
    .select("valence, energy, danceability, acousticness")
    .eq("mood_text", key)
    .single();

  if (cached) return NextResponse.json(cached);

  // Cache miss — ask Claude to interpret the mood as a sound profile
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    system: "You translate mood descriptions into music audio feature scores. Return only valid JSON with four keys, all values between 0 and 1.",
    messages: [{
      role: "user",
      content: `Mood: "${key}"\n\nReturn JSON: {"valence": 0-1, "energy": 0-1, "danceability": 0-1, "acousticness": 0-1}\n\nvalence = positivity/happiness. energy = intensity/tempo. danceability = groove/rhythm. acousticness = acoustic vs electronic.`,
    }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const stripped = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  let profile: { valence: number; energy: number; danceability: number; acousticness: number } | null = null;
  try {
    profile = JSON.parse(stripped);
  } catch {
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) profile = JSON.parse(m[0]);
  }

  if (!profile) return NextResponse.json({ error: "Could not parse mood profile" }, { status: 500 });

  // Store in cache for future users
  await supabase.from("mood_profile_cache").upsert({
    mood_text: key,
    valence: profile.valence,
    energy: profile.energy,
    danceability: profile.danceability,
    acousticness: profile.acousticness,
  });

  return NextResponse.json(profile);
}
