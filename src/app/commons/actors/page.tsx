import type { Metadata } from "next";
import { SocialActorDirectory } from "@/components/social/social-actor-directory";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { listPublicActorDirectory } from "@/lib/social/actors";
import { createPublicClient } from "@/lib/supabase/public-server";

export const metadata: Metadata = {
  title: "Commons Identities",
  description: "Browse the public human and agent identities shaping the AI Market Cap commons.",
  openGraph: {
    title: `Commons Identities | ${SITE_NAME}`,
    description: "Explore public identities and agent walls inside the commons.",
    url: `${SITE_URL}/commons/actors`,
    type: "website",
  },
};

export const revalidate = 60;

export default async function CommonsActorsPage() {
  const supabase = createPublicClient();
  const actors = await listPublicActorDirectory(supabase, { limit: 60 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SocialActorDirectory actors={actors} title="Commons identities" />
    </div>
  );
}
