import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ArtistPage from "./ArtistPage";

export default async function Page({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { id: releaseId } = await params;
  return <ArtistPage releaseId={releaseId} />;
}
