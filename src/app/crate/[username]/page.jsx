import { supabase } from "@/lib/supabase";
import PublicCrate from "./PublicCrate";
import { notFound } from "next/navigation";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `${username}'s Crate — CrateMate`,
    description: `Browse ${username}'s vinyl collection on CrateMate`,
  };
}

export default async function PublicCratePage({ params }) {
  const { username } = await params;

  // Look up user_id from discogs_tokens
  const { data: tokenRow } = await supabase
    .from("discogs_tokens")
    .select("user_id")
    .eq("discogs_username", username)
    .single();

  if (!tokenRow) notFound();

  const { data: records } = await supabase
    .from("records")
    .select("id, title, artist, genre, year_original, year_pressed, thumb, discogs_id, for_sale")
    .eq("user_id", tokenRow.user_id)
    .eq("for_sale", false)
    .order("created_at", { ascending: true });

  const allRecords = records || [];

  // Genre sort: biggest cluster first, year within
  const genreCounts = {};
  allRecords.forEach((r) => {
    genreCounts[r.genre || "zzz"] = (genreCounts[r.genre || "zzz"] || 0) + 1;
  });
  const sorted = [...allRecords].sort((a, b) => {
    const ga = a.genre || "zzz";
    const gb = b.genre || "zzz";
    if (ga !== gb) {
      const countDiff = (genreCounts[gb] || 0) - (genreCounts[ga] || 0);
      return countDiff !== 0 ? countDiff : ga.localeCompare(gb);
    }
    return (a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999);
  });

  return <PublicCrate records={sorted} username={username} />;
}
