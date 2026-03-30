import { supabase } from "@/lib/supabase";
import PublicCrate from "./PublicCrate";
import { notFound } from "next/navigation";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { username } = await params;

  // Grab a representative cover image for og:image
  const { data: topRecord } = await supabase
    .from("records")
    .select("thumb")
    .eq("user_id", (
      await supabase.from("user_profiles").select("user_id").eq("display_name", username).limit(1)
    ).data?.[0]?.user_id || "")
    .eq("for_sale", false)
    .not("thumb", "is", null)
    .limit(1)
    .single();

  const ogImage = topRecord?.thumb || null;
  const title = `${username}'s Crate — CrateMate`;
  const description = `Browse ${username}'s vinyl collection on CrateMate`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function PublicCratePage({ params }) {
  const { username } = await params;

  // Look up user_id from user_profiles by display_name
  const { data: profileRows } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("display_name", username)
    .limit(1);

  const tokenRow = profileRows?.[0];
  if (!tokenRow) notFound();

  const { data: records } = await supabase
    .from("records")
    .select("id, title, artist, genre, year_original, year_pressed, thumb, discogs_id, for_sale")
    .eq("user_id", tokenRow.user_id)
    .eq("for_sale", false)
    .order("created_at", { ascending: true })
    .limit(10000);

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
