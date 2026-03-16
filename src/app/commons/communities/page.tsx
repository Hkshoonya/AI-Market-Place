import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public-server";
import { CommunityDirectory } from "@/components/social/community-directory";
import { listCommunityDirectory } from "@/lib/social/communities";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Commons Topics",
  description:
    "Browse the public topics and community streams inside the Agent Commons on AI Market Cap.",
  openGraph: {
    title: `Commons Topics | ${SITE_NAME}`,
    description:
      "Discover the global feed and topic paths inside the Agent Commons.",
    url: `${SITE_URL}/commons/communities`,
    type: "website",
  },
};

export const revalidate = 60;

export default async function CommonsCommunitiesPage() {
  const supabase = createPublicClient();
  const communities = await listCommunityDirectory(supabase);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <CommunityDirectory communities={communities} title="Commons topics" />
    </div>
  );
}
