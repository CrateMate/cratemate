import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ArtistPage from "./ArtistPage";

const DISCOGS_KEY = process.env.DISCOGS_CONSUMER_KEY;
const DISCOGS_SECRET = process.env.DISCOGS_CONSUMER_SECRET;

function discogsHeaders() {
  if (DISCOGS_KEY && DISCOGS_SECRET) {
    return {
      Authorization: `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`,
      "User-Agent": "CrateMate/1.0",
    };
  }
  return { "User-Agent": "CrateMate/1.0" };
}

function categorize(releases) {
  const studioAlbums = [];
  const epsSingles = [];
  const live = [];

  for (const r of releases) {
    if (r.type !== "master") continue;
    const fmt = (r.format || "") + " " + (r.role || "");
    if (/acetate|unofficial|video/i.test(fmt)) continue;
    if (/live/i.test(fmt)) { live.push(r); continue; }
    if (/ep|single/i.test(fmt)) { epsSingles.push(r); continue; }
    if (/compilation|dj.?mix/i.test(fmt)) continue;
    studioAlbums.push(r);
  }

  return { studioAlbums, epsSingles, live };
}

export default async function Page({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // `id` here is the Discogs *release* ID (from record.discogs_id)
  const { id: releaseId } = await params;

  // Step 1: fetch the release to get the artist's Discogs ID
  const releaseRes = await fetch(
    `https://api.discogs.com/releases/${releaseId}`,
    { headers: discogsHeaders(), next: { revalidate: 3600 } }
  );

  if (!releaseRes.ok) {
    return <ArtistPage artist={null} studioAlbums={[]} epsSingles={[]} live={[]} />;
  }

  const release = await releaseRes.json();
  const artistId = release.artists?.[0]?.id;

  if (!artistId) {
    return <ArtistPage artist={null} studioAlbums={[]} epsSingles={[]} live={[]} />;
  }

  // Step 2: fetch artist info + full discography in parallel
  const [artistRes, releasesRes] = await Promise.all([
    fetch(`https://api.discogs.com/artists/${artistId}`, { headers: discogsHeaders(), next: { revalidate: 3600 } }),
    fetch(`https://api.discogs.com/artists/${artistId}/releases?per_page=100&sort=year`, { headers: discogsHeaders(), next: { revalidate: 3600 } }),
  ]);

  let artist = null;
  let releases = [];

  if (artistRes.ok) artist = await artistRes.json();
  if (releasesRes.ok) {
    const data = await releasesRes.json();
    releases = data.releases || [];
  }

  const { studioAlbums, epsSingles, live } = categorize(releases);

  return (
    <ArtistPage
      artist={artist}
      studioAlbums={studioAlbums}
      epsSingles={epsSingles}
      live={live}
    />
  );
}
